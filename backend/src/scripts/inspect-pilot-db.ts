import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parse } from "dotenv";
import pg from "pg";
import { postgresConnectionConfig } from "../infrastructure/database/database-url.js";
import { inspectPilotDatabase } from "../infrastructure/database/pilot-db-inventory.js";
import { diagnoseNegFuncDatabase } from "../infrastructure/database/neg-func-diagnostics.js";
import { diagnoseManualPortal } from "../infrastructure/database/manual-portal-diagnostics.js";

let db: pg.Client | undefined;
let phase = "configuration";
try {
  const args = process.argv.slice(2);
  let url: string | undefined, ca: string | undefined;
  if (args.length === 2 && args[0] === "--env-file") {
    const config = parse(readFileSync(args[1]!));
    url = config.DATABASE_URL;
    ca = config.DATABASE_CA_CERT_PATH ?? "certs/supabase-ca.crt";
  } else if (!args.length) {
    url = process.env.TEST_DATABASE_URL;
    const target = new URL(url ?? "");
    if (
      !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
      !/^\/[a-z0-9_]+_test$/.test(target.pathname)
    )
      throw new Error();
  } else throw new Error();
  if (!url) throw new Error();
  const parsed = new URL(url);
  if (
    [...parsed.searchParams.keys()].some(
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
  db = new pg.Client({
    ...postgresConnectionConfig(url, ca),
    options: "-c default_transaction_read_only=on -c timezone=UTC",
  });
  phase = "connection";
  await db.connect();
  phase = "inventory";
  const inventory = await inspectPilotDatabase(db);
  phase = "integrity-diagnosis";
  const diagnosis =
    inventory.migrations[0]?.status === "MATCH"
      ? await diagnoseNegFuncDatabase(db)
      : null;
  const manualPortal = diagnosis ? await diagnoseManualPortal(db) : null;
  const configuredTargetFingerprint = createHash("sha256")
    .update(`${parsed.hostname}:${parsed.port || "5432"}${parsed.pathname}`)
    .digest("hex");
  console.log(
    JSON.stringify(
      {
        verifiedAt: new Date().toISOString(),
        configuredTargetFingerprint,
        inventory,
        diagnosis,
        manualPortal,
      },
      null,
      2,
    ),
  );
  if (
    inventory.blocked ||
    diagnosis?.issues.some((i) => i.count > 0) ||
    manualPortal?.migrationRequired ||
    manualPortal?.issues.some((i) => i.count > 0)
  )
    process.exitCode = 2;
} catch (error) {
  console.error(
    "Protected pilot inventory failed. Select an explicit environment file or a local _test connection; no connection values or data are printed.",
  );
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : undefined;
  console.error(
    JSON.stringify({
      phase,
      ...(code && /^[A-Z0-9_]{2,64}$/.test(code) ? { code } : {}),
    }),
  );
  process.exitCode = 1;
} finally {
  await db?.end();
}
