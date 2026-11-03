import pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { app } from "../../src/app.js";
import { prisma } from "../../src/infrastructure/database/prisma.js";
import { accessTokenService } from "../../src/modules/auth/access-token.service.js";
import { appointmentService } from "../../src/modules/appointments/appointment.service.js";
import { encounterProcedureService } from "../../src/modules/encounter-procedures/encounter-procedure.service.js";
import { svbCatalogService } from "../../src/modules/svb-catalog/svb-catalog.service.js";
import { documentStorage } from "../../src/modules/documents/document.storage.js";
import { createNegFuncDbFixture, insertDbRow } from "../helpers/neg-func-db-fixture.js";

const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
let f: Awaited<ReturnType<typeof createNegFuncDbFixture>>;
let other: Awaited<ReturnType<typeof createNegFuncDbFixture>>;
let token: string, denied: string, procedureId: string;
const accidentIds: string[] = [];
let number = 0;
const auth = () => ({ Authorization: `Bearer ${token}` });

async function accident(patientId = f.patientId, insuranceId: string | null = f.insuranceId) {
  const id = await insertDbRow(db, "accident_cases", { patient_id: patientId,
    patient_insurance_id: insuranceId, accident_form_number: String(++number).padStart(10,"0"),
    created_by_user_id: patientId === f.patientId ? f.userId : other.userId });
  accidentIds.push(id);
  return id;
}
function appointmentInput(accidentCaseId: string | null) {
  number++;
  return { patientId: f.patientId, providerId: f.providerId, clinicLocationId: f.clinicLocationId,
    accidentCaseId, scheduledStart: new Date(Date.UTC(2026,10,5,number)).toISOString(),
    scheduledEnd: new Date(Date.UTC(2026,10,5,number,30)).toISOString() };
}
async function clinical(accidentCaseId: string | null) {
  const appointment = await appointmentService.create(appointmentInput(accidentCaseId), f.actor, {});
  const encounterId = await insertDbRow(db, "clinical_encounters", { appointment_id: appointment.id,
    provider_id: f.providerId, created_by_user_id: f.userId, started_at: "2026-11-05T13:00:00Z" });
  return { appointmentId: appointment.id, encounterId };
}
function capture(encounterId: string) {
  return encounterProcedureService.create(BigInt(encounterId), {
    patientInsuranceId: f.insuranceId, svbProcedureId: procedureId, quantity: "1.00",
  }, f.actor, {});
}

describe("NEG-FINAL-06 Backend independent controls on synthetic PostgreSQL QA", () => {
  beforeAll(async () => {
    await db.connect();
    f = await createNegFuncDbFixture(db);
    other = await createNegFuncDbFixture(db);
    const seedInvoice = await f.invoice();
    procedureId = (await db.query("SELECT svb_procedure_id::text AS id FROM invoice_items WHERE id=$1", [seedInvoice.itemId])).rows[0].id;
    await db.query("INSERT INTO user_roles (user_id,role_id) SELECT $1,id FROM roles WHERE code='ADMIN'", [f.userId]);
    token = await accessTokenService.sign(BigInt(f.userId), BigInt(f.organizationId));
    denied = await accessTokenService.sign(BigInt(other.userId), BigInt(other.organizationId));
  }, 20000);
  afterAll(async () => {
    vi.restoreAllMocks();
    if (accidentIds.length) {
      await db.query("UPDATE appointments SET accident_case_id=NULL WHERE accident_case_id=ANY($1::bigint[])", [accidentIds]);
      await db.query("DELETE FROM accident_cases WHERE id=ANY($1::bigint[])", [accidentIds]);
    }
    if (f) await f.cleanup();
    if (other) await other.cleanup();
    await prisma.$disconnect();
    await db.end();
  }, 20000);

  it("requires actual permissions and publishes an empty unapproved pilot", async () => {
    await request(app).get("/api/v1/svb-pilot/readiness").expect(401);
    await request(app).get("/api/v1/svb-pilot/readiness").set("Authorization",`Bearer ${denied}`).expect(403);
    const result = await request(app).get("/api/v1/svb-pilot/readiness").set(auth()).expect(200);
    expect(result.body.data).toMatchObject({ realSubmissionEnabled: false, status: "BLOCKED",
      sourceSheet: null, destinationFormat: null, enabledServiceCodes: [], enabledCaseTypes: [] });
    await request(app).get("/api/v1/svb-pilot/readiness?approved=true").set(auth()).expect(400);
  });

  it("blocks real READY/export before any transition, audit, file write or cache reuse", async () => {
    const id = await f.batch();
    const auditCount = await prisma.auditLog.count({ where: { organizationId: BigInt(f.organizationId) } });
    const realReady = await request(app).post(`/api/v1/declarations/${id}/ready`).set(auth())
      .send({ presentationPurpose: "REAL_SVB" }).expect(409);
    expect(realReady.body.error.code).toBe("SVB_REAL_PRESENTATION_NOT_ENABLED");
    expect((await prisma.declarationBatch.findUniqueOrThrow({ where: { id: BigInt(id) } })).status).toBe("DRAFT");
    expect(await prisma.auditLog.count({ where: { organizationId: BigInt(f.organizationId) } })).toBe(auditCount);
    await db.query("UPDATE declaration_batches SET status='READY',ready_at=clock_timestamp() WHERE id=$1", [id]);
    const files = vi.spyOn(documentStorage,"write");
    const exported = await request(app).post(`/api/v1/declarations/${id}/exports`).set(auth())
      .send({ format: "CSV", presentationPurpose: "REAL_SVB" }).expect(409);
    expect(exported.body.error.code).toBe("SVB_REAL_PRESENTATION_NOT_ENABLED");
    expect(files).not.toHaveBeenCalled();
    expect(await prisma.declarationExport.count({ where: { declarationBatchId: BigInt(id) } })).toBe(0);
    files.mockRestore();
    const otherToken = await accessTokenService.sign(BigInt(f.userId), BigInt(other.organizationId));
    // A forged organization claim is rejected by the existing authentication layer.
    await request(app).post(`/api/v1/declarations/${id}/ready`).set("Authorization", `Bearer ${otherToken}`)
      .send({ presentationPurpose: "REAL_SVB" }).expect(401);
  });

  it("keeps technical COMPLETE separate from real presentation readiness", async () => {
    const bill = await f.invoice();
    await db.query(`UPDATE invoice_items SET treatment_id_snapshot='0000123',number_of_treatments_snapshot=1,
      assistance_snapshot='Y',policlinic_snapshot='P' WHERE id=$1`,[bill.itemId]);
    const id = await f.batch();
    const response = await request(app).get(`/api/v1/declarations/${id}/candidates?pageSize=100`).set(auth()).expect(200);
    const candidate = response.body.data.find((v: { invoiceItemId: string }) => v.invoiceItemId === bill.itemId);
    expect(candidate.svbReadiness).toBe("COMPLETE");
    expect(candidate.realPresentationReadiness).toMatchObject({ realSubmissionEnabled: false, status: "BLOCKED" });
    const detail = await request(app).get(`/api/v1/declarations/${id}`).set(auth()).expect(200);
    expect(detail.body.data.realPresentationReadiness.realSubmissionEnabled).toBe(false);
  });

  it("blocks referral-required care without consuming or inserting anything", async () => {
    const ce = await clinical(null);
    await db.query("UPDATE svb_procedures SET requires_referral=true WHERE id=$1",[procedureId]);
    try {
      const before = await prisma.encounterProcedure.count({ where: { encounterId: BigInt(ce.encounterId) } });
      await expect(capture(ce.encounterId)).rejects.toMatchObject({ code: "SVB_REFERRAL_FLOW_NOT_SUPPORTED", statusCode: 409 });
      expect(await prisma.encounterProcedure.count({ where: { encounterId: BigInt(ce.encounterId) } })).toBe(before);
    } finally { await db.query("UPDATE svb_procedures SET requires_referral=false WHERE id=$1",[procedureId]); }
  });

  it("rechecks referral and authorization flags after preflight inside the transaction", async () => {
    const ce = await clinical(null);
    const resolution = await svbCatalogService.resolveApplicableTariff({ svbProcedureId: BigInt(procedureId), serviceDate: new Date("2026-11-05"), currencyCode: "ANG" });
    const stale = vi.spyOn(svbCatalogService,"resolveApplicableTariff").mockResolvedValueOnce(resolution);
    await db.query("UPDATE svb_procedures SET requires_referral=true WHERE id=$1",[procedureId]);
    try { await expect(capture(ce.encounterId)).rejects.toMatchObject({ code: "SVB_REFERRAL_FLOW_NOT_SUPPORTED" }); }
    finally {
      stale.mockRestore();
      await db.query("UPDATE svb_procedures SET requires_referral=false WHERE id=$1",[procedureId]);
    }
    const staleAuthorization = vi.spyOn(svbCatalogService,"resolveApplicableTariff").mockResolvedValueOnce(resolution);
    await db.query("UPDATE svb_procedures SET requires_authorization=true WHERE id=$1",[procedureId]);
    try { await expect(capture(ce.encounterId)).rejects.toMatchObject({ code: "PROCEDURE_AUTHORIZATION_REQUIRED" }); }
    finally {
      staleAuthorization.mockRestore();
      await db.query("UPDATE svb_procedures SET requires_authorization=false WHERE id=$1",[procedureId]);
    }
  });

  it("rejects foreign accident links and inconsistent patient/insurance before appointment allocation", async () => {
    const foreign = await accident(other.patientId,other.insuranceId);
    const inconsistent = await accident(f.patientId,other.insuranceId);
    const before = await prisma.numberSequence.findFirstOrThrow({ where: { organizationId: BigInt(f.organizationId), sequenceType: "APPOINTMENT" } });
    await expect(appointmentService.create(appointmentInput(foreign),f.actor,{})).rejects.toMatchObject({ code: "ACCIDENT_CASE_NOT_FOUND" });
    await expect(appointmentService.create(appointmentInput(inconsistent),f.actor,{})).rejects.toMatchObject({ code: "ACCIDENT_INSURANCE_CONTEXT_MISMATCH" });
    const after = await prisma.numberSequence.findUniqueOrThrow({ where: { id: before.id } });
    expect(after.currentValue).toBe(before.currentValue);
  });

  it("revalidates insurance at capture and rejects legacy cross-patient context", async () => {
    const alt = await insertDbRow(db,"patient_insurance", { patient_id: f.patientId, payer_id: f.payerId,
      insured_id: "000000002", valid_from: "2026-01-01", status: "ACTIVE" });
    const linked = await accident(f.patientId,alt);
    const ce = await clinical(linked);
    await expect(capture(ce.encounterId)).rejects.toMatchObject({ code: "ACCIDENT_INSURANCE_CONTEXT_MISMATCH" });
    await db.query("UPDATE appointments SET accident_case_id=$1 WHERE id=$2",[await accident(other.patientId,other.insuranceId),ce.appointmentId]);
    await expect(capture(ce.encounterId)).rejects.toMatchObject({ code: "ACCIDENT_CASE_NOT_FOUND" });
  });

  it("freezes valid existing accident/policlinic values with provenance and protects historical snapshots", async () => {
    const id = await accident();
    await db.query("UPDATE clinic_locations SET policlinic_code='P' WHERE id=$1",[f.clinicLocationId]);
    const before = (await db.query("SELECT id,content_hash,declarant_id_snapshot,total_amount FROM invoice_versions WHERE invoice_id IN (SELECT id FROM invoices WHERE organization_id=$1) ORDER BY id",[f.organizationId])).rows;
    const ce = await clinical(id);
    const expected = (await db.query("SELECT accident_form_number FROM accident_cases WHERE id=$1",[id])).rows[0].accident_form_number;
    const saved = await capture(ce.encounterId);
    expect(saved.accidentFormNumberSnapshot).toBe(expected);
    expect(saved.policlinicSnapshot).toBe("P");
    expect(saved.numberOfTreatmentsSnapshot).toBeNull();
    expect(saved.assistanceSnapshot).toBeNull();
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { organizationId: BigInt(f.organizationId), entityId: BigInt(saved.id), action: "ENCOUNTER_PROCEDURE_CREATE" } });
    expect(audit.metadata).toMatchObject({ svbSourceState: "UNAPPROVED", origins: { accidentFormNumber: "APPOINTMENT_ACCIDENT_CASE", numberOfTreatments: "UNRESOLVED" } });
    await db.query("UPDATE clinic_locations SET policlinic_code='K' WHERE id=$1",[f.clinicLocationId]);
    await db.query("UPDATE accident_cases SET accident_form_number='0000009999' WHERE id=$1",[id]);
    const snapshot = await prisma.encounterProcedure.findUniqueOrThrow({ where: { id: BigInt(saved.id) } });
    expect(snapshot.policlinicSnapshot).toBe("P");
    expect(snapshot.accidentFormNumberSnapshot).toBe(expected);
    await expect(appointmentService.update(BigInt(ce.appointmentId),{ accidentCaseId: null },f.actor,{})).rejects.toMatchObject({ code: "APPOINTMENT_CLINICAL_CONTEXT_LOCKED" });
    const after = (await db.query("SELECT id,content_hash,declarant_id_snapshot,total_amount FROM invoice_versions WHERE invoice_id IN (SELECT id FROM invoices WHERE organization_id=$1) ORDER BY id",[f.organizationId])).rows;
    expect(after).toEqual(before);
    const lookup = await request(app).get("/api/v1/clinic-locations?isActive=true").set(auth()).expect(200);
    expect(lookup.body.data).toEqual([expect.objectContaining({ id: f.clinicLocationId, policlinicCode: "K" })]);
    expect(lookup.body.data.some((row: { id: string }) => row.id === other.clinicLocationId)).toBe(false);
  });
});
