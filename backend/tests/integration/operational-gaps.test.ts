import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { prisma } from "../../src/infrastructure/database/prisma.js";
import { accessTokenService } from "../../src/modules/auth/access-token.service.js";
import { dashboardQuerySchema, reportPeriod, summarizeProduction } from "../../src/modules/reports/dashboard.service.js";

let org: bigint, otherOrg: bigint, actor: bigint, token: string, denied: string, patient: bigint, provider: bigint, location: bigint, procedure: bigint, tariff: bigint, insurance: bigint, invoice: bigint, originalVersion: bigint;
const ids: bigint[] = [];
const query = "?from=2026-10-28&to=2026-10-29";
async function get(path = query) { return request(app).get("/api/v1/reports/dashboard" + path).set("Authorization", "Bearer " + token).expect(200); }
describe("Operational gap corrections", () => {
  beforeAll(async () => {
    const suffix = Date.now().toString();
    const o = await prisma.organization.create({ data: { legalName: "TEST-OPS-" + suffix, isActive: true } }); org = o.id;
    otherOrg = (await prisma.organization.create({ data: { legalName: "TEST-OPS-OTHER-" + suffix } })).id;
    await prisma.numberSequence.create({ data: { organizationId: org, sequenceType: "APPOINTMENT", sequenceYear: Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Curacao", year: "numeric" }).format(new Date())), prefix: "QA-OPS-", currentValue: 0n, padding: 6 } });
    const role = await prisma.role.findUniqueOrThrow({ where: { code: "ADMIN" } });
    actor = (await prisma.user.create({ data: { organizationId: org, email: "ops." + suffix + "@local.invalid", passwordHash: "unused", firstName: "QA", lastName: "Ops", status: "ACTIVE", userRoles: { create: { roleId: role.id } } } })).id;
    const noRole = await prisma.user.create({ data: { organizationId: org, email: "ops.denied." + suffix + "@local.invalid", passwordHash: "unused", firstName: "QA", lastName: "Denied", status: "ACTIVE" } });
    token = await accessTokenService.sign(actor, org); denied = await accessTokenService.sign(noRole.id, org);
    location = (await prisma.clinicLocation.create({ data: { organizationId: org, code: "QA", name: "QA clinic" } })).id;
    await prisma.clinicLocation.create({ data: { organizationId: org, code: "INACTIVE", name: "Inactive clinic", isActive: false } });
    await prisma.clinicLocation.create({ data: { organizationId: otherOrg, code: "OTHER", name: "Other clinic" } });
    patient = (await prisma.patient.create({ data: { organizationId: org, patientNumber: "PAT-OPS", firstName: "QA", lastName: "Patient", status: "ACTIVE" } })).id;
    provider = (await prisma.provider.create({ data: { organizationId: org, firstName: "QA", lastName: "Provider", isActive: true, svbProviderId: "QA-OPS" } })).id;
    const payer = await prisma.payer.findUniqueOrThrow({ where: { code: "SVB" } });
    insurance = (await prisma.patientInsurance.create({ data: { patientId: patient, payerId: payer.id, insuredId: "QA-OPS", status: "ACTIVE", validFrom: new Date("2026-01-01T00:00:00Z") } })).id;
    procedure = (await prisma.svbProcedure.create({ data: { code: "TEST-OPS-" + suffix, description: "QA procedure", isActive: true } })).id;
    tariff = (await prisma.svbTariff.create({ data: { svbProcedureId: procedure, amount: "88.80", currencyCode: "ANG", validFrom: new Date("2026-01-01T00:00:00Z") } })).id;
    for (const [n, time, currency, amount] of [[0,"2026-10-28T13:00:00Z","ANG","88.80"],[1,"2026-10-28T15:00:00Z","ANG","0.10"],[2,"2026-10-29T13:00:00Z","USD","0.20"],[3,"2026-10-28T02:00:00Z","ANG","100.00"]] as const) {
      const a = await prisma.appointment.create({ data: { organizationId: org, appointmentNumber: "APT-OPS-" + n, patientId: patient, providerId: provider, clinicLocationId: location, createdByUserId: actor, scheduledStartAt: new Date(time), scheduledEndAt: new Date(new Date(time).getTime()+1800000), status: "IN_PROGRESS" } });
      const ce = await prisma.clinicalEncounter.create({ data: { appointmentId: a.id, providerId: provider, status: "OPEN", startedAt: new Date(time), createdByUserId: actor } });
      const ep = await prisma.encounterProcedure.create({ data: { encounterId: ce.id, patientInsuranceId: insurance, svbProcedureId: procedure, svbTariffId: tariff, performedByProviderId: provider, procedureCodeSnapshot: "QA-OPS", procedureDescriptionSnapshot: "Original", providerIdSnapshot: "QA-OPS", insuredIdSnapshot: "QA-OPS", unitTariffSnapshot: amount, currencyCodeSnapshot: currency, quantity: "1.00", amount, performedAt: new Date(time), createdByUserId: actor } }); ids.push(ep.id);
      if (n === 0) {
        invoice = (await prisma.invoice.create({ data: { organizationId: org, appointmentId: a.id, patientId: patient, patientInsuranceId: insurance, createdByUserId: actor, status: "CLOSED" } })).id;
        originalVersion = (await prisma.invoiceVersion.create({ data: { invoiceId: invoice, versionNumber: 1, status: "CLOSED", currencyCode: "ANG", totalAmount: "88.80", patientNameSnapshot: "QA Patient", insuredIdSnapshot: "QA-OPS", preparedByUserId: actor } })).id;
        await prisma.invoice.update({ where: { id: invoice }, data: { currentVersionId: originalVersion } });
        await prisma.invoiceItem.create({ data: { invoiceVersionId: originalVersion, lineNumber: 1, encounterProcedureId: ep.id, svbProcedureId: procedure, svbTariffId: tariff, serviceDateSnapshot: new Date("2026-10-28T00:00:00Z"), procedureCodeSnapshot: "QA-OPS", procedureDescriptionSnapshot: "Original", providerIdSnapshot: "QA-OPS", insuredIdSnapshot: "QA-OPS", unitTariffSnapshot: "88.80", currencyCodeSnapshot: "ANG", quantity: "1.00", amount: "88.80" } });
      }
    }
  }, 20000);
  afterAll(async () => {
    if (org) {
      await prisma.invoice.updateMany({ where: { organizationId: org }, data: { currentVersionId: null } });
      await prisma.declarationItem.deleteMany({ where: { declarationBatch: { organizationId: org } } });
      await prisma.declarationBatch.deleteMany({ where: { organizationId: org } });
      await prisma.invoiceItem.deleteMany({ where: { invoiceVersion: { invoice: { organizationId: org } } } });
      await prisma.invoiceVersion.updateMany({ where: { invoice: { organizationId: org } }, data: { supersedesVersionId: null } });
      await prisma.invoiceVersion.deleteMany({ where: { invoice: { organizationId: org } } });
      await prisma.invoice.deleteMany({ where: { organizationId: org } });
      await prisma.encounterProcedure.deleteMany({ where: { encounter: { appointment: { organizationId: org } } } });
      await prisma.clinicalEncounter.deleteMany({ where: { appointment: { organizationId: org } } });
      await prisma.appointmentStatusHistory.deleteMany({ where: { appointment: { organizationId: org } } });
      await prisma.appointment.deleteMany({ where: { organizationId: org } });
      await prisma.patientInsurance.deleteMany({ where: { patient: { organizationId: org } } });
      await prisma.patient.deleteMany({ where: { organizationId: org } });
      await prisma.provider.deleteMany({ where: { organizationId: { in: [org, otherOrg] } } });
      await prisma.clinicLocation.deleteMany({ where: { organizationId: { in: [org, otherOrg] } } });
      await prisma.auditLog.deleteMany({ where: { organizationId: org } });
      await prisma.numberSequence.deleteMany({ where: { organizationId: org } });
      await prisma.userRole.deleteMany({ where: { user: { organizationId: org } } });
      await prisma.user.deleteMany({ where: { organizationId: org } });
      await prisma.organization.deleteMany({ where: { id: { in: [org, otherOrg] } } });
      await prisma.svbTariff.deleteMany({ where: { svbProcedureId: procedure } });
      await prisma.svbProcedure.delete({ where: { id: procedure } });
    }
    await prisma.$disconnect();
  }, 20000);
  it("requires authentication and independent permissions", async () => {
    for (const path of ["/api/v1/clinic-locations?isActive=true", "/api/v1/reports/dashboard" + query]) {
      await request(app).get(path).expect(401);
      await request(app).get(path).set("Authorization", "Bearer " + denied).expect(403);
    }
  });
  it("returns only active organization locations with string IDs", async () => {
    const r = await request(app).get("/api/v1/clinic-locations?isActive=true").set("Authorization", "Bearer " + token).expect(200);
    expect(r.body.data).toEqual([{ id: location.toString(), code: "QA", name: "QA clinic", isActive: true }]);
  });
  it("creates an appointment using the mounted lookup and existing POST contract", async () => {
    const r = await request(app).post("/api/v1/appointments").set("Authorization", "Bearer " + token).send({ patientId: patient.toString(), providerId: provider.toString(), clinicLocationId: location.toString(), scheduledStart: "2026-11-01T09:00:00-04:00", scheduledEnd: "2026-11-01T09:30:00-04:00", reason: "QA create", notes: "QA notes" }).expect(201);
    expect(r.body.data).toMatchObject({ patientId: patient.toString(), clinicLocationId: location.toString(), reason: "QA create", notes: "QA notes" });
  });
  it("aggregates performed production exactly per currency and unique patient-days with Curacao boundaries", async () => {
    const r = (await get()).body.data;
    expect(r.kpis.production).toEqual([{ currencyCode: "ANG", amount: "88.90" }, { currencyCode: "USD", amount: "0.20" }]);
    expect(r.kpis.patientsSeen).toBe(2);
    expect(r.kpis.appointments).toBe(3);
    expect(r.productionTimeline).toHaveLength(2);
    expect(r.productionByProvider[0].providerId).toBe(provider.toString());
    expect(r.kpis.svbBilled).toEqual([{ currencyCode: "ANG", amount: "88.80" }]);
    expect(r.kpis.closedInvoices).toBe(1);
    expect(r.kpis.toDeclare).toBe(1);
  });
  it("excludes VOID procedures without rewriting snapshots", async () => {
    await prisma.encounterProcedure.update({ where: { id: ids[1]! }, data: { status: "VOID" } });
    expect((await get()).body.data.kpis.production[0].amount).toBe("88.80");
    await prisma.encounterProcedure.update({ where: { id: ids[1]! }, data: { status: "PERFORMED" } });
  });
  it("counts only active closed invoice versions after a correction", async () => {
    const oldItem = await prisma.invoiceItem.findFirstOrThrow({ where: { invoiceVersionId: originalVersion } });
    const { id: _id, createdAt: _created, updatedAt: _updated, ...snapshot } = oldItem;
    const replacement = await prisma.invoiceVersion.create({ data: { invoiceId: invoice, versionNumber: 2, status: "CLOSED", currencyCode: "ANG", totalAmount: "89.90", patientNameSnapshot: "QA Patient", insuredIdSnapshot: "QA-OPS", preparedByUserId: actor, supersedesVersionId: originalVersion } });
    await prisma.invoiceItem.create({ data: { ...snapshot, invoiceVersionId: replacement.id, amount: "89.90" } });
    await prisma.invoiceVersion.update({ where: { id: originalVersion }, data: { status: "SUPERSEDED" } });
    await prisma.invoice.update({ where: { id: invoice }, data: { currentVersionId: replacement.id } });
    expect((await get()).body.data.kpis.svbBilled).toEqual([{ currencyCode: "ANG", amount: "89.90" }]);
    expect((await get()).body.data.kpis.production[0].amount).toBe("88.90");
    const item = await prisma.invoiceItem.findFirstOrThrow({ where: { invoiceVersionId: replacement.id } });
    const payer = await prisma.payer.findUniqueOrThrow({ where: { code: "SVB" } });
    const batch = await prisma.declarationBatch.create({ data: { organizationId: org, payerId: payer.id, createdByUserId: actor } });
    await prisma.declarationItem.create({ data: { declarationBatchId: batch.id, invoiceItemId: item.id, sequenceNumber: 1, declarantIdSnapshot: "QA", invoiceNumberSnapshot: "QA", detailInvoiceNumberSnapshot: "QA-1", providerIdSnapshot: "QA", serviceDateSnapshot: item.serviceDateSnapshot, insuredIdSnapshot: "QA", amountSnapshot: item.amount } });
    expect((await get()).body.data.kpis.toDeclare).toBe(0);
    await prisma.declarationBatch.update({ where: { id: batch.id }, data: { status: "CANCELLED" } });
    expect((await get()).body.data.kpis.toDeclare).toBe(1);
  });
  it("does not leak another organization through a provider filter", async () => {
    const p = await prisma.provider.create({ data: { organizationId: otherOrg, firstName: "Other", lastName: "Provider" } });
    await request(app).get("/api/v1/reports/dashboard" + query + "&providerId=" + p.id).set("Authorization", "Bearer " + token).expect(404);
    await prisma.provider.delete({ where: { id: p.id } });
    const r = await get(query + "&providerId=" + provider);
    expect(r.body.data.kpis.production[0].amount).toBe("88.90");
  });
  it("returns zero counts and empty money groups for an empty period", async () => {
    const r = (await get("?from=2025-01-01&to=2025-01-01")).body.data;
    expect(r.kpis).toEqual({ production: [], svbBilled: [], patientsSeen: 0, appointments: 0, pendingSignatures: 0, closedInvoices: 0, toDeclare: 0 });
  });
  it("rejects malformed, inverted and excessive periods", async () => {
    for (const q of ["?from=2026-02-30&to=2026-03-01", "?from=2026-03-01&to=2026-02-01", "?from=2025-01-01&to=2026-10-28"]) await request(app).get("/api/v1/reports/dashboard" + q).set("Authorization", "Bearer " + token).expect(400);
    expect(() => reportPeriod(dashboardQuerySchema.parse({ from: "2026-02-30", to: "2026-03-01" }))).toThrow();
  });
  it("retains maximum-precision monetary strings and large provider identities", () => {
    const r = summarizeProduction([{ date: "2026-10-28", providerId: 9007199254740993n, providerName: "QA", currencyCode: "ANG", amount: "9999999999999.99" }, { date: "2026-10-28", providerId: 9007199254740993n, providerName: "QA", currencyCode: "ANG", amount: "0.01" }]);
    expect(r.production[0]!.amount).toBe("10000000000000.00");
    expect(r.productionByProvider[0]!.providerId).toBe("9007199254740993");
  });
  it("documents both new GET contracts", async () => {
    const r = await request(app).get("/api/openapi.json").expect(200);
    expect(r.body.paths["/api/v1/clinic-locations"].get.description).toContain("clinic_location.read");
    expect(r.body.paths["/api/v1/reports/dashboard"].get.description).toContain("dashboard.read");
  });
});
