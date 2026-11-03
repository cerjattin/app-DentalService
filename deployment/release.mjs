// Source snapshot only. Never connects to a database, publishes, or runs migrations.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFile, lstat, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const trees = ['backend/src', 'backend/assets', 'backend/prisma/postgresql/migrations', 'frontend/src', 'frontend/public', 'deployment'];
const singles = ['backend/package.json', 'backend/package-lock.json', 'backend/tsconfig.json',
  'backend/prisma.config.ts', 'backend/prisma/schema.prisma', 'backend/prisma/seed.ts', 'frontend/package.json',
  'frontend/package-lock.json', 'frontend/index.html', 'frontend/vite.config.ts',
  'frontend/tsconfig.json', 'frontend/tsconfig.app.json', 'frontend/tsconfig.node.json',
  'frontend/eslint.config.js'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const ignored = part => ['node_modules', '.git', 'releases', 'evidence', 'storage', 'dist'].includes(part)
  || /^\.env(?:\.|$)/.test(part) || /\.local\./.test(part);

export async function collectFiles(root) {
  const files = [];
  async function visit(relative, optional = false) {
    const absolute = path.join(root, relative);
    let info;
    try { info = await lstat(absolute); } catch (error) {
      if (optional && error.code === 'ENOENT') return;
      throw new Error(`Missing source path: ${relative}`);
    }
    if (info.isSymbolicLink()) throw new Error(`Source links are not allowed: ${relative}`);
    if (relative.split(/[\\/]/).some(ignored)) return;
    if (info.isDirectory()) {
      for (const name of (await readdir(absolute)).sort()) await visit(`${relative}/${name}`);
    } else if (info.isFile()) {
      files.push({ path: relative.replaceAll('\\', '/'), bytes: info.size, sha256: sha(await readFile(absolute)) });
    } else throw new Error(`Unsupported source entry: ${relative}`);
  }
  for (const item of trees) await visit(item, item === 'frontend/public');
  for (const item of singles) await visit(item);
  return files.sort((a, b) => a.path.localeCompare(b.path, 'en'));
}

export function sourceHash(files) { return sha(JSON.stringify(files)); }
export async function verifySnapshot(directory) {
  const manifest = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'));
  if (!Array.isArray(manifest.files) || sourceHash(manifest.files) !== manifest.sourceSha256) throw new Error('Invalid manifest hash');
  const seen = new Set();
  const sourceRoot = await realpath(path.join(directory, 'source'));
  for (const file of manifest.files) {
    if (typeof file.path !== 'string' || file.path.includes('\\') || file.path.split('/').some(x => !x || x === '.' || x === '..' || ignored(x))
      || !/^(backend|frontend|deployment)\//.test(file.path) || seen.has(file.path)) throw new Error('Unsafe manifest path');
    seen.add(file.path);
    const target = path.join(directory, 'source', file.path);
    const resolved = await realpath(target);
    if (!resolved.startsWith(`${sourceRoot}${path.sep}`)) throw new Error('Snapshot path escapes source directory');
    const info = await lstat(target);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error('Invalid snapshot entry');
    const bytes = await readFile(path.join(directory, 'source', file.path));
    if (bytes.length !== file.bytes || sha(bytes) !== file.sha256) throw new Error(`Snapshot changed: ${file.path}`);
  }
  return { version: manifest.version, sourceSha256: manifest.sourceSha256, files: manifest.files.length };
}

async function main() {
  const [command, destination] = process.argv.slice(2);
  if (command === 'verify' && destination) { console.log(JSON.stringify(await verifySnapshot(path.resolve(destination)), null, 2)); return; }
  if (command !== 'snapshot' || destination) throw new Error('Usage: node deployment/release.mjs snapshot | verify RELEASE_DIRECTORY');
  const files = await collectFiles(projectRoot);
  const hash = sourceHash(files);
  const version = `dep12-${hash.slice(0, 16)}`;
  const directory = path.join(projectRoot, 'deployment', 'releases', `${version}-${Date.now()}`);
  await mkdir(directory, { recursive: true });
  for (const file of files) {
    const target = path.join(directory, 'source', file.path);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(projectRoot, file.path), target);
  }
  if (sourceHash(await collectFiles(projectRoot)) !== hash) throw new Error('Working tree changed during snapshot; do not use this incomplete candidate');
  const manifest = { format: 'odontho-source-v1', createdAt: new Date().toISOString(), version,
    gitHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: projectRoot, encoding: 'utf8' }).trim(),
    sourceSha256: hash, node: process.version, scope: 'Local QA preparation for clinical pilot; SVB presentation deferred',
    status: 'SOURCE_SNAPSHOT_ONLY_NOT_DEPLOYED', files };
  await writeFile(path.join(directory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify({ directory, ...await verifySnapshot(directory) }, null, 2));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => { console.error('Release preparation failed. Check paths/source stability; no deployment was attempted.'); process.exitCode = 1; });
}
