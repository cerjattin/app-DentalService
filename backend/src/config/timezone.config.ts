import { IANAZone, Settings } from "luxon";
import { env } from "./env.js";

if (!IANAZone.isValidZone(env.APP_TIMEZONE)) {
  throw new Error(`Invalid APP_TIMEZONE: ${env.APP_TIMEZONE}`);
}

Settings.defaultZone = env.APP_TIMEZONE;

export const organizationTimezone = env.APP_TIMEZONE;
