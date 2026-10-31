import { describe, expect, it } from "vitest";
import { Prisma } from "../../src/generated/prisma/client.js";
import { isTransactionConflict } from "../../src/infrastructure/database/transaction-conflict.js";
import { updateOrganizationSchema } from "../../src/modules/organization/organization.schemas.js";
import { createTreatmentCaseSchema, updateTreatmentCaseSchema } from "../../src/modules/treatment-cases/treatment-case.schemas.js";
import { declarationCandidatesQuerySchema, declarationReasonSchema } from "../../src/modules/declarations/declaration.schemas.js";
import { diagnoseSvbDeclarationRow, validateSvbDeclarationRow, type SvbDeclarationRow } from "../../src/modules/declarations/export/declaration-row.mapper.js";

describe("NEG-FUNC strict input contracts", () => {
  const revision = "a".repeat(64);
  it("requires reason, revision and a real mutable organization field", () => {
    expect(updateOrganizationSchema.safeParse({ expectedRevision: revision, reason: "QA" }).success).toBe(false);
    expect(updateOrganizationSchema.safeParse({ reason: "QA", phone: "QA" }).success).toBe(false);
    expect(updateOrganizationSchema.safeParse({ expectedRevision: revision, reason: "  ", phone: "QA" }).success).toBe(false);
    for (const field of ["organizationId", "id", "timezone", "isActive", "lastItemSequence"]) {
      expect(updateOrganizationSchema.safeParse({ expectedRevision: revision, reason: "QA", phone: "QA", [field]: "1" }).success).toBe(false);
    }
    expect(updateOrganizationSchema.parse({ expectedRevision: revision, reason: " QA ", declarantId: "00123", phone: null })).toMatchObject({ reason: "QA", declarantId: "00123", phone: null });
  });
  it.each(["", "123456", "12.3", " 123", 123])("rejects invalid new Declarant ID %s", (declarantId) => {
    expect(updateOrganizationSchema.safeParse({ expectedRevision: revision, reason: "QA", declarantId }).success).toBe(false);
  });
  it("distinguishes external treatment references from internal IDs and lifecycle fields", () => {
    expect(createTreatmentCaseSchema.parse({ treatmentId: "0000123" }).treatmentId).toBe("0000123");
    for (const body of [{ treatmentId: "12345678" }, { treatmentId: "" }, { treatmentId: null }, { treatmentId: 123 }, { treatmentId: "123", status: "ACTIVE" }, { treatmentId: "123", patientId: "1" }]) {
      expect(createTreatmentCaseSchema.safeParse(body).success).toBe(false);
    }
    expect(updateTreatmentCaseSchema.safeParse({}).success).toBe(false);
    expect(updateTreatmentCaseSchema.parse({ description: null })).toEqual({ description: null });
  });
  it("rejects hidden candidate organization filters, excessive pages and empty deletion reasons", () => {
    expect(declarationCandidatesQuerySchema.safeParse({ organizationId: "1" }).success).toBe(false);
    expect(declarationCandidatesQuerySchema.safeParse({ pageSize: "101" }).success).toBe(false);
    expect(declarationReasonSchema.safeParse({ reason: " " }).success).toBe(false);
    expect(declarationReasonSchema.safeParse({ reason: "QA", invoiceItemId: "1" }).success).toBe(false);
  });
});

describe("Shared SVB diagnostics and transaction conflicts", () => {
  const row: SvbDeclarationRow = { declarantId: "00123", invoiceNumber: "INV-1", detailInvoiceNumber: "D-1",
    providerId: "12345", date: "01-09-2026", insuredId: "012345678", accidentFormNumber: "", treatmentId: "000001",
    amount: "9999999999999.99", authorizationId: "", numberOfTreatments: "1", assistance: "Y", referrerId: "",
    diagnosticCode: "", policlinic: "P", additionalNote: "" };
  it("reports all missing fields while READY preserves its original first-error contract", () => {
    expect(diagnoseSvbDeclarationRow(row)).toEqual([]);
    const missing = { ...row, numberOfTreatments: "", assistance: "", providerId: "bad" };
    expect(diagnoseSvbDeclarationRow(missing)).toEqual([
      { field: "NumberOfTreatments", code: "DECLARATION_SVB_DATA_INCOMPLETE" },
      { field: "Assistance", code: "DECLARATION_SVB_DATA_INCOMPLETE" },
      { field: "ProviderId", code: "DECLARATION_SVB_DATA_INVALID" },
    ]);
    expect(() => validateSvbDeclarationRow(missing)).toThrow("missing required SVB field NumberOfTreatments");
  });
  it("retries actual PostgreSQL serialization/deadlock errors without swallowing unrelated failures", () => {
    const error = (code: string, meta?: Record<string,unknown>) => new Prisma.PrismaClientKnownRequestError("QA", { code, clientVersion: "7.9.1", ...(meta ? { meta } : {}) });
    expect(isTransactionConflict(error("P2034"))).toBe(true);
    expect(isTransactionConflict(error("P2010", { code: "40001" }))).toBe(true);
    expect(isTransactionConflict(error("P2010", { driverAdapterError: { cause: { originalCode: "40P01" } } }))).toBe(true);
    expect(isTransactionConflict(error("P2010", { code: "23505" }))).toBe(false);
    expect(isTransactionConflict(new Error("40001"))).toBe(false);
  });
});
