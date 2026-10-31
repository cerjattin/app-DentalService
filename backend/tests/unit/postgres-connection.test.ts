import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { postgresConnectionConfig } from "../../src/infrastructure/database/database-url.js";

describe("PostgreSQL connection configuration", () => {
  it("keeps UTC and allows the dedicated local test server without TLS", () => {
    const config = postgresConnectionConfig("postgresql://postgres@127.0.0.1:55439/odontho_test");
    expect(config.ssl).toBe(false);
    expect(config.options).toBe("-c timezone=UTC");
  });
  it("validates a remote CA without letting URL parameters override TLS", () => {
    const config = postgresConnectionConfig(
      "postgresql://test:password@example.invalid/postgres?sslmode=require&sslcert=ignored&sslaccept=accept_invalid_certs",
      resolve("certs/supabase-ca.crt"),
    );
    expect(config.ssl).toMatchObject({ rejectUnauthorized: true, ca: expect.stringContaining("BEGIN CERTIFICATE") });
    expect(config.connectionString).not.toContain("sslcert");
    expect(config.connectionString).not.toContain("sslaccept");
  });
  it("refuses disabled TLS on remote databases", () => {
    expect(() => postgresConnectionConfig("postgresql://test:password@example.invalid/db?sslmode=disable")).toThrow("require TLS");
  });
  it("rejects old MySQL URLs without echoing secrets", () => {
    expect(() => postgresConnectionConfig("mysql://test:private-password@example.invalid/db")).toThrow("must use PostgreSQL");
    try { postgresConnectionConfig("mysql://test:private-password@example.invalid/db"); }
    catch (error) { expect(String(error)).not.toContain("private-password"); }
  });
});
