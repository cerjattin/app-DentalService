import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { app } from "../../src/app.js";
import { prisma } from "../../src/infrastructure/database/prisma.js";
import { accessTokenService } from "../../src/modules/auth/access-token.service.js";
import { auditService } from "../../src/modules/audit/audit.service.js";

const suffix = randomUUID().slice(0, 8);
let org: bigint, otherOrg: bigint, user: bigint, token: string, reception: string, providerToken: string, noRole: string;
let patient: bigint, otherPatient: bigint, provider: bigint, location: bigint, insurance: bigint, payer: bigint, procedure: bigint, tariff: bigint;
let n = 0;
const orgs: bigint[] = [];
const auth = () => ({ Authorization: `Bearer ${token}` });
async function draft() {
  const r = await request(app).post("/api/v1/declarations").set(auth()).send({ payerId: payer.toString() }).expect(201);
  expect(r.body.data.declarantIdSnapshot).toBeNull();
  return r.body.data.id as string;
}
async function add(batch: string, item: bigint) {
  return request(app).post(`/api/v1/declarations/${batch}/items`).set(auth()).send({ invoiceItemId: item.toString() });
}
async function cancel(batch: string) {
  return request(app).post(`/api/v1/declarations/${batch}/cancel`).set(auth()).send({ reason: "QA release" });
}
async function invoice(declarantId = "00123", incomplete = false) {
  n++;
  const appointment = await prisma.appointment.create({ data: { organizationId: org, patientId: patient,
    providerId: provider, clinicLocationId: location, appointmentNumber: `F-${suffix}-${n}`,
    scheduledStartAt: new Date(`2026-09-${String(n).padStart(2,"0")}T13:00:00Z`),
    scheduledEndAt: new Date(`2026-09-${String(n).padStart(2,"0")}T13:30:00Z`),
    status: "COMPLETED", completedAt: new Date("2026-09-01T14:00:00Z"), createdByUserId: user } });
  const encounter = await prisma.clinicalEncounter.create({ data: { appointmentId: appointment.id, providerId: provider,
    status: "COMPLETED", startedAt: appointment.scheduledStartAt, completedAt: appointment.scheduledEndAt, createdByUserId: user } });
  const performed = await prisma.encounterProcedure.create({ data: { encounterId: encounter.id,
    patientInsuranceId: insurance, svbProcedureId: procedure, svbTariffId: tariff, performedByProviderId: provider,
    procedureCodeSnapshot: "QA", procedureDescriptionSnapshot: "Café treatment", providerIdSnapshot: "81234",
    insuredIdSnapshot: "012345678", unitTariffSnapshot: "88.80", currencyCodeSnapshot: "ANG", quantity: "1.00",
    amount: "88.80", performedAt: appointment.scheduledStartAt, createdByUserId: user, status: "PERFORMED" } });
  const bill = await prisma.invoice.create({ data: { organizationId: org, appointmentId: appointment.id,
    patientId: patient, patientInsuranceId: insurance, invoiceNumber: `F-${suffix}-${n}`, status: "CLOSED", createdByUserId: user } });
  const version = await prisma.invoiceVersion.create({ data: { invoiceId: bill.id, versionNumber: 1, versionType: "ORIGINAL",
    status: "CLOSED", invoiceDate: new Date("2026-09-01"), currencyCode: "ANG", totalAmount: "88.80",
    declarantIdSnapshot: declarantId, patientNameSnapshot: "QA Synthetic", insuredIdSnapshot: "012345678",
    preparedByUserId: user, contentHash: "a".repeat(64), closedAt: appointment.scheduledEndAt } });
  await prisma.invoice.update({ where: { id: bill.id }, data: { currentVersionId: version.id } });
  const item = await prisma.invoiceItem.create({ data: { invoiceVersionId: version.id, lineNumber: 1,
    detailInvoiceNumber: `D-${n}`, encounterProcedureId: performed.id, svbProcedureId: procedure, svbTariffId: tariff,
    serviceDateSnapshot: new Date("2026-09-01"), procedureCodeSnapshot: "QA", procedureDescriptionSnapshot: "Café treatment",
    providerIdSnapshot: "81234", insuredIdSnapshot: "012345678", unitTariffSnapshot: "88.80", currencyCodeSnapshot: "ANG",
    quantity: "1.00", amount: "88.80", treatmentIdSnapshot: "000001", numberOfTreatmentsSnapshot: incomplete ? null : 1,
    assistanceSnapshot: incomplete ? null : "Y", policlinicSnapshot: "P" } });
  return { item, bill, version, appointment, encounter };
}

describe("NEG-FUNC-03/04/05 on dedicated PostgreSQL", () => {
  beforeAll(async () => {
    org = (await prisma.organization.create({ data: { legalName: `TEST-FUNC-${suffix}`, declarantId: "00321" } })).id;
    otherOrg = (await prisma.organization.create({ data: { legalName: `TEST-FUNC-OTHER-${suffix}`, declarantId: "00456" } })).id;
    orgs.push(org, otherOrg);
    const tokens: Record<string,string> = {};
    for (const code of ["ADMIN","RECEPTION","PROVIDER","NONE"]) {
      const u = await prisma.user.create({ data: { organizationId: org, email: `${code}.${suffix}@local.invalid`,
        passwordHash: "unused-test-hash", firstName: "QA", lastName: "Synthetic", status: "ACTIVE" } });
      if (code !== "NONE") {
        const role = await prisma.role.findUniqueOrThrow({ where: { code } });
        await prisma.userRole.create({ data: { userId: u.id, roleId: role.id } });
      }
      tokens[code] = await accessTokenService.sign(u.id, org);
      if (code === "ADMIN") user = u.id;
    }
    token = tokens.ADMIN!; reception = tokens.RECEPTION!; providerToken = tokens.PROVIDER!; noRole = tokens.NONE!;
    for (const sequenceType of ["APPOINTMENT","DECLARATION"] as const) {
      await prisma.numberSequence.create({ data: { organizationId: org, sequenceType,
        sequenceYear: Number(new Intl.DateTimeFormat("en", { timeZone: "America/Curacao", year: "numeric" }).format(new Date())), prefix: `F-${suffix}-`, padding: 6 } });
    }
    patient = (await prisma.patient.create({ data: { organizationId: org, patientNumber: "QA-1", firstName: "QA", lastName: "Synthetic" } })).id;
    otherPatient = (await prisma.patient.create({ data: { organizationId: otherOrg, patientNumber: "QA-2", firstName: "QA", lastName: "Other" } })).id;
    payer = (await prisma.payer.create({ data: { code: `F-${suffix}`, name: "QA payer", payerType: "STATE_INSURANCE" } })).id;
    provider = (await prisma.provider.create({ data: { organizationId: org, svbProviderId: "81234", firstName: "QA", lastName: "Provider" } })).id;
    location = (await prisma.clinicLocation.create({ data: { organizationId: org, code: "QA", name: "QA", policlinicCode: "P" } })).id;
    insurance = (await prisma.patientInsurance.create({ data: { patientId: patient, payerId: payer, insuredId: "012345678",
      validFrom: new Date("2020-01-01"), status: "ACTIVE", isPrimary: true } })).id;
    procedure = (await prisma.svbProcedure.create({ data: { code: `F-${suffix}`, description: "QA treatment" } })).id;
    tariff = (await prisma.svbTariff.create({ data: { svbProcedureId: procedure, amount: "88.80", currencyCode: "ANG", validFrom: new Date("2020-01-01") } })).id;
  }, 20000);

  afterAll(async () => {
    vi.restoreAllMocks();
    if (orgs.length) {
      const scope = { organizationId: { in: orgs } };
      await prisma.invoice.updateMany({ where: scope, data: { currentVersionId: null } });
      await prisma.declarationItem.deleteMany({ where: { declarationBatch: scope } });
      await prisma.declarationBatchStatusHistory.deleteMany({ where: { declarationBatch: scope } });
      await prisma.declarationBatch.deleteMany({ where: scope });
      await prisma.invoiceStatusHistory.deleteMany({ where: { invoice: scope } });
      await prisma.invoiceCorrection.deleteMany({ where: { invoice: scope } });
      await prisma.invoiceItem.deleteMany({ where: { invoiceVersion: { invoice: scope } } });
      await prisma.invoiceVersion.deleteMany({ where: { invoice: scope } });
      await prisma.invoice.deleteMany({ where: scope });
      await prisma.encounterProcedure.deleteMany({ where: { encounter: { appointment: scope } } });
      await prisma.clinicalEncounter.deleteMany({ where: { appointment: scope } });
      await prisma.appointmentStatusHistory.deleteMany({ where: { appointment: scope } });
      await prisma.appointment.deleteMany({ where: scope });
      await prisma.treatmentCase.deleteMany({ where: scope });
      await prisma.patientInsurance.deleteMany({ where: { patient: scope } });
      await prisma.patient.deleteMany({ where: scope });
      await prisma.provider.deleteMany({ where: scope });
      await prisma.clinicLocation.deleteMany({ where: scope });
      await prisma.auditLog.deleteMany({ where: scope });
      await prisma.numberSequence.deleteMany({ where: scope });
      await prisma.userRole.deleteMany({ where: { user: scope } });
      await prisma.user.deleteMany({ where: scope });
      await prisma.organization.deleteMany({ where: { id: { in: orgs } } });
      if (tariff) await prisma.svbTariff.delete({ where: { id: tariff } });
      if (procedure) await prisma.svbProcedure.delete({ where: { id: procedure } });
      if (payer) await prisma.payer.delete({ where: { id: payer } });
    }
    await prisma.$disconnect();
  }, 20000);

  it("B03 scopes settings, preserves leading zeros and rejects stale revision, client IDs, duplicates and missing permissions", async () => {
    await request(app).get("/api/v1/organization").expect(401);
    await request(app).get("/api/v1/organization").set("Authorization", `Bearer ${noRole}`).expect(403);
    const before = await request(app).get("/api/v1/organization").set(auth()).expect(200);
    const patch = { expectedRevision: before.body.data.revision, reason: "QA config", declarantId: "00123" };
    await request(app).patch("/api/v1/organization").set("Authorization", `Bearer ${reception}`).send(patch).expect(403);
    await request(app).patch("/api/v1/organization").set(auth()).send({ ...patch, organizationId: otherOrg.toString() }).expect(400);
    const saved = await request(app).patch("/api/v1/organization").set(auth()).send(patch).expect(200);
    expect(saved.body.data.declarantId).toBe("00123");
    expect(saved.body.data.id).toBe(org.toString());
    await request(app).patch("/api/v1/organization").set(auth()).send({ ...patch, phone: "QA" }).expect(409);
    const duplicate = await request(app).patch("/api/v1/organization").set(auth()).send({ ...patch, expectedRevision: saved.body.data.revision, declarantId: "00456" }).expect(409);
    expect(duplicate.body.error.code).toBe("DECLARANT_ID_ALREADY_EXISTS");
    const original = await prisma.organization.findUniqueOrThrow({ where: { id: otherOrg } });
    expect(original.declarantId).toBe("00456");
  });

  it("B03 rolls back settings when transactional audit fails", async () => {
    const before = await request(app).get("/api/v1/organization").set(auth()).expect(200);
    vi.spyOn(auditService, "writeWithinTransaction").mockRejectedValueOnce(new Error("QA audit failure"));
    await request(app).patch("/api/v1/organization").set(auth()).send({ expectedRevision: before.body.data.revision, reason: "QA rollback", phone: "should roll back" }).expect(500);
    const after = await request(app).get("/api/v1/organization").set(auth()).expect(200);
    expect(after.body.data).toEqual(before.body.data);
  });

  it("B03 rejects manual identity override and binds exactly one identity under concurrent first items", async () => {
    await request(app).post("/api/v1/declarations").set(auth()).send({ payerId: payer.toString(), declarantIdSnapshot: "00123" }).expect(400);
    const batch = await draft();
    const a = await invoice("00123"), b = await invoice("00456");
    const hashes = [a.version.contentHash, b.version.contentHash];
    const results = await Promise.all([add(batch, a.item.id), add(batch, b.item.id)]);
    expect(results.map((r) => r.status).sort()).toEqual([201,409]);
    expect(results.find((r) => r.status === 409)!.body.error.code).toBe("DECLARATION_DECLARANT_MISMATCH");
    const detail = await request(app).get(`/api/v1/declarations/${batch}`).set(auth()).expect(200);
    expect(detail.body.data.items).toHaveLength(1);
    expect(detail.body.data.declarantIdSnapshot).toBe(detail.body.data.items[0].declarantIdSnapshot);
    const versions = await prisma.invoiceVersion.findMany({ where: { id: { in: [a.version.id,b.version.id] } }, orderBy: { id: "asc" } });
    expect(versions.map((v) => v.contentHash)).toEqual(hashes);
  });

  it("B04 returns paginated accent-insensitive candidates, diagnoses incomplete data, and requires both read permissions", async () => {
    const batch = await draft(), bill = await invoice("00123", true);
    await request(app).get(`/api/v1/declarations/${batch}/candidates`).set("Authorization", `Bearer ${providerToken}`).expect(403);
    const response = await request(app).get(`/api/v1/declarations/${batch}/candidates?q=cafe&from=2026-09-01&to=2026-09-01&pageSize=1`).set(auth()).expect(200);
    expect(response.body.meta.total).toBeGreaterThan(0);
    expect(response.body.data[0]).toMatchObject({ amount: "88.80", currencyCode: "ANG" });
    const own = await request(app).get(`/api/v1/declarations/${batch}/candidates?pageSize=100`).set(auth()).expect(200);
    const candidate = own.body.data.find((v: { invoiceItemId: string }) => v.invoiceItemId === bill.item.id.toString());
    expect(candidate.svbReadiness).toBe("INCOMPLETE");
    expect(candidate.issues).toEqual(expect.arrayContaining([{ field: "NumberOfTreatments", code: "DECLARATION_SVB_DATA_INCOMPLETE" }, { field: "Assistance", code: "DECLARATION_SVB_DATA_INCOMPLETE" }]));
    await request(app).get(`/api/v1/declarations/${batch}/candidates?from=2026-02-30`).set(auth()).expect(400);
    await request(app).get(`/api/v1/declarations/${batch}/candidates?from=2026-10-01&to=2026-09-01`).set(auth()).expect(400);
    await add(batch,bill.item.id).then((r) => expect(r.status).toBe(201));
    const ready = await request(app).post(`/api/v1/declarations/${batch}/ready`).set(auth()).expect(409);
    expect(ready.body.error.code).toBe("DECLARATION_SVB_DATA_INCOMPLETE");
  });

  it("B04 allows only one active assignment across competing batches and releases cancelled history", async () => {
    const a = await draft(), b = await draft(), bill = await invoice();
    const result = await Promise.all([add(a,bill.item.id), add(b,bill.item.id)]);
    expect(result.map((r) => r.status).sort()).toEqual([201,409]);
    expect(result.find((r) => r.status === 409)!.body.error.code).toBe("DECLARATION_ITEM_ASSIGNED");
    const winner = result[0]!.status === 201 ? a : b, loser = winner === a ? b : a;
    const cancelled = await cancel(winner);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.items).toHaveLength(1);
    expect((await add(loser,bill.item.id)).status).toBe(201);
    expect(await prisma.declarationActiveAssignment.count({ where: { invoiceItemId: bill.item.id } })).toBe(1);
    expect(await prisma.declarationItem.count({ where: { invoiceItemId: bill.item.id } })).toBe(2);
  });

  it("B03/B04 preserves bound identity and ordinal after removing the last item; audit failure rolls back allocation and ownership", async () => {
    const batch = await draft(), a = await invoice(), b = await invoice();
    const first = await add(batch,a.item.id);
    expect(first.status).toBe(201);
    const removed = await request(app).delete(`/api/v1/declarations/${batch}/items/${first.body.data.id}`).set(auth()).send({ reason: "QA wrong item" }).expect(200);
    expect(removed.body.data.items).toHaveLength(0);
    expect(removed.body.data.declarantIdSnapshot).toBe("00123");
    vi.spyOn(auditService,"writeWithinTransaction").mockRejectedValueOnce(new Error("QA audit rollback"));
    expect((await add(batch,b.item.id)).status).toBe(500);
    expect(await prisma.declarationActiveAssignment.count({ where: { invoiceItemId: b.item.id } })).toBe(0);
    const next = await add(batch,b.item.id);
    expect(next.status).toBe(201);
    expect(next.body.data.sequenceNumber).toBe(first.body.data.sequenceNumber + 1);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { organizationId: org, action: "DECLARATION_ITEM_REMOVE", entityId: BigInt(first.body.data.id) } });
    expect(audit.oldValues).toMatchObject({ declarantIdSnapshot: "00123", amountSnapshot: "88.80" });
    const mismatch = await invoice("00456");
    const conflict = await add(batch,mismatch.item.id);
    expect(conflict.body.error.code).toBe("DECLARATION_DECLARANT_MISMATCH");
  });

  it("B04 serializes READY against removal and cancellation without partial state", async () => {
    for (const removal of [true,false]) {
      const batch = await draft(), bill = await invoice();
      const item = await add(batch,bill.item.id);
      const ready = request(app).post(`/api/v1/declarations/${batch}/ready`).set(auth());
      const change = removal ? request(app).delete(`/api/v1/declarations/${batch}/items/${item.body.data.id}`).set(auth()).send({ reason: "QA race" }) : cancel(batch);
      const results = await Promise.all([ready,change]);
      expect(results.map((r) => r.status).sort()).toEqual([200,409]);
      const current = await prisma.declarationBatch.findUniqueOrThrow({ where: { id: BigInt(batch) }, include: { items: true } });
      expect(current.status === "READY" ? current.items.length === 1 : removal ? current.items.length === 0 : current.status === "CANCELLED").toBe(true);
    }
  });

  it("B04 rejects a stale candidate after an invoice enters correction", async () => {
    const batch = await draft(), bill = await invoice();
    const available = await request(app).get(`/api/v1/declarations/${batch}/candidates?pageSize=100`).set(auth()).expect(200);
    expect(available.body.data.some((v: { invoiceItemId: string }) => v.invoiceItemId === bill.item.id.toString())).toBe(true);
    await request(app).post(`/api/v1/invoices/${bill.bill.id}/corrections`).set(auth()).send({ reasonCode: "QA", reasonText: "QA correction of stale selection" }).expect(201);
    const stale = await add(batch,bill.item.id);
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("DECLARATION_ITEM_NOT_ELIGIBLE");
    expect(await prisma.declarationActiveAssignment.count({ where: { invoiceItemId: bill.item.id } })).toBe(0);
  });

  it("B03 diagnoses legacy inconsistent Drafts without rewriting their snapshots", async () => {
    const batch = await draft(), a = await invoice(), b = await invoice();
    await add(batch,a.item.id);
    await prisma.declarationBatch.update({ where: { id: BigInt(batch) }, data: { declarantIdSnapshot: null } });
    const conflict = await add(batch,b.item.id);
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe("DECLARATION_LEGACY_DATA_CONFLICT");
    const stored = await prisma.declarationBatch.findUniqueOrThrow({ where: { id: BigInt(batch) } });
    expect(stored.declarantIdSnapshot).toBeNull();
    // Old client overrides can be self-consistent within the batch but disagree
    // with the source invoice. They must also be rejected without rewriting.
    await prisma.declarationBatch.update({ where: { id: BigInt(batch) }, data: { declarantIdSnapshot: "00456" } });
    await prisma.declarationItem.updateMany({ where: { declarationBatchId: BigInt(batch) }, data: { declarantIdSnapshot: "00456" } });
    const legacyOverride = await add(batch,b.item.id);
    expect(legacyOverride.body.error.code).toBe("DECLARATION_LEGACY_DATA_CONFLICT");
  });

  it("B04 keeps Clinical blocked by every active assignment and only exposes assignment details with read permission", async () => {
    const batch = await draft(), bill = await invoice();
    const added = await add(batch,bill.item.id);
    const blocked = await request(app).post(`/api/v1/invoices/${bill.bill.id}/reopen-encounter`).set(auth())
      .send({ reason: "QA correction", expectedVersionId: bill.version.id.toString() }).expect(409);
    expect(blocked.body.error.code).toBe("INVOICE_DECLARATION_ASSIGNED");
    expect(blocked.body.error.details.assignments).toEqual([{ declarationId: batch,
      declarationNumber: expect.any(String), status: "DRAFT", items: [{ declarationItemId: added.body.data.id, invoiceItemId: bill.item.id.toString() }] }]);
    vi.spyOn(auditService,"writeWithinTransaction").mockRejectedValueOnce(new Error("QA cancel rollback"));
    expect((await cancel(batch)).status).toBe(500);
    expect(await prisma.declarationActiveAssignment.count({ where: { invoiceItemId: bill.item.id } })).toBe(1);
    expect((await cancel(batch)).status).toBe(200);
    const available = await request(app).get(`/api/v1/declarations/${await draft()}/candidates`).set(auth()).expect(200);
    expect(available.body.data.some((v: { invoiceItemId: string }) => v.invoiceItemId === bill.item.id.toString())).toBe(true);
    expect((await prisma.invoiceVersion.findUniqueOrThrow({ where: { id: bill.version.id } })).contentHash).toBe("a".repeat(64));
  });

  it("B03 preserves frozen invoice and declaration identity when organization configuration is cleared", async () => {
    const batch = await draft(), bill = await invoice();
    await add(batch,bill.item.id);
    const before = await request(app).get("/api/v1/organization").set(auth()).expect(200);
    await request(app).patch("/api/v1/organization").set(auth()).send({ expectedRevision: before.body.data.revision, reason: "QA clear config", declarantId: null }).expect(200);
    expect((await prisma.invoiceVersion.findUniqueOrThrow({ where: { id: bill.version.id } })).declarantIdSnapshot).toBe("00123");
    expect((await prisma.declarationBatch.findUniqueOrThrow({ where: { id: BigInt(batch) } })).declarantIdSnapshot).toBe("00123");
  });

  it("B05 creates external references as strings with explicit permissions and cross-patient isolation", async () => {
    const root = `/api/v1/patients/${patient}/treatment-cases`;
    await request(app).post(root).set("Authorization", `Bearer ${reception}`).send({ treatmentId: "000123" }).expect(403);
    const created = await request(app).post(root).set("Authorization", `Bearer ${providerToken}`).send({ treatmentId: "000123", description: "Café case" }).expect(201);
    expect(created.body.data).toMatchObject({ treatmentId: "000123", status: "PLANNED", isEditable: true, patientId: patient.toString() });
    await request(app).post(root).set(auth()).send({ treatmentId: "000123" }).expect(409);
    await request(app).post(root).set(auth()).send({ treatmentId: "000124", organizationId: otherOrg.toString() }).expect(400);
    await request(app).post(root).set(auth()).send({ treatmentId: "000124", status: "ACTIVE" }).expect(400);
    await request(app).get(`/api/v1/patients/${otherPatient}/treatment-cases`).set(auth()).expect(404);
    const listed = await request(app).get(`${root}?q=cafe&pageSize=1`).set("Authorization", `Bearer ${reception}`).expect(200);
    expect(listed.body.data[0].id).toBe(created.body.data.id);
    await request(app).get(`/api/v1/patients/${otherPatient}/treatment-cases/${created.body.data.id}`).set(auth()).expect(404);
  });

  it("B05 serializes case editing against first assignment and prevents editing even after unlinking", async () => {
    const root = `/api/v1/patients/${patient}/treatment-cases`;
    const created = await request(app).post(root).set(auth()).send({ treatmentId: "000125" }).expect(201);
    const caseId = created.body.data.id;
    const results = await Promise.all([
      request(app).patch(`${root}/${caseId}`).set(auth()).send({ treatmentId: "000126" }),
      request(app).post("/api/v1/appointments").set(auth()).send({ patientId: patient.toString(), providerId: provider.toString(), clinicLocationId: location.toString(), treatmentCaseId: caseId,
        scheduledStart: "2027-01-10T13:00:00Z", scheduledEnd: "2027-01-10T13:30:00Z" }),
    ]);
    expect(results[0]!.status === 200 || results[0]!.status === 409).toBe(true);
    // Appointment conflict is permitted if Serializable detects the concurrent edit; retry explicitly in QA.
    const assigned = results[1]!.status === 201 ? results[1]! : await request(app).post("/api/v1/appointments").set(auth()).send({ patientId: patient.toString(), providerId: provider.toString(), clinicLocationId: location.toString(), treatmentCaseId: caseId,
      scheduledStart: "2027-01-10T13:00:00Z", scheduledEnd: "2027-01-10T13:30:00Z" }).expect(201);
    await request(app).patch(`${root}/${caseId}`).set(auth()).send({ description: "after use" }).expect(409);
    await request(app).patch(`/api/v1/appointments/${assigned.body.data.id}`).set(auth()).send({ treatmentCaseId: null }).expect(200);
    await request(app).patch(`${root}/${caseId}`).set(auth()).send({ description: "after unlink" }).expect(409);
    const wrong = await prisma.treatmentCase.create({ data: { patientId: otherPatient, organizationId: otherOrg, createdByUserId: user, treatmentId: "000127" } });
    await request(app).patch(`/api/v1/appointments/${assigned.body.data.id}`).set(auth()).send({ treatmentCaseId: wrong.id.toString() }).expect(404);
    await prisma.treatmentCase.update({ where: { id: BigInt(caseId) }, data: { status: "COMPLETED" } });
    const invalid = await request(app).patch(`/api/v1/appointments/${assigned.body.data.id}`).set(auth()).send({ treatmentCaseId: caseId }).expect(409);
    expect(invalid.body.error.code).toBe("TREATMENT_CASE_NOT_ASSIGNABLE");
  });

  it("B05 freezes external TreatmentId when recording care and blocks later appointment context changes", async () => {
    const root = `/api/v1/patients/${patient}/treatment-cases`;
    const c = await request(app).post(root).set(auth()).send({ treatmentId: "000128" }).expect(201);
    const appointment = await request(app).post("/api/v1/appointments").set(auth()).send({ patientId: patient.toString(), providerId: provider.toString(), clinicLocationId: location.toString(), treatmentCaseId: c.body.data.id,
      scheduledStart: "2027-01-11T13:00:00Z", scheduledEnd: "2027-01-11T13:30:00Z" }).expect(201);
    const encounter = await prisma.clinicalEncounter.create({ data: { appointmentId: BigInt(appointment.body.data.id), providerId: provider, createdByUserId: user, startedAt: new Date("2027-01-11T13:00:00Z") } });
    const performed = await request(app).post(`/api/v1/clinical-encounters/${encounter.id}/procedures`).set(auth()).send({ patientInsuranceId: insurance.toString(), svbProcedureId: procedure.toString(), quantity: "1.00" }).expect(201);
    expect(performed.body.data.treatmentIdSnapshot).toBe("000128");
    expect(performed.body.data.numberOfTreatmentsSnapshot).toBeNull();
    expect(performed.body.data.assistanceSnapshot).toBeNull();
    await request(app).patch(`/api/v1/appointments/${appointment.body.data.id}`).set(auth()).send({ treatmentCaseId: null }).expect(409);
    await prisma.treatmentCase.update({ where: { id: BigInt(c.body.data.id) }, data: { treatmentId: "QAOLD" } });
    const stored = await prisma.encounterProcedure.findUniqueOrThrow({ where: { id: BigInt(performed.body.data.id) } });
    expect(stored.treatmentIdSnapshot).toBe("000128");
  });

  it("B05 rolls back create and update when audit fails", async () => {
    const root = `/api/v1/patients/${patient}/treatment-cases`;
    vi.spyOn(auditService,"writeWithinTransaction").mockRejectedValueOnce(new Error("QA create rollback"));
    await request(app).post(root).set(auth()).send({ treatmentId: "000129" }).expect(500);
    expect(await prisma.treatmentCase.count({ where: { patientId: patient, treatmentId: "000129" } })).toBe(0);
    const created = await request(app).post(root).set(auth()).send({ treatmentId: "000129" }).expect(201);
    vi.spyOn(auditService,"writeWithinTransaction").mockRejectedValueOnce(new Error("QA update rollback"));
    await request(app).patch(`${root}/${created.body.data.id}`).set(auth()).send({ treatmentId: "000130" }).expect(500);
    expect((await prisma.treatmentCase.findUniqueOrThrow({ where: { id: BigInt(created.body.data.id) } })).treatmentId).toBe("000129");
  });
});
