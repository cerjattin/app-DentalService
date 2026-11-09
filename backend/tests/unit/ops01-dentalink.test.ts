import { afterEach, describe, it, expect, vi } from "vitest";
import { env } from "../../src/config/env.js";
import {
  dentalinkAdapterProvider,
  getDentalinkAdapter,
} from "../../src/modules/dentalink/dentalink.adapter.js";
import {
  externalId,
  accountSchema,
  normalizedPatientSchema,
  normalizedAppointmentSchema,
  previewSchema,
} from "../../src/modules/dentalink/dentalink.schemas.js";
const original = { node: env.NODE_ENV, url: env.DATABASE_URL };
afterEach(() => {
  env.NODE_ENV = original.node;
  env.DATABASE_URL = original.url;
  vi.restoreAllMocks();
});
describe("OPS01 normalized reader and capability limits", () => {
  it("keeps the real reader unconfigured and synthetic implementation out of runtime defaults", () => {
    expect(getDentalinkAdapter()).toBeUndefined();
  });
  it.each([
    "postgresql://qa@remote.invalid/qa_test",
    "postgresql://qa@127.0.0.1/clinic",
    "mysql://qa@127.0.0.1/qa_test",
  ])("rejects a synthetic reader outside dedicated PostgreSQL: %s", (url) => {
    vi.spyOn(dentalinkAdapterProvider, "resolve").mockReturnValue({
      kind: "SYNTHETIC",
      readPage: async () => ({}),
    });
    env.DATABASE_URL = url;
    expect(() => getDentalinkAdapter()).toThrow(
      expect.objectContaining({ code: "DENTALINK_SYNTHETIC_QA_ONLY" }),
    );
  });
  it("rejects a synthetic reader in production even when the URL looks like QA", () => {
    vi.spyOn(dentalinkAdapterProvider, "resolve").mockReturnValue({
      kind: "SYNTHETIC",
      readPage: async () => ({}),
    });
    env.NODE_ENV = "production";
    expect(() => getDentalinkAdapter()).toThrow(
      expect.objectContaining({ code: "DENTALINK_SYNTHETIC_QA_ONLY" }),
    );
  });
  it("preserves exact textual IDs and rejects whitespace, controls and client credentials", () => {
    expect(externalId.parse("0000123")).toBe("0000123");
    for (const value of [" 123", "123\n", ""])
      expect(externalId.safeParse(value).success).toBe(false);
    expect(
      accountSchema.safeParse({
        externalAccountId: "001",
        label: "QA",
        token: "secret",
      }).success,
    ).toBe(false);
  });
  it("validates local required fields, explicit source eligibility and timestamps with offsets", () => {
    expect(normalizedPatientSchema.safeParse({ firstName: "QA" }).success).toBe(
      false,
    );
    const appointment = {
      patientExternalId: "0001",
      providerExternalId: "0002",
      locationExternalId: "0003",
      start: "2027-01-01T10:00:00-04:00",
      end: "2027-01-01T10:30:00-04:00",
      eligibility: "NEW_APPOINTMENT",
    };
    expect(normalizedAppointmentSchema.safeParse(appointment).success).toBe(
      true,
    );
    expect(
      normalizedAppointmentSchema.safeParse({
        ...appointment,
        start: "2027-01-01T10:00:00",
      }).success,
    ).toBe(false);
    expect(
      previewSchema.safeParse({
        idempotencyKey: "synthetic-key-0001",
        from: appointment.start,
      }).success,
    ).toBe(false);
  });
});
