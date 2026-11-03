import { readFileSync, statSync } from "node:fs";
import pg from "pg";
import {
  diagnoseFinal06Database,
  final06PreflightSql,
} from "../infrastructure/database/svb-final06-preflight.js";
import {
  parseSvbMasterBatch,
  preflightSvbMasterBatch,
} from "../infrastructure/database/svb-master-preflight.js";

// Deliberately no dotenv, runtime configuration, or operational URL fallback.
let db: pg.Client | undefined;
try {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--sql")
    console.log(final06PreflightSql());
  else {
    if (args.length && !(args.length === 2 && args[0] === "--master-batch"))
      throw new Error();
    let batch: unknown;
    if (args[0] === "--master-batch") {
      if (statSync(args[1]!).size > 2 * 1024 * 1024) throw new Error();
      batch = JSON.parse(readFileSync(args[1]!, "utf8").replace(/^\uFEFF/, ""));
      parseSvbMasterBatch(batch);
    }
    const url = new URL(process.env.TEST_DATABASE_URL ?? "");
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      !/^\/[a-z0-9_]+_test$/.test(url.pathname) ||
      [...url.searchParams.keys()].some(
        (k) => !["sslmode", "connect_timeout"].includes(k),
      )
    )
      throw new Error();
    db = new pg.Client({
      connectionString: url.toString(),
      connectionTimeoutMillis: 5000,
    });
    await db.connect();
    const report =
      batch === undefined
        ? await diagnoseFinal06Database(db)
        : await preflightSvbMasterBatch(db, batch);
    console.log(JSON.stringify(report, null, 2));
    // Missing approved sources is an actual blocker, including on an empty database.
    if (
      "canApply" in report
        ? !report.canApply
        : !report.realSubmissionApproved || report.integrityBlocked
    )
      process.exitCode = 2;
  }
} catch {
  console.error(
    "Final 06 preflight failed. Use a dedicated local TEST_DATABASE_URL ending in _test and a valid batch; no operational connection or write is used.",
  );
  process.exitCode = 1;
} finally {
  await db?.end();
}
