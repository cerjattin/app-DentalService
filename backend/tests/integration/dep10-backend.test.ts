import pg from "pg";
import request from "supertest";
import { randomUUID } from "node:crypto";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { app } from "../../src/app.js";
import { env } from "../../src/config/env.js";
import { prisma } from "../../src/infrastructure/database/prisma.js";
import { accessTokenService } from "../../src/modules/auth/access-token.service.js";
import { documentService } from "../../src/modules/documents/document.service.js";
import { documentStorage } from "../../src/modules/documents/document.storage.js";
import { auditService } from "../../src/modules/audit/audit.service.js";
import {
  createNegFuncDbFixture,
  insertDbRow,
} from "../helpers/neg-func-db-fixture.js";
const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
type Fixture = Awaited<ReturnType<typeof createNegFuncDbFixture>>;
let f: Fixture, other: Fixture, token: string, foreign: string;
const originalEnabled = env.SVB_MANUAL_RECORDING_ENABLED;
const files: string[] = [];
const auth = () => ({ Authorization: `Bearer ${token}` });
async function bill(count = 2) {
  const invoice = await f.invoice("00123", count > 1);
  if (count > 2) {
    const { id: ignoredItem, ...source } = (
      await db.query("SELECT * FROM invoice_items WHERE id=$1", [
        invoice.itemId,
      ])
    ).rows[0];
    const { id: ignoredProcedure, ...procedure } = (
      await db.query("SELECT * FROM encounter_procedures WHERE id=$1", [
        source.encounter_procedure_id,
      ])
    ).rows[0];
    for (let line = 3; line <= count; line++) {
      const procedureId = await insertDbRow(
        db,
        "encounter_procedures",
        procedure,
      );
      invoice.itemIds.push(
        await insertDbRow(db, "invoice_items", {
          ...source,
          line_number: line,
          encounter_procedure_id: procedureId,
          detail_invoice_number: null,
        }),
      );
    }
    await db.query(
      "UPDATE invoice_versions SET total_amount=(SELECT sum(amount) FROM invoice_items WHERE invoice_version_id=$1) WHERE id=$1",
      [invoice.versionId],
    );
  }
  return invoice;
}
async function batch(ids: string[]) {
  const id = await f.batch("00123");
  for (const [index, item] of ids.entries())
    await f.historyItem(id, item, index + 1);
  return id;
}
const prepare = (id: string, key: string = randomUUID()) =>
  request(app)
    .post(`/api/v1/declarations/${id}/manual-entry/prepare`)
    .set(auth())
    .send({ idempotencyKey: key });
async function evidence() {
  const result = await documentService.upload(
    {
      documentType: "OTHER",
      originalFilename: "synthetic-dep10.pdf",
      mimeType: "application/pdf",
      bytes: Buffer.from("%PDF-1.4\nSYNTHETIC QA ONLY\n%%EOF"),
    },
    f.actor,
  );
  files.push(
    (
      await prisma.document.findUniqueOrThrow({
        where: { id: BigInt(result.id) },
      })
    ).storageUri,
  );
  return result.id;
}
function payload(entry: { id: string; contentHash: string }, receipt: string) {
  return {
    manualEntryId: entry.id,
    expectedContentHash: entry.contentHash,
    receiptDocumentId: receipt,
    submittedAt: "2026-09-02T12:00:00-04:00",
    externalReference: "000123",
    idempotencyKey: randomUUID(),
    confirmation: "ALREADY_ENTERED_IN_OFFICIAL_PORTAL",
  };
}
const record = (id: string, body: ReturnType<typeof payload>) =>
  request(app)
    .post(`/api/v1/declarations/${id}/submissions/manual`)
    .set(auth())
    .send(body);
async function untouched(id: string) {
  expect(
    await prisma.declarationManualEntry.count({
      where: { declarationBatchId: BigInt(id) },
    }),
  ).toBe(0);
  expect(
    await prisma.declarationSubmission.count({
      where: { declarationBatchId: BigInt(id) },
    }),
  ).toBe(0);
  expect(
    (
      await prisma.declarationBatch.findUniqueOrThrow({
        where: { id: BigInt(id) },
      })
    ).lastSubmissionAttempt,
  ).toBe(0);
}
describe("DEP10 backend invoice completeness and deferred presentation", () => {
  beforeAll(async () => {
    await db.connect();
    f = await createNegFuncDbFixture(db);
    other = await createNegFuncDbFixture(db);
    for (const userId of [f.userId, other.userId])
      await db.query(
        "INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE code='ADMIN'",
        [userId],
      );
    token = await accessTokenService.sign(
      BigInt(f.userId),
      BigInt(f.organizationId),
    );
    foreign = await accessTokenService.sign(
      BigInt(other.userId),
      BigInt(other.organizationId),
    );
    env.SVB_MANUAL_RECORDING_ENABLED = false;
  });
  afterEach(() => {
    env.SVB_MANUAL_RECORDING_ENABLED = false;
    vi.restoreAllMocks();
  });
  afterAll(async () => {
    env.SVB_MANUAL_RECORDING_ENABLED = originalEnabled;
    if (!new URL(process.env.TEST_DATABASE_URL!).pathname.endsWith("_test"))
      throw new Error("Dedicated QA required");
    await db.query("BEGIN");
    try {
      await db.query(
        "ALTER TABLE declaration_manual_entries DISABLE TRIGGER protect_manual_entry_delete",
      );
      await db.query(
        "ALTER TABLE declaration_manual_results DISABLE TRIGGER protect_manual_result_delete",
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
        "ALTER TABLE declaration_manual_entries ENABLE TRIGGER protect_manual_entry_delete",
      );
      await db.query(
        "ALTER TABLE declaration_manual_results ENABLE TRIGGER protect_manual_result_delete",
      );
      await db.query("COMMIT");
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    }
    await prisma.document.deleteMany({
      where: { organizationId: BigInt(f.organizationId) },
    });
    for (const uri of files) await documentStorage.remove(uri);
    await f.cleanup();
    await other.cleanup();
    await prisma.$disconnect();
    await db.end();
  }, 20000);
  it("rejects one of 22 lines without preparation, audit or counter changes", async () => {
    env.SVB_MANUAL_RECORDING_ENABLED = true;
    const invoice = await bill(22),
      id = await batch([invoice.itemId]);
    const audit = vi.spyOn(auditService, "writeWithinTransaction");
    const result = await prepare(id);
    expect(result.status).toBe(409);
    expect(result.body.error.code).toBe("MANUAL_ENTRY_INCOMPLETE_INVOICE");
    expect(result.body.error.details).toBeNull();
    expect(audit).not.toHaveBeenCalled();
    await untouched(id);
    await request(app)
      .get(`/api/v1/declarations/${id}/manual-entry`)
      .set(auth())
      .expect(200); // Internal preview remains readable.
  });
  it("rejects two concurrent partial batches of the same invoice", async () => {
    env.SVB_MANUAL_RECORDING_ENABLED = true;
    const invoice = await bill(22),
      a = await batch(invoice.itemIds.slice(0, 11)),
      b = await batch(invoice.itemIds.slice(11));
    const results = await Promise.all([prepare(a), prepare(b)]);
    expect(results.map((r) => r.body.error.code)).toEqual([
      "MANUAL_ENTRY_INCOMPLETE_INVOICE",
      "MANUAL_ENTRY_INCOMPLETE_INVOICE",
    ]);
    await untouched(a);
    await untouched(b);
  });
  it("rejects mixed invoices and mixed versions even when the selected count matches", async () => {
    env.SVB_MANUAL_RECORDING_ENABLED = true;
    const first = await bill(),
      second = await bill(1),
      id = await batch([first.itemIds[0]!, second.itemId]);
    expect((await prepare(id)).body.error.code).toBe(
      "MANUAL_ENTRY_SINGLE_INVOICE_REQUIRED",
    );
    await untouched(id);
    const third = await bill(1);
    const { id: oldVersion, ...version } = (
      await db.query("SELECT * FROM invoice_versions WHERE id=$1", [
        third.versionId,
      ])
    ).rows[0];
    const versionId = await insertDbRow(db, "invoice_versions", {
      ...version,
      version_number: 2,
    });
    const { id: oldItem, ...item } = (
      await db.query("SELECT * FROM invoice_items WHERE id=$1", [third.itemId])
    ).rows[0];
    const itemId = await insertDbRow(db, "invoice_items", {
      ...item,
      invoice_version_id: versionId,
    });
    const mixed = await batch([third.itemId, itemId]);
    expect((await prepare(mixed)).body.error.code).toBe(
      "MANUAL_ENTRY_SINGLE_INVOICE_REQUIRED",
    );
    await untouched(mixed);
  });
  it("allows a complete 22-line invoice with one concurrent preparation winner, record and replay", async () => {
    env.SVB_MANUAL_RECORDING_ENABLED = true;
    const invoice = await bill(22),
      id = await batch(invoice.itemIds);
    const results = await Promise.all([prepare(id), prepare(id)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const entry = results.find((r) => r.status === 201)!.body.data,
      body = payload(entry, await evidence());
    const saved = await record(id, body).expect(201),
      replay = await record(id, body).expect(200);
    expect(replay.body.data.id).toBe(saved.body.data.id);
    expect(
      await prisma.declarationSubmission.count({
        where: { declarationBatchId: BigInt(id) },
      }),
    ).toBe(1);
    expect(
      (
        await prisma.declarationManualEntry.findUniqueOrThrow({
          where: { id: BigInt(entry.id) },
        })
      ).contentSnapshot,
    ).toMatchObject({
      items: expect.arrayContaining(
        invoice.itemIds.map((invoiceItemId) =>
          expect.objectContaining({ invoiceItemId }),
        ),
      ),
    });
  });
  it("rolls back a failed preparation audit and serializes a concurrent invoice correction", async () => {
    env.SVB_MANUAL_RECORDING_ENABLED = true;
    const invoice = await bill(),
      id = await batch(invoice.itemIds);
    vi.spyOn(auditService, "writeWithinTransaction").mockRejectedValueOnce(
      new Error("Synthetic audit failure"),
    );
    await prepare(id).expect(500);
    await untouched(id);
    vi.restoreAllMocks();
    const results = await Promise.all([
      prepare(id),
      request(app)
        .post(`/api/v1/invoices/${invoice.invoiceId}/corrections`)
        .set(auth())
        .send({
          reasonCode: "QA",
          reasonText: "Synthetic concurrent correction",
        }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const version = await prisma.invoiceVersion.findUniqueOrThrow({
      where: { id: BigInt(invoice.versionId) },
    });
    expect(version.contentHash).toBe("a".repeat(64));
    expect(version.status).toBe("CLOSED");
    if (results[0]!.status === 201)
      expect(
        (
          await prisma.invoice.findUniqueOrThrow({
            where: { id: BigInt(invoice.invoiceId) },
          })
        ).status,
      ).toBe("CLOSED");
    else await untouched(id);
  });
  it("diagnoses an old partial preparation at record time without rewriting it", async () => {
    env.SVB_MANUAL_RECORDING_ENABLED = true;
    const invoice = await bill(22),
      id = await batch([invoice.itemId]);
    const dossier = (
      await request(app)
        .get(`/api/v1/declarations/${id}/manual-entry`)
        .set(auth())
        .expect(200)
    ).body.data;
    const legacy = await prisma.declarationManualEntry.create({
      data: {
        organizationId: BigInt(f.organizationId),
        declarationBatchId: BigInt(id),
        claimKey: randomUUID(),
        contentHash: dossier.contentHash,
        contentSnapshot: dossier.content,
        preparedByUserId: BigInt(f.userId),
      },
    });
    const result = await record(
      id,
      payload(
        { id: legacy.id.toString(), contentHash: legacy.contentHash },
        await evidence(),
      ),
    );
    expect(result.status).toBe(409);
    expect(result.body.error.code).toBe("MANUAL_ENTRY_INCOMPLETE_INVOICE");
    expect(
      (
        await prisma.declarationManualEntry.findUniqueOrThrow({
          where: { id: legacy.id },
        })
      ).contentSnapshot,
    ).toEqual(legacy.contentSnapshot);
    expect(
      await prisma.declarationSubmission.count({
        where: { declarationBatchId: BigInt(id) },
      }),
    ).toBe(0);
  });
  it("defers direct Admin calls with no file access/mutation and does not expose foreign resources", async () => {
    const invoice = await bill(),
      id = await batch(invoice.itemIds),
      body = payload({ id: "999999", contentHash: "a".repeat(64) }, "999999");
    const read = vi.spyOn(documentService, "download");
    expect((await prepare(id)).body.error.code).toBe(
      "SVB_PRESENTATION_DEFERRED",
    );
    expect((await record(id, body)).body.error.code).toBe(
      "SVB_PRESENTATION_DEFERRED",
    );
    expect(read).not.toHaveBeenCalled();
    await untouched(id);
    await request(app)
      .post(`/api/v1/declarations/${id}/manual-entry/prepare`)
      .send({ idempotencyKey: randomUUID() })
      .expect(401);
    await request(app)
      .post(`/api/v1/declarations/${id}/manual-entry/prepare`)
      .set("Authorization", `Bearer ${foreign}`)
      .send({ idempotencyKey: randomUUID() })
      .expect(404);
    await request(app)
      .post(`/api/v1/declarations/${id}/submissions/manual`)
      .set("Authorization", `Bearer ${foreign}`)
      .send(body)
      .expect(404);
    const readiness = await request(app)
      .get("/api/v1/svb-pilot/readiness")
      .set(auth())
      .expect(200);
    expect(readiness.body.data.manualPortalRecordingEnabled).toBe(false);
  });
  it("preserves confirmed replay, final responses, history and uncertain-release while deferred", async () => {
    env.SVB_MANUAL_RECORDING_ENABLED = true;
    const invoice = await bill(1),
      id = await batch(invoice.itemIds),
      prepareKey = randomUUID();
    const entry = (await prepare(id, prepareKey)).body.data,
      receipt = await evidence(),
      body = payload(entry, receipt);
    const saved = (await record(id, body).expect(201)).body.data;
    const invoice2 = await bill(1),
      id2 = await batch(invoice2.itemIds),
      prepared2 = (await prepare(id2)).body.data;
    env.SVB_MANUAL_RECORDING_ENABLED = false;
    const read = vi
      .spyOn(documentService, "download")
      .mockRejectedValue(new Error("Synthetic unavailable file"));
    expect(
      (await prepare(id, prepareKey).expect(200)).body.data.receiptSha256,
    ).toBe(saved.manualEntry.receiptSha256);
    expect((await record(id, body).expect(200)).body.data).toEqual(saved);
    expect(read).not.toHaveBeenCalled();
    expect(
      (await record(id, { ...body, idempotencyKey: randomUUID() })).body.error
        .code,
    ).toBe("SVB_PRESENTATION_DEFERRED");
    expect(
      (await record(id, { ...body, externalReference: "different" })).body.error
        .code,
    ).toBe("IDEMPOTENCY_KEY_CONFLICT");
    vi.restoreAllMocks();
    const current = (
      await request(app)
        .get(`/api/v1/declarations/${id}/manual-entry`)
        .set(auth())
        .expect(200)
    ).body.data;
    const lines = current.content.items.map(
      (line: { declarationItemId: string }) => ({
        declarationItemId: line.declarationItemId,
        status: "ACCEPTED",
      }),
    );
    await request(app)
      .post(
        `/api/v1/declarations/${id}/submissions/${saved.id}/official-result`,
      )
      .set(auth())
      .send({
        status: "ACCEPTED",
        externalReference: "QA-result",
        respondedAt: "2026-09-03T12:00:00-04:00",
        resultDocumentId: receipt,
        idempotencyKey: randomUUID(),
        lines,
      })
      .expect(201);
    await request(app)
      .post(
        `/api/v1/declarations/${id2}/manual-entry/${prepared2.id}/uncertain`,
      )
      .set(auth())
      .send({ reason: "Synthetic pending outcome" })
      .expect(200);
    await request(app)
      .post(`/api/v1/declarations/${id2}/manual-entry/${prepared2.id}/release`)
      .set(auth())
      .send({
        reason: "Synthetic verified absent",
        confirmation: "NOT_PRESENTED_VERIFIED",
        resolutionDocumentId: receipt,
      })
      .expect(200);
    expect((await prepare(id2)).body.error.code).toBe(
      "SVB_PRESENTATION_DEFERRED",
    );
    expect(
      await prisma.declarationSubmission.count({
        where: { declarationBatchId: BigInt(id) },
      }),
    ).toBe(1);
  });
});
