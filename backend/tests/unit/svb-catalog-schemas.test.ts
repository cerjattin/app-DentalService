import { describe, expect, it } from "vitest";
import {
  createSvbProcedureSchema,
  updateSvbProcedureSchema,
  svbProcedureStatusSchema,
  createSvbTariffSchema,
  updateSvbTariffSchema,
} from "../../src/modules/svb-catalog/svb-catalog.schemas.js";

const base = { amount: "88.80", currencyCode: "ANG", validFrom: "2026-01-01" };
describe("SVB catalogue mutation schemas", () => {
  it.each([
    88.8,
    "1e2",
    "-0.01",
    "1.001",
    "10000000000000.00",
    "NaN",
    "Infinity",
  ])("rejects unsafe Decimal input %s", (amount) => {
    expect(createSvbTariffSchema.safeParse({ ...base, amount }).success).toBe(
      false,
    );
    expect(updateSvbTariffSchema.safeParse({ amount }).success).toBe(false);
  });
  it.each(["0", "0.00", "88.80", "9999999999999.99"])(
    "preserves Decimal string %s",
    (amount) => {
      expect(createSvbTariffSchema.parse({ ...base, amount }).amount).toBe(
        amount,
      );
    },
  );
  it("requires explicit currency and normalizes it without inventing defaults", () => {
    expect(
      createSvbTariffSchema.parse({ ...base, currencyCode: "usd" })
        .currencyCode,
    ).toBe("USD");
    expect(
      createSvbTariffSchema.safeParse({
        amount: "88.80",
        validFrom: base.validFrom,
      }).success,
    ).toBe(false);
  });
  it.each(["id", "createdAt", "updatedAt", "procedureCodeSnapshot"])(
    "rejects immutable field %s",
    (field) => {
      expect(
        createSvbProcedureSchema.safeParse({
          code: "TEST",
          description: "Test",
          [field]: "1",
        }).success,
      ).toBe(false);
      expect(updateSvbProcedureSchema.safeParse({ [field]: "1" }).success).toBe(
        false,
      );
    },
  );
  it("rejects parent reassignment, empty patches, nonboolean status, and extra status fields", () => {
    expect(
      updateSvbTariffSchema.safeParse({ svbProcedureId: "2" }).success,
    ).toBe(false);
    expect(updateSvbTariffSchema.safeParse({}).success).toBe(false);
    expect(updateSvbProcedureSchema.safeParse({}).success).toBe(false);
    expect(
      svbProcedureStatusSchema.safeParse({ isActive: "false" }).success,
    ).toBe(false);
    expect(
      svbProcedureStatusSchema.safeParse({ isActive: false, code: "EDIT" })
        .success,
    ).toBe(false);
  });
});
