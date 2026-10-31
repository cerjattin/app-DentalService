import dotenv from "dotenv";
import { expect } from "vitest";

dotenv.config({ path: ".env.test", quiet: true });
const integration = expect.getState().testPath?.replaceAll("\\", "/").includes("/tests/integration/");
if (integration && !process.env.TEST_DATABASE_URL) {
  throw new Error("Integration tests require TEST_DATABASE_URL for a dedicated local PostgreSQL database ending in _test");
}
const testUrl = process.env.TEST_DATABASE_URL ?? "postgresql://postgres:test@127.0.0.1:55439/odontho_test";
const target = new URL(testUrl);
if (!["postgres:", "postgresql:"].includes(target.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
    !/^\/[a-z0-9_]+_test$/.test(target.pathname)) {
  throw new Error("TEST_DATABASE_URL must target a dedicated local PostgreSQL database ending in _test");
}
delete process.env.ODONTHO_ENV_FILE;
process.env.DATABASE_URL = testUrl;
process.env.NODE_ENV = "test";
process.env.ACCESS_TOKEN_SECRET = "isolated-postgresql-test-secret-at-least-32-characters";
process.env.LOG_LEVEL = "silent";
