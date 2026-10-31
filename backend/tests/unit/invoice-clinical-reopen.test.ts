import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    invoice: { findMany: vi.fn(), update: vi.fn(), create: vi.fn() },
    invoiceVersion: { create: vi.fn(), update: vi.fn() },
    invoiceCorrection: { findFirst: vi.fn(), create: vi.fn() },
    declarationItem: { findFirst: vi.fn() },
    clinicalEncounter: { findFirst: vi.fn(), update: vi.fn() },
    appointment: { findFirst: vi.fn() },
    patientInsurance: { findFirst: vi.fn() },
    invoiceItem: { create: vi.fn(), findMany: vi.fn() },
    invoiceStatusHistory: { create: vi.fn() },
    auditLog: { create: vi.fn() },
    numberSequence: { updateMany: vi.fn() },
  };
  return { tx, transaction: vi.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx)) };
});
vi.mock("../../src/infrastructure/database/prisma.js", () => ({ prisma: { $transaction: state.transaction } }));

import { Prisma, type InvoiceStatus, type InvoiceVersionStatus } from "../../src/generated/prisma/client.js";
import { invoiceRepository, type InvoiceRecord, type InvoiceVersionRecord } from "../../src/modules/invoices/invoice.repository.js";
import { assertProcedureBillingEditable, reopenInvoiceEncounter } from "../../src/modules/invoices/invoice-clinical-reopen.service.js";
import { reopenInvoiceEncounterSchema } from "../../src/modules/invoices/invoice.schemas.js";
import { invoiceService } from "../../src/modules/invoices/invoice.service.js";

const date = new Date("2026-10-30T15:00:00Z");
const actor = { userId: 2n, organizationId: 3n, email: "test@local.invalid", firstName: "Test", lastName: "Admin", roles: [],
  permissions: ["invoice.apply_correction", "encounter.update", "procedure.update"] };
const input = { reason: "Wrong service selected", expectedVersionId: "20" };
let invoice: InvoiceRecord;
let replacement: InvoiceVersionRecord;

function fixture(status: InvoiceStatus = "CLOSED"): InvoiceRecord {
  const version: InvoiceVersionRecord = {
    id: 20n, invoiceId: 10n, versionNumber: 1, versionType: "ORIGINAL", supersedesVersionId: null,
    status: status as InvoiceVersionStatus, invoiceDate: date, currencyCode: "ANG", totalAmount: new Prisma.Decimal("100.00"),
    declarantIdSnapshot: "12345", patientNameSnapshot: "Test Patient", patientDocumentTypeSnapshot: null,
    patientDocumentNumberSnapshot: null, insuredIdSnapshot: "123456789", contentHash: "a".repeat(64), preparedByUserId: 2n,
    lockedAt: date, signedAt: date, closedAt: status === "CLOSED" ? date : null, supersededAt: null,
    createdAt: date, updatedAt: date, items: [],
  };
  return {
    id: 10n, organizationId: 3n, appointmentId: 40n, patientId: 50n, patientInsuranceId: 60n, invoiceNumber: "INV-000010",
    status, currentVersionId: 20n, createdByUserId: 2n, cancelledByUserId: null, cancelledAt: null, cancellationReason: null,
    createdAt: date, updatedAt: date, appointment: { id: 40n, appointmentNumber: "APT-40", scheduledStartAt: date, scheduledEndAt: date, status: "COMPLETED" },
    patient: { id: 50n, patientNumber: "PAT-50", firstName: "Test", middleName: null, lastName: "Patient", secondLastName: null, documentType: null, documentNumber: null },
    patientInsurance: { id: 60n, insuredId: "123456789", status: "ACTIVE", payer: { id: 70n, code: "SVB", name: "SVB" } },
    currentVersion: version, versions: [version],
  };
}

describe("Clinical invoice return with transaction doubles (no database rollback proof)", () => {
  beforeEach(() => {
    invoice = fixture();
    replacement = { ...invoice.currentVersion!, id: 21n, versionNumber: 2, versionType: "CORRECTION", supersedesVersionId: 20n,
      status: "DRAFT", contentHash: null, lockedAt: null, signedAt: null, closedAt: null, totalAmount: new Prisma.Decimal("0.00"), items: [] };
    vi.spyOn(invoiceRepository, "findById").mockImplementation(() => Promise.resolve(invoice) as ReturnType<typeof invoiceRepository.findById>);
    vi.spyOn(invoiceRepository, "findByAppointmentId").mockImplementation(() => Promise.resolve(invoice) as ReturnType<typeof invoiceRepository.findByAppointmentId>);
    state.tx.invoiceCorrection.findFirst.mockResolvedValue(null);
    state.tx.declarationItem.findFirst.mockResolvedValue(null);
    state.tx.clinicalEncounter.findFirst.mockResolvedValue({ id: 30n, status: "COMPLETED", completedAt: date });
    state.tx.invoiceVersion.create.mockResolvedValue(replacement);
    state.tx.invoice.update.mockImplementation(async ({ data }) => {
      invoice = { ...invoice, ...data, currentVersion: data.currentVersionId === 21n ? replacement : invoice.currentVersion };
      return invoice;
    });
    state.tx.invoiceVersion.update.mockImplementation(async ({ data }) => {
      Object.assign(replacement, data);
      return replacement;
    });
    state.tx.invoice.findMany.mockResolvedValue([]);
    state.tx.invoiceItem.findMany.mockResolvedValue([]);
    state.tx.invoiceItem.create.mockImplementation(async ({ data }) => {
      const row = { ...data, id: 100n, createdAt: date, updatedAt: date };
      replacement.items.push(row);
      return row;
    });
    state.tx.auditLog.create.mockResolvedValue({ id: 1n });
  });

  it.each(["DRAFT", "PENDING_SIGNATURE", "SIGNED", "CLOSED"] as const)("returns %s to care with a fresh unsigned version and untouched source", async (status) => {
    invoice = fixture(status);
    const source = invoice.currentVersion!;
    const hash = source.contentHash;
    const result = await reopenInvoiceEncounter(10n, input, actor, {});
    expect(result.currentVersionId).toBe("21");
    expect(result.currentVersion?.items).toEqual([]);
    expect(result.currentVersion?.contentHash).toBeNull();
    expect(source.status).toBe(status);
    expect(source.contentHash).toBe(hash);
    expect(state.tx.invoiceVersion.update).not.toHaveBeenCalled();
    expect(state.tx.clinicalEncounter.update).toHaveBeenCalledWith({ where: { id: 30n }, data: { status: "OPEN", completedAt: null } });
    expect(state.tx.invoiceCorrection.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "APPROVED", sourceVersionId: 20n, replacementVersionId: 21n }) }));
    expect(state.transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ isolationLevel: "Serializable" }));
    expect(state.tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "INVOICE_ENCOUNTER_REOPEN", reason: input.reason }) }));
    expect(state.tx.numberSequence.updateMany).not.toHaveBeenCalled();
  });

  it.each(actor.permissions)("requires %s regardless of role name", async (permission) => {
    await expect(reopenInvoiceEncounter(10n, input, { ...actor, roles: ["ADMIN"], permissions: actor.permissions.filter((p) => p !== permission) }, {}))
      .rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    expect(state.transaction).not.toHaveBeenCalled();
  });
  it("keeps ownership scoped to the actor and conceals another organization's invoice", async () => {
    vi.mocked(invoiceRepository.findById).mockResolvedValue(null);
    await expect(reopenInvoiceEncounter(10n, input, actor, {})).rejects.toMatchObject({ code: "INVOICE_NOT_FOUND" });
    expect(invoiceRepository.findById).toHaveBeenCalledWith(10n, actor.organizationId, state.tx);
  });
  it("rejects a stale version without creating a replacement", async () => {
    await expect(reopenInvoiceEncounter(10n, { ...input, expectedVersionId: "19" }, actor, {})).rejects.toMatchObject({ code: "INVOICE_VERSION_CONFLICT" });
    expect(state.tx.invoiceVersion.create).not.toHaveBeenCalled();
  });
  it.each(["CANCELLED", "CORRECTION_REQUIRED", "DECLARED"] as const)("rejects invoice state %s", async (status) => {
    invoice.status = status;
    await expect(reopenInvoiceEncounter(10n, input, actor, {})).rejects.toMatchObject({ code: "INVOICE_ENCOUNTER_NOT_REOPENABLE" });
  });
  it("blocks a second active correction", async () => {
    state.tx.invoiceCorrection.findFirst.mockResolvedValue({ id: 4n });
    await expect(reopenInvoiceEncounter(10n, input, actor, {})).rejects.toMatchObject({ code: "INVOICE_CORRECTION_ALREADY_ACTIVE" });
  });
  it("blocks invoices assigned to a non-cancelled declaration", async () => {
    state.tx.declarationItem.findFirst.mockResolvedValue({ id: 4n });
    await expect(reopenInvoiceEncounter(10n, input, actor, {})).rejects.toMatchObject({ code: "INVOICE_DECLARATION_ASSIGNED" });
    expect(state.tx.invoiceVersion.create).not.toHaveBeenCalled();
  });
  it("rejects non-completed clinical care", async () => {
    state.tx.clinicalEncounter.findFirst.mockResolvedValue({ id: 30n, status: "OPEN" });
    await expect(reopenInvoiceEncounter(10n, input, actor, {})).rejects.toMatchObject({ code: "INVOICE_ENCOUNTER_NOT_REOPENABLE" });
  });
  it("does not swallow an audit failure", async () => {
    state.tx.auditLog.create.mockRejectedValue(new Error("audit unavailable"));
    await expect(reopenInvoiceEncounter(10n, input, actor, {})).rejects.toThrow("audit unavailable");
  });
  it("validates a nonempty reason, string version ID and strict input", () => {
    expect(reopenInvoiceEncounterSchema.safeParse(input).success).toBe(true);
    for (const body of [{ ...input, reason: " " }, { ...input, expectedVersionId: 20 }, { ...input, organizationId: "999" }]) {
      expect(reopenInvoiceEncounterSchema.safeParse(body).success).toBe(false);
    }
  });

  it("prevents editing billed care outside an approved clinical return", async () => {
    state.tx.invoice.findMany.mockResolvedValue([invoice]);
    await expect(assertProcedureBillingEditable(state.tx as unknown as Prisma.TransactionClient, 80n, actor.organizationId))
      .rejects.toMatchObject({ code: "ENCOUNTER_PROCEDURE_ALREADY_BILLED" });
  });
  it("allows billed care changes only while the clinical replacement is unsigned", async () => {
    state.tx.invoice.findMany.mockResolvedValue([{ ...invoice, status: "CORRECTION_REQUIRED", currentVersion: replacement }]);
    state.tx.invoiceCorrection.findFirst.mockResolvedValue({ id: 4n, sourceVersionId: 20n });
    await expect(assertProcedureBillingEditable(state.tx as unknown as Prisma.TransactionClient, 80n, actor.organizationId)).resolves.toBeUndefined();
    replacement.status = "SIGNED";
    await expect(assertProcedureBillingEditable(state.tx as unknown as Prisma.TransactionClient, 80n, actor.organizationId)).rejects.toMatchObject({ code: "ENCOUNTER_PROCEDURE_ALREADY_BILLED" });
  });

  it("rebuilds from corrected services with exact totals and the same logical invoice/number", async () => {
    const source = invoice.currentVersion!;
    invoice = { ...invoice, status: "CORRECTION_REQUIRED", currentVersionId: 21n, currentVersion: replacement, versions: [...invoice.versions, replacement] };
    state.tx.invoiceCorrection.findFirst.mockResolvedValue({ id: 4n, sourceVersionId: 20n });
    const procedure = {
      id: 80n, encounterId: 30n, patientInsuranceId: 60n, svbProcedureId: 90n, svbTariffId: 91n,
      quantity: new Prisma.Decimal("3.00"), unitTariffSnapshot: new Prisma.Decimal("10.10"), amount: new Prisma.Decimal("30.30"),
      currencyCodeSnapshot: "ANG", procedureCodeSnapshot: "CORRECT", procedureDescriptionSnapshot: "Correct service",
      insuredIdSnapshot: "123456789", providerIdSnapshot: "12345", diagnosisId: null, svbTariff: { svbProcedureId: 90n },
      authorizationIdSnapshot: null, diagnosticCodeSnapshot: null, treatmentIdSnapshot: null,
      accidentFormNumberSnapshot: null, numberOfTreatmentsSnapshot: null, assistanceSnapshot: null,
      referrerIdSnapshot: null, policlinicSnapshot: null, additionalNote: null,
    };
    state.tx.appointment.findFirst.mockResolvedValue({
      ...invoice.appointment, patientId: 50n, patient: invoice.patient, organization: { declarantId: "12345" },
      clinicalEncounter: { id: 30n, appointmentId: 40n, status: "COMPLETED", procedures: [procedure] },
    });
    state.tx.patientInsurance.findFirst.mockResolvedValue({ id: 60n, insuredId: "123456789" });
    const result = await invoiceService.createFromAppointment(40n, actor, {});
    expect(result.id).toBe("10");
    expect(result.invoiceNumber).toBe("INV-000010");
    expect(result.currentVersion?.totalAmount).toBe("30.30");
    expect(result.currentVersion?.items[0]?.procedureCodeSnapshot).toBe("CORRECT");
    expect(source.totalAmount.toFixed(2)).toBe("100.00");
    expect(source.contentHash).toBe("a".repeat(64));
    expect(state.tx.numberSequence.updateMany).not.toHaveBeenCalled();
    expect(state.tx.invoice.create).not.toHaveBeenCalled();
    expect(state.tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "INVOICE_REBUILD" }) }));
  });
  it("will not prepare the empty replacement for signature", async () => {
    invoice = { ...invoice, status: "CORRECTION_REQUIRED", currentVersionId: 21n, currentVersion: replacement };
    await expect(invoiceService.prepareForSignature(10n, 21n, actor, {})).rejects.toMatchObject({ code: "INVOICE_NOT_PREPARABLE" });
  });
});
