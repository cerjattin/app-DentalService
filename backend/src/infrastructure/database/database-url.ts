import { readFileSync } from "node:fs";
import type { PoolConfig } from "pg";

export function postgresConnectionConfig(connectionString: string, caPath?: string): PoolConfig {
  let url: URL;
  try { url = new URL(connectionString); }
  catch { throw new Error("DATABASE_URL is not a valid PostgreSQL URL"); }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("DATABASE_URL must use PostgreSQL. Select the Supabase environment file.");
  }
  if (!url.hostname || !url.username || url.pathname.length <= 1) {
    throw new Error("DATABASE_URL must contain host, user and database");
  }
  const schema = url.searchParams.get("schema");
  if (schema && schema !== "public") throw new Error("This backend uses the public PostgreSQL schema");
  const local = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname);
  if (!local && url.searchParams.get("sslmode") === "disable") throw new Error("Remote PostgreSQL connections require TLS");
  for (const key of ["sslmode", "sslrootcert", "sslcert", "sslkey", "sslaccept"]) url.searchParams.delete(key);
  url.searchParams.delete("schema");
  return {
    connectionString: url.toString(), connectionTimeoutMillis: 15_000, idleTimeoutMillis: 10_000,
    options: "-c timezone=UTC",
    ssl: local ? false : { rejectUnauthorized: true, ...(caPath ? { ca: readFileSync(caPath, "utf8") } : {}) },
  };
}
