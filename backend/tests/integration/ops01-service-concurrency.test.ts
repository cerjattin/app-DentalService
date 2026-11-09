import pg from "pg";
import request from "supertest";
import sharp from "sharp";
import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { app } from "../../src/app.js";
import { prisma } from "../../src/infrastructure/database/prisma.js";
import { documentStorage } from "../../src/modules/documents/document.storage.js";
import { auditService } from "../../src/modules/audit/audit.service.js";
import { accessTokenService } from "../../src/modules/auth/access-token.service.js";
import {
  createNegFuncDbFixture,
  insertDbRow,
} from "../helpers/neg-func-db-fixture.js";
const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
let f: Awaited<ReturnType<typeof createNegFuncDbFixture>>,
  token: string,
  serial = 0,
  serviceId: string;
const auth = () => ({ Authorization: `Bearer ${token}` });
const ap = (id: string) => `/api/v1/appointments/${id}`;
const ce = (id: string) => `/api/v1/clinical-encounters/${id}`;
beforeAll(async () => {
  await db.connect();
  f = await createNegFuncDbFixture(db);
  await db.query(
    "INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE code='ADMIN'",
    [f.userId],
  );
  token = await accessTokenService.sign(
    BigInt(f.userId),
    BigInt(f.organizationId),
  );
  await db.query("UPDATE organizations SET declarant_id='00123' WHERE id=$1", [
    f.organizationId,
  ]);
  await db.query("UPDATE providers SET svb_provider_id='12345' WHERE id=$1", [
    f.providerId,
  ]);
  serviceId = await insertDbRow(db, "svb_procedures", {
    code: `OPS-${f.organizationId}`,
    description: "Synthetic OPS service",
  });
  await insertDbRow(db, "svb_tariffs", {
    svb_procedure_id: serviceId,
    amount: "12.30",
    currency_code: "ANG",
    valid_from: "2026-01-01",
  });
  await insertDbRow(db, "number_sequences", {
    organization_id: f.organizationId,
    sequence_type: "INVOICE",
    sequence_year: new Date().getFullYear(),
    prefix: "OPS-",
  });
});
afterAll(async () => {
  vi.restoreAllMocks();
  const docs = await prisma.document.findMany({
    where: { organizationId: BigInt(f.organizationId) },
  });
  await prisma.signature.deleteMany({
    where: {
      invoiceVersion: { invoice: { organizationId: BigInt(f.organizationId) } },
    },
  });
  await prisma.invoiceDocument.deleteMany({
    where: {
      invoiceVersion: { invoice: { organizationId: BigInt(f.organizationId) } },
    },
  });
  await prisma.document.deleteMany({
    where: { organizationId: BigInt(f.organizationId) },
  });
  for (const doc of docs) await documentStorage.remove(doc.storageUri);
  await f.cleanup();
  await db.query("DELETE FROM svb_tariffs WHERE svb_procedure_id=$1", [
    serviceId,
  ]);
  await db.query("DELETE FROM svb_procedures WHERE id=$1", [serviceId]);
  await prisma.$disconnect();
  await db.end();
});
async function appointment() {
  serial++;
  const day = String(serial).padStart(2, "0");
  return (
    await request(app)
      .post("/api/v1/appointments")
      .set(auth())
      .send({
        patientId: f.patientId,
        providerId: f.providerId,
        clinicLocationId: f.clinicLocationId,
        scheduledStart: `2026-12-${day}T10:00:00-04:00`,
        scheduledEnd: `2026-12-${day}T10:30:00-04:00`,
      })
      .expect(201)
  ).body.data.id as string;
}
async function open() {
  const id = await appointment();
  await request(app)
    .patch(ap(id) + "/status")
    .set(auth())
    .send({ status: "CONFIRMED" })
    .expect(200);
  const entry = (
    await request(app)
      .post(ap(id) + "/clinical-encounter/start")
      .set(auth())
      .expect(200)
  ).body.data;
  return { id, encounter: entry.id as string };
}
const add = (id: string) =>
  request(app)
    .post(ce(id) + "/procedures")
    .set(auth())
    .send({ svbProcedureId: serviceId });
const finish = (id: string) =>
  request(app)
    .post(ce(id) + "/finish-services")
    .set(auth());
it("starts concurrently once and preserves an open correction on a completed appointment", async () => {
  const id = await appointment();
  await request(app)
    .patch(ap(id) + "/status")
    .set(auth())
    .send({ status: "CONFIRMED" })
    .expect(200);
  const starts = await Promise.all([
    request(app)
      .post(ap(id) + "/clinical-encounter/start")
      .set(auth()),
    request(app)
      .post(ap(id) + "/clinical-encounter/start")
      .set(auth()),
  ]);
  expect(starts.map((r) => r.status)).toEqual([200, 200]);
  expect(starts[0]!.body.data.id).toBe(starts[1]!.body.data.id);
  await request(app)
    .patch(ap(id) + "/status")
    .set(auth())
    .send({ status: "CANCELLED", reason: "Synthetic cancel after start" })
    .expect(409);
  await add(starts[0]!.body.data.id).expect(201);
  await finish(starts[0]!.body.data.id).expect(200);
  const bill = (
    await request(app)
      .post(ap(id) + "/invoice")
      .set(auth())
      .expect(201)
  ).body.data;
  await request(app)
    .post(`/api/v1/invoices/${bill.id}/reopen-encounter`)
    .set(auth())
    .send({
      reason: "Synthetic return",
      expectedVersionId: bill.currentVersion.id,
    })
    .expect(200);
  const resumed = await request(app)
    .post(ap(id) + "/clinical-encounter/start")
    .set(auth())
    .expect(200);
  expect(resumed.body.data.id).toBe(starts[0]!.body.data.id);
  expect(resumed.body.data.appointment.status).toBe("COMPLETED");
});
it("completes a legacy checked-in handoff and preserves the original encounter completion time", async () => {
  const d = await open();
  await add(d.encounter).expect(201);
  await db.query(
    "UPDATE clinical_encounters SET status='COMPLETED',started_at='2026-11-01T13:00:00Z',completed_at='2026-11-01T14:00:00Z' WHERE id=$1",
    [d.encounter],
  );
  await db.query("UPDATE appointments SET status='CHECKED_IN' WHERE id=$1", [
    d.id,
  ]);
  const result = await finish(d.encounter).expect(200);
  expect(result.body.data.status).toBe("COMPLETED");
  expect(result.body.data.appointment.status).toBe("COMPLETED");
  expect(result.body.data.completedAt).toBe("2026-11-01T14:00:00.000Z");
});
it("serializes adding/removing with joint finish and invoice creation without missing a performed line", async () => {
  const d = await open();
  const first = await add(d.encounter).expect(201);
  const [added, closed] = await Promise.all([
    add(d.encounter),
    finish(d.encounter),
  ]);
  expect([200, 409]).toContain(closed.status);
  expect([201, 409]).toContain(added.status);
  await finish(d.encounter).expect(200);
  const rows = await prisma.encounterProcedure.findMany({
    where: { encounterId: BigInt(d.encounter), status: "PERFORMED" },
  });
  expect(rows).toHaveLength(added.status === 201 ? 2 : 1);
  await request(app)
    .delete(ce(d.encounter) + `/procedures/${first.body.data.id}`)
    .set(auth())
    .expect(409);
  const bills = await Promise.all([
    request(app)
      .post(ap(d.id) + "/invoice")
      .set(auth()),
    request(app)
      .post(ap(d.id) + "/invoice")
      .set(auth()),
  ]);
  expect(bills.map((r) => r.status).sort()).toEqual([201, 409]);
  expect(
    bills.find((r) => r.status === 201)!.body.data.currentVersion.items,
  ).toHaveLength(rows.length);
});
it("rolls back both completion states when audit fails, leaving services available", async () => {
  const d = await open();
  await add(d.encounter).expect(201);
  vi.spyOn(auditService, "writeWithinTransaction").mockRejectedValueOnce(
    new Error("Synthetic audit failure"),
  );
  await finish(d.encounter).expect(500);
  vi.restoreAllMocks();
  expect(
    (
      await prisma.appointment.findUniqueOrThrow({
        where: { id: BigInt(d.id) },
      })
    ).status,
  ).toBe("IN_PROGRESS");
  expect(
    (
      await prisma.clinicalEncounter.findUniqueOrThrow({
        where: { id: BigInt(d.encounter) },
      })
    ).status,
  ).toBe("OPEN");
  await finish(d.encounter).expect(200);
});

it("prices a new unpriced replacement after return, signs a new version and keeps both PDFs", async () => {
  const d = await open();
  const first = (await add(d.encounter).expect(201)).body.data;
  await finish(d.encounter).expect(200);
  const original = (
    await request(app)
      .post(ap(d.id) + "/invoice")
      .set(auth())
      .expect(201)
  ).body.data;
  const png = await sharp(
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="60"><path d="M5 40 L45 8 L85 35 L140 10" stroke="black" fill="none"/></svg>',
    ),
  )
    .png()
    .toBuffer();
  const sign = async (invoiceId: string, versionId: string) => {
    const path = `/api/v1/invoices/${invoiceId}/versions/${versionId}`;
    const prepared = (
      await request(app)
        .post(path + "/prepare-signature")
        .set(auth())
        .expect(200)
    ).body.data;
    const proof = (
      await request(app)
        .post(
          "/api/v1/documents?documentType=SIGNATURE&originalFilename=ops-signature.png",
        )
        .set(auth())
        .set("Content-Type", "image/png")
        .send(png)
        .expect(201)
    ).body.data;
    await request(app)
      .post(path + "/signatures")
      .set(auth())
      .send({
        signatureDocumentId: proof.id,
        signatureType: "PATIENT",
        captureMethod: "SIGNATURE_PAD",
        expectedContentHash: prepared.currentVersion.contentHash,
      })
      .expect(201);
    await request(app)
      .post(path + "/sign")
      .set(auth())
      .expect(200);
    await request(app)
      .post(path + "/close")
      .set(auth())
      .expect(200);
    const pdf = (
      await request(app)
        .post(path + "/pdf")
        .set(auth())
        .expect(201)
    ).body.data;
    return { hash: prepared.currentVersion.contentHash, pdf };
  };
  const old = await sign(original.id, original.currentVersion.id);
  await request(app)
    .post(`/api/v1/invoices/${original.id}/reopen-encounter`)
    .set(auth())
    .send({
      reason: "Synthetic rebilling replacement",
      expectedVersionId: original.currentVersion.id,
    })
    .expect(200);
  await request(app)
    .delete(ce(d.encounter) + `/procedures/${first.id}`)
    .set(auth())
    .expect(200);
  const added = (
    await request(app)
      .post(ce(d.encounter) + "/procedures")
      .set(auth())
      .send({ svbProcedureId: serviceId, quantity: "2.25" })
      .expect(201)
  ).body.data;
  expect(added.amount).toBeNull();
  await finish(d.encounter).expect(200);
  const rebuilt = (
    await request(app)
      .post(ap(d.id) + "/invoice")
      .set(auth())
      .expect(201)
  ).body.data;
  expect(rebuilt).toMatchObject({
    id: original.id,
    invoiceNumber: original.invoiceNumber,
    patientInsuranceId: original.patientInsuranceId,
    currentVersion: { currencyCode: "ANG", totalAmount: "27.68" },
  });
  const next = await sign(rebuilt.id, rebuilt.currentVersion.id);
  expect(next.hash).not.toBe(old.hash);
  const history = await prisma.invoiceVersion.findUniqueOrThrow({
    where: { id: BigInt(original.currentVersion.id) },
  });
  expect(history.contentHash).toBe(old.hash);
  expect(history.status).toBe("SUPERSEDED");
  expect(history.totalAmount.toFixed(2)).toBe("12.30");
  expect(
    (
      await prisma.encounterProcedure.findUniqueOrThrow({
        where: { id: BigInt(first.id) },
      })
    ).status,
  ).toBe("VOID");
  for (const pdf of [old.pdf, next.pdf])
    await request(app)
      .get(`/api/v1/documents/${pdf.documentId}/download`)
      .set(auth())
      .expect(200);
}, 30000);
