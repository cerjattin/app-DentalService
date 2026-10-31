import { spawn } from "node:child_process";

// Reuse the service's integration tests instead of maintaining a second allocator.
const value = process.env.TEST_DATABASE_URL;
if (!value) throw new Error("Set TEST_DATABASE_URL for a dedicated local PostgreSQL test database");
const target = new URL(value);
if (!["postgres:", "postgresql:"].includes(target.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
    !/^\/[a-z0-9_]+_test$/.test(target.pathname)) {
  throw new Error("Refusing concurrency tests outside a dedicated local PostgreSQL test database");
}
const child = spawn(process.execPath, [
  "node_modules/vitest/vitest.mjs", "run",
  "tests/integration/number-sequence-concurrency.test.ts",
  "tests/integration/number-sequence-rollback.test.ts",
], { stdio: "inherit", env: process.env, windowsHide: true });
child.on("error", () => { process.exitCode = 1; });
child.on("exit", code => { process.exitCode = code ?? 1; });
