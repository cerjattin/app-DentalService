import { DateTime } from "luxon";
import { parseDateOnly } from "./date-only.js";

/** A date filter denotes a Curaçao business day, not a UTC calendar day. */
export function businessDayBounds(value: string, fieldName = "date") {
  parseDateOnly(value, fieldName);
  const start = DateTime.fromISO(value, { zone: "America/Curacao" }).startOf(
    "day",
  );
  return { gte: start.toJSDate(), lt: start.plus({ days: 1 }).toJSDate() };
}
