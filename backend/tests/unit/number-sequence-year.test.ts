import { describe, expect, it } from "vitest";

import { getDefaultSequenceYear } from "../../src/modules/number-sequences/number-sequence-year.js";

describe("getDefaultSequenceYear", () => {
  it("uses year 0 for patient numbers", () => {
    expect(getDefaultSequenceYear("PATIENT")).toBe(0);
  });

  it("uses Curacao year for annual sequences", () => {
    const date = new Date("2026-08-18T15:00:00.000Z");

    expect(getDefaultSequenceYear("INVOICE", date)).toBe(2026);

    expect(getDefaultSequenceYear("APPOINTMENT", date)).toBe(2026);

    expect(getDefaultSequenceYear("DECLARATION", date)).toBe(2026);
  });
});
