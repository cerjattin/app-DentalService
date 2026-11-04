import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sourceHash, verifySnapshot } from '../release.mjs';
import { smoke } from '../smoke.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
async function fixture(relative = 'backend/package.json') {
  const dir = await mkdtemp(path.join(tmpdir(), 'odontho-dep12-'));
  const text = '{"name":"synthetic-only"}\n';
  await mkdir(path.join(dir, 'source', path.dirname(relative)), { recursive: true });
  await writeFile(path.join(dir, 'source', relative), text);
  const files = [{ path: relative, bytes: Buffer.byteLength(text), sha256: sha(text) }];
  await writeFile(path.join(dir, 'manifest.json'), JSON.stringify({ version: 'synthetic', sourceSha256: sourceHash(files), files }));
  return dir;
}
test('a frozen source detects modifications after verification', async () => {
  const dir = await fixture();
  assert.equal((await verifySnapshot(dir)).files, 1);
  await writeFile(path.join(dir, 'source/backend/package.json'), '{}');
  await assert.rejects(verifySnapshot(dir), /Snapshot changed/);
});
test('a self-consistent manifest cannot smuggle an environment file', async () => {
  const dir = await fixture('backend/.env.supabase.local');
  await assert.rejects(verifySnapshot(dir), /Unsafe manifest path/);
});
test('an intermediate directory link cannot escape the source snapshot', async context => {
  const dir = await mkdtemp(path.join(tmpdir(), 'odontho-dep12-'));
  const other = await fixture();
  await mkdir(path.join(dir, 'source'));
  try { await symlink(path.join(other, 'source/backend'), path.join(dir, 'source/backend'), 'junction'); }
  catch (error) {
    if (error.code === 'EPERM') { context.skip('The Windows sandbox forbids creating junctions'); return; }
    throw error;
  }
  await writeFile(path.join(dir, 'manifest.json'), await readFile(path.join(other, 'manifest.json')));
  await assert.rejects(verifySnapshot(dir), /escapes/);
});
test('a manifest cannot substitute a path traversal even when its own hash matches', async () => {
  const dir = await fixture();
  const files = [{ path: 'backend/../../outside', bytes: 0, sha256: sha('') }];
  await writeFile(path.join(dir, 'manifest.json'), JSON.stringify({ sourceSha256: sourceHash(files), files }));
  await assert.rejects(verifySnapshot(dir), /Unsafe manifest path/);
});
const html = '<html><div id="root"></div><script src="/assets/app.js"></script></html>';
function mockFetch({ enabled = false, allowUntrusted = false } = {}) {
  return async (url, options) => {
    assert.ok(['GET', 'OPTIONS'].includes(options.method ?? 'GET'), 'smoke must never mutate');
    const uri = new URL(url);
    if (options.method === 'OPTIONS') return new Response(null, { status: 204, headers: {
      ...((options.headers.Origin === 'https://web.invalid' || allowUntrusted) ? { 'access-control-allow-origin': options.headers.Origin } : {}),
      'access-control-allow-headers': 'authorization' } });
    if (uri.pathname === '/health/live') return Response.json({ data: { status: 'ok' } });
    if (uri.pathname === '/health/ready') return Response.json({ data: { status: 'ready' } });
    if (uri.pathname === '/api/v1/auth/me') return new Response(null, { status: 401 });
    if (uri.pathname === '/api/v1/svb-pilot/readiness') return Response.json({ success: true, data: { manualPortalRecordingEnabled: enabled, realSubmissionEnabled: false } });
    return new Response(uri.pathname.endsWith('.js') ? '/* synthetic-version */' : html, { headers: { 'content-type': uri.pathname.endsWith('.js') ? 'text/javascript' : 'text/html' } });
  };
}
test('HTTPS smoke is read-only and fails an enabled presentation capability', async () => {
  const report = await smoke({ web: 'https://web.invalid', api: 'https://api.invalid', version: 'synthetic-version', token: 'synthetic', fetcher: mockFetch({ enabled: true }) });
  assert.equal(report.passed, false);
  assert.equal(report.results.find(x => x.check === 'svb-presentation-deferred').status, 'FAIL');
});
test('HTTPS smoke fails open CORS and does not report a missing session check as PASS', async () => {
  const report = await smoke({ web: 'https://web.invalid', api: 'https://api.invalid', version: 'synthetic-version', fetcher: mockFetch({ allowUntrusted: true }) });
  assert.equal(report.passed, false);
  assert.equal(report.results.find(x => x.check === 'untrusted-origin-cannot-read').status, 'FAIL');
  assert.equal(report.results.find(x => x.check === 'svb-presentation-deferred').status, 'NOT_RUN');
});
test('the smoke requires verified HTTPS and accepts the complete synthetic infrastructure scenario', async () => {
  await assert.rejects(smoke({ web: 'http://web.invalid', api: 'https://api.invalid', fetcher: mockFetch() }), /HTTPS/);
  const report = await smoke({ web: 'https://web.invalid', api: 'https://api.invalid', version: 'synthetic-version', token: 'synthetic', fetcher: mockFetch() });
  assert.equal(report.passed, true);
});
test('the smoke rejects a frontend built from another release', async () => {
  const report = await smoke({ web: 'https://web.invalid', api: 'https://api.invalid', version: 'different-version', token: 'synthetic', fetcher: mockFetch() });
  assert.equal(report.passed, false);
  assert.equal(report.results.find(x => x.check === 'spa-javascript-asset-and-version').status, 'FAIL');
});
for (const template of ['render.yaml', 'render-qa.yaml', 'render-free.yaml']) {
test(`${template} has no automatic deployment, data operation, or frontend secret`, async () => {
  const blueprint = JSON.parse(await readFile(new URL(`../${template}`, import.meta.url), 'utf8'));
  for (const service of blueprint.services) {
    assert.equal(service.autoDeployTrigger, 'off');
    assert.doesNotMatch(service.buildCommand + (service.startCommand ?? '') + (service.preDeployCommand ?? ''), /migrate|seed|bootstrap|cleanup/);
    if (service.runtime === 'static') assert.ok(service.envVars.every(x => ['NODE_VERSION', 'SKIP_INSTALL_DEPS'].includes(x.key) || x.key.startsWith('VITE_')));
  }
  const backend = blueprint.services.find(x => x.runtime === 'node');
  assert.equal(backend.envVars.find(x => x.key === 'DOCUMENT_STORAGE_PROVIDER').value, 'SUPABASE');
  assert.equal(backend.envVars.find(x => x.key === 'SVB_MANUAL_RECORDING_ENABLED').value, 'false');
});
}

test('the clinical Free deployment cannot provision paid compute or a replacement database', async () => {
  const blueprint = JSON.parse(await readFile(new URL('../render-free.yaml', import.meta.url), 'utf8'));
  assert.deepEqual(blueprint.services.map(x => x.runtime).sort(), ['node', 'static']);
  assert.equal(blueprint.databases, undefined);
  for (const service of blueprint.services) {
    assert.equal(service.disk, undefined);
    assert.equal(service.scaling, undefined);
    assert.equal(service.plan, service.runtime === 'static' ? undefined : 'free');
  }
  const api = blueprint.services.find(x => x.runtime === 'node');
  assert.ok(api.envVars.some(x => x.fromGroup === 'odontho-clinical-tls'), 'CA secret file must be available from a preconfigured group at first deploy');
  for (const key of ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_STORAGE_BUCKET']) {
    const entry = api.envVars.find(x => x.key === key);
    assert.equal(entry.sync, false);
    assert.equal(entry.value, undefined);
  }
});
