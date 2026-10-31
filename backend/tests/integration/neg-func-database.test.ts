import pg from "pg";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  createNegFuncDbFixture,
  insertDbRow,
} from "../helpers/neg-func-db-fixture.js";
import { prisma } from "../../src/infrastructure/database/prisma.js";
import { diagnoseNegFuncDatabase } from "../../src/infrastructure/database/neg-func-diagnostics.js";
import { organizationService } from "../../src/modules/organization/organization.service.js";
import { declarationService } from "../../src/modules/declarations/declaration.service.js";
import { changeDraftDeclaration } from "../../src/modules/declarations/declaration-draft.service.js";
import { treatmentCaseService } from "../../src/modules/treatment-cases/treatment-case.service.js";
import { appointmentService } from "../../src/modules/appointments/appointment.service.js";
import { auditService } from "../../src/modules/audit/audit.service.js";
import { reopenInvoiceEncounter } from "../../src/modules/invoices/invoice-clinical-reopen.service.js";

// setup-env.ts refuses remote/operational connections before this client is used.
const db = new pg.Client({
  connectionString: process.env.TEST_DATABASE_URL,
  connectionTimeoutMillis: 5_000,
});
let fixture: Awaited<ReturnType<typeof createNegFuncDbFixture>>;
const metadata = { correlationId: randomUUID() };
const extraOrganizations: string[] = [];
beforeAll(async () => {
  await db.connect();
  fixture = await createNegFuncDbFixture(db);
});
afterAll(async () => {
  try {
    if (fixture) await fixture.cleanup();
    for (const id of extraOrganizations)
      await db.query("DELETE FROM organizations WHERE id=$1", [id]);
  } finally {
    await prisma.$disconnect();
    await db.end();
  }
});
const add = (batch: string, item: string) =>
  declarationService.addItem(
    BigInt(batch),
    { invoiceItemId: item },
    fixture.actor,
    metadata,
  );

describe("DB03 configuration and frozen identity on real PostgreSQL", () => {
  it("serializes stale revisions, preserves leading zeroes and rolls back audit failure", async () => {
    const before = await organizationService.get(fixture.actor);
    const changes = await Promise.allSettled([
      organizationService.update(
        {
          expectedRevision: before.revision,
          reason: "Synthetic concurrent QA",
          declarantId: "00123",
        },
        fixture.actor,
        metadata,
      ),
      organizationService.update(
        {
          expectedRevision: before.revision,
          reason: "Synthetic concurrent QA",
          declarantId: "00456",
        },
        fixture.actor,
        metadata,
      ),
    ]);
    expect(
      changes.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const failure = changes.find((result) => result.status === "rejected");
    expect(failure?.status === "rejected" && failure.reason).toMatchObject({
      code: "ORGANIZATION_VERSION_CONFLICT",
    });
    const current = await organizationService.get(fixture.actor);
    expect(["00123", "00456"]).toContain(current.declarantId);
    const duplicateOrg = await insertDbRow(db, "organizations", {
      legal_name: `TEST-DB-DUP-${randomUUID()}`,
    });
    extraOrganizations.push(duplicateOrg);
    await expect(
      db.query("UPDATE organizations SET declarant_id = $1 WHERE id = $2", [
        current.declarantId,
        duplicateOrg,
      ]),
    ).rejects.toMatchObject({ code: "23505" });
    const spy = vi
      .spyOn(auditService, "writeWithinTransaction")
      .mockRejectedValueOnce(new Error("Synthetic audit failure"));
    try {
      await expect(
        organizationService.update(
          {
            expectedRevision: current.revision,
            reason: "Synthetic rollback QA",
            declarantId: null,
          },
          fixture.actor,
          metadata,
        ),
      ).rejects.toThrow("Synthetic audit failure");
    } finally {
      spy.mockRestore();
    }
    expect(await organizationService.get(fixture.actor)).toEqual(current);
  });

  it("allows only one concurrent first identity and retains it after removing the last item", async () => {
    const batch = await fixture.batch();
    const invoices = await Promise.all([
      fixture.invoice("00123"),
      fixture.invoice("00456"),
    ]);
    const before = (
      await db.query(
        "SELECT id::text, declarant_id_snapshot, content_hash FROM invoice_versions WHERE id = ANY($1::bigint[]) ORDER BY id",
        [invoices.map((row) => row.versionId)],
      )
    ).rows;
    const results = await Promise.allSettled(
      invoices.map((row) => add(batch, row.itemId)),
    );
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected?.status === "rejected" && rejected.reason).toMatchObject({
      code: "DECLARATION_DECLARANT_MISMATCH",
    });
    const winning = results.find((result) => result.status === "fulfilled");
    if (winning?.status !== "fulfilled")
      throw new Error("Missing successful first link");
    const identity = winning.value.declarantIdSnapshot;
    await changeDraftDeclaration(
      BigInt(batch),
      BigInt(winning.value.id),
      "Synthetic QA remove",
      fixture.actor,
      metadata,
    );
    const empty = (
      await db.query(
        "SELECT declarant_id_snapshot, last_item_sequence FROM declaration_batches WHERE id = $1",
        [batch],
      )
    ).rows[0];
    expect(empty).toMatchObject({
      declarant_id_snapshot: identity,
      last_item_sequence: 1,
    });
    const other = invoices.find((row) => row.declarantId !== identity)!;
    await expect(add(batch, other.itemId)).rejects.toMatchObject({
      code: "DECLARATION_DECLARANT_MISMATCH",
    });
    expect(
      (
        await db.query(
          "SELECT id::text, declarant_id_snapshot, content_hash FROM invoice_versions WHERE id = ANY($1::bigint[]) ORDER BY id",
          [invoices.map((row) => row.versionId)],
        )
      ).rows,
    ).toEqual(before);
  });
});

describe("DB04 active ownership, history and ordinal rollback", () => {
  it("keeps Clinical blocked by the remaining batch of a multi-item invoice", async () => {
    const bill = await fixture.invoice("00123", true);
    const a = await fixture.batch(),
      b = await fixture.batch();
    await add(a, bill.itemIds[0]!);
    await add(b, bill.itemIds[1]!);
    const reopen = () =>
      reopenInvoiceEncounter(
        BigInt(bill.invoiceId),
        {
          expectedVersionId: bill.versionId,
          reason: "Synthetic clinical correction",
        },
        fixture.actor,
        metadata,
      );
    await expect(reopen()).rejects.toMatchObject({
      code: "INVOICE_DECLARATION_ASSIGNED",
      details: {
        assignments: expect.arrayContaining([
          {
            declarationId: a,
            declarationNumber: expect.any(String),
            items: expect.any(Array),
            status: "DRAFT",
          },
          {
            declarationId: b,
            declarationNumber: expect.any(String),
            items: expect.any(Array),
            status: "DRAFT",
          },
        ]),
      },
    });
    await changeDraftDeclaration(
      BigInt(a),
      null,
      "Synthetic first release",
      fixture.actor,
      metadata,
    );
    await expect(reopen()).rejects.toMatchObject({
      code: "INVOICE_DECLARATION_ASSIGNED",
      details: {
        assignments: [
          {
            declarationId: b,
            declarationNumber: expect.any(String),
            items: expect.any(Array),
            status: "DRAFT",
          },
        ],
      },
    });
    await changeDraftDeclaration(
      BigInt(b),
      null,
      "Synthetic final release",
      fixture.actor,
      metadata,
    );
    const reopened = await reopen();
    expect(reopened.id).toBe(bill.invoiceId);
    expect(reopened.status).toBe("CORRECTION_REQUIRED");
    expect(reopened.currentVersion?.contentHash).toBeNull();
    expect(reopened.currentVersion?.id).not.toBe(bill.versionId);
    expect(
      (
        await db.query(
          "SELECT content_hash, declarant_id_snapshot, total_amount::text FROM invoice_versions WHERE id=$1",
          [bill.versionId],
        )
      ).rows[0],
    ).toEqual({
      content_hash: "a".repeat(64),
      declarant_id_snapshot: "00123",
      total_amount: "24.60",
    });
  });

  it("commits only one owner across competing batches; cancellation preserves history and releases availability", async () => {
    const invoice = await fixture.invoice();
    const batches = await Promise.all([fixture.batch(), fixture.batch()]);
    const results = await Promise.allSettled(
      batches.map((batch) => add(batch, invoice.itemId)),
    );
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected?.status === "rejected" && rejected.reason).toMatchObject({
      code: "DECLARATION_ITEM_ASSIGNED",
    });
    const owner = (
      await db.query(
        "SELECT declaration_item_id::text, declaration_batch_id::text FROM declaration_active_assignments WHERE invoice_item_id=$1",
        [invoice.itemId],
      )
    ).rows[0]!;
    await changeDraftDeclaration(
      BigInt(owner.declaration_batch_id),
      null,
      "Synthetic QA cancel",
      fixture.actor,
      metadata,
    );
    expect(
      (
        await db.query("SELECT id FROM declaration_items WHERE id=$1", [
          owner.declaration_item_id,
        ])
      ).rowCount,
    ).toBe(1);
    expect(
      (
        await db.query(
          "SELECT 1 FROM declaration_active_assignments WHERE invoice_item_id=$1",
          [invoice.itemId],
        )
      ).rowCount,
    ).toBe(0);
    const otherBatch = batches.find(
      (batch) => batch !== owner.declaration_batch_id,
    )!;
    await add(otherBatch, invoice.itemId);
    expect(
      (
        await db.query(
          "SELECT count(*)::int AS count FROM declaration_items WHERE invoice_item_id=$1",
          [invoice.itemId],
        )
      ).rows[0]?.count,
    ).toBe(2);
    await expect(
      db.query(
        "UPDATE declaration_active_assignments SET declaration_batch_id=$1 WHERE invoice_item_id=$2",
        [owner.declaration_batch_id, invoice.itemId],
      ),
    ).rejects.toThrow();
    expect(
      (
        await db.query(
          "SELECT declarant_id_snapshot, content_hash FROM invoice_versions WHERE id=$1",
          [invoice.versionId],
        )
      ).rows[0],
    ).toMatchObject({
      declarant_id_snapshot: "00123",
      content_hash: "a".repeat(64),
    });
  });

  it("never reuses a retired last ordinal and does not consume an ordinal or ownership on audit rollback", async () => {
    const batch = await fixture.batch();
    const a = await fixture.invoice(),
      b = await fixture.invoice();
    const first = await add(batch, a.itemId);
    expect(first.sequenceNumber).toBe(1);
    await changeDraftDeclaration(
      BigInt(batch),
      BigInt(first.id),
      "Synthetic last-line retirement",
      fixture.actor,
      metadata,
    );
    const second = await add(batch, a.itemId);
    expect(second.sequenceNumber).toBe(2);
    const spy = vi
      .spyOn(auditService, "writeWithinTransaction")
      .mockRejectedValueOnce(new Error("Synthetic audit failure"));
    try {
      await expect(add(batch, b.itemId)).rejects.toThrow(
        "Synthetic audit failure",
      );
    } finally {
      spy.mockRestore();
    }
    expect(
      (
        await db.query(
          "SELECT last_item_sequence FROM declaration_batches WHERE id=$1",
          [batch],
        )
      ).rows[0]?.last_item_sequence,
    ).toBe(2);
    expect(
      (
        await db.query(
          "SELECT 1 FROM declaration_active_assignments WHERE invoice_item_id=$1",
          [b.itemId],
        )
      ).rowCount,
    ).toBe(0);
    expect((await add(batch, b.itemId)).sequenceNumber).toBe(3);
  });

  it("reports a legacy client override without disclosing snapshots or modifying the database", async () => {
    const invoice = await fixture.invoice();
    const batch = await fixture.batch("00456");
    const item = await fixture.historyItem(batch, invoice.itemId, 1, "00456");
    const before = (
      await db.query(
        "SELECT to_jsonb(di) AS snapshot FROM declaration_items di WHERE id=$1",
        [item],
      )
    ).rows[0];
    const report = await diagnoseNegFuncDatabase(db);
    expect(report.readOnly).toBe(true);
    expect(
      report.issues.find(
        (issue) => issue.code === "DECLARATION_DRAFT_IDENTITY_CONFLICT",
      )?.count,
    ).toBeGreaterThan(0);
    expect(JSON.stringify(report)).not.toContain("00123");
    expect(report.issues.every((issue) => issue.ids === undefined)).toBe(true);
    await expect(
      add(batch, (await fixture.invoice("00456")).itemId),
    ).rejects.toMatchObject({ code: "DECLARATION_LEGACY_DATA_CONFLICT" });
    expect(
      (
        await db.query(
          "SELECT to_jsonb(di) AS snapshot FROM declaration_items di WHERE id=$1",
          [item],
        )
      ).rows[0],
    ).toEqual(before);
    await changeDraftDeclaration(
      BigInt(batch),
      null,
      "Synthetic fixture cancellation",
      fixture.actor,
      metadata,
    );
  });
});

describe("DB05 persisted permissions and first-use locking", () => {
  it("persists the exact permission matrix and leaves Admin with all configured permissions", async () => {
    const rows = (
      await db.query(`SELECT r.code AS role, p.code AS permission FROM roles r
      JOIN role_permissions rp ON rp.role_id=r.id JOIN permissions p ON p.id=rp.permission_id
      WHERE p.code IN ('treatment_case.read','treatment_case.manage') ORDER BY r.code, p.code`)
    ).rows;
    expect(rows).toEqual([
      { role: "ADMIN", permission: "treatment_case.manage" },
      { role: "ADMIN", permission: "treatment_case.read" },
      { role: "PROVIDER", permission: "treatment_case.manage" },
      { role: "PROVIDER", permission: "treatment_case.read" },
      { role: "RECEPTION", permission: "treatment_case.read" },
    ]);
    const counts = (
      await db.query(`SELECT (SELECT count(*)::int FROM permissions) AS permissions,
      (SELECT count(*)::int FROM role_permissions rp JOIN roles r ON r.id=rp.role_id WHERE r.code='ADMIN') AS admin`)
    ).rows[0];
    expect(counts.admin).toBe(counts.permissions);
  });

  it("serializes editing against the first link and preserves use after unlinking", async () => {
    const created = await treatmentCaseService.create(
      BigInt(fixture.patientId),
      { treatmentId: "0000123" },
      fixture.actor,
      metadata,
    );
    expect(created.treatmentId).toBe("0000123");
    await expect(
      treatmentCaseService.create(
        BigInt(fixture.patientId),
        { treatmentId: "0000123" },
        fixture.actor,
        metadata,
      ),
    ).rejects.toMatchObject({ code: "TREATMENT_ID_ALREADY_EXISTS" });
    const gate = new pg.Client({
      connectionString: process.env.TEST_DATABASE_URL,
    });
    await gate.connect();
    await gate.query("BEGIN");
    await gate.query("SELECT id FROM treatment_cases WHERE id=$1 FOR UPDATE", [
      created.id,
    ]);
    const edit = treatmentCaseService.update(
      BigInt(fixture.patientId),
      BigInt(created.id),
      { treatmentId: "0000124" },
      fixture.actor,
      metadata,
    );
    const link = appointmentService.create(
      {
        patientId: fixture.patientId,
        providerId: fixture.providerId,
        clinicLocationId: fixture.clinicLocationId,
        treatmentCaseId: created.id,
        scheduledStart: "2028-01-01T13:00:00Z",
        scheduledEnd: "2028-01-01T13:30:00Z",
      },
      fixture.actor,
      metadata,
    );
    const settled = Promise.allSettled([edit, link]);
    try {
      const deadline = performance.now() + 3_000;
      let waiting = 0;
      while (performance.now() < deadline && waiting < 2) {
        await gate.query("SELECT pg_stat_clear_snapshot()");
        waiting = (
          await gate.query(
            "SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'",
          )
        ).rows[0].count;
        if (waiting < 2) await delay(15);
      }
      expect(waiting).toBeGreaterThanOrEqual(2);
    } finally {
      await gate.query("COMMIT");
      await gate.end();
    }
    const outcomes = await settled;
    const editResult = outcomes[0]!,
      linkResult = outcomes[1]!;
    expect(
      editResult.status === "fulfilled" ||
        (editResult.status === "rejected" &&
          editResult.reason.code === "TREATMENT_CASE_NOT_EDITABLE"),
    ).toBe(true);
    // A safe serializable conflict may require the explicit caller retry.
    if (linkResult.status === "rejected")
      expect(linkResult.reason).toMatchObject({
        code: "APPOINTMENT_PROVIDER_OVERLAP",
      });
    const appointment =
      linkResult.status === "fulfilled"
        ? linkResult.value
        : await appointmentService.create(
            {
              patientId: fixture.patientId,
              providerId: fixture.providerId,
              clinicLocationId: fixture.clinicLocationId,
              treatmentCaseId: created.id,
              scheduledStart: "2028-01-01T13:00:00Z",
              scheduledEnd: "2028-01-01T13:30:00Z",
            },
            fixture.actor,
            metadata,
          );
    await expect(
      treatmentCaseService.update(
        BigInt(fixture.patientId),
        BigInt(created.id),
        { description: "after use" },
        fixture.actor,
        metadata,
      ),
    ).rejects.toMatchObject({ code: "TREATMENT_CASE_NOT_EDITABLE" });
    await appointmentService.update(
      BigInt(appointment.id),
      { treatmentCaseId: null },
      fixture.actor,
      metadata,
    );
    const firstUse = (
      await db.query(
        "SELECT first_assigned_at FROM treatment_cases WHERE id=$1",
        [created.id],
      )
    ).rows[0].first_assigned_at;
    expect(firstUse).not.toBeNull();
    await expect(
      treatmentCaseService.update(
        BigInt(fixture.patientId),
        BigInt(created.id),
        { description: "after unlink" },
        fixture.actor,
        metadata,
      ),
    ).rejects.toMatchObject({ code: "TREATMENT_CASE_NOT_EDITABLE" });
  }, 15_000);

  it("preserves baseline manual CHECK, collations, hash comparison and RLS", async () => {
    const counts = (
      await db.query(`SELECT
      (SELECT count(*)::int FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace
        WHERE n.nspname='public' AND c.contype='c') AS checks,
      (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relkind='r' AND c.relname <> '_prisma_migrations' AND NOT c.relrowsecurity) AS exposed`)
    ).rows[0];
    expect(counts.checks).toBeGreaterThanOrEqual(186);
    expect(counts.exposed).toBe(0);
    const collations = (
      await db.query(`SELECT a.attname, c.collname FROM pg_attribute a
      JOIN pg_collation c ON c.oid=a.attcollation WHERE a.attrelid IN ('organizations'::regclass,'invoice_versions'::regclass)
      AND a.attname IN ('declarant_id','content_hash') ORDER BY a.attname`)
    ).rows;
    expect(collations).toEqual([
      { attname: "content_hash", collname: "C" },
      { attname: "declarant_id", collname: "odontho_ai_ci" },
    ]);
  });
});
