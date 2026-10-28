import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    svbProcedure: {
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    svbTariff: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return {
    tx,
    transaction: vi.fn(async (work: (client: typeof tx) => Promise<unknown>) =>
      work(tx),
    ),
  };
});
vi.mock("../../src/infrastructure/database/prisma.js", () => ({
  prisma: { $transaction: state.transaction },
}));
import { Prisma } from "../../src/generated/prisma/client.js";
import { svbCatalogService } from "../../src/modules/svb-catalog/svb-catalog.service.js";

const actor = {
  userId: 2n,
  organizationId: 3n,
  email: "qa@local.invalid",
  firstName: "QA",
  lastName: "Service",
  roles: [],
  permissions: [],
};
const master = {
  id: 9007199254740993n,
  code: "TEST",
  description: "Test",
  category: null,
  unit: null,
  requiresAuthorization: false,
  requiresReferral: false,
  isActive: true,
  validFrom: new Date("2026-01-01Z"),
  validTo: null,
  createdAt: new Date("2026-01-01Z"),
  updatedAt: new Date("2026-01-01Z"),
};
const tariff = {
  id: 4n,
  svbProcedureId: master.id,
  amount: new Prisma.Decimal("88.80"),
  currencyCode: "ANG",
  validFrom: new Date("2026-01-01Z"),
  validTo: new Date("2026-06-30Z"),
  isActive: true,
  createdAt: master.createdAt,
  updatedAt: master.updatedAt,
};
const input = {
  amount: "88.80",
  currencyCode: "ANG",
  validFrom: "2026-01-01",
  validTo: "2026-06-30",
};

describe("SVB master mutation service with transaction double (not database rollback proof)", () => {
  beforeEach(() => {
    state.tx.$queryRaw.mockResolvedValue([{ id: master.id }]);
    state.tx.svbProcedure.findUniqueOrThrow.mockResolvedValue(master);
    state.tx.svbProcedure.create.mockResolvedValue(master);
    state.tx.svbProcedure.update.mockResolvedValue(master);
    state.tx.svbTariff.findFirst.mockResolvedValue(null);
    state.tx.svbTariff.create.mockResolvedValue(tariff);
    state.tx.svbTariff.update.mockResolvedValue(tariff);
    state.tx.auditLog.create.mockResolvedValue({ id: 5n });
  });
  it("creates a procedure and audit through the supplied transaction", async () => {
    const result = await svbCatalogService.createProcedure(
      { code: "TEST", description: "Test", requiresReferral: true },
      actor,
      { correlationId: "qa" },
    );
    expect(result.id).toBe("9007199254740993");
    expect(state.transaction).toHaveBeenCalledOnce();
    expect(state.tx.svbProcedure.create.mock.calls[0]?.[0].data).toMatchObject({
      code: "TEST",
      requiresReferral: true,
      requiresAuthorization: false,
      validFrom: null,
      validTo: null,
    });
    expect(state.tx.auditLog.create.mock.calls[0]?.[0].data).toMatchObject({
      actorUserId: 2n,
      organizationId: 3n,
      action: "SVB_PROCEDURE_CREATE",
      entityId: master.id,
      correlationId: "qa",
      newValues: expect.objectContaining({ id: master.id.toString() }),
    });
  });
  it("locks the exact bigint parent before update and audits serialized before/after", async () => {
    await svbCatalogService.updateProcedure(
      master.id,
      { isActive: false },
      actor,
      {},
    );
    expect(state.tx.$queryRaw.mock.calls[0]?.[1]).toBe(master.id);
    expect(state.tx.svbProcedure.update.mock.calls[0]?.[0].data).toMatchObject({
      isActive: false,
      validFrom: master.validFrom,
      validTo: null,
    });
    expect(state.tx.auditLog.create.mock.calls[0]?.[0].data).toMatchObject({
      action: "SVB_PROCEDURE_UPDATE",
      oldValues: expect.objectContaining({ code: "TEST" }),
    });
  });
  it("rejects inverted procedure create and merged update periods before writing", async () => {
    await expect(
      svbCatalogService.createProcedure(
        {
          code: "TEST",
          description: "Test",
          validFrom: "2026-07-01",
          validTo: "2026-06-30",
        },
        actor,
        {},
      ),
    ).rejects.toMatchObject({ code: "INVALID_SVB_PROCEDURE_PERIOD" });
    await expect(
      svbCatalogService.updateProcedure(
        master.id,
        { validTo: "2025-12-31" },
        actor,
        {},
      ),
    ).rejects.toMatchObject({ code: "INVALID_SVB_PROCEDURE_PERIOD" });
    expect(state.tx.svbProcedure.create).not.toHaveBeenCalled();
    expect(state.tx.svbProcedure.update).not.toHaveBeenCalled();
    expect(state.tx.auditLog.create).not.toHaveBeenCalled();
  });
  it("passes Decimal strings to Prisma and returns two decimal places", async () => {
    const result = await svbCatalogService.createTariff(
      master.id,
      input,
      actor,
      {},
    );
    expect(state.tx.svbTariff.create.mock.calls[0]?.[0].data.amount).toBe(
      "88.80",
    );
    expect(result.amount).toBe("88.80");
    expect(state.tx.auditLog.create.mock.calls[0]?.[0].data).toMatchObject({
      action: "SVB_TARIFF_CREATE",
      newValues: expect.objectContaining({ amount: "88.80" }),
    });
  });
  it("scopes tariff read and update to both parent and tariff IDs", async () => {
    state.tx.svbTariff.findFirst.mockResolvedValueOnce(tariff);
    await svbCatalogService.updateTariff(
      master.id,
      tariff.id,
      { amount: "99.90" },
      actor,
      {},
    );
    expect(state.tx.svbTariff.findFirst.mock.calls[0]?.[0].where).toEqual({
      id: tariff.id,
      svbProcedureId: master.id,
    });
    expect(state.tx.svbTariff.update.mock.calls[0]?.[0]).toMatchObject({
      where: { id: tariff.id, svbProcedureId: master.id },
      data: { amount: "99.90" },
    });
    expect(state.tx.auditLog.create.mock.calls[0]?.[0].data).toMatchObject({
      action: "SVB_TARIFF_UPDATE",
      oldValues: expect.objectContaining({ amount: "88.80" }),
    });
  });
  it("rejects inverted tariff create and merged update periods", async () => {
    await expect(
      svbCatalogService.createTariff(
        master.id,
        { ...input, validTo: "2025-12-31" },
        actor,
        {},
      ),
    ).rejects.toMatchObject({ code: "INVALID_SVB_TARIFF_PERIOD" });
    state.tx.svbTariff.findFirst.mockResolvedValueOnce(tariff);
    await expect(
      svbCatalogService.updateTariff(
        master.id,
        tariff.id,
        { validFrom: "2026-07-01" },
        actor,
        {},
      ),
    ).rejects.toMatchObject({ code: "INVALID_SVB_TARIFF_PERIOD" });
    expect(state.tx.svbTariff.create).not.toHaveBeenCalled();
    expect(state.tx.svbTariff.update).not.toHaveBeenCalled();
  });
  it("rejects missing parent and foreign-parent tariff without updating", async () => {
    state.tx.$queryRaw.mockResolvedValueOnce([]);
    await expect(
      svbCatalogService.updateProcedure(
        master.id,
        { description: "Missing" },
        actor,
        {},
      ),
    ).rejects.toMatchObject({ code: "SVB_PROCEDURE_NOT_FOUND" });
    await expect(
      svbCatalogService.updateTariff(
        master.id,
        9n,
        { amount: "99.99" },
        actor,
        {},
      ),
    ).rejects.toMatchObject({ code: "SVB_TARIFF_NOT_FOUND" });
    expect(state.tx.svbProcedure.update).not.toHaveBeenCalled();
    expect(state.tx.svbTariff.update).not.toHaveBeenCalled();
  });
  it("checks inclusive overlap per parent/currency after acquiring the parent lock", async () => {
    state.tx.svbTariff.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 9n });
    await expect(
      svbCatalogService.createTariff(master.id, input, actor, {}),
    ).rejects.toMatchObject({ code: "SVB_TARIFF_PERIOD_OVERLAP" });
    expect(state.tx.svbTariff.findFirst.mock.calls[1]?.[0].where).toMatchObject(
      {
        svbProcedureId: master.id,
        currencyCode: "ANG",
        isActive: true,
        validFrom: { lte: new Date("2026-06-30Z") },
        OR: [{ validTo: null }, { validTo: { gte: new Date("2026-01-01Z") } }],
      },
    );
    expect(state.tx.svbTariff.create).not.toHaveBeenCalled();
  });
  it("revalidates overlap when activating an inactive tariff", async () => {
    state.tx.svbTariff.findFirst
      .mockResolvedValueOnce({ ...tariff, isActive: false })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 9n });
    await expect(
      svbCatalogService.updateTariff(
        master.id,
        tariff.id,
        { isActive: true },
        actor,
        {},
      ),
    ).rejects.toMatchObject({ code: "SVB_TARIFF_PERIOD_OVERLAP" });
    expect(state.tx.svbTariff.update).not.toHaveBeenCalled();
  });
  it("checks uniqueness for inactive tariffs while allowing their overlapping periods", async () => {
    await svbCatalogService.createTariff(
      master.id,
      { ...input, isActive: false },
      actor,
      {},
    );
    expect(state.tx.svbTariff.findFirst).toHaveBeenCalledOnce();
    state.tx.svbTariff.findFirst.mockResolvedValueOnce({ id: 9n });
    await expect(
      svbCatalogService.createTariff(
        master.id,
        { ...input, isActive: false },
        actor,
        {},
      ),
    ).rejects.toMatchObject({ code: "SVB_TARIFF_ALREADY_EXISTS" });
  });
  it("maps Prisma uniqueness races on procedure create and update without database internals", async () => {
    const error = new Prisma.PrismaClientKnownRequestError("DB internals", {
      code: "P2002",
      clientVersion: "test",
    });
    state.tx.svbProcedure.create.mockRejectedValue(error);
    state.tx.svbProcedure.update.mockRejectedValue(error);
    await expect(
      svbCatalogService.createProcedure(
        { code: "TEST", description: "Test" },
        actor,
        {},
      ),
    ).rejects.toMatchObject({
      code: "SVB_PROCEDURE_CODE_ALREADY_EXISTS",
      statusCode: 409,
    });
    await expect(
      svbCatalogService.updateProcedure(master.id, { code: "TEST" }, actor, {}),
    ).rejects.toMatchObject({
      code: "SVB_PROCEDURE_CODE_ALREADY_EXISTS",
      statusCode: 409,
    });
  });
  it("rejects impossible calendar dates without normalizing them into another day", async () => {
    await expect(
      svbCatalogService.createProcedure(
        { code: "TEST", description: "Test", validFrom: "2026-02-30" },
        actor,
        {},
      ),
    ).rejects.toMatchObject({ code: "INVALID_DATE" });
    await expect(
      svbCatalogService.createTariff(
        master.id,
        { ...input, validFrom: "2026-02-30" },
        actor,
        {},
      ),
    ).rejects.toMatchObject({ code: "INVALID_DATE" });
  });
  it("propagates audit failures out of the business transaction", async () => {
    state.tx.auditLog.create.mockRejectedValue(new Error("Audit failure"));
    await expect(
      svbCatalogService.createProcedure(
        { code: "TEST", description: "Test" },
        actor,
        {},
      ),
    ).rejects.toThrow("Audit failure");
  });
});
