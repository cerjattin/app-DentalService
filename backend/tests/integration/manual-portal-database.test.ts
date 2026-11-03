import pg from "pg";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createNegFuncDbFixture,
  insertDbRow,
} from "../helpers/neg-func-db-fixture.js";

const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
beforeAll(() => db.connect());
afterAll(() => db.end());
type Fixture = Awaited<ReturnType<typeof createNegFuncDbFixture>>;
const entry = (f: Fixture, batch: string, key: string = randomUUID()) =>
  insertDbRow(db, "declaration_manual_entries", {
    organization_id: f.organizationId,
    declaration_batch_id: batch,
    claim_key: key,
    content_hash: "a".repeat(64),
    content_snapshot: { schemaVersion: "synthetic-db-v1", lines: [] },
    prepared_by_user_id: f.userId,
  });
async function rejection(action: () => Promise<unknown>, codes: string[]) {
  await db.query("SAVEPOINT expected_rejection");
  let code: string | undefined;
  try {
    await action();
  } catch (error) {
    code = (error as { code: string }).code;
  }
  await db.query("ROLLBACK TO SAVEPOINT expected_rejection");
  await db.query("RELEASE SAVEPOINT expected_rejection");
  expect(codes).toContain(code);
}
async function inFixture(action: (f: Fixture) => Promise<void>) {
  await db.query("BEGIN");
  try {
    await action(await createNegFuncDbFixture(db));
  } finally {
    await db.query("ROLLBACK");
  }
}
describe("Manual portal database invariants independent of HTTP", () => {
  it("enforces one active preparation and binary organization idempotency keys", () =>
    inFixture(async (f) => {
      const one = await f.batch(),
        two = await f.batch(),
        three = await f.batch();
      const key = "Binary-Key-ABC-0001";
      await entry(f, one, key);
      await entry(f, two, key.toLowerCase());
      await rejection(() => entry(f, three, key), ["23505"]);
      await rejection(() => entry(f, one, randomUUID()), ["23505"]);
      const r =
        await db.query(`SELECT a.attcollation::regcollation::text AS collation FROM pg_attribute a
      WHERE a.attrelid='declaration_manual_entries'::regclass AND a.attname='claim_key'`);
      expect(r.rows[0].collation).toBe('"C"');
    }));
  it("rejects missing reasons, foreign organizations and mutation of frozen content", () =>
    inFixture(async (f) => {
      const id = await entry(f, await f.batch());
      await rejection(
        () =>
          db.query(
            "UPDATE declaration_manual_entries SET state='UNCERTAIN',uncertainty_reason=NULL WHERE id=$1",
            [id],
          ),
        ["23514"],
      );
      await rejection(
        () =>
          db.query(
            "UPDATE declaration_manual_entries SET state='RELEASED',released_at=now(),release_reason=NULL WHERE id=$1",
            [id],
          ),
        ["23514"],
      );
      await rejection(
        () =>
          db.query(
            "UPDATE declaration_manual_entries SET content_snapshot='{}'::jsonb WHERE id=$1",
            [id],
          ),
        ["P0001"],
      );
      const foreign = await insertDbRow(db, "organizations", {
        legal_name: "Synthetic foreign context",
      });
      const foreignBatch = await f.batch();
      await rejection(
        () =>
          insertDbRow(db, "declaration_manual_entries", {
            organization_id: foreign,
            declaration_batch_id: foreignBatch,
            claim_key: randomUUID(),
            content_hash: "a".repeat(64),
            content_snapshot: {},
            prepared_by_user_id: f.userId,
          }),
        ["P0001"],
      );
      await db.query(
        "UPDATE declaration_manual_entries SET state='RELEASED',released_at=now(),release_reason='Synthetic verification only' WHERE id=$1",
        [id],
      );
      await rejection(
        () =>
          db.query(
            "UPDATE declaration_manual_entries SET release_reason='Changed history' WHERE id=$1",
            [id],
          ),
        ["P0001"],
      );
    }));
  it("allocates attempts transactionally and preserves schema protections", () =>
    inFixture(async (f) => {
      const batch = await f.batch();
      await db.query("SAVEPOINT failed_operation");
      expect(
        (
          await db.query(
            "UPDATE declaration_batches SET last_submission_attempt=last_submission_attempt+1 WHERE id=$1 RETURNING last_submission_attempt",
            [batch],
          )
        ).rows[0].last_submission_attempt,
      ).toBe(1);
      await db.query("ROLLBACK TO SAVEPOINT failed_operation");
      expect(
        (
          await db.query(
            "SELECT last_submission_attempt FROM declaration_batches WHERE id=$1",
            [batch],
          )
        ).rows[0].last_submission_attempt,
      ).toBe(0);
      await rejection(
        () =>
          db.query(
            "UPDATE declaration_batches SET last_submission_attempt=-1 WHERE id=$1",
            [batch],
          ),
        ["23514"],
      );
      const rls = await db.query(
        "SELECT relrowsecurity FROM pg_class WHERE oid IN ('declaration_manual_entries'::regclass,'declaration_manual_results'::regclass)",
      );
      expect(rls.rows).toHaveLength(2);
      expect(rls.rows.every((r) => r.relrowsecurity)).toBe(true);
    }));
  it("preserves recorded submission/response evidence and rejects malformed hashes", () =>
    inFixture(async (f) => {
      const batch = await f.batch(),
        id = await entry(f, batch);
      const receipt = await insertDbRow(db, "documents", {
        organization_id: f.organizationId,
        document_type: "OTHER",
        storage_provider: "LOCAL",
        storage_uri: `local://documents/synthetic-${randomUUID()}.bin`,
        original_filename: "Synthetic evidence",
        mime_type: "application/octet-stream",
        size_bytes: "1",
        sha256: "c".repeat(64),
        created_by_user_id: f.userId,
      });
      const submission = await insertDbRow(db, "declaration_submissions", {
        declaration_batch_id: batch,
        attempt_number: 1,
        channel: "MANUAL",
        status: "SUBMITTED",
        submitted_by_user_id: f.userId,
      });
      await db.query(
        "UPDATE declaration_batches SET last_submission_attempt=1 WHERE id=$1",
        [batch],
      );
      await rejection(
        () =>
          db.query(
            `UPDATE declaration_manual_entries SET state='RECORDED',submission_id=$1,receipt_document_id=$2,
      receipt_sha256=$3,record_key=$4,record_hash='invalid',external_submitted_at=now(),confirmed_at=now() WHERE id=$5`,
            [submission, receipt, "c".repeat(64), randomUUID(), id],
          ),
        ["23514"],
      );
      await db.query(
        `UPDATE declaration_manual_entries SET state='RECORDED',submission_id=$1,receipt_document_id=$2,
      receipt_sha256=$3,record_key=$4,record_hash=$5,external_submitted_at=now(),confirmed_at=now() WHERE id=$6`,
        [submission, receipt, "c".repeat(64), randomUUID(), "b".repeat(64), id],
      );
      const result = await insertDbRow(db, "declaration_manual_results", {
        manual_entry_id: id,
        organization_id: f.organizationId,
        idempotency_key: randomUUID(),
        request_hash: "d".repeat(64),
        status: "ACCEPTED",
        result_document_id: receipt,
        result_sha256: "c".repeat(64),
        external_reference: "SYNTHETIC",
        external_responded_at: new Date(),
        recorded_by_user_id: f.userId,
        line_results: JSON.stringify([{ synthetic: true, status: "ACCEPTED" }]),
      });
      await rejection(
        () =>
          db.query("DELETE FROM declaration_manual_results WHERE id=$1", [
            result,
          ]),
        ["P0001"],
      );
      await rejection(
        () =>
          db.query("DELETE FROM declaration_manual_entries WHERE id=$1", [id]),
        ["P0001", "23503"],
      );
      await rejection(
        () => db.query("DELETE FROM documents WHERE id=$1", [receipt]),
        ["23503"],
      );
    }));
});
