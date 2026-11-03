import pg from "pg";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { Prisma } from "../../src/generated/prisma/client.js";
import { prisma } from "../../src/infrastructure/database/prisma.js";
import { manualEntryService } from "../../src/modules/declarations/manual-entry.service.js";
import {
  createNegFuncDbFixture,
  insertDbRow,
} from "../helpers/neg-func-db-fixture.js";

const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
beforeAll(() => db.connect());
afterAll(async () => {
  await prisma.$disconnect();
  await db.end();
});
const metadata = { correlationId: randomUUID() };
type F = Awaited<ReturnType<typeof createNegFuncDbFixture>>;
async function fullInvoice(f: F) {
  const bill = await f.invoice("00123", true);
  const { id: _item, ...item } = (
    await db.query("SELECT * FROM invoice_items WHERE id=$1", [bill.itemId])
  ).rows[0];
  const { id: _procedure, ...procedure } = (
    await db.query("SELECT * FROM encounter_procedures WHERE id=$1", [
      item.encounter_procedure_id,
    ])
  ).rows[0];
  for (let line = 3; line <= 22; line++) {
    const performed = await insertDbRow(db, "encounter_procedures", procedure);
    bill.itemIds.push(
      await insertDbRow(db, "invoice_items", {
        ...item,
        line_number: line,
        encounter_procedure_id: performed,
      }),
    );
  }
  await db.query("UPDATE invoice_versions SET total_amount=$1 WHERE id=$2", [
    new Prisma.Decimal("12.30").mul("22").toFixed(2),
    bill.versionId,
  ]);
  return bill;
}
async function fixture(run: (f: F) => Promise<void>) {
  const f = await createNegFuncDbFixture(db);
  try {
    await run(f);
  } finally {
    // Only PREPARED reservations made by these tests; no final evidence is bypassed.
    await db.query(
      "DELETE FROM declaration_manual_entries WHERE organization_id=$1 AND state='PREPARED'",
      [f.organizationId],
    );
    await f.cleanup();
  }
}
const prepare = (f: F, batch: string) =>
  manualEntryService.prepare(
    BigInt(batch),
    { idempotencyKey: randomUUID() },
    f.actor,
    metadata,
  );
describe("Independent DEP10 invoice set integrity and concurrent preparations", () => {
  it("rejects one of 22 lines and two disjoint partial batches without reservation/audit", () =>
    fixture(async (f) => {
      const bill = await fullInvoice(f),
        one = await f.batch("00123"),
        two = await f.batch("00123");
      await f.historyItem(one, bill.itemIds[0]!, 1);
      await expect(prepare(f, one)).rejects.toMatchObject({
        code: "MANUAL_ENTRY_INCOMPLETE_INVOICE",
      });
      for (let i = 1; i < 11; i++)
        await f.historyItem(one, bill.itemIds[i]!, i + 1);
      for (let i = 11; i < 22; i++)
        await f.historyItem(two, bill.itemIds[i]!, i - 10);
      const both = await Promise.allSettled([prepare(f, one), prepare(f, two)]);
      expect(
        both.every(
          (r) =>
            r.status === "rejected" &&
            r.reason.code === "MANUAL_ENTRY_INCOMPLETE_INVOICE",
        ),
      ).toBe(true);
      expect(
        (
          await db.query(
            "SELECT count(*)::int AS count FROM declaration_manual_entries WHERE organization_id=$1",
            [f.organizationId],
          )
        ).rows[0].count,
      ).toBe(0);
      expect(
        (
          await db.query(
            "SELECT count(*)::int AS count FROM audit_logs WHERE organization_id=$1 AND action='MANUAL_ENTRY_PREPARE'",
            [f.organizationId],
          )
        ).rows[0].count,
      ).toBe(0);
    }));
  it("allows the exact 22-line invoice with one concurrent winner and immutable hash", () =>
    fixture(async (f) => {
      const bill = await fullInvoice(f),
        batch = await f.batch("00123");
      for (let i = 0; i < 22; i++)
        await f.historyItem(batch, bill.itemIds[i]!, i + 1);
      const before = (
        await db.query(
          "SELECT content_hash,total_amount::text FROM invoice_versions WHERE id=$1",
          [bill.versionId],
        )
      ).rows;
      const attempts = await Promise.allSettled([
        prepare(f, batch),
        prepare(f, batch),
      ]);
      expect(attempts.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(attempts.filter((r) => r.status === "rejected")).toHaveLength(1);
      const snapshot = (
        await db.query(
          "SELECT content_snapshot FROM declaration_manual_entries WHERE declaration_batch_id=$1",
          [batch],
        )
      ).rows[0].content_snapshot;
      expect(snapshot.items).toHaveLength(22);
      expect(
        (
          await db.query(
            "SELECT content_hash,total_amount::text FROM invoice_versions WHERE id=$1",
            [bill.versionId],
          )
        ).rows,
      ).toEqual(before);
    }));
  it("rejects a mixed invoice batch by persisted identity, even when amounts match", () =>
    fixture(async (f) => {
      const first = await f.invoice(),
        second = await f.invoice(),
        batch = await f.batch("00123");
      await f.historyItem(batch, first.itemId, 1);
      await f.historyItem(batch, second.itemId, 2);
      await expect(prepare(f, batch)).rejects.toMatchObject({
        code: "MANUAL_ENTRY_SINGLE_INVOICE_REQUIRED",
      });
      expect(
        (
          await db.query(
            "SELECT count(*)::int AS count FROM declaration_manual_entries WHERE declaration_batch_id=$1",
            [batch],
          )
        ).rows[0].count,
      ).toBe(0);
    }));
});
