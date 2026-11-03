import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parse } from "dotenv";
import pg from "pg";
import { postgresConnectionConfig } from "../infrastructure/database/database-url.js";
import { requireLocalQaUrl } from "../infrastructure/database/qa-recovery.js";
import { syncPermissions } from "../infrastructure/database/permission-sync.js";

let db: pg.Client | undefined;
try {
  const args = process.argv.slice(2),
    values = new Map<string, string>();
  let apply = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--apply") {
      if (apply) throw new Error();
      apply = true;
      continue;
    }
    const key = args[i]!;
    if (
      ![
        "--env-file",
        "--expected-diff",
        "--expected-target",
        "--actor-id",
        "--reason",
      ].includes(key) ||
      values.has(key) ||
      !args[i + 1]
    )
      throw new Error();
    values.set(key, args[++i]!);
  }
  let url: string, ca: string | undefined;
  if (values.has("--env-file")) {
    const config = parse(readFileSync(values.get("--env-file")!));
    url = config.DATABASE_URL!;
    ca = config.DATABASE_CA_CERT_PATH ?? "certs/supabase-ca.crt";
  } else {
    url = process.env.TEST_DATABASE_URL ?? "";
    requireLocalQaUrl(url);
  }
  const target = new URL(url);
  if (
    [...target.searchParams.keys()].some(
      (k) =>
        ![
          "schema",
          "sslmode",
          "pgbouncer",
          "connection_limit",
          "connect_timeout",
        ].includes(k),
    )
  )
    throw new Error();
  const targetFingerprint = createHash("sha256")
    .update(`${target.hostname}:${target.port || "5432"}${target.pathname}`)
    .digest("hex");
  if (
    apply &&
    (values.get("--expected-target") !== targetFingerprint ||
      !values.has("--expected-diff") ||
      !values.has("--actor-id") ||
      !values.has("--reason"))
  )
    throw new Error();
  db = new pg.Client({
    ...postgresConnectionConfig(url, ca),
    options: apply
      ? "-c timezone=UTC"
      : "-c default_transaction_read_only=on -c timezone=UTC",
  });
  await db.connect();
  const report = await syncPermissions(db, {
    apply,
    ...(apply
      ? {
          expectedDiff: values.get("--expected-diff")!,
          actorId: values.get("--actor-id")!,
          reason: values.get("--reason")!,
        }
      : {}),
  });
  console.log(JSON.stringify({ targetFingerprint, ...report }, null, 2));
  if (report.diff.blocked.length || (!apply && report.changes))
    process.exitCode = 2;
} catch {
  console.error(
    "Permission sync failed. Run the protected dry-run first; apply requires the exact target/diff, authorized actor and reason. No connection values are printed.",
  );
  process.exitCode = 1;
} finally {
  await db?.end();
}
