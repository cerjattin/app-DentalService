import dotenv from "dotenv";
import { resolve } from "node:path";

dotenv.config({ quiet: true });
// An explicit overlay preserves the existing MySQL .env for reference.
if (process.env.ODONTHO_ENV_FILE) {
  const result = dotenv.config({ path: resolve(process.env.ODONTHO_ENV_FILE), override: true, quiet: true });
  if (result.error) throw new Error("Cannot load ODONTHO_ENV_FILE");
}
