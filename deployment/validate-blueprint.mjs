// Offline validation against a separately downloaded official Render schema.
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
async function main() {
  const [schemaPath, output, blueprintName = 'render.yaml'] = process.argv.slice(2);
  if (!schemaPath || !output) throw new Error('Supply an official schema file and a new report file');
  if (!['render.yaml', 'render-qa.yaml', 'render-free.yaml'].includes(blueprintName)) throw new Error('Select a supported deployment template');
  // Reuse the installed Backend dev dependency, without installing anything.
  const Ajv2020 = require(path.join(root, 'backend/node_modules/ajv/dist/2020.js'));
  const schemaBytes = await readFile(path.resolve(schemaPath));
  const schema = JSON.parse(schemaBytes);
  if (schema.$id !== 'https://render.com/schema/render.yaml.json') throw new Error('Unexpected schema identity');
  const blueprintBytes = await readFile(path.join(root, 'deployment', blueprintName));
  const validator = new Ajv2020({ strict: false, allErrors: true });
  // The schema uses URI annotations. Validate syntax without contacting any URI.
  validator.addFormat('uri', value => { try { return Boolean(new URL(value).protocol); } catch { return false; } });
  const validate = validator.compile(schema);
  const passed = validate(JSON.parse(blueprintBytes));
  const sha = bytes => createHash('sha256').update(bytes).digest('hex');
  const report = { at: new Date().toISOString(), schemaUrl: schema.$id, schemaSha256: sha(schemaBytes),
    blueprint: blueprintName, blueprintSha256: sha(blueprintBytes), passed, errors: validate.errors ?? [],
    scope: 'OFFLINE_JSON_SCHEMA_ONLY_NOT_PROVIDER_API_OR_DEPLOYMENT', deployed: false };
  await writeFile(path.resolve(output), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify(report, null, 2));
  if (!passed) process.exitCode = 1;
}
main().catch(() => { console.error('Blueprint validation failed; no resource was created.'); process.exitCode = 1; });
