import { readFileSync } from "node:fs";
import { mkdir, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "dotenv";
import pg from "pg";
import { postgresConnectionConfig } from "../infrastructure/database/database-url.js";
import { requireLocalQaUrl } from "../infrastructure/database/qa-recovery.js";
import { planFiscalReconciliation } from "../infrastructure/database/fiscal-reconciliation-plan.js";
let db: pg.Client | undefined;
try {
  const args = process.argv.slice(2),
    values = new Map<string, string>();
  for (let i = 0; i < args.length; i += 2) {
    if (
      !["--env-file", "--out"].includes(args[i]!) ||
      !args[i + 1] ||
      values.has(args[i]!)
    )
      throw new Error();
    values.set(args[i]!, args[i + 1]!);
  }
  if (!values.has("--out")) throw new Error();
  const root = await realpath("storage"),
    output = path.resolve(values.get("--out")!);
  if (!output.startsWith(root + path.sep) || !output.endsWith(".json"))
    throw new Error();
  await mkdir(path.dirname(output), { recursive: true });
  const parent = await realpath(path.dirname(output));
  if (parent !== root && !parent.startsWith(root + path.sep)) throw new Error();
  let url: string, ca: string | undefined;
  if (values.has("--env-file")) {
    const cfg = parse(readFileSync(values.get("--env-file")!));
    url = cfg.DATABASE_URL!;
    ca = cfg.DATABASE_CA_CERT_PATH ?? "certs/supabase-ca.crt";
  } else {
    url = process.env.TEST_DATABASE_URL ?? "";
    requireLocalQaUrl(url);
  }
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
  await db.connect();
  const plan = await planFiscalReconciliation(db);
  await writeFile(output, JSON.stringify(plan, null, 2), { flag: "wx" });
  console.log(
    JSON.stringify({
      readOnly: true,
      protectedPlanWritten: true,
      organizations: plan.organizationPlans.length,
      drafts: plan.batchPlans.length,
      automaticRepairs: 0,
    }),
  );
} catch {
  console.error(
    "Protected reconciliation plan failed. Use an explicit environment/local QA and a new JSON path under storage; no fiscal values are printed.",
  );
  process.exitCode = 1;
} finally {
  await db?.end();
}
