import { createHash } from "node:crypto";
import type { Client } from "pg";
import { negFuncDiagnosticQueries } from "./neg-func-diagnostics.js";
const fingerprint = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

/** A protected review artifact. There is intentionally no apply/repair function. */
export async function planFiscalReconciliation(db: Pick<Client, "query">) {
  await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    await db.query("SET LOCAL statement_timeout='10s'");
    const invalidOrganizations = (
      await db.query<{
        id: string;
        declarant_id: string | null;
        updated_at: Date;
      }>(`
      SELECT id::text,declarant_id,updated_at FROM organizations WHERE id::text IN (${negFuncDiagnosticQueries.ORGANIZATION_DECLARANT_INVALID}) ORDER BY id`)
    ).rows;
    const organizationPlans = [];
    for (const row of invalidOrganizations) {
      const references = (
        await db.query(
          `SELECT count(*)::int AS frozen_versions FROM invoice_versions v JOIN invoices i ON i.id=v.invoice_id
        WHERE i.organization_id=$1 AND v.status IN ('PENDING_SIGNATURE','SIGNED','CLOSED','SUPERSEDED')`,
          [row.id],
        )
      ).rows[0];
      organizationPlans.push({
        entity: "Organization",
        organizationId: row.id,
        expectedRowFingerprint: fingerprint(row),
        expectedUpdatedAt: row.updated_at.toISOString(),
        currentConfiguration: row.declarant_id,
        references,
        status: "SOURCE_REQUIRED",
        proposedValue: null,
        requiredSource:
          "Clinic-approved Declarant ID for this organization; preserve leading zeroes",
        proposedOperation:
          "PATCH organization with current expectedRevision, explicit reason and appropriate organization actor; configuration only",
        effects:
          "Only future captures; no rewriting invoice/declaration/signature snapshots",
        rollback:
          "Keep the protected prior value as evidence; do not restore an invalid identifier. Suspend affected new captures and use a fresh audited revision with a clinic-approved valid value; never edit historical snapshots",
      });
    }
    const batches = (
      await db.query<{
        id: string;
        organization_id: string;
        status: string;
        declarant_id_snapshot: string | null;
        updated_at: Date;
      }>(`
      SELECT id::text,organization_id::text,status::text,declarant_id_snapshot,updated_at FROM declaration_batches
      WHERE id::text IN (${negFuncDiagnosticQueries.DECLARATION_DRAFT_IDENTITY_CONFLICT}) ORDER BY id`)
    ).rows;
    const batchPlans = [];
    const hasManual = (
      await db.query(
        "SELECT to_regclass('public.declaration_manual_entries') IS NOT NULL AS present",
      )
    ).rows[0].present;
    for (const batch of batches) {
      const lines = (
        await db.query(
          `SELECT di.id::text,di.invoice_item_id::text,ii.invoice_version_id::text,
        di.declarant_id_snapshot AS line_identity,v.declarant_id_snapshot AS invoice_identity
        FROM declaration_items di JOIN invoice_items ii ON ii.id=di.invoice_item_id JOIN invoice_versions v ON v.id=ii.invoice_version_id
        WHERE di.declaration_batch_id=$1 ORDER BY di.id`,
          [batch.id],
        )
      ).rows;
      const evidence = (
        await db.query(
          `SELECT
        (SELECT count(*)::int FROM declaration_exports WHERE declaration_batch_id=$1) AS exports,
        (SELECT count(*)::int FROM declaration_submissions WHERE declaration_batch_id=$1) AS submissions`,
          [batch.id],
        )
      ).rows[0];
      const manual = hasManual
        ? (
            await db.query(
              "SELECT count(*)::int AS count FROM declaration_manual_entries WHERE declaration_batch_id=$1 AND state IN ('PREPARED','UNCERTAIN','RECORDED')",
              [batch.id],
            )
          ).rows[0].count
        : 0;
      const identities = new Set(lines.map((l) => l.invoice_identity));
      const validSource =
        lines.length > 0 &&
        identities.size === 1 &&
        lines.every(
          (l) =>
            typeof l.invoice_identity === "string" &&
            /^[0-9]{1,5}$/.test(l.invoice_identity),
        );
      batchPlans.push({
        entity: "DeclarationBatch",
        declarationId: batch.id,
        organizationId: batch.organization_id,
        expectedRowFingerprint: fingerprint({ batch, lines, evidence, manual }),
        status: "REVIEW_REQUIRED",
        currentBatch: batch,
        lines,
        evidence,
        activeManualEntries: manual,
        classification: validSource
          ? "DRAFT_DIFFERS_FROM_FROZEN_INVOICE_SOURCE"
          : "FROZEN_SOURCE_INCONSISTENT_OR_INVALID",
        proposedOperation:
          validSource && !evidence.exports && !evidence.submissions && !manual
            ? "Review cancellation of this Draft through the existing audited API, preserving history. Recreate from frozen invoice source only when SVB scope resumes"
            : "Keep unchanged; business review of original evidence and any required invoice correction/new signature before choosing an action",
        requiredSource:
          "Authoritative original invoice identity/evidence and a responsible clinician/operator; current organization settings do not replace historical source",
        rollback:
          "Cancellation is not undone by SQL; retain original record and evidence. Any replacement is a new authorized workflow",
        applyAuthorized: false,
      });
    }
    const documents = (
      await db.query<{
        id: string;
        organization_id: string;
        storage_provider: string;
        storage_uri: string;
        sha256: string;
        size_bytes: string;
      }>(
        "SELECT id::text,organization_id::text,storage_provider::text,storage_uri,sha256,size_bytes::text FROM documents ORDER BY id",
      )
    ).rows;
    const groups = new Map<
      string,
      { provider: string; count: number; bytes: string }
    >();
    for (const doc of documents) {
      const key = doc.storage_uri.startsWith("local://documents/")
        ? "LOCAL_URI"
        : doc.storage_uri.startsWith("supabase://documents/")
          ? "SUPABASE_URI"
          : "UNSUPPORTED_URI";
      const g = groups.get(key) ?? { provider: key, count: 0, bytes: "0" };
      g.count++;
      g.bytes = (BigInt(g.bytes) + BigInt(doc.size_bytes)).toString();
      groups.set(key, g);
    }
    return {
      readOnly: true,
      artifactVersion: "DEP12_FISCAL_REVIEW_V1",
      generatedAt: new Date().toISOString(),
      organizationPlans,
      batchPlans,
      automaticRepairs: 0,
      documentTransition: {
        groups: [...groups.values()],
        documents: documents.map((d) => ({
          ...d,
          expectedRowFingerprint: fingerprint(d),
        })),
        automaticUriChanges: 0,
        requiredAction:
          "Verify/copy each referenced object into an isolated private QA target with same SHA-256/size; preserve original IDs/URIs until separately authorized transition",
        databaseBackupIncludesObjectBytes: false,
      },
      allSourceValuesApproved: false,
      notes:
        "Sensitive review artifact: no patient names, clinical notes or credentials. No automatic changes; fingerprints must be checked again before a separately authorized operation.",
    };
  } finally {
    await db.query("ROLLBACK");
  }
}
