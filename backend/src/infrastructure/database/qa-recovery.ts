import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const exec = promisify(execFile);
const hash = (bytes: Buffer | string) =>
  createHash("sha256").update(bytes).digest("hex");
export function requireLocalQaUrl(value: string) {
  const url = new URL(value);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    !/^\/[a-z0-9_]+_test$/.test(url.pathname) ||
    url.search
  )
    throw new Error("Dedicated local _test connection required");
  return url;
}
function pgEnv(url: URL, readOnly: boolean) {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !key.toUpperCase().startsWith("PG"),
    ),
  );
  return {
    ...env,
    PGHOST: url.hostname.replace(/^\[|\]$/g, ""),
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: url.pathname.slice(1),
    PGSSLMODE: "disable",
    PGOPTIONS: readOnly
      ? "-c default_transaction_read_only=on -c timezone=UTC"
      : "-c timezone=UTC",
  };
}
async function run(
  bin: string,
  name: string,
  args: string[],
  env: NodeJS.ProcessEnv,
) {
  // Arguments never include passwords or a connection URL; stderr may contain source values and is suppressed.
  try {
    await exec(
      path.join(bin, process.platform === "win32" ? `${name}.exe` : name),
      args,
      { env, windowsHide: true, maxBuffer: 4 * 1024 * 1024, timeout: 120000 },
    );
  } catch {
    throw new Error(
      `${name} failed; inspect the protected local recovery environment`,
    );
  }
}
async function fingerprint(db: pg.Client) {
  const tables = (
    await db.query<{
      name: string;
    }>(`SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname COLLATE "C"`)
  ).rows;
  const fingerprints = [];
  for (const { name } of tables) {
    if (!/^[a-z_][a-z_0-9]*$/.test(name))
      throw new Error("Unexpected table identifier");
    const result = await db.query<{ value: string }>(
      `SELECT to_jsonb(t)::text AS value FROM public."${name}" t ORDER BY to_jsonb(t)::text COLLATE "C"`,
    );
    fingerprints.push({
      table: name,
      rows: result.rows.length,
      sha256: hash(result.rows.map((r) => r.value).join("\n")),
    });
  }
  const sequences = (
    await db.query<{
      name: string;
    }>(`SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='S' ORDER BY c.relname COLLATE "C"`)
  ).rows;
  for (const { name } of sequences) {
    if (!/^[a-z_][a-z_0-9]*$/.test(name))
      throw new Error("Unexpected sequence identifier");
    const row = (
      await db.query(`SELECT last_value::text,is_called FROM public."${name}"`)
    ).rows[0];
    fingerprints.push({
      table: name,
      rows: 1,
      sha256: hash(JSON.stringify(row)),
    });
  }
  return fingerprints;
}
export async function checkedDocumentPath(root: string, uri: string) {
  const prefix = "local://documents/";
  if (!uri.startsWith(prefix))
    throw new Error("Recovery supports local documents only");
  const key = uri.slice(prefix.length);
  if (
    !key ||
    key.includes("\\") ||
    key.split("/").some((s) => !s || s === "." || s === "..") ||
    key.includes(":")
  )
    throw new Error("Invalid document key");
  const resolvedRoot = await realpath(root);
  const candidate = await realpath(path.resolve(root, ...key.split("/")));
  const relative = path.relative(resolvedRoot, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative))
    throw new Error("Document escapes storage root");
  return { key, file: candidate };
}

/** QA-only drill, never an operational restore or production backup command. */
export async function runQaRecovery(input: {
  sourceUrl: string;
  restoreUrl: string;
  sourceDocuments: string;
  output: string;
  pgBin: string;
  writersPaused: true;
}) {
  const sourceUrl = requireLocalQaUrl(input.sourceUrl),
    restoreUrl = requireLocalQaUrl(input.restoreUrl);
  if (
    sourceUrl.pathname === restoreUrl.pathname ||
    input.writersPaused !== true
  )
    throw new Error(
      "Use a distinct empty restore database and pause QA writers",
    );
  const source = new pg.Client({
    connectionString: sourceUrl.toString(),
    options: "-c default_transaction_read_only=on -c timezone=UTC",
    connectionTimeoutMillis: 5000,
  });
  const target = new pg.Client({
    connectionString: restoreUrl.toString(),
    options: "-c timezone=UTC",
    connectionTimeoutMillis: 5000,
  });
  let transaction = false;
  try {
    await source.connect();
    await target.connect();
    const objects = (
      await target.query(
        `SELECT count(*)::int AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'`,
      )
    ).rows[0].count;
    if (objects !== 0)
      throw new Error(
        "Restore database must be empty; no reset or overwrite is performed",
      );
    // Fail if the source test DB also appears to host external authentication/storage services.
    const remoteServices = (
      await source.query(
        "SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname IN ('auth','storage')) AS present",
      )
    ).rows[0].present;
    if (remoteServices)
      throw new Error("Use an isolated synthetic QA database");
    await mkdir(input.output); // Must be a new directory. No overwriting a prior backup.
    await source.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    transaction = true;
    await source.query("SET LOCAL statement_timeout='30s'");
    const snapshot = (
      await source.query<{ snapshot: string }>(
        "SELECT pg_export_snapshot() AS snapshot",
      )
    ).rows[0]!.snapshot;
    const before = await fingerprint(source);
    const documents = (
      await source.query<{
        id: string;
        storage_provider: string;
        storage_uri: string;
        sha256: string;
        size_bytes: string;
      }>(
        "SELECT id::text,storage_provider::text,storage_uri,sha256,size_bytes::text FROM documents ORDER BY id",
      )
    ).rows;
    const archive = path.join(input.output, "database.dump");
    await run(
      input.pgBin,
      "pg_dump",
      [
        "--format=custom",
        "--no-owner",
        "--no-acl",
        `--snapshot=${snapshot}`,
        `--file=${archive}`,
      ],
      pgEnv(sourceUrl, true),
    );
    const restoredRoot = path.join(input.output, "documents");
    await mkdir(restoredRoot);
    for (const doc of documents) {
      if (doc.storage_provider !== "LOCAL")
        throw new Error(
          "External document storage needs its own verified recovery adapter",
        );
      const { key, file } = await checkedDocumentPath(
        input.sourceDocuments,
        doc.storage_uri,
      );
      const bytes = await readFile(file);
      if (
        hash(bytes) !== doc.sha256 ||
        BigInt(bytes.length) !== BigInt(doc.size_bytes)
      )
        throw new Error("Source document integrity failed");
      const destination = path.join(restoredRoot, ...key.split("/"));
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, bytes, { flag: "wx" });
    }
    await source.query("ROLLBACK");
    transaction = false;
    await run(
      input.pgBin,
      "pg_restore",
      [
        "--no-owner",
        "--no-acl",
        "--single-transaction",
        "--exit-on-error",
        `--dbname=${restoreUrl.pathname.slice(1)}`,
        archive,
      ],
      pgEnv(restoreUrl, false),
    );
    await target.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const after = await fingerprint(target);
    if (JSON.stringify(before) !== JSON.stringify(after))
      throw new Error("Restored database or sequence fingerprint mismatch");
    let verified = 0;
    for (const doc of documents) {
      const { file } = await checkedDocumentPath(restoredRoot, doc.storage_uri);
      const bytes = await readFile(file);
      if (
        hash(bytes) !== doc.sha256 ||
        (await stat(file)).size !== Number(doc.size_bytes)
      )
        throw new Error("Restored document integrity failed");
      verified++;
    }
    await target.query("ROLLBACK");
    const report = {
      contract: "NEG-FINAL-08",
      syntheticQaOnly: true,
      restored: true,
      archiveSha256: hash(await readFile(archive)),
      tableAndSequenceFingerprints: before,
      documentsVerified: verified,
      sourceDataSha256: hash(JSON.stringify(before)),
      externalSubmissionsReconciled: false,
      operationalReadinessApproved: false,
    };
    await writeFile(
      path.join(input.output, "report.json"),
      JSON.stringify(report, null, 2),
      { flag: "wx" },
    );
    return report;
  } finally {
    if (transaction) await source.query("ROLLBACK").catch(() => {});
    await source.end();
    await target.end();
  }
}
