import pg from "pg";
import sharp from "sharp";
import request from "supertest";
import { beforeAll, afterAll, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { prisma } from "../../src/infrastructure/database/prisma.js";
import { documentStorage } from "../../src/modules/documents/document.storage.js";
import { accessTokenService } from "../../src/modules/auth/access-token.service.js";
import {
  createNegFuncDbFixture,
  insertDbRow,
} from "../helpers/neg-func-db-fixture.js";

const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
let fixture: Awaited<ReturnType<typeof createNegFuncDbFixture>> | undefined;
let serviceId: string | undefined;
beforeAll(async () => db.connect());
afterAll(async () => {
  if (fixture) {
    const organizationId = BigInt(fixture.organizationId);
    const docs = await prisma.document.findMany({ where: { organizationId } });
    await prisma.signature.deleteMany({
      where: { invoiceVersion: { invoice: { organizationId } } },
    });
    await prisma.invoiceDocument.deleteMany({
      where: { invoiceVersion: { invoice: { organizationId } } },
    });
    await prisma.document.deleteMany({ where: { organizationId } });
    for (const doc of docs) await documentStorage.remove(doc.storageUri);
    await db.query("DELETE FROM audit_logs WHERE organization_id=$1", [
      fixture.organizationId,
    ]);
    const invoiceScope = { invoice: { organizationId } };
    await prisma.invoiceStatusHistory.deleteMany({ where: invoiceScope });
    await prisma.invoiceItem.deleteMany({
      where: { invoiceVersion: invoiceScope },
    });
    await prisma.invoice.updateMany({
      where: { organizationId },
      data: { currentVersionId: null },
    });
    await prisma.invoiceVersion.deleteMany({ where: invoiceScope });
    await prisma.invoice.deleteMany({ where: { organizationId } });
    await prisma.encounterProcedure.deleteMany({
      where: { encounter: { appointment: { organizationId } } },
    });
    await prisma.clinicalEncounter.deleteMany({
      where: { appointment: { organizationId } },
    });
    await prisma.appointmentStatusHistory.deleteMany({
      where: { appointment: { organizationId } },
    });
    await prisma.appointment.deleteMany({ where: { organizationId } });
    await db.query(
      "UPDATE providers SET user_id=NULL WHERE organization_id=$1",
      [fixture.organizationId],
    );
    await db.query(
      "DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE organization_id=$1 AND id<>$2)",
      [fixture.organizationId, fixture.userId],
    );
    await db.query("DELETE FROM users WHERE organization_id=$1 AND id<>$2", [
      fixture.organizationId,
      fixture.userId,
    ]);
    await fixture.cleanup();
  }
  if (serviceId) {
    await db.query("DELETE FROM svb_tariffs WHERE svb_procedure_id=$1", [
      serviceId,
    ]);
    await db.query("DELETE FROM svb_procedures WHERE id=$1", [serviceId]);
  }
  await prisma.$disconnect();
  await db.end();
});

it("records performed services before billing and hands off invoice and signature to reception", async () => {
  const f = await createNegFuncDbFixture(db);
  fixture = f;
  const auth = async (role: string) => {
    const userId = await insertDbRow(db, "users", {
      organization_id: f.organizationId,
      email: `service-flow-${f.organizationId}-${role}@local.invalid`,
      password_hash: "synthetic-fixture",
      first_name: "QA",
      last_name: role,
    });
    await db.query(
      "INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE code=$2",
      [userId, role],
    );
    return {
      userId,
      header: {
        Authorization: `Bearer ${await accessTokenService.sign(BigInt(userId), BigInt(f.organizationId))}`,
      },
    };
  };
  const provider = await auth("PROVIDER");
  const reception = await auth("RECEPTION");
  const admin = await auth("ADMIN");
  await db.query(
    "UPDATE providers SET svb_provider_id='12345', user_id=$2 WHERE id=$1",
    [f.providerId, provider.userId],
  );
  await db.query("UPDATE organizations SET declarant_id=$2 WHERE id=$1", [
    f.organizationId,
    f.organizationId.padStart(5, "0"),
  ]);
  await insertDbRow(db, "number_sequences", {
    organization_id: f.organizationId,
    sequence_type: "INVOICE",
    sequence_year: new Date().getFullYear(),
    prefix: "ATT-",
  });
  serviceId = await insertDbRow(db, "svb_procedures", {
    code: `QA-ATT-${f.organizationId}`,
    description: "Synthetic performed service",
    requires_authorization: true,
    requires_referral: true,
  });
  const created = await request(app)
    .post("/api/v1/appointments")
    .set(reception.header)
    .send({
      patientId: f.patientId,
      providerId: f.providerId,
      clinicLocationId: f.clinicLocationId,
      scheduledStart: "2026-11-06T12:00:00-04:00",
      scheduledEnd: "2026-11-06T12:30:00-04:00",
    })
    .expect(201);
  const appointmentPath = `/api/v1/appointments/${created.body.data.id}`;
  const startPath = `${appointmentPath}/clinical-encounter/start`;
  const invoicePath = `${appointmentPath}/invoice`;
  await request(app).post(startPath).set(provider.header).expect(409);
  await request(app)
    .patch(`${appointmentPath}/status`)
    .set(reception.header)
    .send({ status: "CONFIRMED" })
    .expect(200);
  await request(app).post(startPath).set(reception.header).expect(403);
  const started = await request(app)
    .post(startPath)
    .set(provider.header)
    .expect(200);
  const encounterId = started.body.data.id as string;
  expect(started.body.data.appointment.status).toBe("IN_PROGRESS");
  const replay = await request(app)
    .post(startPath)
    .set(provider.header)
    .expect(200);
  expect(replay.body.data.id).toBe(encounterId);
  await request(app)
    .patch(appointmentPath)
    .set(reception.header)
    .send({ scheduledEnd: "2026-11-06T13:00:00-04:00" })
    .expect(409);
  const attentionPath = `/api/v1/clinical-encounters/${encounterId}`;
  await request(app)
    .post(`${attentionPath}/finish-services`)
    .set(provider.header)
    .expect(409);
  const servicesPath = `${attentionPath}/procedures`;
  const first = await request(app)
    .post(servicesPath)
    .set(provider.header)
    .send({ svbProcedureId: serviceId })
    .expect(201);
  await request(app)
    .delete(`${servicesPath}/${first.body.data.id}`)
    .set(provider.header)
    .expect(200);
  const service = await request(app)
    .post(servicesPath)
    .set(provider.header)
    .send({ svbProcedureId: serviceId, quantity: "1.25" })
    .expect(201);
  expect(service.body.data).toMatchObject({
    quantity: "1.25",
    patientInsuranceId: null,
    svbTariffId: null,
    amount: null,
    authorizationItemId: null,
    diagnosisId: null,
    additionalNote: null,
  });
  await request(app).post(invoicePath).set(reception.header).expect(409);
  const finished = await request(app)
    .post(`${attentionPath}/finish-services`)
    .set(provider.header)
    .expect(200);
  expect(finished.body.data).toMatchObject({
    status: "COMPLETED",
    appointment: { status: "COMPLETED" },
  });
  await request(app)
    .delete(`${servicesPath}/${service.body.data.id}`)
    .set(provider.header)
    .expect(409);
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Curacao",
    dateStyle: "short",
  }).format(new Date());
  const report = await request(app)
    .get("/api/v1/reports/dashboard")
    .query({ from: day, to: day })
    .set(admin.header)
    .expect(200);
  expect(report.body.data.kpis).toMatchObject({
    completedAttentions: 1,
    production: [],
  });
  expect(report.body.data.serviceVolumeByProvider).toMatchObject([
    { attentions: 1, units: "1.25" },
  ]);
  await request(app).post(invoicePath).set(provider.header).expect(403);
  const missingTariff = await request(app)
    .post(invoicePath)
    .set(reception.header)
    .expect(409);
  expect(missingTariff.body.error.code).toBe("SVB_TARIFF_NOT_FOUND");
  expect(
    (await request(app).get(servicesPath).set(provider.header).expect(200)).body
      .data[0].amount,
  ).toBeNull();

  await insertDbRow(db, "svb_tariffs", {
    svb_procedure_id: serviceId,
    amount: "12.30",
    currency_code: "ANG",
    valid_from: "2026-01-01",
  });
  const bill = await request(app)
    .post(invoicePath)
    .set(reception.header)
    .send({ patientInsuranceId: f.insuranceId })
    .expect(201);
  expect(bill.body.data.currentVersion).toMatchObject({
    totalAmount: "15.38",
    items: [{ quantity: "1.25", unitTariffSnapshot: "12.30", amount: "15.38" }],
  });
  const versionPath = `/api/v1/invoices/${bill.body.data.id}/versions/${bill.body.data.currentVersion.id}`;
  await request(app)
    .post(`${versionPath}/prepare-signature`)
    .set(provider.header)
    .expect(403);
  const prepared = await request(app)
    .post(`${versionPath}/prepare-signature`)
    .set(reception.header)
    .expect(200);
  const signaturePng = await sharp(
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="60"><path d="M12 48 L54 12 L85 48 L146 20" fill="none" stroke="black" stroke-width="3"/></svg>',
    ),
  )
    .png()
    .toBuffer();
  const document = await request(app)
    .post(
      "/api/v1/documents?documentType=SIGNATURE&originalFilename=QA-SERVICE.png",
    )
    .set(reception.header)
    .set("Content-Type", "image/png")
    .send(signaturePng)
    .expect(201);
  const signature = {
    signatureDocumentId: document.body.data.id,
    signatureType: "PATIENT",
    captureMethod: "SIGNATURE_PAD",
    expectedContentHash: prepared.body.data.currentVersion.contentHash,
  };
  await request(app)
    .post(`${versionPath}/signatures`)
    .set(provider.header)
    .send(signature)
    .expect(403);
  await request(app)
    .post(`${versionPath}/signatures`)
    .set(reception.header)
    .send(signature)
    .expect(201);
  await request(app)
    .post(`${versionPath}/sign`)
    .set(reception.header)
    .expect(200);
  const closed = await request(app)
    .post(`${versionPath}/close`)
    .set(reception.header)
    .expect(200);
  expect(closed.body.data).toMatchObject({
    status: "CLOSED",
    currentVersion: {
      totalAmount: "15.38",
      contentHash: signature.expectedContentHash,
    },
  });
  await request(app).post(invoicePath).set(reception.header).expect(409);
}, 25_000);
