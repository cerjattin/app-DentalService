import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  HOST: z.string().default("0.0.0.0"),

  PORT: z.coerce.number().int().positive().max(65535).default(3000),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  DB_CONNECTION_LIMIT: z.coerce.number().int().positive().max(50).default(5),

  APP_TIMEZONE: z.string().default("America/Curacao"),

  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),

  ACCESS_TOKEN_SECRET: z
    .string()
    .min(32, "ACCESS_TOKEN_SECRET must contain at least 32 characters"),

  ACCESS_TOKEN_TTL: z.string().default("15m"),

  JWT_ISSUER: z.string().default("odontho-svb-backend"),

  JWT_AUDIENCE: z.string().default("odontho-svb-web"),

  AUTH_MAX_FAILED_ATTEMPTS: z.coerce.number().int().min(3).max(20).default(5),

  AUTH_LOCK_MINUTES: z.coerce.number().int().positive().max(1440).default(15),

  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),

  CORS_ORIGIN: z.string().default("http://localhost:5173"),

  OPENAPI_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error("❌ Invalid environment configuration:");

  console.error(JSON.stringify(result.error.flatten().fieldErrors, null, 2));

  process.exit(1);
}

export const env = result.data;

export type Env = typeof env;
