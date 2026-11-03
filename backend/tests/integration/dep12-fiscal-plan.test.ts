import pg from "pg";
import { beforeAll, afterAll, it, expect } from "vitest";
import { createNegFuncDbFixture } from "../helpers/neg-func-db-fixture.js";
import { planFiscalReconciliation } from "../../src/infrastructure/database/fiscal-reconciliation-plan.js";
const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
beforeAll(() => db.connect());
afterAll(() => db.end());
it("prepares precondition fingerprints and explicit source-required actions without repairing any fiscal history", async () => {
  const f = await createNegFuncDbFixture(db);
  try {
    await db.query(
      "UPDATE organizations SET declarant_id='INVALID-QA' WHERE id=$1",
      [f.organizationId],
    );
    const bill = await f.invoice("00123"),
      batch = await f.batch("00456");
    await f.historyItem(batch, bill.itemId, 1, "00456");
    const snapshot = async () =>
      (
        await db.query(
          `SELECT o.declarant_id,b.declarant_id_snapshot,v.content_hash FROM organizations o
      JOIN declaration_batches b ON b.organization_id=o.id JOIN invoices i ON i.organization_id=o.id JOIN invoice_versions v ON v.invoice_id=i.id WHERE o.id=$1`,
          [f.organizationId],
        )
      ).rows;
    const before = await snapshot(),
      plan = await planFiscalReconciliation(db);
    expect(
      plan.organizationPlans.find((p) => p.organizationId === f.organizationId)
        ?.proposedValue,
    ).toBeNull();
    const draft = plan.batchPlans.find((p) => p.declarationId === batch)!;
    expect(draft.classification).toBe(
      "DRAFT_DIFFERS_FROM_FROZEN_INVOICE_SOURCE",
    );
    expect(draft.applyAuthorized).toBe(false);
    expect(draft.expectedRowFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(plan.automaticRepairs).toBe(0);
    expect(plan.documentTransition.automaticUriChanges).toBe(0);
    expect(await snapshot()).toEqual(before);
  } finally {
    await f.cleanup();
  }
});
