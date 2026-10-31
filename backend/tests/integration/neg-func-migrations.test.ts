import pg from "pg";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createNegFuncDbFixture,
  insertDbRow,
} from "../helpers/neg-func-db-fixture.js";
import { diagnoseNegFuncDatabase } from "../../src/infrastructure/database/neg-func-diagnostics.js";

// Migration regression is opt-in: this second database must be empty and must
// never be the database used by the other integration files in the same run.
const legacyUrl = process.env.NEG_FUNC_LEGACY_TEST_URL;
const db = new pg.Client({
  connectionString: legacyUrl,
  connectionTimeoutMillis: 5_000,
});
const sql = (name: string) =>
  readFileSync(
    new URL(
      `../../prisma/postgresql/migrations/${name}/migration.sql`,
      import.meta.url,
    ),
    "utf8",
  );
let fixture: Awaited<ReturnType<typeof createNegFuncDbFixture>>;
async function apply(name: string) {
  try {
    await db.query(sql(name));
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }
}

describe.skipIf(!legacyUrl)(
  "DB migration preflight and legacy evidence on a separate empty PostgreSQL",
  () => {
    beforeAll(async () => {
      let target: URL;
      try {
        target = new URL(legacyUrl!);
      } catch {
        throw new Error("Invalid NEG_FUNC_LEGACY_TEST_URL");
      }
      if (
        !["postgres:", "postgresql:"].includes(target.protocol) ||
        !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
        !/^\/[a-z0-9_]+_test$/.test(target.pathname) ||
        target.pathname === new URL(process.env.TEST_DATABASE_URL!).pathname
      ) {
        throw new Error(
          "Legacy migration tests need a different dedicated local _test database",
        );
      }
      await db.connect();
      const count = (
        await db.query(
          "SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public'",
        )
      ).rows[0].count;
      if (count !== 0)
        throw new Error(
          "Legacy migration database must be empty; no reset or cleanup is performed automatically",
        );
      await apply("20261030000000_init");
      fixture = await createNegFuncDbFixture(db);
    });
    afterAll(async () => {
      try {
        if (fixture) await fixture.cleanup();
      } finally {
        await db.end();
      }
    });

    it("blocks conflicting legacy data, preserves removed ordinals and verifies incremental reconciliation guards", async () => {
      const bill = await fixture.invoice();
      const a = await fixture.batch("00123"),
        b = await fixture.batch("00123");
      const first = await fixture.historyItem(a, bill.itemId, 1);
      const duplicate = await fixture.historyItem(b, bill.itemId, 1);
      const before = (
        await db.query(
          "SELECT id::text, to_jsonb(di) AS snapshot FROM declaration_items di ORDER BY id",
        )
      ).rows;
      const report = await diagnoseNegFuncDatabase(db);
      expect(report.migrationBlocked).toBe(true);
      expect(
        report.issues.find(
          (issue) => issue.code === "DECLARATION_ACTIVE_DUPLICATE",
        )?.count,
      ).toBe(1);
      expect(JSON.stringify(report)).not.toContain("00123");
      expect(report.issues.every((issue) => issue.ids === undefined)).toBe(
        true,
      );
      await expect(
        apply("20261031000000_declaration_assignment"),
      ).rejects.toThrow(/duplicate active assignments/);
      expect(
        (
          await db.query(
            "SELECT id::text, to_jsonb(di) AS snapshot FROM declaration_items di ORDER BY id",
          )
        ).rows,
      ).toEqual(before);
      expect(
        (
          await db.query(
            "SELECT to_regclass('public.declaration_active_assignments') AS relation",
          )
        ).rows[0].relation,
      ).toBeNull();

      // Explicit fixture setup for the next scenario, never an automatic repair.
      await db.query(
        "UPDATE declaration_batches SET status='CANCELLED' WHERE id=$1",
        [b],
      );
      const invalidRemoval = await insertDbRow(db, "audit_logs", {
        organization_id: fixture.organizationId,
        actor_user_id: fixture.userId,
        action: "DECLARATION_ITEM_REMOVE",
        entity_type: "DECLARATION_ITEM",
        old_values: { declarationBatchId: a },
      });
      expect(
        (await diagnoseNegFuncDatabase(db)).issues.find(
          (issue) => issue.code === "ORDINAL_AUDIT_INVALID",
        )?.count,
      ).toBe(1);
      await expect(
        apply("20261031000000_declaration_assignment"),
      ).rejects.toThrow(/ordinal history is incomplete/);
      expect(
        (
          await db.query(
            "SELECT 1 FROM information_schema.columns WHERE table_name='declaration_batches' AND column_name='last_item_sequence'",
          )
        ).rowCount,
      ).toBe(0);
      await db.query("DELETE FROM audit_logs WHERE id=$1", [invalidRemoval]);

      const batchNumber = (
        await db.query(
          "SELECT declaration_number FROM declaration_batches WHERE id=$1",
          [a],
        )
      ).rows[0].declaration_number;
      // The largest retired ordinal survives only in a historical ADD event,
      // without batch ID or retained item. Resolve the original scoped entity key.
      await insertDbRow(db, "audit_logs", {
        organization_id: fixture.organizationId,
        actor_user_id: fixture.userId,
        action: "DECLARATION_ITEM_ADD",
        entity_type: "DECLARATION_ITEM",
        entity_id: "9007199254740993",
        entity_key: `${batchNumber}:20`,
        new_values: { sequenceNumber: 20 },
      });
      await insertDbRow(db, "audit_logs", {
        organization_id: fixture.organizationId,
        actor_user_id: fixture.userId,
        action: "DECLARATION_ITEM_REMOVE",
        entity_type: "DECLARATION_ITEM",
        entity_id: "9007199254740994",
        old_values: { declarationBatchId: a, sequenceNumber: 11 },
      });
      const recoverable = await diagnoseNegFuncDatabase(db, true);
      expect(recoverable.migrationBlocked).toBe(false);
      expect(
        recoverable.issues.find(
          (issue) => issue.code === "ORDINAL_AUDIT_BATCH_MISSING",
        )?.count,
      ).toBe(0);
      await apply("20261031000000_declaration_assignment");

      const treatmentId = await insertDbRow(db, "treatment_cases", {
        organization_id: fixture.organizationId,
        patient_id: fixture.patientId,
        created_by_user_id: fixture.userId,
        treatment_id: "0000123",
      });
      const historicalUse = new Date("2026-09-01T13:00:00Z");
      await insertDbRow(db, "audit_logs", {
        organization_id: fixture.organizationId,
        actor_user_id: fixture.userId,
        action: "APPOINTMENT_UPDATE",
        entity_type: "APPOINTMENT",
        created_at: historicalUse,
        new_values: { treatmentCaseId: treatmentId },
      });
      const invalidUsage = await insertDbRow(db, "audit_logs", {
        organization_id: fixture.organizationId,
        actor_user_id: fixture.userId,
        action: "APPOINTMENT_UPDATE",
        entity_type: "APPOINTMENT",
        new_values: { treatmentCaseId: "protected-malformed-value" },
      });
      const invalidUsageReport = await diagnoseNegFuncDatabase(db);
      expect(invalidUsageReport.migrationBlocked).toBe(true);
      expect(
        invalidUsageReport.issues.find(
          (issue) => issue.code === "TREATMENT_USAGE_AUDIT_INVALID",
        )?.count,
      ).toBe(1);
      expect(JSON.stringify(invalidUsageReport)).not.toContain(
        "protected-malformed-value",
      );
      await db.query("DELETE FROM audit_logs WHERE id=$1", [invalidUsage]);
      await apply("20261031010000_treatment_case_usage");
      const used = (
        await db.query(
          "SELECT treatment_id, first_assigned_at FROM treatment_cases WHERE id=$1",
          [treatmentId],
        )
      ).rows[0];
      expect(used.treatment_id).toBe("0000123");
      expect(used.first_assigned_at.toISOString()).toBe(
        historicalUse.toISOString(),
      );

      const invalidAdd = await insertDbRow(db, "audit_logs", {
        organization_id: fixture.organizationId,
        actor_user_id: fixture.userId,
        action: "DECLARATION_ITEM_ADD",
        entity_type: "DECLARATION_ITEM",
        new_values: { declarationBatchId: a, sequenceNumber: "2147483648" },
      });
      const beforeFailure = (
        await db.query(
          "SELECT last_item_sequence FROM declaration_batches WHERE id=$1",
          [a],
        )
      ).rows[0].last_item_sequence;
      expect((await diagnoseNegFuncDatabase(db)).migrationBlocked).toBe(true);
      await expect(
        apply("20261031020000_declaration_integrity"),
      ).rejects.toThrow(/integer range/);
      expect(
        (
          await db.query(
            "SELECT last_item_sequence FROM declaration_batches WHERE id=$1",
            [a],
          )
        ).rows[0].last_item_sequence,
      ).toBe(beforeFailure);
      await db.query("DELETE FROM audit_logs WHERE id=$1", [invalidAdd]);
      await apply("20261031020000_declaration_integrity");
      expect(
        (
          await db.query(
            "SELECT last_item_sequence FROM declaration_batches WHERE id=$1",
            [a],
          )
        ).rows[0].last_item_sequence,
      ).toBe(20);

      const contradicting = await insertDbRow(db, "audit_logs", {
        organization_id: fixture.organizationId,
        actor_user_id: fixture.userId,
        action: "DECLARATION_ITEM_ADD",
        entity_type: "DECLARATION_ITEM",
        entity_key: `${batchNumber}:2`,
        new_values: { declarationBatchId: b, sequenceNumber: 2 },
      });
      const conflict = await diagnoseNegFuncDatabase(db);
      expect(conflict.migrationBlocked).toBe(true);
      expect(
        conflict.issues.find((issue) => issue.code === "ORDINAL_AUDIT_CONFLICT")
          ?.count,
      ).toBe(1);
      const counters = (
        await db.query(
          "SELECT id::text, last_item_sequence FROM declaration_batches ORDER BY id",
        )
      ).rows;
      await expect(
        apply("20261031030000_declaration_evidence_checks"),
      ).rejects.toThrow(/conflicting audit batch/);
      expect(
        (
          await db.query(
            "SELECT id::text, last_item_sequence FROM declaration_batches ORDER BY id",
          )
        ).rows,
      ).toEqual(counters);
      await db.query("DELETE FROM audit_logs WHERE id=$1", [contradicting]);
      await apply("20261031030000_declaration_evidence_checks");

      expect(
        (
          await db.query(
            "SELECT declaration_item_id::text FROM declaration_active_assignments WHERE invoice_item_id=$1",
            [bill.itemId],
          )
        ).rows,
      ).toEqual([{ declaration_item_id: first }]);
      expect(
        (
          await db.query("SELECT id FROM declaration_items WHERE id=$1", [
            duplicate,
          ])
        ).rowCount,
      ).toBe(1);
      await expect(
        db.query(
          "UPDATE declaration_active_assignments SET declaration_batch_id=$1 WHERE invoice_item_id=$2",
          [b, bill.itemId],
        ),
      ).rejects.toThrow();
      const connection = new pg.Client({ connectionString: legacyUrl });
      await connection.connect();
      try {
        await connection.query("BEGIN");
        expect(
          (
            await connection.query(
              "UPDATE declaration_batches SET last_item_sequence=last_item_sequence+1 WHERE id=$1 RETURNING last_item_sequence",
              [a],
            )
          ).rows[0].last_item_sequence,
        ).toBe(21);
        await connection.query("ROLLBACK");
      } finally {
        await connection.end();
      }
      expect(
        (
          await db.query(
            "SELECT last_item_sequence FROM declaration_batches WHERE id=$1",
            [a],
          )
        ).rows[0].last_item_sequence,
      ).toBe(20);
      expect(
        (
          await db.query(
            "UPDATE declaration_batches SET last_item_sequence=last_item_sequence+1 WHERE id=$1 RETURNING last_item_sequence",
            [a],
          )
        ).rows[0].last_item_sequence,
      ).toBe(21);
      const finalReport = await diagnoseNegFuncDatabase(db);
      expect(finalReport.migrationBlocked).toBe(false);
      expect(finalReport.issues.every((issue) => issue.count === 0)).toBe(true);
      expect(
        (
          await db.query(
            "SELECT declarant_id_snapshot, content_hash FROM invoice_versions WHERE id=$1",
            [bill.versionId],
          )
        ).rows[0],
      ).toEqual({
        declarant_id_snapshot: "00123",
        content_hash: "a".repeat(64),
      });
    }, 20_000);
  },
);
