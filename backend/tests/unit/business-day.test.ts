import { describe, expect, it } from "vitest";
import { businessDayBounds } from "../../src/shared/utils/business-day.js";

describe("appointment business-day boundaries", () => {
  const bounds = businessDayBounds("2026-10-30");
  it("uses Curaçao midnight through the following midnight, exclusively", () => {
    expect(bounds.gte.toISOString()).toBe("2026-10-30T04:00:00.000Z");
    expect(bounds.lt.toISOString()).toBe("2026-10-31T04:00:00.000Z");
  });
  it.each(["00:00:00", "19:59:00", "20:00:00", "23:59:59"])(
    "includes %s on the business date",
    (time) => {
      const instant = new Date(`2026-10-30T${time}-04:00`);
      expect(instant >= bounds.gte && instant < bounds.lt).toBe(true);
    },
  );
  it.each(["2026-10-29T23:59:59-04:00", "2026-10-31T00:00:00-04:00"])(
    "excludes the adjacent day: %s",
    (value) => {
      const instant = new Date(value);
      expect(instant >= bounds.gte && instant < bounds.lt).toBe(false);
    },
  );
  it("handles leap days and preserves strict date-only validation", () => {
    expect(businessDayBounds("2024-02-29").lt.toISOString()).toBe(
      "2024-03-01T04:00:00.000Z",
    );
    expect(() => businessDayBounds("2026-02-29")).toThrow();
    expect(() => businessDayBounds("2026-10-30T00:00:00Z")).toThrow();
  });
});
