import type { Client } from "pg";

export async function diagnoseManualPortal(db: Pick<Client, "query">) {
  await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    await db.query("SET LOCAL statement_timeout='10s'");
    const available = (
      await db.query(
        "SELECT to_regclass('public.declaration_manual_entries') IS NOT NULL AND to_regclass('public.declaration_manual_results') IS NOT NULL AS present",
      )
    ).rows[0].present;
    if (!available)
      return { readOnly: true, migrationRequired: true, issues: [] };
    const queries = {
      MANUAL_ENTRY_CONTEXT_MISMATCH: `SELECT e.id FROM declaration_manual_entries e JOIN declaration_batches b ON b.id=e.declaration_batch_id
        JOIN users u ON u.id=e.prepared_by_user_id WHERE b.organization_id<>e.organization_id OR u.organization_id<>e.organization_id`,
      MANUAL_ACTIVE_DUPLICATE: `SELECT declaration_batch_id FROM declaration_manual_entries WHERE state IN ('PREPARED','UNCERTAIN','RECORDED') GROUP BY declaration_batch_id HAVING count(*)>1`,
      MANUAL_RECEIPT_MISMATCH: `SELECT e.id FROM declaration_manual_entries e LEFT JOIN documents d ON d.id=e.receipt_document_id
        WHERE e.state='RECORDED' AND (d.id IS NULL OR d.organization_id<>e.organization_id OR d.sha256<>e.receipt_sha256
          OR d.document_type NOT IN ('OTHER','SUPPORTING_DOCUMENT'))`,
      MANUAL_SUBMISSION_MISMATCH: `SELECT e.id FROM declaration_manual_entries e LEFT JOIN declaration_submissions s ON s.id=e.submission_id
        WHERE e.state='RECORDED' AND (s.id IS NULL OR s.declaration_batch_id<>e.declaration_batch_id OR s.channel<>'MANUAL')`,
      MANUAL_RESULT_MISMATCH: `SELECT r.id FROM declaration_manual_results r JOIN declaration_manual_entries e ON e.id=r.manual_entry_id
        JOIN documents d ON d.id=r.result_document_id JOIN users u ON u.id=r.recorded_by_user_id
        WHERE e.state<>'RECORDED' OR r.organization_id<>e.organization_id OR d.organization_id<>r.organization_id
          OR u.organization_id<>r.organization_id OR d.sha256<>r.result_sha256`,
      SUBMISSION_COUNTER_BEHIND_HISTORY: `SELECT b.id FROM declaration_batches b WHERE b.last_submission_attempt <
        (SELECT coalesce(max(s.attempt_number),0) FROM declaration_submissions s WHERE s.declaration_batch_id=b.id)`,
    };
    const issues = [];
    for (const [code, sql] of Object.entries(queries))
      issues.push({
        code,
        count: (
          await db.query<{ count: number }>(
            `SELECT count(*)::int AS count FROM (${sql}) affected`,
          )
        ).rows[0]!.count,
      });
    return { readOnly: true, migrationRequired: false, issues };
  } finally {
    await db.query("ROLLBACK");
  }
}
