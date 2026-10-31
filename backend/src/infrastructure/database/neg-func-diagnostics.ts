import type { Client } from "pg";

type SqlClient = Pick<Client, "query">;
export type DiagnosticIssue = { code: string; count: number; ids?: string[] };
export type NegFuncDatabaseReport = {
  readOnly: true;
  version: string;
  migrationBlocked: boolean;
  issues: DiagnosticIssue[];
};

// Numeric casts are deliberately inside CASE: malformed legacy JSON must be
// reported as a count, never echoed in an exception or interpreted as an ID.
const validBatchId = (field: string) =>
  `CASE WHEN ((${field}) COLLATE "C") ~ '^[1-9][0-9]*$' AND length(${field}) <= 19 THEN (${field})::numeric <= 9223372036854775807 ELSE false END`;
const validOrdinal = (field: string) =>
  `CASE WHEN ((${field}) COLLATE "C") ~ '^[1-9][0-9]*$' AND length(${field}) <= 10 THEN (${field})::numeric <= 2147483647 ELSE false END`;
const ordinalAudit = `WITH payloads AS (
  SELECT id, organization_id, entity_id, entity_key,
    CASE WHEN action = 'DECLARATION_ITEM_ADD' THEN new_values ELSE old_values END AS payload
  FROM audit_logs WHERE action IN ('DECLARATION_ITEM_ADD', 'DECLARATION_ITEM_REMOVE')
), raw_evidence AS (
  SELECT *, payload->>'declarationBatchId' AS raw_batch_id, payload->>'sequenceNumber' AS ordinal
  FROM payloads
) , candidates AS (
  SELECT e.id, db.id AS batch_id FROM raw_evidence e JOIN declaration_batches db
    ON db.id = CASE WHEN ${validBatchId("e.raw_batch_id")} THEN e.raw_batch_id::bigint END
      AND db.organization_id = e.organization_id
  UNION
  SELECT e.id, di.declaration_batch_id FROM raw_evidence e JOIN declaration_items di ON di.id = e.entity_id
    JOIN declaration_batches db ON db.id = di.declaration_batch_id AND db.organization_id = e.organization_id
  UNION
  SELECT e.id, db.id FROM raw_evidence e JOIN declaration_batches db ON db.organization_id = e.organization_id
    AND (e.entity_key COLLATE "C") = ((db.declaration_number || ':' || e.ordinal) COLLATE "C")
), evidence AS (
  SELECT e.*, CASE WHEN count(DISTINCT c.batch_id) = 1 THEN min(c.batch_id)::text END AS batch_id,
    count(DISTINCT c.batch_id) AS candidate_count
  FROM raw_evidence e LEFT JOIN candidates c ON c.id = e.id
  GROUP BY e.id, e.organization_id, e.entity_id, e.entity_key, e.payload, e.raw_batch_id, e.ordinal
)`;

export const negFuncDiagnosticQueries = {
  ORGANIZATION_DECLARANT_INVALID: `SELECT id::text AS id FROM organizations
    WHERE declarant_id IS NOT NULL AND declarant_id COLLATE "C" !~ '^[0-9]{1,5}$'`,
  DECLARATION_DRAFT_IDENTITY_CONFLICT: `SELECT db.id::text AS id FROM declaration_batches db
    WHERE db.status = 'DRAFT' AND (
      (db.declarant_id_snapshot IS NOT NULL AND db.declarant_id_snapshot COLLATE "C" !~ '^[0-9]{1,5}$') OR
      EXISTS (SELECT 1 FROM declaration_items di
        JOIN invoice_items ii ON ii.id = di.invoice_item_id
        JOIN invoice_versions iv ON iv.id = ii.invoice_version_id
        WHERE di.declaration_batch_id = db.id AND (
          db.declarant_id_snapshot IS NULL OR di.declarant_id_snapshot COLLATE "C" !~ '^[0-9]{1,5}$' OR
          (di.declarant_id_snapshot COLLATE "C") IS DISTINCT FROM (db.declarant_id_snapshot COLLATE "C") OR
          iv.declarant_id_snapshot IS NULL OR iv.declarant_id_snapshot COLLATE "C" !~ '^[0-9]{1,5}$' OR
          (di.declarant_id_snapshot COLLATE "C") IS DISTINCT FROM (iv.declarant_id_snapshot COLLATE "C")
        ))
    )`,
  DECLARATION_ACTIVE_DUPLICATE: `SELECT di.invoice_item_id::text AS id FROM declaration_items di
    JOIN declaration_batches db ON db.id = di.declaration_batch_id
    WHERE db.status <> 'CANCELLED' GROUP BY di.invoice_item_id HAVING count(*) > 1`,
  DECLARATION_DRAFT_FROZEN_EVIDENCE: `SELECT db.id::text AS id FROM declaration_batches db
    WHERE db.status = 'DRAFT' AND (
      EXISTS (SELECT 1 FROM declaration_exports e WHERE e.declaration_batch_id = db.id) OR
      EXISTS (SELECT 1 FROM declaration_submissions s WHERE s.declaration_batch_id = db.id))`,
  ORDINAL_AUDIT_INVALID: `${ordinalAudit} SELECT id::text AS id FROM evidence
    WHERE (raw_batch_id IS NOT NULL AND NOT (${validBatchId("raw_batch_id")})) OR NOT (${validOrdinal("ordinal")})`,
  ORDINAL_AUDIT_BATCH_MISSING: `${ordinalAudit}
    SELECT id::text AS id FROM evidence WHERE candidate_count = 0`,
  ORDINAL_AUDIT_CONFLICT: `${ordinalAudit} SELECT e.id::text AS id FROM evidence e
    WHERE candidate_count > 1 OR
      (raw_batch_id IS NOT NULL AND (${validBatchId("raw_batch_id")}) AND
        NOT EXISTS (SELECT 1 FROM declaration_batches db
          WHERE db.id = CASE WHEN ${validBatchId("e.raw_batch_id")} THEN e.raw_batch_id::bigint END
            AND db.organization_id = e.organization_id)) OR
      EXISTS (SELECT 1 FROM declaration_items di JOIN declaration_batches db ON db.id = di.declaration_batch_id
        WHERE di.id = e.entity_id AND (db.organization_id <> e.organization_id OR
          di.sequence_number::text IS DISTINCT FROM e.ordinal)) OR
      (e.entity_key IS NOT NULL AND e.candidate_count = 1 AND NOT EXISTS (
        SELECT 1 FROM declaration_batches db WHERE db.id::text = e.batch_id AND
          (e.entity_key COLLATE "C") = ((coalesce(db.declaration_number, db.id::text) || ':' || e.ordinal) COLLATE "C")))`,
  TREATMENT_CASE_PATIENT_ORGANIZATION_MISMATCH: `SELECT tc.id::text AS id FROM treatment_cases tc
    JOIN patients p ON p.id = tc.patient_id WHERE tc.organization_id <> p.organization_id`,
  APPOINTMENT_TREATMENT_CONTEXT_MISMATCH: `SELECT a.id::text AS id FROM appointments a
    JOIN treatment_cases tc ON tc.id=a.treatment_case_id
    WHERE a.patient_id <> tc.patient_id OR a.organization_id <> tc.organization_id`,
  TREATMENT_USAGE_AUDIT_INVALID: `SELECT a.id::text AS id FROM audit_logs a
    WHERE a.action IN ('APPOINTMENT_CREATE','APPOINTMENT_UPDATE') AND a.new_values->>'treatmentCaseId' IS NOT NULL
      AND (NOT (${validBatchId("a.new_values->>'treatmentCaseId'")}) OR
        (a.new_values->>'patientId' IS NOT NULL AND NOT (${validBatchId("a.new_values->>'patientId'")})))`,
  TREATMENT_USAGE_AUDIT_CONTEXT_MISMATCH: `SELECT a.id::text AS id FROM audit_logs a
    LEFT JOIN treatment_cases tc ON tc.id = CASE WHEN ${validBatchId("a.new_values->>'treatmentCaseId'")}
      THEN (a.new_values->>'treatmentCaseId')::bigint END
    WHERE a.action IN ('APPOINTMENT_CREATE','APPOINTMENT_UPDATE')
      AND (${validBatchId("a.new_values->>'treatmentCaseId'")}) AND (
        tc.id IS NULL OR tc.organization_id <> a.organization_id OR
        (a.new_values->>'patientId' IS NOT NULL AND tc.patient_id::text IS DISTINCT FROM a.new_values->>'patientId'))`,
};

const blockingCodes = new Set([
  "DECLARATION_ACTIVE_DUPLICATE",
  "ORDINAL_AUDIT_INVALID",
  "ORDINAL_AUDIT_BATCH_MISSING",
  "ORDINAL_AUDIT_CONFLICT",
  "ACTIVE_ASSIGNMENT_MISSING",
  "ACTIVE_ASSIGNMENT_MISMATCH",
  "ORDINAL_COUNTER_BEHIND_HISTORY",
  "TREATMENT_CASE_PATIENT_ORGANIZATION_MISMATCH",
  "TREATMENT_FIRST_USE_MISSING",
  "APPOINTMENT_TREATMENT_CONTEXT_MISMATCH",
  "TREATMENT_USAGE_AUDIT_INVALID",
  "TREATMENT_USAGE_AUDIT_CONTEXT_MISMATCH",
]);

/** Baseline-compatible SQL for a separately authorized protected inspection. */
export function negFuncPreflightSql() {
  const rows = Object.entries(negFuncDiagnosticQueries).map(
    ([code, sql]) =>
      `SELECT '${code}'::text AS code, ${blockingCodes.has(code)} AS blocks_migration,
      (SELECT count(*)::int FROM (${sql}) affected) AS affected_count`,
  );
  return (
    `-- Generated from src/infrastructure/database/neg-func-diagnostics.ts.\n` +
    `-- Read-only counts only: no IDs, snapshots, credentials or automatic repairs.\n` +
    `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\nSET LOCAL statement_timeout = '10s';\n` +
    `WITH issues AS (${rows.join("\nUNION ALL\n")})\nSELECT * FROM issues ORDER BY code;\nROLLBACK;\n`
  );
}

/** Read-only report. IDs are opt-in and may only be exposed by the guarded QA CLI. */
export async function diagnoseNegFuncDatabase(
  client: SqlClient,
  includeQaIds = false,
): Promise<NegFuncDatabaseReport> {
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    await client.query("SET LOCAL statement_timeout = '10s'");
    const version = (
      await client.query<{ version: string }>(
        "SELECT current_setting('server_version') AS version",
      )
    ).rows[0]!.version;
    const issues: DiagnosticIssue[] = [];
    const check = async (code: string, sql: string) => {
      const result = await client.query<{ count: number; ids: string[] }>(`
        WITH affected AS (${sql}) SELECT (SELECT count(*)::int FROM affected) AS count,
          ARRAY(SELECT id FROM affected ORDER BY id LIMIT 100) AS ids`);
      const row = result.rows[0]!;
      issues.push({
        code,
        count: row.count,
        ...(includeQaIds ? { ids: row.ids } : {}),
      });
    };
    for (const [code, sql] of Object.entries(negFuncDiagnosticQueries))
      await check(code, sql);
    const capabilities = (
      await client.query<{
        ownership: boolean;
        ordinal: boolean;
        first_use: boolean;
      }>(`
      SELECT to_regclass('public.declaration_active_assignments') IS NOT NULL AS ownership,
        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
          AND table_name = 'declaration_batches' AND column_name = 'last_item_sequence') AS ordinal,
        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
          AND table_name = 'treatment_cases' AND column_name = 'first_assigned_at') AS first_use`)
    ).rows[0]!;
    if (capabilities.ownership) {
      await check(
        "ACTIVE_ASSIGNMENT_MISSING",
        `SELECT di.id::text AS id FROM declaration_items di
        JOIN declaration_batches db ON db.id = di.declaration_batch_id
        WHERE db.status <> 'CANCELLED' AND NOT EXISTS (
          SELECT 1 FROM declaration_active_assignments a WHERE a.declaration_item_id = di.id
            AND a.invoice_item_id = di.invoice_item_id AND a.declaration_batch_id = di.declaration_batch_id)`,
      );
      await check(
        "ACTIVE_ASSIGNMENT_MISMATCH",
        `SELECT a.declaration_item_id::text AS id
        FROM declaration_active_assignments a LEFT JOIN declaration_items di ON di.id = a.declaration_item_id
        LEFT JOIN declaration_batches db ON db.id = a.declaration_batch_id
        WHERE di.id IS NULL OR db.id IS NULL OR db.status = 'CANCELLED' OR
          di.invoice_item_id <> a.invoice_item_id OR di.declaration_batch_id <> a.declaration_batch_id`,
      );
    }
    if (capabilities.ordinal) {
      await check(
        "ORDINAL_COUNTER_BEHIND_HISTORY",
        `${ordinalAudit}, used AS (
        SELECT declaration_batch_id AS batch_id, sequence_number AS ordinal FROM declaration_items
        UNION ALL SELECT CASE WHEN ${validBatchId("batch_id")} THEN batch_id::bigint END,
          CASE WHEN ${validOrdinal("ordinal")} THEN ordinal::int END FROM evidence
      ), high_water AS (SELECT batch_id, max(ordinal) AS ordinal FROM used GROUP BY batch_id)
      SELECT db.id::text AS id FROM declaration_batches db JOIN high_water h ON h.batch_id = db.id
        WHERE db.last_item_sequence < h.ordinal`,
      );
    }
    if (capabilities.first_use) {
      await check(
        "TREATMENT_FIRST_USE_MISSING",
        `SELECT tc.id::text AS id FROM treatment_cases tc
        WHERE tc.first_assigned_at IS NULL AND (
          EXISTS (SELECT 1 FROM appointments a WHERE a.treatment_case_id = tc.id) OR
          EXISTS (SELECT 1 FROM audit_logs a WHERE a.action IN ('APPOINTMENT_CREATE','APPOINTMENT_UPDATE')
            AND a.new_values->>'treatmentCaseId' = tc.id::text))`,
      );
    }
    return {
      readOnly: true,
      version,
      migrationBlocked: issues.some(
        (issue) => blockingCodes.has(issue.code) && issue.count > 0,
      ),
      issues,
    };
  } finally {
    await client.query("ROLLBACK");
  }
}
