import pg from "pg";
import request from "supertest";
import { randomUUID, createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { app } from "../../src/app.js";
import { env } from "../../src/config/env.js";
import { prisma } from "../../src/infrastructure/database/prisma.js";
import { accessTokenService } from "../../src/modules/auth/access-token.service.js";
import { documentService } from "../../src/modules/documents/document.service.js";
import { documentStorage } from "../../src/modules/documents/document.storage.js";
import { auditService } from "../../src/modules/audit/audit.service.js";
import { createNegFuncDbFixture } from "../helpers/neg-func-db-fixture.js";

const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
let f: Awaited<ReturnType<typeof createNegFuncDbFixture>>, other: typeof f;
let token: string, otherToken: string, readToken: string;
const stored: string[] = [];
const originalManualEnabled = env.SVB_MANUAL_RECORDING_ENABLED;
const auth = () => ({ Authorization: `Bearer ${token}` });
async function proof(actor = f.actor, text = "SYNTHETIC RECEIPT") {
  const doc = await documentService.upload(
    {
      documentType: "OTHER",
      originalFilename: "synthetic-qa.pdf",
      mimeType: "application/pdf",
      bytes: Buffer.from(`%PDF-1.4\n${text}\n%%EOF`),
    },
    actor,
  );
  const saved = await prisma.document.findUniqueOrThrow({
    where: { id: BigInt(doc.id) },
  });
  stored.push(saved.storageUri);
  return doc.id;
}
async function draft(two = false) {
  const bill = await f.invoice("00123", two),
    id = await f.batch("00123");
  const first = await f.historyItem(id, bill.itemId, 1);
  const ids = [first];
  if (bill.itemIds[1]) ids.push(await f.historyItem(id, bill.itemIds[1], 2));
  return { id, bill, ids };
}
async function prepare(id: string, key: string = randomUUID()) {
  return request(app)
    .post(`/api/v1/declarations/${id}/manual-entry/prepare`)
    .set(auth())
    .send({ idempotencyKey: key });
}
async function record(
  id: string,
  entry: { id: string; contentHash: string },
  receipt: string,
  key: string = randomUUID(),
) {
  return request(app)
    .post(`/api/v1/declarations/${id}/submissions/manual`)
    .set(auth())
    .send({
      manualEntryId: entry.id,
      expectedContentHash: entry.contentHash,
      receiptDocumentId: receipt,
      idempotencyKey: key,
      submittedAt: "2026-09-01T13:00:00-04:00",
      externalReference: "0000123",
      confirmation: "ALREADY_ENTERED_IN_OFFICIAL_PORTAL",
    });
}

describe("Backend manual portal entry without an official file format", () => {
  beforeAll(async () => {
    env.SVB_MANUAL_RECORDING_ENABLED = true; // Explicit synthetic-only scenario.
    await db.connect();
    f = await createNegFuncDbFixture(db);
    other = await createNegFuncDbFixture(db);
    await db.query(
      "INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE code='ADMIN'",
      [f.userId],
    );
    await db.query(
      "INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE code='RECEPTION'",
      [other.userId],
    );
    token = await accessTokenService.sign(
      BigInt(f.userId),
      BigInt(f.organizationId),
    );
    otherToken = await accessTokenService.sign(
      BigInt(other.userId),
      BigInt(other.organizationId),
    );
    readToken = otherToken;
  });
  afterAll(async () => {
    env.SVB_MANUAL_RECORDING_ENABLED = originalManualEnabled;
    vi.restoreAllMocks();
    // Deliberate, guarded maintenance on this dedicated synthetic DB only.
    if (!new URL(process.env.TEST_DATABASE_URL!).pathname.endsWith("_test"))
      throw new Error("QA cleanup refused");
    await db.query("BEGIN");
    try {
      await db.query(
        "ALTER TABLE declaration_manual_results DISABLE TRIGGER protect_manual_result_delete",
      );
      await db.query(
        "ALTER TABLE declaration_manual_entries DISABLE TRIGGER protect_manual_entry_delete",
      );
      const orgs = [f.organizationId, other.organizationId];
      await db.query(
        "DELETE FROM declaration_manual_results WHERE organization_id=ANY($1::bigint[])",
        [orgs],
      );
      await db.query(
        "DELETE FROM declaration_manual_entries WHERE organization_id=ANY($1::bigint[])",
        [orgs],
      );
      await db.query(
        "DELETE FROM declaration_submissions WHERE declaration_batch_id IN (SELECT id FROM declaration_batches WHERE organization_id=ANY($1::bigint[]))",
        [orgs],
      );
      await db.query(
        "ALTER TABLE declaration_manual_results ENABLE TRIGGER protect_manual_result_delete",
      );
      await db.query(
        "ALTER TABLE declaration_manual_entries ENABLE TRIGGER protect_manual_entry_delete",
      );
      await db.query("COMMIT");
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    }
    await prisma.document.deleteMany({
      where: {
        organizationId: {
          in: [BigInt(f.organizationId), BigInt(other.organizationId)],
        },
      },
    });
    for (const uri of stored) await documentStorage.remove(uri);
    await f.cleanup();
    await other.cleanup();
    await prisma.$disconnect();
    await db.end();
  }, 20000);

  it("provides only frozen internal field proposals, with exact money and reproducible bytes", async () => {
    const d = await draft(true);
    await request(app)
      .get(`/api/v1/declarations/${d.id}/manual-entry`)
      .expect(401);
    await request(app)
      .get(`/api/v1/declarations/${d.id}/manual-entry`)
      .set("Authorization", `Bearer ${otherToken}`)
      .expect(404);
    const view = await request(app)
      .get(`/api/v1/declarations/${d.id}/manual-entry`)
      .set(auth())
      .expect(200);
    expect(view.body.data.content).toMatchObject({
      notOfficialSvbFile: true,
      officialRulesVerified: false,
      entryMode: "MANUAL_ENTRY",
    });
    expect(view.body.data.content.items).toHaveLength(2);
    expect(view.body.data.content.items[0]).toMatchObject({
      amount: "12.30",
      numberOfTreatments: null,
      assistance: null,
      invoiceVersionId: d.bill.versionId,
    });
    const file = await request(app)
      .get(`/api/v1/declarations/${d.id}/manual-entry/download`)
      .set(auth())
      .expect(200);
    expect(createHash("sha256").update(file.text).digest("hex")).toBe(
      view.body.data.contentHash,
    );
    expect(file.headers["content-disposition"]).toContain("internal-v1.json");
  });
  it("serializes competing preparations and blocks edits/Clinical corrections while reserved", async () => {
    const d = await draft(),
      key = randomUUID();
    const responses = await Promise.all([
      prepare(d.id, key),
      prepare(d.id, randomUUID()),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    const winner = responses.find((r) => r.status === 201)!;
    const replayKey = responses[0]!.status === 201 ? key : null;
    if (replayKey) expect((await prepare(d.id, replayKey)).status).toBe(200);
    await request(app)
      .delete(`/api/v1/declarations/${d.id}/items/${d.ids[0]}`)
      .set(auth())
      .send({ reason: "QA" })
      .expect(409);
    await request(app)
      .post(`/api/v1/declarations/${d.id}/cancel`)
      .set(auth())
      .send({ reason: "QA" })
      .expect(409);
    await request(app)
      .post(`/api/v1/invoices/${d.bill.invoiceId}/corrections`)
      .set(auth())
      .send({ reasonCode: "QA", reasonText: "QA" })
      .expect(409);
    await request(app)
      .post(
        `/api/v1/declarations/${d.id}/manual-entry/${winner.body.data.id}/release`,
      )
      .set(auth())
      .send({
        reason: "No external interaction occurred",
        confirmation: "NOT_PRESENTED_VERIFIED",
      })
      .expect(200);
    expect((await prepare(d.id)).status).toBe(201);
  });
  it("keeps uncertainty blocked until portal verification is documented", async () => {
    const d = await draft(),
      entry = (await prepare(d.id)).body.data;
    await request(app)
      .post(`/api/v1/declarations/${d.id}/manual-entry/${entry.id}/uncertain`)
      .set(auth())
      .send({ reason: "Portal response not known" })
      .expect(200);
    expect(
      (
        await prisma.declarationBatch.findUniqueOrThrow({
          where: { id: BigInt(d.id) },
        })
      ).status,
    ).toBe("DRAFT");
    await request(app)
      .post(`/api/v1/declarations/${d.id}/manual-entry/${entry.id}/release`)
      .set(auth())
      .send({
        reason: "Checked portal",
        confirmation: "NOT_PRESENTED_VERIFIED",
      })
      .expect(409);
    await request(app)
      .post(`/api/v1/declarations/${d.id}/manual-entry/${entry.id}/release`)
      .set(auth())
      .send({
        reason: "Verified no entry exists",
        confirmation: "NOT_PRESENTED_VERIFIED",
        resolutionDocumentId: await proof(),
      })
      .expect(200);
  });
  it("records operator-confirmed manual entry once, with receipt, without export or invented fields", async () => {
    const d = await draft(),
      entry = (await prepare(d.id)).body.data,
      receipt = await proof(),
      key = randomUUID();
    const original = await prisma.invoiceVersion.findUniqueOrThrow({
      where: { id: BigInt(d.bill.versionId) },
    });
    const responses = await Promise.all([
      record(d.id, entry, receipt, key),
      record(d.id, entry, receipt, key),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 201]);
    const submission = responses[0]!.body.data;
    expect(submission).toMatchObject({
      channel: "MANUAL",
      status: "SUBMITTED",
      declarationExportId: null,
      externalReference: "0000123",
    });
    expect(submission.manualEntry.externalSubmittedAt).toBe(
      "2026-09-01T17:00:00.000Z",
    );
    expect(
      await prisma.declarationExport.count({
        where: { declarationBatchId: BigInt(d.id) },
      }),
    ).toBe(0);
    expect(
      await prisma.declarationSubmission.count({
        where: { declarationBatchId: BigInt(d.id) },
      }),
    ).toBe(1);
    expect((await record(d.id, entry, receipt, randomUUID())).status).toBe(409);
    expect(
      (await record(d.id, entry, await proof(f.actor, "Changed receipt"), key))
        .body.error.code,
    ).toBe("IDEMPOTENCY_KEY_CONFLICT");
    await request(app)
      .post(`/api/v1/declarations/${d.id}/submissions/${submission.id}/result`)
      .set(auth())
      .send({ status: "ACCEPTED" })
      .expect(409);
    const unchanged = await prisma.invoiceVersion.findUniqueOrThrow({
      where: { id: BigInt(d.bill.versionId) },
    });
    expect([unchanged.contentHash, unchanged.totalAmount.toString()]).toEqual([
      original.contentHash,
      original.totalAmount.toString(),
    ]);
    const detail = await request(app)
      .get(`/api/v1/declarations/${d.id}/submissions/${submission.id}`)
      .set(auth())
      .expect(200);
    expect(detail.body.data.manualEntry.receiptDocumentId).toBe(receipt);
    const downloaded = await request(app)
      .get(`/api/v1/documents/${receipt}/download`)
      .set(auth())
      .expect(200);
    expect(downloaded.headers["content-type"]).toContain("application/pdf");
  });
  it("requires evidence ownership, confirmation and snapshot identity; audit rollback preserves counters", async () => {
    const d = await draft(),
      entry = (await prepare(d.id)).body.data,
      receipt = await proof();
    const foreign = await proof(other.actor);
    expect((await record(d.id, entry, foreign)).status).toBe(404);
    expect(
      (await record(d.id, { ...entry, contentHash: "b".repeat(64) }, receipt))
        .body.error.code,
    ).toBe("MANUAL_CONTENT_CHANGED");
    vi.spyOn(auditService, "writeWithinTransaction").mockRejectedValueOnce(
      new Error("Synthetic audit failure"),
    );
    expect((await record(d.id, entry, receipt)).status).toBe(500);
    expect(
      await prisma.declarationSubmission.count({
        where: { declarationBatchId: BigInt(d.id) },
      }),
    ).toBe(0);
    const batch = await prisma.declarationBatch.findUniqueOrThrow({
      where: { id: BigInt(d.id) },
    });
    expect(batch.lastSubmissionAttempt).toBe(0);
    expect(
      (
        await prisma.declarationManualEntry.findUniqueOrThrow({
          where: { id: BigInt(entry.id) },
        })
      ).state,
    ).toBe("PREPARED");
    const unauthorized = await request(app)
      .post(`/api/v1/declarations/${d.id}/submissions/manual`)
      .set("Authorization", `Bearer ${readToken}`)
      .send({});
    expect(unauthorized.status).toBe(403);
  });
  it("records final per-line outcomes with evidence/idempotency and never changes billed amounts", async () => {
    const d = await draft(true),
      entry = (await prepare(d.id)).body.data;
    const submitted = await record(d.id, entry, await proof());
    expect(submitted.status).toBe(201);
    const result = {
      status: "PARTIALLY_REJECTED",
      externalReference: "R-0001",
      respondedAt: "2026-09-02T13:00:00Z",
      resultDocumentId: await proof(f.actor, "SYNTHETIC FINAL RESULT"),
      idempotencyKey: randomUUID(),
      lines: [
        { declarationItemId: d.ids[0], status: "ACCEPTED" },
        {
          declarationItemId: d.ids[1],
          status: "REJECTED",
          responseCode: "SYNTHETIC-QA",
        },
      ],
    };
    const url = `/api/v1/declarations/${d.id}/submissions/${submitted.body.data.id}/official-result`;
    await request(app)
      .post(url)
      .set(auth())
      .send({ ...result, lines: [result.lines[0]] })
      .expect(409);
    vi.spyOn(auditService, "writeWithinTransaction").mockRejectedValueOnce(
      new Error("Synthetic result rollback"),
    );
    await request(app).post(url).set(auth()).send(result).expect(500);
    expect(
      await prisma.declarationManualResult.count({
        where: { manualEntryId: BigInt(entry.id) },
      }),
    ).toBe(0);
    const recorded = await request(app)
      .post(url)
      .set(auth())
      .send(result)
      .expect(201);
    expect(recorded.body.data.result.status).toBe("PARTIALLY_REJECTED");
    await request(app).post(url).set(auth()).send(result).expect(200);
    await request(app)
      .post(url)
      .set(auth())
      .send({ ...result, externalReference: "changed" })
      .expect(409);
    const rows = await prisma.declarationItem.findMany({
      where: { declarationBatchId: BigInt(d.id) },
      orderBy: { sequenceNumber: "asc" },
    });
    expect(rows.map((r) => r.lineStatus)).toEqual(["ACCEPTED", "REJECTED"]);
    expect(rows.map((r) => r.amountSnapshot.toFixed(2))).toEqual([
      "12.30",
      "12.30",
    ]);
    await expect(
      db.query(
        "UPDATE declaration_manual_results SET status='ACCEPTED' WHERE manual_entry_id=$1",
        [entry.id],
      ),
    ).rejects.toThrow();
    await expect(
      db.query("DELETE FROM declaration_manual_entries WHERE id=$1", [
        entry.id,
      ]),
    ).rejects.toThrow();
  });
});
