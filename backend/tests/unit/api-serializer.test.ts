import { describe, expect, it } from "vitest";

import { serializeApiValue } from "../../src/shared/http/api-serializer.js";

describe("serializeApiValue", () => {
  it("serializes bigint values as strings", () => {
    const result = serializeApiValue({
      id: 1542n,
      patientId: 850n,
    });

    expect(result).toEqual({
      id: "1542",
      patientId: "850",
    });
  });

  it("serializes nested bigint values", () => {
    const result = serializeApiValue({
      patient: {
        id: 10n,
      },

      items: [
        {
          id: 20n,
        },
      ],
    });

    expect(result).toEqual({
      patient: {
        id: "10",
      },

      items: [
        {
          id: "20",
        },
      ],
    });
  });

  it("serializes Date values as ISO strings", () => {
    const date = new Date("2026-08-18T15:00:00.000Z");

    expect(serializeApiValue(date)).toBe("2026-08-18T15:00:00.000Z");
  });
});
