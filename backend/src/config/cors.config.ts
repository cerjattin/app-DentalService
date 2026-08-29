import type { CorsOptions } from "cors";

import { env } from "./env.js";

function parseAllowedOrigins() {
  const source = env.CORS_ALLOWED_ORIGINS ?? env.CORS_ORIGIN;

  return source
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0 && origin !== "*");
}

const allowedOrigins = new Set(parseAllowedOrigins());

export const corsOptions: CorsOptions = {
  credentials: true,

  origin(origin, callback) {
    if (origin === undefined) {
      callback(null, true);
      return;
    }

    callback(null, allowedOrigins.has(origin));
  },
};

export const configuredCorsOrigins = [...allowedOrigins];
