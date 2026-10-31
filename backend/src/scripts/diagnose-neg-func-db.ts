import pg from "pg";
import {
  diagnoseNegFuncDatabase,
  negFuncPreflightSql,
} from "../infrastructure/database/neg-func-diagnostics.js";

// This command never falls back to DATABASE_URL or the operational .env file.
if (process.argv.includes("--sql")) {
  console.log(negFuncPreflightSql());
} else {
  let client: pg.Client | undefined;
  try {
    const value = process.env.TEST_DATABASE_URL;
    if (!value) throw new Error("TEST_DATABASE_URL is required");
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error("Invalid TEST_DATABASE_URL");
    }
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      !/^\/[a-z0-9_]+_test$/.test(url.pathname)
    ) {
      throw new Error(
        "Diagnostics require a dedicated local PostgreSQL database ending in _test",
      );
    }
    client = new pg.Client({
      connectionString: value,
      connectionTimeoutMillis: 10_000,
    });
    await client.connect();
    const report = await diagnoseNegFuncDatabase(
      client,
      process.argv.includes("--include-qa-ids"),
    );
    console.log(JSON.stringify(report, null, 2));
    if (report.migrationBlocked) process.exitCode = 2;
  } catch {
    console.error(
      "Database diagnostics could not run. Use TEST_DATABASE_URL for a dedicated local _test database; no operational connection is used.",
    );
    process.exitCode = 1;
  } finally {
    await client?.end();
  }
}
