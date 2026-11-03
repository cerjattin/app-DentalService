import "./load-env.js";
import { z } from "zod";

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    HOST: z.string().default("0.0.0.0"),

    PORT: z.coerce.number().int().positive().max(65535).default(3000),

    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

    DB_CONNECTION_LIMIT: z.coerce.number().int().positive().max(50).default(5),

    APP_TIMEZONE: z.string().default("America/Curacao"),
    SVB_MANUAL_RECORDING_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),

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
    DOCUMENT_STORAGE_PROVIDER: z.enum(["LOCAL", "SUPABASE"]).default("LOCAL"),
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
    SUPABASE_STORAGE_BUCKET: z
      .string()
      .regex(/^[a-z0-9][a-z0-9_-]{0,62}$/)
      .optional(),
    VERCEL: z.string().optional(),

    DOCUMENT_MAX_UPLOAD_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .max(25 * 1024 * 1024)
      .default(5 * 1024 * 1024),
  })
  .superRefine((value, context) => {
    if (value.SVB_MANUAL_RECORDING_ENABLED) {
      let syntheticTarget = false;
      try {
        const target = new URL(value.DATABASE_URL);
        syntheticTarget =
          ["postgres:", "postgresql:"].includes(target.protocol) &&
          ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) &&
          /^\/[a-z0-9_]+_test$/.test(target.pathname);
      } catch {
        /* Configuration errors must not expose connection strings. */
      }
      if (value.NODE_ENV !== "test" || !syntheticTarget)
        context.addIssue({
          code: "custom",
          path: ["SVB_MANUAL_RECORDING_ENABLED"],
          message:
            "Manual SVB recording can only be enabled explicitly for local synthetic QA (NODE_ENV=test, PostgreSQL _test)",
        });
    }
    if (value.DOCUMENT_STORAGE_PROVIDER === "SUPABASE") {
      for (const name of [
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
        "SUPABASE_STORAGE_BUCKET",
      ] as const) {
        if (!value[name])
          context.addIssue({
            code: "custom",
            path: [name],
            message: "Required for private document storage",
          });
      }
      if (value.SUPABASE_URL) {
        try {
          const url = new URL(value.SUPABASE_URL);
          if (
            url.protocol !== "https:" ||
            url.username ||
            url.password ||
            url.search ||
            url.hash ||
            url.pathname !== "/"
          )
            throw new Error();
        } catch {
          context.addIssue({
            code: "custom",
            path: ["SUPABASE_URL"],
            message:
              "Use an HTTPS project origin without credentials, path or query",
          });
        }
      }
    }
    if (value.VERCEL === "1") {
      if (value.DOCUMENT_STORAGE_PROVIDER !== "SUPABASE")
        context.addIssue({
          code: "custom",
          path: ["DOCUMENT_STORAGE_PROVIDER"],
          message: "Vercel requires persistent external document storage",
        });
      if (value.DOCUMENT_MAX_UPLOAD_BYTES > 4 * 1024 * 1024)
        context.addIssue({
          code: "custom",
          path: ["DOCUMENT_MAX_UPLOAD_BYTES"],
          message: "Configure uploads at or below 4194304 bytes for Vercel",
        });
    }
    if (value.NODE_ENV !== "production") {
      return;
    }

    if (
      value.CORS_ALLOWED_ORIGINS === undefined ||
      value.CORS_ALLOWED_ORIGINS.split(",")
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
    for (const origin of value.CORS_ALLOWED_ORIGINS?.split(",") ?? []) {
      try {
        const url = new URL(origin.trim());
        if (url.origin !== origin.trim() || url.protocol !== "https:")
          throw new Error();
      } catch {
        context.addIssue({
          code: "custom",
          path: ["CORS_ALLOWED_ORIGINS"],
          message: "Production origins must be exact HTTPS origins",
        });
      }
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
