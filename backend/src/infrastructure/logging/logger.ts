import pino from "pino";

import { env } from "../../config/env.js";

export const logger = pino({
  level: env.LOG_LEVEL,

  base: {
    service: "odontho-svb-backend",
    environment: env.NODE_ENV,
  },

  redact: {
    paths: [
      "password",
      "*.password",
      "passwordHash",
      "*.passwordHash",
      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers['set-cookie']",
      "accessToken",
      "*.accessToken",
      "refreshToken",
      "*.refreshToken",
      "token",
      "*.token",
      "secret",
      "*.secret",
      "authorization",
      "*.authorization",
      "cookie",
      "*.cookie",
      "DATABASE_URL",
      "*.DATABASE_URL",
      "DATABASE_PASSWORD",
      "*.DATABASE_PASSWORD",
      "SUPABASE_SERVICE_ROLE_KEY",
      "*.SUPABASE_SERVICE_ROLE_KEY",
      "apikey",
      "*.apikey",
    ],
    censor: "[REDACTED]",
  },

  timestamp: pino.stdTimeFunctions.isoTime,
});
