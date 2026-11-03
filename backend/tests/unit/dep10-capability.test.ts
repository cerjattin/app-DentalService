import { describe, expect, it } from "vitest";
import { envSchema } from "../../src/config/env.js";
describe("DEP10 safe deployment capability configuration", () => {
  const base = {
    DATABASE_URL: "postgresql://qa@127.0.0.1/qa_test",
    ACCESS_TOKEN_SECRET: "synthetic-config-secret-of-at-least-32-characters",
  };
  it("disables new SVB preparations and records by default even in a test environment", () => {
    expect(
      envSchema.parse({ ...base, NODE_ENV: "test" })
        .SVB_MANUAL_RECORDING_ENABLED,
    ).toBe(false);
  });
  it("accepts explicit synthetic QA without enabling certified real submission", () => {
    expect(
      envSchema.parse({
        ...base,
        NODE_ENV: "test",
        SVB_MANUAL_RECORDING_ENABLED: "true",
      }).SVB_MANUAL_RECORDING_ENABLED,
    ).toBe(true);
  });
  it.each([
    { NODE_ENV: "development" },
    { NODE_ENV: "production", CORS_ALLOWED_ORIGINS: "https://client.example" },
    {
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://qa@remote.example/qa_test",
    },
    { NODE_ENV: "test", DATABASE_URL: "postgresql://qa@localhost/clinic" },
    { NODE_ENV: "test", DATABASE_URL: "mysql://qa@localhost/qa_test" },
    { NODE_ENV: "test", DATABASE_URL: "invalid-connection-string" },
  ])("rejects enabling on a non-QA target: %j", (override) => {
    const result = envSchema.safeParse({
      ...base,
      ...override,
      SVB_MANUAL_RECORDING_ENABLED: "true",
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(
        result.error.issues.some(
          (issue) => issue.path[0] === "SVB_MANUAL_RECORDING_ENABLED",
        ),
      ).toBe(true);
  });
  it("does not coerce arbitrary truthy strings into authorization", () => {
    expect(
      envSchema.safeParse({
        ...base,
        NODE_ENV: "test",
        SVB_MANUAL_RECORDING_ENABLED: "yes",
      }).success,
    ).toBe(false);
  });
});
