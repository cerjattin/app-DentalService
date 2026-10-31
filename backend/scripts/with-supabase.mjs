import { config, parse } from "dotenv";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

config({ quiet: true });
const overlay = resolve(".env.supabase.local");
const values = parse(readFileSync(overlay));
if (!values.DATABASE_URL) throw new Error("DATABASE_URL is missing in .env.supabase.local");
const ca = resolve("certs/supabase-ca.crt");
readFileSync(ca);
let migrationUrl;
try {
  migrationUrl = new URL(values.DATABASE_URL);
} catch {
  throw new Error("DATABASE_URL must be a valid PostgreSQL URI");
}
if (!["postgres:", "postgresql:"].includes(migrationUrl.protocol)) {
  throw new Error("The Supabase environment must use a PostgreSQL URI");
}
migrationUrl.searchParams.set("sslmode", "require");
migrationUrl.searchParams.set("sslaccept", "strict");
migrationUrl.searchParams.set("sslcert", ca.replaceAll("\\", "/"));
const [entry, ...args] = process.argv.slice(2);
if (!entry) throw new Error("A Node entry point is required");
const child = spawn(process.execPath, [entry, ...args], {
  stdio: "inherit", windowsHide: true,
  env: { ...process.env, ...values, ODONTHO_ENV_FILE: overlay,
    DATABASE_CA_CERT_PATH: ca, NODE_EXTRA_CA_CERTS: ca,
    ODONTHO_MIGRATION_URL: migrationUrl.toString() },
});
child.on("error", () => { console.error("Cannot start Supabase command"); process.exitCode = 1; });
child.on("exit", code => { process.exitCode = code ?? 1; });
