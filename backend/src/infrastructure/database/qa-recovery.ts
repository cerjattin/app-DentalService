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
    PGCONNECT_TIMEOUT: "5",
    PGAPPNAME: "odontho-qa-recovery-command",
    PGOPTIONS: readOnly
      ? "-c default_transaction_read_only=on -c timezone=UTC -c lock_timeout=5s -c statement_timeout=30s"
      : "-c timezone=UTC -c lock_timeout=5s -c statement_timeout=30s",
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
      { env, windowsHide: true, maxBuffer: 4 * 1024 * 1024, timeout: 30000 },
    );
  } catch {
    throw new Error(
      `${name} failed; inspect the protected local recovery environment`,
    );
  }
}
/** pg_dump may distribute an unbounded varchar[] -> text[] cast over each constant.
 * These literal text arrays have identical values and types after either parse. */
export function canonicalRecoveryDefinition(definition: string) {
  const literal = "'(?:[^']|'')*'";
  const element =
    "(?:\\(" +
    literal +
    "::character varying\\)::text|" +
    literal +
    "::character varying(?:::text)?|" +
    literal +
    "::text)";
  const array = "ARRAY\\[" + element + "(?:,\\s*" + element + ")*\\]";
  const castArray = new RegExp(
    "\\((" + array + ")\\)::text\\[\\]|(" + array + ")(?:::text\\[\\])?",
    "g",
  );
  return definition.replace(
    castArray,
    (_match, wrapped: string | undefined, direct: string | undefined) => {
      const values =
        (wrapped ?? direct ?? "").match(new RegExp(literal, "g")) ?? [];
      return (
        "ARRAY[" + values.map((value) => value + "::text").join(", ") + "]"
      );
    },
  );
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
  const schema = await db.query<{ value: string }>(`
    WITH objects AS (
      SELECT 'constraint' AS kind,c.conrelid::regclass::text AS relation,c.conname AS name,
        pg_get_constraintdef(c.oid,true) AS definition,c.convalidated AS enabled
      FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public'
      UNION ALL
      SELECT 'index',i.indrelid::regclass::text,c.relname,pg_get_indexdef(i.indexrelid),i.indisvalid
      FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public'
      UNION ALL
      SELECT 'trigger',t.tgrelid::regclass::text,t.tgname,pg_get_triggerdef(t.oid,true),t.tgenabled<>'D'
      FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND NOT t.tgisinternal
      UNION ALL
      SELECT 'rls',c.relname,c.relname,c.relforcerowsecurity::text,c.relrowsecurity
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'
      UNION ALL
      SELECT 'column',c.relname,a.attname,
        jsonb_build_array(format_type(a.atttypid,a.atttypmod),a.attnotnull,
          pg_get_expr(d.adbin,d.adrelid),co.collname)::text,true
      FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
      LEFT JOIN pg_collation co ON co.oid=a.attcollation
      WHERE n.nspname='public' AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped
    )
    SELECT to_jsonb(o)::text AS value FROM objects o ORDER BY to_jsonb(o)::text COLLATE "C"
  `);
  fingerprints.push({
    table: "$schema",
    rows: schema.rows.length,
    sha256: hash(
      schema.rows
        .map((row) => {
          const object = JSON.parse(row.value) as { definition: string };
          object.definition = canonicalRecoveryDefinition(object.definition);
          return JSON.stringify(object);
        })
        .sort()
        .join("\n"),
    ),
  });
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
    options:
      "-c default_transaction_read_only=on -c timezone=UTC -c lock_timeout=5s -c statement_timeout=30s -c application_name=odontho-qa-recovery-source",
    connectionTimeoutMillis: 5000,
  });
  const target = new pg.Client({
    connectionString: restoreUrl.toString(),
    options:
      "-c timezone=UTC -c lock_timeout=5s -c statement_timeout=30s -c application_name=odontho-qa-recovery-target",
    connectionTimeoutMillis: 5000,
  });
  let transaction = false;
  let targetTransaction = false;
  let outputCreated = false;
  const started = Date.now();
  let phase = "connect";
  const stages: Array<{ phase: string; elapsedMs: number }> = [];
  async function recordPhase(next: string, status = "RUNNING") {
    phase = next;
    stages.push({ phase, elapsedMs: Date.now() - started });
    if (outputCreated)
      await writeFile(
        path.join(input.output, "progress.json"),
        JSON.stringify({ phase, status, stages }, null, 2),
      );
  }
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
    outputCreated = true;
    await recordPhase("snapshot-fingerprint");
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
    await recordPhase("pg-dump");
    await run(
      input.pgBin,
      "pg_dump",
      [
        "--no-password",
        "--lock-wait-timeout=5s",
        "--format=custom",
        "--no-owner",
        "--no-acl",
        `--snapshot=${snapshot}`,
        `--file=${archive}`,
      ],
      pgEnv(sourceUrl, true),
    );
    const restoredRoot = path.join(input.output, "documents");
    await recordPhase("copy-documents");
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
    await recordPhase("pg-restore");
    await run(
      input.pgBin,
      "pg_restore",
      [
        "--no-password",
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
    targetTransaction = true;
    await recordPhase("verify-database");
    const after = await fingerprint(target);
    if (JSON.stringify(before) !== JSON.stringify(after))
      throw new Error("Restored database or sequence fingerprint mismatch");
    let verified = 0;
    await recordPhase("verify-documents");
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
    targetTransaction = false;
    await recordPhase("completed", "PASSED");
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
      stages,
    };
    await writeFile(
      path.join(input.output, "report.json"),
      JSON.stringify(report, null, 2),
      { flag: "wx" },
    );
    return report;
  } catch (error) {
    if (
      !outputCreated &&
      error instanceof Error &&
      [
        "Restore database must be empty; no reset or overwrite is performed",
        "Use an isolated synthetic QA database",
      ].includes(error.message)
    )
      throw error;
    await recordPhase(phase, "FAILED").catch(() => {});
    throw new Error(
      `QA recovery failed at ${phase}; inspect protected progress.json`,
    );
  } finally {
    if (transaction) await source.query("ROLLBACK").catch(() => {});
    if (targetTransaction) await target.query("ROLLBACK").catch(() => {});
    await source.end();
    await target.end();
  }
}
