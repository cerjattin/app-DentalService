import { env } from "./env.js";

export const appConfig = {
  name: "ODONTHO SERVICES — SVB BILLING APP",
  environment: env.NODE_ENV,
  host: env.HOST,
  port: env.PORT,
  timezone: env.APP_TIMEZONE,
  apiPrefix: "/api/v1",
} as const;
