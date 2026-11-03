// Read-only remote checks. No login, upload, database query, or record mutation.
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function origin(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.origin !== value || url.username || url.password) throw new Error('Use exact HTTPS origins without paths or credentials');
  return url.origin;
}
export async function smoke({ web, api, version, token, fetcher = fetch }) {
  web = origin(web); api = origin(api);
  if (typeof version !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/.test(version)) throw new Error('Supply the expected public release version');
  const results = [];
  async function check(name, route, options, accept) {
    try {
      const response = await fetcher(route, { redirect: 'error', signal: AbortSignal.timeout(15000), ...options });
      results.push({ check: name, status: await accept(response) ? 'PASS' : 'FAIL', http: response.status });
    } catch { results.push({ check: name, status: 'FAIL', reason: 'Network, certificate or response validation failed' }); }
  }
  const status = expected => async response => response.status === 200 && (await response.json()).data?.status === expected;
  await check('liveness', `${api}/health/live`, {}, status('ok'));
  await check('database-readiness-not-storage-or-migrations', `${api}/health/ready`, {}, status('ready'));
  await check('allowed-origin-preflight', `${api}/api/v1/auth/me`, { method: 'OPTIONS', headers: {
    Origin: web, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization' } },
    response => response.ok && response.headers.get('access-control-allow-origin') === web
      && /authorization/i.test(response.headers.get('access-control-allow-headers') ?? ''));
  await check('untrusted-origin-cannot-read', `${api}/api/v1/auth/me`, { method: 'OPTIONS', headers: {
    Origin: 'https://untrusted.invalid', 'Access-Control-Request-Method': 'GET' } },
    response => !response.headers.get('access-control-allow-origin'));
  await check('protected-route-requires-session', `${api}/api/v1/auth/me`, {}, response => response.status === 401);
  let index;
  await check('spa-index', web, {}, async response => {
    index = await response.text();
    return response.ok && /text\/html/.test(response.headers.get('content-type') ?? '') && /id=["']root["']/.test(index);
  });
  await check('spa-direct-navigation', `${web}/patients`, {}, async response => response.ok && index === await response.text());
  const jsAsset = index?.match(/<script[^>]+src=["']([^"']+\.js)["']/)?.[1];
  if (jsAsset) {
    const url = new URL(jsAsset, web);
    if (url.origin === web) await check('spa-javascript-asset-and-version', url.href, {}, async response => response.ok
      && /javascript/.test(response.headers.get('content-type') ?? '') && (await response.text()).includes(version));
    else results.push({ check: 'spa-javascript-asset', status: 'FAIL', reason: 'Unexpected asset origin' });
  } else results.push({ check: 'spa-javascript-asset', status: 'FAIL', reason: 'Missing bundled JavaScript asset' });
  if (token) await check('svb-presentation-deferred', `${api}/api/v1/svb-pilot/readiness`, {
    headers: { Authorization: `Bearer ${token}` } }, async response => {
    const body = await response.json();
    return response.ok && body.success === true && body.data?.manualPortalRecordingEnabled === false && body.data?.realSubmissionEnabled === false;
  });
  else results.push({ check: 'svb-presentation-deferred', status: 'NOT_RUN', reason: 'Set a dedicated QA bearer token in DEP12_QA_TOKEN' });
  return { at: new Date().toISOString(), scope: 'READ_ONLY_INFRASTRUCTURE_SMOKE_NOT_CLINICAL_UAT', web, api, version, results,
    passed: results.every(result => result.status === 'PASS') };
}
async function main() {
  const [web, api, version, output] = process.argv.slice(2);
  if (!web || !api || !version || !output) throw new Error('Usage: node deployment/smoke.mjs HTTPS_WEB_ORIGIN HTTPS_API_ORIGIN EXPECTED_VERSION NEW_REPORT_FILE');
  const report = await smoke({ web, api, version, token: process.env.DEP12_QA_TOKEN });
  await writeFile(path.resolve(output), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => { console.error('Smoke failed. No credentials or response bodies are reported.'); process.exitCode = 1; });
}
