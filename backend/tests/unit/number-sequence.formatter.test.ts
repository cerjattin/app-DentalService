import { describe, expect, it } from "vitest";

import { formatBusinessNumber } from "../../src/modules/number-sequences/number-sequence.formatter.js";

describe("formatBusinessNumber", () => {
  it("formats PATIENT number", () => {
    expect(formatBusinessNumber("PAT-", 1n, 6)).toBe("PAT-000001");
  });

  it("formats invoice number", () => {
    expect(formatBusinessNumber("OS-", 42n, 6)).toBe("OS-000042");
  });

  it("does not truncate values larger than padding", () => {
    expect(formatBusinessNumber("OS-", 1234567n, 6)).toBe("OS-1234567");
  });

  it("rejects invalid padding", () => {
    expect(() => formatBusinessNumber("OS-", 1n, 0)).toThrow();
  });
});
