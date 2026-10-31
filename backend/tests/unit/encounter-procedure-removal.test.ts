import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => {
  const tx = {
    invoice: { findMany: vi.fn() }, invoiceCorrection: { findFirst: vi.fn() },
    encounterProcedure: { delete: vi.fn(), update: vi.fn() },
    svbAuthorizationItem: { findUnique: vi.fn(), update: vi.fn() },
    svbAuthorization: { findUnique: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return { tx, encounter: vi.fn(), procedure: vi.fn(), transaction: vi.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx)) };
});
vi.mock("../../src/infrastructure/database/prisma.js", () => ({ prisma: { $transaction: state.transaction } }));
vi.mock("../../src/modules/clinical-encounters/clinical-encounter.repository.js", () => ({ clinicalEncounterRepository: { findById: state.encounter } }));
vi.mock("../../src/modules/encounter-procedures/encounter-procedure.repository.js", () => ({ encounterProcedureRepository: { findById: state.procedure }, encounterProcedureSelect: {} }));
vi.mock("../../src/modules/encounter-procedures/encounter-procedure.types.js", () => ({ toEncounterProcedureResponse: (value: unknown) => value }));
import { Prisma } from "../../src/generated/prisma/client.js";
import { encounterProcedureService } from "../../src/modules/encounter-procedures/encounter-procedure.service.js";

const actor = { userId: 2n, organizationId: 3n, email: "test@local.invalid", firstName: "Test", lastName: "Provider", roles: [], permissions: ["procedure.update"] };
const row = {
  id: 1n, encounterId: 4n, patientInsuranceId: 5n, svbProcedureId: 6n, svbTariffId: 7n, authorizationItemId: 8n,
  diagnosisId: null, performedByProviderId: 9n, procedureCodeSnapshot: "TEST", procedureDescriptionSnapshot: "Test service",
  providerIdSnapshot: "12345", insuredIdSnapshot: "123456789", unitTariffSnapshot: new Prisma.Decimal("10.00"),
  currencyCodeSnapshot: "ANG", quantity: new Prisma.Decimal("2.00"), amount: new Prisma.Decimal("20.00"),
  authorizationIdSnapshot: "AUTH-1", diagnosticCodeSnapshot: null, treatmentIdSnapshot: null, accidentFormNumberSnapshot: null,
  numberOfTreatmentsSnapshot: null, assistanceSnapshot: null, referrerIdSnapshot: null, policlinicSnapshot: null,
  performedAt: new Date("2026-10-30T15:00:00Z"), additionalNote: null, status: "PERFORMED", createdByUserId: 2n,
  invoiceItems: [] as { id: bigint }[],
};
describe("Mistaken service removal and historical correction", () => {
  beforeEach(() => {
    state.encounter.mockResolvedValue({ status: "OPEN", appointment: { appointmentNumber: "APT-4" } });
    state.procedure.mockResolvedValue({ ...row });
    state.tx.svbAuthorizationItem.findUnique.mockResolvedValue({ authorizationId: 10n, usedQuantity: new Prisma.Decimal("2.00") });
    state.tx.svbAuthorization.findUnique.mockResolvedValue({ status: "PARTIALLY_USED", items: [] });
    state.tx.invoice.findMany.mockResolvedValue([{ id: 11n, organizationId: 3n, status: "CORRECTION_REQUIRED", currentVersion: { id: 12n, status: "DRAFT", contentHash: null } }]);
    state.tx.invoiceCorrection.findFirst.mockResolvedValue({ id: 13n, sourceVersionId: 14n });
  });
  it("removes an unbilled mistake and releases its quantity so it can be added again", async () => {
    await encounterProcedureService.remove(4n, 1n, actor, {});
    expect(state.tx.encounterProcedure.delete).toHaveBeenCalledWith({ where: { id: 1n } });
    expect(state.tx.encounterProcedure.update).not.toHaveBeenCalled();
    expect(state.tx.svbAuthorizationItem.update).toHaveBeenCalledWith({ where: { id: 8n }, data: { usedQuantity: { decrement: row.quantity } } });
  });
  it("voids a previously invoiced mistake while retaining its signed invoice links", async () => {
    state.procedure.mockResolvedValue({ ...row, invoiceItems: [{ id: 15n }] });
    const result = await encounterProcedureService.remove(4n, 1n, actor, {});
    expect(result.status).toBe("VOID");
    expect(state.tx.encounterProcedure.delete).not.toHaveBeenCalled();
    expect(state.tx.encounterProcedure.update).toHaveBeenCalledWith({ where: { id: 1n }, data: { status: "VOID" } });
    expect(state.tx.svbAuthorizationItem.update).toHaveBeenCalledOnce();
  });
  it("does not remove billed services without an approved clinical return", async () => {
    state.procedure.mockResolvedValue({ ...row, invoiceItems: [{ id: 15n }] });
    state.tx.invoiceCorrection.findFirst.mockResolvedValue(null);
    await expect(encounterProcedureService.remove(4n, 1n, actor, {})).rejects.toMatchObject({ code: "ENCOUNTER_PROCEDURE_ALREADY_BILLED" });
    expect(state.tx.svbAuthorizationItem.update).not.toHaveBeenCalled();
    expect(state.tx.encounterProcedure.update).not.toHaveBeenCalled();
  });
  it("does not release authorization twice when the removed historical service is retried", async () => {
    state.procedure.mockResolvedValue({ ...row, status: "VOID", invoiceItems: [{ id: 15n }] });
    await expect(encounterProcedureService.remove(4n, 1n, actor, {})).rejects.toMatchObject({ code: "ENCOUNTER_PROCEDURE_NOT_EDITABLE" });
    expect(state.tx.svbAuthorizationItem.update).not.toHaveBeenCalled();
  });
  it("requires an open clinical encounter even for an administrator", async () => {
    state.encounter.mockResolvedValue({ status: "COMPLETED" });
    await expect(encounterProcedureService.remove(4n, 1n, { ...actor, roles: ["ADMIN"] }, {})).rejects.toMatchObject({ code: "CLINICAL_ENCOUNTER_NOT_EDITABLE" });
    expect(state.tx.encounterProcedure.delete).not.toHaveBeenCalled();
  });
});
