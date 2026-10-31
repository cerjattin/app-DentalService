-- Generated from src/infrastructure/database/neg-func-diagnostics.ts.
-- Read-only counts only: no IDs, snapshots, credentials or automatic repairs.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '10s';
WITH issues AS (SELECT 'ORGANIZATION_DECLARANT_INVALID'::text AS code, false AS blocks_migration,
      (SELECT count(*)::int FROM (SELECT id::text AS id FROM organizations
    WHERE declarant_id IS NOT NULL AND declarant_id COLLATE "C" !~ '^[0-9]{1,5}$') affected) AS affected_count
UNION ALL
SELECT 'DECLARATION_DRAFT_IDENTITY_CONFLICT'::text AS code, false AS blocks_migration,
      (SELECT count(*)::int FROM (SELECT db.id::text AS id FROM declaration_batches db
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
    )) affected) AS affected_count
UNION ALL
SELECT 'DECLARATION_ACTIVE_DUPLICATE'::text AS code, true AS blocks_migration,
      (SELECT count(*)::int FROM (SELECT di.invoice_item_id::text AS id FROM declaration_items di
    JOIN declaration_batches db ON db.id = di.declaration_batch_id
    WHERE db.status <> 'CANCELLED' GROUP BY di.invoice_item_id HAVING count(*) > 1) affected) AS affected_count
UNION ALL
SELECT 'DECLARATION_DRAFT_FROZEN_EVIDENCE'::text AS code, false AS blocks_migration,
      (SELECT count(*)::int FROM (SELECT db.id::text AS id FROM declaration_batches db
    WHERE db.status = 'DRAFT' AND (
      EXISTS (SELECT 1 FROM declaration_exports e WHERE e.declaration_batch_id = db.id) OR
      EXISTS (SELECT 1 FROM declaration_submissions s WHERE s.declaration_batch_id = db.id))) affected) AS affected_count
UNION ALL
SELECT 'ORDINAL_AUDIT_INVALID'::text AS code, true AS blocks_migration,
      (SELECT count(*)::int FROM (WITH payloads AS (
  SELECT id, organization_id, entity_id, entity_key,
    CASE WHEN action = 'DECLARATION_ITEM_ADD' THEN new_values ELSE old_values END AS payload
  FROM audit_logs WHERE action IN ('DECLARATION_ITEM_ADD', 'DECLARATION_ITEM_REMOVE')
), raw_evidence AS (
  SELECT *, payload->>'declarationBatchId' AS raw_batch_id, payload->>'sequenceNumber' AS ordinal
  FROM payloads
) , candidates AS (
  SELECT e.id, db.id AS batch_id FROM raw_evidence e JOIN declaration_batches db
    ON db.id = CASE WHEN CASE WHEN ((e.raw_batch_id) COLLATE "C") ~ '^[1-9][0-9]*$' AND length(e.raw_batch_id) <= 19 THEN (e.raw_batch_id)::numeric <= 9223372036854775807 ELSE false END THEN e.raw_batch_id::bigint END
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
) SELECT id::text AS id FROM evidence
    WHERE (raw_batch_id IS NOT NULL AND NOT (CASE WHEN ((raw_batch_id) COLLATE "C") ~ '^[1-9][0-9]*$' AND length(raw_batch_id) <= 19 THEN (raw_batch_id)::numeric <= 9223372036854775807 ELSE false END)) OR NOT (CASE WHEN ((ordinal) COLLATE "C") ~ '^[1-9][0-9]*$' AND length(ordinal) <= 10 THEN (ordinal)::numeric <= 2147483647 ELSE false END)) affected) AS affected_count
UNION ALL
SELECT 'ORDINAL_AUDIT_BATCH_MISSING'::text AS code, true AS blocks_migration,
      (SELECT count(*)::int FROM (WITH payloads AS (
  SELECT id, organization_id, entity_id, entity_key,
    CASE WHEN action = 'DECLARATION_ITEM_ADD' THEN new_values ELSE old_values END AS payload
  FROM audit_logs WHERE action IN ('DECLARATION_ITEM_ADD', 'DECLARATION_ITEM_REMOVE')
), raw_evidence AS (
  SELECT *, payload->>'declarationBatchId' AS raw_batch_id, payload->>'sequenceNumber' AS ordinal
  FROM payloads
) , candidates AS (
  SELECT e.id, db.id AS batch_id FROM raw_evidence e JOIN declaration_batches db
    ON db.id = CASE WHEN CASE WHEN ((e.raw_batch_id) COLLATE "C") ~ '^[1-9][0-9]*$' AND length(e.raw_batch_id) <= 19 THEN (e.raw_batch_id)::numeric <= 9223372036854775807 ELSE false END THEN e.raw_batch_id::bigint END
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
)
    SELECT id::text AS id FROM evidence WHERE candidate_count = 0) affected) AS affected_count
UNION ALL
SELECT 'ORDINAL_AUDIT_CONFLICT'::text AS code, true AS blocks_migration,
      (SELECT count(*)::int FROM (WITH payloads AS (
  SELECT id, organization_id, entity_id, entity_key,
    CASE WHEN action = 'DECLARATION_ITEM_ADD' THEN new_values ELSE old_values END AS payload
  FROM audit_logs WHERE action IN ('DECLARATION_ITEM_ADD', 'DECLARATION_ITEM_REMOVE')
), raw_evidence AS (
  SELECT *, payload->>'declarationBatchId' AS raw_batch_id, payload->>'sequenceNumber' AS ordinal
  FROM payloads
) , candidates AS (
  SELECT e.id, db.id AS batch_id FROM raw_evidence e JOIN declaration_batches db
    ON db.id = CASE WHEN CASE WHEN ((e.raw_batch_id) COLLATE "C") ~ '^[1-9][0-9]*$' AND length(e.raw_batch_id) <= 19 THEN (e.raw_batch_id)::numeric <= 9223372036854775807 ELSE false END THEN e.raw_batch_id::bigint END
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
) SELECT e.id::text AS id FROM evidence e
    WHERE candidate_count > 1 OR
      (raw_batch_id IS NOT NULL AND (CASE WHEN ((raw_batch_id) COLLATE "C") ~ '^[1-9][0-9]*$' AND length(raw_batch_id) <= 19 THEN (raw_batch_id)::numeric <= 9223372036854775807 ELSE false END) AND
        NOT EXISTS (SELECT 1 FROM declaration_batches db
          WHERE db.id = CASE WHEN CASE WHEN ((e.raw_batch_id) COLLATE "C") ~ '^[1-9][0-9]*$' AND length(e.raw_batch_id) <= 19 THEN (e.raw_batch_id)::numeric <= 9223372036854775807 ELSE false END THEN e.raw_batch_id::bigint END
            AND db.organization_id = e.organization_id)) OR
      EXISTS (SELECT 1 FROM declaration_items di JOIN declaration_batches db ON db.id = di.declaration_batch_id
        WHERE di.id = e.entity_id AND (db.organization_id <> e.organization_id OR
          di.sequence_number::text IS DISTINCT FROM e.ordinal)) OR
      (e.entity_key IS NOT NULL AND e.candidate_count = 1 AND NOT EXISTS (
        SELECT 1 FROM declaration_batches db WHERE db.id::text = e.batch_id AND
          (e.entity_key COLLATE "C") = ((coalesce(db.declaration_number, db.id::text) || ':' || e.ordinal) COLLATE "C")))) affected) AS affected_count
UNION ALL
SELECT 'TREATMENT_CASE_PATIENT_ORGANIZATION_MISMATCH'::text AS code, true AS blocks_migration,
      (SELECT count(*)::int FROM (SELECT tc.id::text AS id FROM treatment_cases tc
    JOIN patients p ON p.id = tc.patient_id WHERE tc.organization_id <> p.organization_id) affected) AS affected_count
UNION ALL
SELECT 'APPOINTMENT_TREATMENT_CONTEXT_MISMATCH'::text AS code, true AS blocks_migration,
      (SELECT count(*)::int FROM (SELECT a.id::text AS id FROM appointments a
    JOIN treatment_cases tc ON tc.id=a.treatment_case_id
    WHERE a.patient_id <> tc.patient_id OR a.organization_id <> tc.organization_id) affected) AS affected_count
UNION ALL
SELECT 'TREATMENT_USAGE_AUDIT_INVALID'::text AS code, true AS blocks_migration,
      (SELECT count(*)::int FROM (SELECT a.id::text AS id FROM audit_logs a
    WHERE a.action IN ('APPOINTMENT_CREATE','APPOINTMENT_UPDATE') AND a.new_values->>'treatmentCaseId' IS NOT NULL
      AND (NOT (CASE WHEN ((a.new_values->>'treatmentCaseId') COLLATE "C") ~ '^[1-9][0-9]*$' AND length(a.new_values->>'treatmentCaseId') <= 19 THEN (a.new_values->>'treatmentCaseId')::numeric <= 9223372036854775807 ELSE false END) OR
        (a.new_values->>'patientId' IS NOT NULL AND NOT (CASE WHEN ((a.new_values->>'patientId') COLLATE "C") ~ '^[1-9][0-9]*$' AND length(a.new_values->>'patientId') <= 19 THEN (a.new_values->>'patientId')::numeric <= 9223372036854775807 ELSE false END)))) affected) AS affected_count
UNION ALL
SELECT 'TREATMENT_USAGE_AUDIT_CONTEXT_MISMATCH'::text AS code, true AS blocks_migration,
      (SELECT count(*)::int FROM (SELECT a.id::text AS id FROM audit_logs a
    LEFT JOIN treatment_cases tc ON tc.id = CASE WHEN CASE WHEN ((a.new_values->>'treatmentCaseId') COLLATE "C") ~ '^[1-9][0-9]*$' AND length(a.new_values->>'treatmentCaseId') <= 19 THEN (a.new_values->>'treatmentCaseId')::numeric <= 9223372036854775807 ELSE false END
      THEN (a.new_values->>'treatmentCaseId')::bigint END
    WHERE a.action IN ('APPOINTMENT_CREATE','APPOINTMENT_UPDATE')
      AND (CASE WHEN ((a.new_values->>'treatmentCaseId') COLLATE "C") ~ '^[1-9][0-9]*$' AND length(a.new_values->>'treatmentCaseId') <= 19 THEN (a.new_values->>'treatmentCaseId')::numeric <= 9223372036854775807 ELSE false END) AND (
        tc.id IS NULL OR tc.organization_id <> a.organization_id OR
        (a.new_values->>'patientId' IS NOT NULL AND tc.patient_id::text IS DISTINCT FROM a.new_values->>'patientId'))) affected) AS affected_count)
SELECT * FROM issues ORDER BY code;
ROLLBACK;

