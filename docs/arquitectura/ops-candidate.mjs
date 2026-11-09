// OPS-05: package a local, provisional source candidate without data operations.
// Reuses the existing source collector/verifier; does not change deployment files.
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectFiles, projectRoot, sourceHash, verifySnapshot } from '../../deployment/release.mjs';

const protectedPaths = ['deployment/prod-ca-2021.crt', 'deployment/supabase-schema-tlfdwmaofwpwlcgrhfps.png'];
const deploymentFiles = new Set([
  'deployment/.gitignore', 'deployment/release.mjs', 'deployment/build-local.mjs',
  'deployment/build-linux.mjs', 'deployment/render.yaml', 'deployment/render-free.yaml',
  'deployment/render-qa.yaml', 'deployment/smoke.mjs', 'deployment/validate-blueprint.mjs',
  'deployment/tests/preparation.test.mjs', 'deployment/tests/linux-guard.test.mjs',
]);
const handoffs = ['docs/backend/OPS_01_ENTREGA.md', 'docs/frontend/OPS_02_ENTREGA.md',
  'docs/base-de-datos/OPS_03_ENTREGA.md', 'docs/diseno/OPS_04_ENTREGA.md'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export function includeCandidateFile(file) {
  return !file.startsWith('deployment/') || deploymentFiles.has(file);
}
async function protectedInventory() {
  return Promise.all(protectedPaths.map(async file => ({ path: file,
    sha256: sha(await readFile(path.join(projectRoot, file))), excludedFromSource: true })));
}
async function collect() { return (await collectFiles(projectRoot)).filter(file => includeCandidateFile(file.path)); }

async function main() {
  if (process.argv.length !== 3 || process.argv[2] !== 'snapshot') throw new Error('Usage: node docs/arquitectura/ops-candidate.mjs snapshot');
  const protectedBefore = await protectedInventory();
  const files = await collect();
  const hash = sourceHash(files), version = `ops05-${hash.slice(0, 16)}`;
  const parent = path.join(projectRoot, 'deployment', 'releases');
  await mkdir(parent, { recursive: true });
  const directory = path.join(parent, `${version}-${Date.now()}-${randomUUID().slice(0, 8)}`);
  await mkdir(directory);
  for (const file of files) {
    const target = path.join(directory, 'source', file.path);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(projectRoot, file.path), target);
  }
  if (sourceHash(await collect()) !== hash) throw new Error('Sources changed during capture; candidate is incomplete');
  const protectedAfter = await protectedInventory();
  if (JSON.stringify(protectedBefore) !== JSON.stringify(protectedAfter)) throw new Error('Protected assets changed during capture');
  const evidence = [];
  for (const file of handoffs) {
    try { evidence.push({ path: file, sha256: sha(await readFile(path.join(projectRoot, file))), status: 'REQUIRES_REVIEW_AND_SOURCE_BINDING' }); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      evidence.push({ path: file, status: 'NOT_PUBLISHED' });
    }
  }
  const migrations = files.filter(file => /^backend\/prisma\/postgresql\/migrations\/[^/]+\/migration\.sql$/.test(file.path))
    .map(file => ({ name: file.path.split('/').at(-2), sha256: file.sha256, targetApplied: 'NOT_CHECKED' }));
  const manifest = { format: 'odontho-source-v1', createdAt: new Date().toISOString(), version,
    gitHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: projectRoot, encoding: 'utf8' }).trim(),
    sourceSha256: hash, node: process.version,
    scope: 'OPS local: service attention then Reception billing; Dentalink synthetic preparation only',
    status: 'PROVISIONAL_PENDING_AREA_ACCEPTANCE_AND_TARGET_OPERATION',
    generator: { path: 'docs/arquitectura/ops-candidate.mjs', sha256: sha(await readFile(fileURLToPath(import.meta.url))) },
    protectedAssets: protectedAfter, migrations, areaEvidence: evidence,
    deployedByThisTask: false, databaseOperationsExecuted: false, dentalinkConnected: false, files };
  await writeFile(path.join(directory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
  const verified = await verifySnapshot(directory);
  console.log(JSON.stringify({ directory, ...verified, migrations: migrations.map(item => item.name),
    status: manifest.status, protectedAssetsPreserved: true, protectedAssetsExcluded: true,
    missingAreaHandoffs: evidence.filter(item => item.status === 'NOT_PUBLISHED').map(item => item.path) }, null, 2));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => { console.error('OPS candidate not completed; no deployment, database or protected asset mutation attempted.'); process.exitCode = 1; });
}
