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
      "req.headers.authorization",
      "req.headers.cookie",
      "accessToken",
      "*.accessToken",
      "refreshToken",
      "*.refreshToken",
      "DATABASE_URL",
    ],
    censor: "[REDACTED]",
  },

  timestamp: pino.stdTimeFunctions.isoTime,
});
