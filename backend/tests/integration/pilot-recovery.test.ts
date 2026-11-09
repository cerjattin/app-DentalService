import pg from "pg";
import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inspectPilotDatabase } from "../../src/infrastructure/database/pilot-db-inventory.js";
import { runQaRecovery } from "../../src/infrastructure/database/qa-recovery.js";
import {
  createNegFuncDbFixture,
  insertDbRow,
} from "../helpers/neg-func-db-fixture.js";

const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
beforeAll(() => db.connect());
afterAll(() => db.end());
describe("Protected deployment inventory", () => {
  it("compares the dedicated QA migrations, permissions and baseline manual objects", async () => {
    const report = await inspectPilotDatabase(db);
    expect(report.blocked).toBe(false);
    expect(report.missingPermissionCodes).toEqual([]);
    expect(report.missingBaselineChecks).toEqual([]);
    expect(report.missingBaselineTriggers).toEqual([]);
    expect(report.tablesWithoutRls).toEqual([]);
    expect(JSON.stringify(report)).not.toContain("password");
  });
  it("detects a checksum mismatch and a pending migration without changing history", async () => {
    const report = await inspectPilotDatabase(db, [
      { name: "20261030000000_init", checksum: "0".repeat(64) },
      { name: "future_qa_only", checksum: "f".repeat(64) },
    ]);
    expect(report.migrations.map((m) => m.status)).toEqual([
      "CHECKSUM_MISMATCH",
      "PENDING",
    ]);
    expect(report.blocked).toBe(true);
  });
});

describe.skipIf(!process.env.RESTORE_TEST_DATABASE_URL)(
  "Joint synthetic database/document recovery on an empty isolated target",
  () => {
    it("restores all rows/sequences and document bytes, links, immutable snapshots and evidence", async () => {
      const f = await createNegFuncDbFixture(db);
      const run = path.resolve(
        process.env.QA_RECOVERY_TEST_ROOT ?? "storage/final07-09-db-qa",
        `recovery-${randomUUID()}`,
      );
      const documents = path.join(run, "source-documents");
      await mkdir(documents, { recursive: true });
      const ids: string[] = [];
      let exportId: string | undefined, submissionId: string | undefined;
      let manualEntryId: string | undefined;
      let disconnect: (() => Promise<void>) | undefined;
      try {
        const invoice = await f.invoice();
        const batchId = await f.batch("00123", "EXPORTED");
        const lineId = await f.historyItem(batchId, invoice.itemId, 1);
        for (const [type, role, body] of [
          ["SIGNATURE", "signature", "SYNTHETIC SIGNATURE BYTES"],
          ["INVOICE_PDF", "pdf", "%PDF-1.4 SYNTHETIC QA"],
          [
            "DECLARATION_EXPORT",
            "export",
            "SYNTHETIC TECHNICAL EXPORT - NOT AN SVB LAYOUT",
          ],
          ["OTHER", "receipt", "%PDF-1.4 SYNTHETIC PORTAL RECEIPT"],
        ] as const) {
          const bytes = Buffer.from(body),
            key = `${role}.bin`;
          await writeFile(path.join(documents, key), bytes);
          const id = await insertDbRow(db, "documents", {
            organization_id: f.organizationId,
            document_type: type,
            storage_provider: "LOCAL",
            storage_uri: `local://documents/${key}`,
            original_filename: `SYNTHETIC-${key}`,
            mime_type:
              role === "receipt"
                ? "application/pdf"
                : "application/octet-stream",
            size_bytes: bytes.length.toString(),
            sha256: createHash("sha256").update(bytes).digest("hex"),
            created_by_user_id: f.userId,
          });
          ids.push(id);
        }
        await insertDbRow(db, "signatures", {
          invoice_version_id: invoice.versionId,
          patient_id: f.patientId,
          signature_document_id: ids[0],
          signer_name: "Synthetic QA",
          capture_method: "OTHER",
          signed_content_hash: "a".repeat(64),
          signature_hash: createHash("sha256")
            .update("SYNTHETIC SIGNATURE BYTES")
            .digest("hex"),
          signed_at: "2026-11-03T10:00:00.000Z",
          captured_by_user_id: f.userId,
        });
        await insertDbRow(db, "invoice_documents", {
          invoice_version_id: invoice.versionId,
          document_id: ids[1],
          document_role: "INVOICE_PDF",
        });
        exportId = await insertDbRow(db, "declaration_exports", {
          declaration_batch_id: batchId,
          document_id: ids[2],
          format: "CSV",
          adapter_version: "synthetic-recovery-v1",
          record_count: 1,
          exported_by_user_id: f.userId,
        });
        process.env.DOCUMENT_STORAGE_PATH = documents;
        const { manualEntryService } =
          await import("../../src/modules/declarations/manual-entry.service.js");
        const { prisma } =
          await import("../../src/infrastructure/database/prisma.js");
        disconnect = () => prisma.$disconnect();
        const metadata = { correlationId: randomUUID() };
        const prepared = await manualEntryService.prepare(
          BigInt(batchId),
          { idempotencyKey: randomUUID() },
          f.actor,
          metadata,
        );
        manualEntryId = prepared.record.id;
        const submission = await manualEntryService.record(
          BigInt(batchId),
          {
            manualEntryId,
            expectedContentHash: prepared.record.contentHash,
            externalReference: "SYNTHETIC-PORTAL-ONLY",
            submittedAt: new Date().toISOString(),
            receiptDocumentId: ids[3]!,
            idempotencyKey: randomUUID(),
            confirmation: "ALREADY_ENTERED_IN_OFFICIAL_PORTAL",
          },
          f.actor,
          metadata,
        );
        submissionId = submission.record.id;
        await manualEntryService.result(
          BigInt(batchId),
          BigInt(submissionId),
          {
            status: "ACCEPTED",
            externalReference: "SYNTHETIC-RESULT-ONLY",
            respondedAt: new Date().toISOString(),
            resultDocumentId: ids[3]!,
            idempotencyKey: randomUUID(),
            lines: [{ declarationItemId: lineId, status: "ACCEPTED" }],
          },
          f.actor,
          metadata,
        );
        const report = await runQaRecovery({
          sourceUrl: process.env.TEST_DATABASE_URL!,
          restoreUrl: process.env.RESTORE_TEST_DATABASE_URL!,
          sourceDocuments: documents,
          output: path.join(run, "restored"),
          pgBin: process.env.PG_BIN ?? "C:/Program Files/PostgreSQL/17/bin",
          writersPaused: true,
        });
        expect(report.restored).toBe(true);
        expect(report.documentsVerified).toBe(4);
        expect(report.operationalReadinessApproved).toBe(false);
        expect(report.tableAndSequenceFingerprints.some(row => row.table === "$schema")).toBe(true);
        expect(report.stages.at(-1)?.phase).toBe("completed");
        const childEnv: NodeJS.ProcessEnv = {
          ...process.env,
          DATABASE_URL: process.env.RESTORE_TEST_DATABASE_URL!,
          DOCUMENT_STORAGE_PATH: path.join(run, "restored", "documents"),
          RESTORED_QA_DOCUMENT_IDS: JSON.stringify(ids),
          RESTORED_QA_ORGANIZATION_ID: f.organizationId,
          RESTORED_QA_USER_ID: f.userId,
        };
        delete childEnv.ODONTHO_ENV_FILE;
        const downloaded = await promisify(execFile)(
          process.execPath,
          ["--import", "tsx", "tests/helpers/verify-restored-documents.ts"],
          { env: childEnv, windowsHide: true, timeout: 15000 },
        );
        expect(JSON.parse(downloaded.stdout).verified).toBe(4);
        // Never reuse a nonempty destination for a destructive restore.
        await expect(
          runQaRecovery({
            sourceUrl: process.env.TEST_DATABASE_URL!,
            restoreUrl: process.env.RESTORE_TEST_DATABASE_URL!,
            sourceDocuments: documents,
            output: path.join(run, "refused"),
            pgBin: process.env.PG_BIN ?? "C:/Program Files/PostgreSQL/17/bin",
            writersPaused: true,
          }),
        ).rejects.toThrow("empty");
      } finally {
        if (disconnect) await disconnect();
        if (manualEntryId) {
          // Only this guarded synthetic _test database. No operational bypass exists.
          if (
            !/^\/[a-z0-9_]+_test$/.test(
              new URL(process.env.TEST_DATABASE_URL!).pathname,
            )
          )
            throw new Error("QA teardown guard");
          await db.query("BEGIN");
          try {
            await db.query(
              "ALTER TABLE declaration_manual_results DISABLE TRIGGER protect_manual_result_delete",
            );
            await db.query(
              "ALTER TABLE declaration_manual_entries DISABLE TRIGGER protect_manual_entry_delete",
            );
            await db.query(
              "DELETE FROM declaration_manual_results WHERE manual_entry_id=$1",
              [manualEntryId],
            );
            await db.query(
              "DELETE FROM declaration_manual_entries WHERE id=$1",
              [manualEntryId],
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
        }
        if (submissionId)
          await db.query("DELETE FROM declaration_submissions WHERE id=$1", [
            submissionId,
          ]);
        if (exportId)
          await db.query("DELETE FROM declaration_exports WHERE id=$1", [
            exportId,
          ]);
        await db.query(
          "DELETE FROM signatures WHERE signature_document_id=ANY($1::bigint[])",
          [ids],
        );
        await db.query(
          "DELETE FROM invoice_documents WHERE document_id=ANY($1::bigint[])",
          [ids],
        );
        if (ids.length)
          await db.query("DELETE FROM documents WHERE id=ANY($1::bigint[])", [
            ids,
          ]);
        await f.cleanup();
      }
    }, 120000);
  },
);
