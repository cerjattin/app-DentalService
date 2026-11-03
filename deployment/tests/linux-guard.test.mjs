import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../build-linux.mjs', import.meta.url));
test('Linux host inspection reports platform honestly without running an installation', () => {
  const result = spawnSync(process.execPath, [script, '--check-host'], { encoding: 'utf8', windowsHide: true });
  assert.ifError(result.error);
  const report = JSON.parse(result.stdout);
  assert.equal(report.platform, process.platform);
  assert.equal(report.supported, process.platform === 'linux' && process.version === 'v24.22.1');
  assert.equal(report.linuxValidated, false);
  assert.equal(result.status, report.supported ? 0 : 2);
});
test('a non-Linux host refuses a build without creating outputs or touching the supplied directory', {
  skip: process.platform === 'linux' ? 'Requires the unsupported host path' : false,
}, async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'odontho-dep12-linux-guard-'));
  await writeFile(path.join(dir, 'sentinel.txt'), 'synthetic');
  const result = spawnSync(process.execPath, [script, dir], { encoding: 'utf8', windowsHide: true });
  assert.ifError(result.error);
  assert.equal(result.status, 1);
  assert.deepEqual(await readdir(dir), ['sentinel.txt']);
  assert.doesNotMatch(result.stdout, /npm|Prisma Client|building client/);
});
