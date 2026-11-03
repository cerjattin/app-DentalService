// Compiles an isolated copy of a snapshot using already-installed local dependencies.
// This is not a Linux npm-ci test and never publishes or contacts a database.
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { copyFile, cp, mkdir, readFile, readdir, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { projectRoot, verifySnapshot } from './release.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function run(script, args, cwd, env) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], { cwd, env, stdio: 'inherit', windowsHide: true });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error('Compilation failed')));
  });
}
async function main() {
  const [argument, dependencyArgument] = process.argv.slice(2);
  if (!argument) throw new Error('Supply the snapshot directory');
  const directory = path.resolve(argument);
  const releases = path.join(projectRoot, 'deployment', 'releases');
  if (!directory.startsWith(`${releases}${path.sep}`)) throw new Error('Use a snapshot inside deployment/releases');
  const dependencyRoot = dependencyArgument ? path.resolve(dependencyArgument) : projectRoot;
  if (dependencyArgument && (!dependencyRoot.startsWith(`${releases}${path.sep}`) || !dependencyRoot.endsWith(`${path.sep}build`))) throw new Error('Dependency cache must be a prior isolated build');
  const verification = await verifySnapshot(directory);
  const manifest = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'));
  const buildRoot = path.join(directory, 'build');
  await mkdir(buildRoot); // Refuse a second build over an existing result.
  for (const file of manifest.files) {
    const target = path.join(buildRoot, file.path);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(directory, 'source', file.path), target);
  }
  for (const area of ['backend', 'frontend']) {
    const lock = `${area}/package-lock.json`;
    if (hash(await readFile(path.join(dependencyRoot, lock))) !== manifest.files.find(file => file.path === lock)?.sha256) throw new Error('Dependency lockfile differs from snapshot');
    const sourceModules = path.join(dependencyRoot, area, 'node_modules');
    const targetModules = path.join(buildRoot, area, 'node_modules');
    if (dependencyArgument) await symlink(sourceModules, targetModules, 'junction');
    else await cp(sourceModules, targetModules, { recursive: true, dereference: true, errorOnExist: true, force: false });
  }
  // Deliberately do not inherit database/storage secrets or dotenv overlays.
  const env = Object.fromEntries(['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'ComSpec', 'TEMP', 'TMP'].filter(key => process.env[key]).map(key => [key, process.env[key]]));
  Object.assign(env, { NODE_ENV: 'production', DATABASE_URL: 'postgresql://synthetic@127.0.0.1:9/dep12_build_test',
    CHECKPOINT_DISABLE: '1', PRISMA_HIDE_UPDATE_MESSAGE: '1' });
  const backend = path.join(buildRoot, 'backend');
  await run(path.join(backend, 'node_modules/prisma/build/index.js'), ['generate'], backend, env);
  await run(path.join(backend, 'node_modules/typescript/bin/tsc'), ['-p', 'tsconfig.json'], backend, env);
  const frontend = path.join(buildRoot, 'frontend');
  Object.assign(env, { VITE_API_BASE_URL: 'https://odontho-clinical-api.onrender.com/api/v1',
    VITE_APP_ENVIRONMENT: 'qa', VITE_APP_VERSION: verification.version });
  await run(path.join(frontend, 'node_modules/typescript/bin/tsc'), ['-b'], frontend, env);
  await run(path.join(frontend, 'node_modules/vite/bin/vite.js'), ['build'], frontend, env);
  const outputs = [];
  async function outputFiles(relative) {
    for (const entry of await readdir(path.join(buildRoot, relative), { withFileTypes: true })) {
      const name = `${relative}/${entry.name}`;
      if (entry.isDirectory()) await outputFiles(name);
      else if (entry.isFile()) {
        const bytes = await readFile(path.join(buildRoot, name));
        outputs.push({ path: name, bytes: bytes.length, sha256: hash(bytes) });
      }
    }
  }
  for (const relative of ['backend/dist', 'frontend/dist']) await outputFiles(relative);
  outputs.sort((a, b) => a.path.localeCompare(b.path, 'en'));
  const report = { ...verification, at: new Date().toISOString(), node: process.version, platform: process.platform,
    dependencyMode: dependencyArgument ? 'REUSED_PRIOR_ISOLATED_NODE_MODULES_NOT_NPM_CI' : 'REUSED_LOCAL_NODE_MODULES_NOT_NPM_CI', linuxValidated: false, deployed: false,
    outputsSha256: hash(JSON.stringify(outputs)), outputs };
  await writeFile(path.join(directory, 'build-report.json'), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  await verifySnapshot(directory);
  console.log(JSON.stringify({ version: report.version, outputsSha256: report.outputsSha256, files: outputs.length, deployed: false }, null, 2));
}
main().catch(() => { console.error('Isolated build failed; candidate is not approved. No deployment or data operation was attempted.'); process.exitCode = 1; });
