import "dotenv/config";
import { z } from "zod";

const envSchema = z
  .object({
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

  AUTH_LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(60_000),

  AUTH_LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),

  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),

  CORS_ORIGIN: z.string().default("http://localhost:5173"),

  CORS_ALLOWED_ORIGINS: z.string().optional(),

  OPENAPI_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),

  DOCUMENT_STORAGE_PATH: z.string().min(1).default("storage/documents"),

    DOCUMENT_MAX_UPLOAD_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .max(25 * 1024 * 1024)
      .default(5 * 1024 * 1024),
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV !== "production") {
      return;
    }

    if (
      value.CORS_ALLOWED_ORIGINS === undefined ||
      value.CORS_ALLOWED_ORIGINS
        .split(",")
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0 && origin !== "*").length === 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["CORS_ALLOWED_ORIGINS"],
        message:
          "CORS_ALLOWED_ORIGINS must list explicit origins in production",
      });
    }
  });

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const errors = result.error.flatten().fieldErrors;

  throw new Error(
    `Invalid environment configuration:\n${JSON.stringify(errors, null, 2)}`,
  );
}

export const env = result.data;

export type Env = typeof env;
