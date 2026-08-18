import { organizationTimezone } from "../../config/timezone.config.js";

import type { NumberSequenceTypeCode } from "./number-sequence.types.js";

export function getDefaultSequenceYear(
  sequenceType: NumberSequenceTypeCode,
  now: Date = new Date(),
): number {
  if (sequenceType === "PATIENT") {
    return 0;
  }

  const value = new Intl.DateTimeFormat("en-US", {
    timeZone: organizationTimezone,
    year: "numeric",
  }).format(now);

  const year = Number(value);

  if (!Number.isInteger(year) || year < 1 || year > 65535) {
    throw new Error(
      `Unable to resolve sequence year for timezone ${organizationTimezone}`,
    );
  }

  return year;
}
