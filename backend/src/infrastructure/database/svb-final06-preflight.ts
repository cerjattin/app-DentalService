import type { Client } from "pg";
import { Prisma } from "../../generated/prisma/client.js";
import {
  declarationItemToSvbRow,
  diagnoseSvbDeclarationRow,
} from "../../modules/declarations/export/declaration-row.mapper.js";

type Db = Pick<Client, "query">;
// Structural integrity only. These are not an alternative set of SVB field rules.
export const final06IntegrityQueries = {
  ACCIDENT_INSURANCE_PATIENT_MISMATCH: `SELECT ac.id FROM accident_cases ac
    JOIN patient_insurance pi ON pi.id=ac.patient_insurance_id WHERE pi.patient_id<>ac.patient_id`,
  ACCIDENT_CREATOR_ORGANIZATION_MISMATCH: `SELECT ac.id FROM accident_cases ac
    JOIN patients p ON p.id=ac.patient_id JOIN users u ON u.id=ac.created_by_user_id
    WHERE p.organization_id<>u.organization_id`,
  APPOINTMENT_ACCIDENT_CONTEXT_MISMATCH: `SELECT a.id FROM appointments a
    JOIN accident_cases ac ON ac.id=a.accident_case_id JOIN patients p ON p.id=ac.patient_id
    WHERE ac.patient_id<>a.patient_id OR p.organization_id<>a.organization_id
      OR (ac.patient_insurance_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM clinical_encounters ce JOIN encounter_procedures ep ON ep.encounter_id=ce.id
        WHERE ce.appointment_id=a.id AND ep.patient_insurance_id<>ac.patient_insurance_id))`,
  APPOINTMENT_LOCATION_ORGANIZATION_MISMATCH: `SELECT a.id FROM appointments a
    JOIN clinic_locations cl ON cl.id=a.clinic_location_id WHERE cl.organization_id<>a.organization_id`,
  PROCEDURE_INSURANCE_PATIENT_MISMATCH: `SELECT ep.id FROM encounter_procedures ep
    JOIN clinical_encounters ce ON ce.id=ep.encounter_id JOIN appointments a ON a.id=ce.appointment_id
    JOIN patient_insurance pi ON pi.id=ep.patient_insurance_id WHERE pi.patient_id<>a.patient_id`,
  PROCEDURE_REFERRER_ORGANIZATION_MISMATCH: `SELECT ep.id FROM encounter_procedures ep
    JOIN referrers r ON r.id=ep.referrer_id JOIN clinical_encounters ce ON ce.id=ep.encounter_id
    JOIN appointments a ON a.id=ce.appointment_id WHERE r.organization_id<>a.organization_id`,
  PROCEDURE_TARIFF_PROCEDURE_MISMATCH: `SELECT ep.id FROM encounter_procedures ep
    JOIN svb_tariffs t ON t.id=ep.svb_tariff_id WHERE t.svb_procedure_id<>ep.svb_procedure_id`,
  PROCEDURE_AUTHORIZATION_CONTEXT_MISMATCH: `SELECT ep.id FROM encounter_procedures ep
    JOIN clinical_encounters ce ON ce.id=ep.encounter_id JOIN appointments a ON a.id=ce.appointment_id
    JOIN svb_authorization_items ai ON ai.id=ep.authorization_item_id
    JOIN svb_authorizations au ON au.id=ai.authorization_id
    WHERE au.patient_id<>a.patient_id OR au.patient_insurance_id<>ep.patient_insurance_id
      OR (ai.svb_procedure_id IS NOT NULL AND ai.svb_procedure_id<>ep.svb_procedure_id)`,
  TARIFF_ACTIVE_OVERLAP: `SELECT t.id FROM svb_tariffs t WHERE t.is_active AND EXISTS (
    SELECT 1 FROM svb_tariffs x WHERE x.id<>t.id AND x.svb_procedure_id=t.svb_procedure_id
      AND x.currency_code=t.currency_code AND x.is_active
      AND (t.valid_to IS NULL OR x.valid_from<=t.valid_to)
      AND (x.valid_to IS NULL OR t.valid_from<=x.valid_to))`,
  TARIFF_INVALID_PERIOD: `SELECT id FROM svb_tariffs WHERE valid_to<valid_from`,
  PROCEDURE_INVALID_PERIOD: `SELECT id FROM svb_procedures WHERE valid_to<valid_from`,
} as const;

export function final06PreflightSql() {
  return `-- NEG-FINAL-06: structural counts only; no clinical values or repair.
-- Zero findings do not authorize real submission, pilot scope, or master loading.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '10s';
${Object.entries(final06IntegrityQueries)
  .map(
    ([code, sql]) =>
      `SELECT '${code}' AS code, count(*) AS affected_count FROM (${sql}) affected`,
  )
  .join("\nUNION ALL\n")};
ROLLBACK;\n`;
}

type Snapshot = Parameters<typeof declarationItemToSvbRow>[0];
type RawSnapshot = Omit<Snapshot, "amountSnapshot" | "serviceDateSnapshot"> & {
  id: string;
  amountSnapshot: string;
  serviceDateSnapshot: string;
};
// Only frozen columns are read. In particular, never COALESCE from current masters.
function snapshotPage(source: "invoice" | "declaration") {
  const invoice = source === "invoice";
  const col = (name: string) => `s.${name}_snapshot`;
  return `SELECT s.id::text AS id,
    ${invoice ? "v.declarant_id_snapshot" : col("declarant_id")} AS "declarantIdSnapshot",
    ${invoice ? "i.invoice_number" : col("invoice_number")} AS "invoiceNumberSnapshot",
    ${invoice ? "s.detail_invoice_number" : col("detail_invoice_number")} AS "detailInvoiceNumberSnapshot",
    ${[
      "provider_id",
      "insured_id",
      "accident_form_number",
      "treatment_id",
      "authorization_id",
      "number_of_treatments",
      "assistance",
      "referrer_id",
      "diagnostic_code",
      "policlinic",
    ]
      .map(
        (name) =>
          `${col(name)} AS "${name.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())}Snapshot"`,
      )
      .join(",\n")},
    ${invoice ? "s.amount" : col("amount")}::text AS "amountSnapshot",
    to_char(s.service_date_snapshot,'YYYY-MM-DD') AS "serviceDateSnapshot",
    ${invoice ? "s.additional_note" : col("additional_note")} AS "additionalNoteSnapshot"
    FROM ${invoice ? "invoice_items s JOIN invoice_versions v ON v.id=s.invoice_version_id JOIN invoices i ON i.id=v.invoice_id" : "declaration_items s JOIN declaration_batches b ON b.id=s.declaration_batch_id"}
    WHERE ${invoice ? "i.current_version_id=v.id AND i.status='CLOSED' AND v.status='CLOSED'" : "b.status<>'CANCELLED'"}
      AND s.id>$1::bigint ORDER BY s.id LIMIT 250`;
}

export async function diagnoseFinal06Database(db: Db) {
  await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    await db.query("SET LOCAL statement_timeout = '10s'");
    const issues: Array<{ code: string; count: number }> = [];
    for (const [code, sql] of Object.entries(final06IntegrityQueries)) {
      const result = await db.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM (${sql}) affected`,
      );
      issues.push({ code, count: result.rows[0]!.count });
    }
    const snapshots: Array<{
      source: string;
      scanned: number;
      issues: Array<{ field: string; code: string; count: number }>;
    }> = [];
    for (const source of ["invoice", "declaration"] as const) {
      let cursor = "-1",
        scanned = 0;
      const counts = new Map<
        string,
        { field: string; code: string; count: number }
      >();
      while (true) {
        const page = await db.query<RawSnapshot>(snapshotPage(source), [
          cursor,
        ]);
        if (!page.rows.length) break;
        for (const row of page.rows) {
          const snapshot: Snapshot = {
            ...row,
            declarantIdSnapshot: row.declarantIdSnapshot ?? "",
            invoiceNumberSnapshot: row.invoiceNumberSnapshot ?? "",
            detailInvoiceNumberSnapshot: row.detailInvoiceNumberSnapshot ?? "",
            amountSnapshot: new Prisma.Decimal(row.amountSnapshot),
            serviceDateSnapshot: new Date(
              `${row.serviceDateSnapshot}T00:00:00.000Z`,
            ),
          };
          for (const issue of diagnoseSvbDeclarationRow(
            declarationItemToSvbRow(snapshot),
          )) {
            const key = `${issue.field}:${issue.code}`;
            const count = counts.get(key) ?? { ...issue, count: 0 };
            count.count++;
            counts.set(key, count);
          }
          cursor = row.id;
          scanned++;
        }
      }
      snapshots.push({ source, scanned, issues: [...counts.values()] });
    }
    // Offline SQL export must not load runtime configuration or credentials.
    const { getSvbPilotReadiness } =
      await import("../../modules/svb-readiness/svb-readiness.service.js");
    const pilot = getSvbPilotReadiness();
    return {
      readOnly: true,
      realSubmissionApproved: pilot.realSubmissionEnabled,
      technicalValidationOnly: true,
      pilot,
      integrityBlocked: issues.some((i) => i.count > 0),
      issues,
      snapshots,
    };
  } finally {
    await db.query("ROLLBACK");
  }
}
