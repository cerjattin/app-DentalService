// Run only inside an approved Linux runner with a secret-free source snapshot.
// Installs locked packages and compiles; never starts the app or applies data.
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { verifySnapshot } from './release.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const host = { platform: process.platform, arch: process.arch, node: process.version,
  supported: process.platform === 'linux' && process.version === 'v24.22.1', linuxValidated: false };
async function run(args, cwd, env) {
  await new Promise((resolve, reject) => {
    const child = spawn('npm', args, { cwd, env, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error('Locked build command failed')));
  });
}
async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--check-host') {
    console.log(JSON.stringify(host, null, 2));
    if (!host.supported) process.exitCode = 2;
    return;
  }
  if (!host.supported) throw new Error('Use Linux and the pinned Node version; no packages installed');
  if (args.length !== 1) throw new Error('Usage: node deployment/build-linux.mjs RELEASE_DIRECTORY');
  const release = path.resolve(args[0]);
  const verified = await verifySnapshot(release);
  const manifest = JSON.parse(await readFile(path.join(release, 'manifest.json'), 'utf8'));
  const build = path.join(release, 'linux-build');
  await mkdir(build); // Never build over another attempt.
  for (const file of manifest.files) {
    const target = path.join(build, file.path);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(release, 'source', file.path), target);
  }
  const userConfig = path.join(build, 'empty-user.npmrc');
  const globalConfig = path.join(build, 'empty-global.npmrc');
  await writeFile(userConfig, '', { flag: 'wx' });
  await writeFile(globalConfig, '', { flag: 'wx' });
  // No inherited .env overlays, database/storage keys, npm tokens or proxy secrets.
  const env = { PATH: process.env.PATH, NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://synthetic@127.0.0.1:9/dep12_build_test',
    SVB_MANUAL_RECORDING_ENABLED: 'false', CHECKPOINT_DISABLE: '1', PRISMA_HIDE_UPDATE_MESSAGE: '1',
    npm_config_cache: path.join(build, '.npm-cache'), npm_config_userconfig: userConfig,
    npm_config_globalconfig: globalConfig, npm_config_registry: 'https://registry.npmjs.org' };
  for (const area of ['backend', 'frontend']) {
    await run(['ci', '--include=dev', '--no-audit', '--no-fund'], path.join(build, area), env);
  }
  const backend = path.join(build, 'backend');
  await run(['run', 'prisma:generate'], backend, env);
  await run(['run', 'build'], backend, env);
  Object.assign(env, { VITE_API_BASE_URL: 'https://odontho-clinical-api.onrender.com/api/v1',
    VITE_APP_ENVIRONMENT: 'qa', VITE_APP_VERSION: verified.version });
  await run(['run', 'build'], path.join(build, 'frontend'), env);
  const require = createRequire(path.join(backend, 'package.json'));
  const argon2 = require('argon2');
  const encoded = await argon2.hash('SYNTHETIC DEP12 LINUX CHECK');
  if (!await argon2.verify(encoded, 'SYNTHETIC DEP12 LINUX CHECK')) throw new Error('Native password check failed');
  const sharp = require('sharp');
  const png = await sharp({ create: { width: 2, height: 2, channels: 4, background: '#ffffff' } }).png().toBuffer();
  const metadata = await sharp(png).metadata();
  if (metadata.width !== 2 || metadata.height !== 2) throw new Error('Native image check failed');
  const PDFDocument = require('pdfkit');
  const pdf = await new Promise((resolve, reject) => {
    const doc = new PDFDocument(); const chunks = [];
    doc.on('data', chunk => chunks.push(chunk)); doc.once('error', reject);
    doc.once('end', () => resolve(Buffer.concat(chunks)));
    doc.font('Helvetica').text('Synthetic DEP12 Linux check').end();
  });
  if (pdf.subarray(0, 5).toString() !== '%PDF-') throw new Error('PDF assets check failed');
  const outputs = [];
  async function visit(relative) {
    for (const item of await readdir(path.join(build, relative), { withFileTypes: true })) {
      const name = `${relative}/${item.name}`;
      if (item.isDirectory()) await visit(name);
      else if (item.isFile()) {
        const bytes = await readFile(path.join(build, name));
        outputs.push({ path: name, bytes: bytes.length, sha256: sha(bytes) });
      }
    }
  }
  for (const area of ['backend/dist', 'frontend/dist']) await visit(area);
  outputs.sort((a, b) => a.path.localeCompare(b.path, 'en'));
  await verifySnapshot(release);
  const report = { ...verified, at: new Date().toISOString(), ...host, linuxValidated: true,
    scope: 'LOCKED_LINUX_BUILD_AND_NATIVE_COMPONENTS_ONLY', deployed: false, databaseConnected: false,
    nativeChecks: { argon2: true, sharp: true, pdfkit: true },
    outputsSha256: sha(JSON.stringify(outputs)), outputs };
  await writeFile(path.join(release, 'linux-build-report.json'), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify({ ...verified, linuxValidated: true, outputsSha256: report.outputsSha256, deployed: false }, null, 2));
}
main().catch(() => { console.error('Linux build not completed; no deployment or data operation was attempted.'); process.exitCode = 1; });
