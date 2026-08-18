-- ============================================================
-- ODONTHO SERVICES — SVB BILLING APP
-- FASE 9B — CROSS-TABLE CONSISTENCY AUDIT
-- READ-ONLY: this script does not INSERT/UPDATE/DELETE data.
--
-- Every violation_count should be 0.
-- Any value > 0 means a business invariant must be fixed
-- and protected by Backend transactional validation.
-- ============================================================

USE odontho_svb_billing;

SELECT '=== ODONTHO FASE 9B - CONSISTENCY AUDIT ===' AS audit_suite;

-- C01: Appointment treatment case must belong to same patient.
SELECT 'C01 appointment_treatment_patient_mismatch' AS rule_name,
       COUNT(*) AS violation_count
FROM appointments a
JOIN treatment_cases tc ON tc.id = a.treatment_case_id
WHERE a.treatment_case_id IS NOT NULL
  AND tc.patient_id <> a.patient_id

UNION ALL

-- C02: Appointment accident case must belong to same patient.
SELECT 'C02 appointment_accident_patient_mismatch',
       COUNT(*)
FROM appointments a
JOIN accident_cases ac ON ac.id = a.accident_case_id
WHERE a.accident_case_id IS NOT NULL
  AND ac.patient_id <> a.patient_id

UNION ALL

-- C03: Accident insurance must belong to accident patient.
SELECT 'C03 accident_insurance_patient_mismatch',
       COUNT(*)
FROM accident_cases ac
JOIN patient_insurance pi ON pi.id = ac.patient_insurance_id
WHERE ac.patient_insurance_id IS NOT NULL
  AND pi.patient_id <> ac.patient_id

UNION ALL

-- C04: SVB authorization insurance must belong to authorization patient.
SELECT 'C04 authorization_insurance_patient_mismatch',
       COUNT(*)
FROM svb_authorizations sa
JOIN patient_insurance pi ON pi.id = sa.patient_insurance_id
WHERE pi.patient_id <> sa.patient_id

UNION ALL

-- C05: Clinical encounter provider should match appointment provider.
-- A different provider is only valid after appointment reassignment.
SELECT 'C05 encounter_provider_appointment_mismatch',
       COUNT(*)
FROM clinical_encounters ce
JOIN appointments a ON a.id = ce.appointment_id
WHERE ce.provider_id <> a.provider_id

UNION ALL

-- C06: At most one primary diagnosis per clinical encounter.
SELECT 'C06 multiple_primary_diagnoses',
       COUNT(*)
FROM (
  SELECT encounter_id
  FROM encounter_diagnoses
  WHERE is_primary = TRUE
  GROUP BY encounter_id
  HAVING COUNT(*) > 1
) x

UNION ALL

-- C07: Encounter procedure insurance must belong to appointment patient.
SELECT 'C07 procedure_insurance_patient_mismatch',
       COUNT(*)
FROM encounter_procedures ep
JOIN clinical_encounters ce ON ce.id = ep.encounter_id
JOIN appointments a ON a.id = ce.appointment_id
JOIN patient_insurance pi ON pi.id = ep.patient_insurance_id
WHERE pi.patient_id <> a.patient_id

UNION ALL

-- C08: Encounter procedure tariff must belong to selected SVB procedure.
SELECT 'C08 procedure_tariff_procedure_mismatch',
       COUNT(*)
FROM encounter_procedures ep
JOIN svb_tariffs st ON st.id = ep.svb_tariff_id
WHERE st.svb_procedure_id <> ep.svb_procedure_id

UNION ALL

-- C09: Encounter procedure diagnosis must belong to same encounter.
SELECT 'C09 procedure_diagnosis_encounter_mismatch',
       COUNT(*)
FROM encounter_procedures ep
JOIN encounter_diagnoses ed ON ed.id = ep.diagnosis_id
WHERE ep.diagnosis_id IS NOT NULL
  AND ed.encounter_id <> ep.encounter_id

UNION ALL

-- C10: Encounter procedure authorization item must belong to same patient insurance.
SELECT 'C10 procedure_authorization_insurance_mismatch',
       COUNT(*)
FROM encounter_procedures ep
JOIN svb_authorization_items sai ON sai.id = ep.authorization_item_id
JOIN svb_authorizations sa ON sa.id = sai.authorization_id
WHERE ep.authorization_item_id IS NOT NULL
  AND sa.patient_insurance_id <> ep.patient_insurance_id

UNION ALL

-- C11: Encounter procedure authorization item should cover same SVB procedure when specified.
SELECT 'C11 procedure_authorization_procedure_mismatch',
       COUNT(*)
FROM encounter_procedures ep
JOIN svb_authorization_items sai ON sai.id = ep.authorization_item_id
WHERE ep.authorization_item_id IS NOT NULL
  AND sai.svb_procedure_id IS NOT NULL
  AND sai.svb_procedure_id <> ep.svb_procedure_id

UNION ALL

-- C12: Invoice patient must match appointment patient.
SELECT 'C12 invoice_patient_appointment_mismatch',
       COUNT(*)
FROM invoices i
JOIN appointments a ON a.id = i.appointment_id
WHERE i.patient_id <> a.patient_id

UNION ALL

-- C13: Invoice insurance must belong to invoice patient.
SELECT 'C13 invoice_insurance_patient_mismatch',
       COUNT(*)
FROM invoices i
JOIN patient_insurance pi ON pi.id = i.patient_insurance_id
WHERE pi.patient_id <> i.patient_id

UNION ALL

-- C14: Invoice current version must belong to same invoice.
SELECT 'C14 invoice_current_version_mismatch',
       COUNT(*)
FROM invoices i
JOIN invoice_versions iv ON iv.id = i.current_version_id
WHERE i.current_version_id IS NOT NULL
  AND iv.invoice_id <> i.id

UNION ALL

-- C15: A superseded version must belong to same logical invoice.
SELECT 'C15 version_supersedes_other_invoice',
       COUNT(*)
FROM invoice_versions iv
JOIN invoice_versions src ON src.id = iv.supersedes_version_id
WHERE iv.supersedes_version_id IS NOT NULL
  AND src.invoice_id <> iv.invoice_id

UNION ALL

-- C16: Invoice item procedure must originate from same appointment as invoice.
SELECT 'C16 invoice_item_wrong_appointment',
       COUNT(*)
FROM invoice_items ii
JOIN invoice_versions iv ON iv.id = ii.invoice_version_id
JOIN invoices i ON i.id = iv.invoice_id
JOIN encounter_procedures ep ON ep.id = ii.encounter_procedure_id
JOIN clinical_encounters ce ON ce.id = ep.encounter_id
WHERE ce.appointment_id <> i.appointment_id

UNION ALL

-- C17: Invoice item selected tariff must belong to selected procedure.
SELECT 'C17 invoice_item_tariff_procedure_mismatch',
       COUNT(*)
FROM invoice_items ii
JOIN svb_tariffs st ON st.id = ii.svb_tariff_id
WHERE st.svb_procedure_id <> ii.svb_procedure_id

UNION ALL

-- C18: Invoice item procedure reference should match source performed procedure.
SELECT 'C18 invoice_item_source_procedure_mismatch',
       COUNT(*)
FROM invoice_items ii
JOIN encounter_procedures ep ON ep.id = ii.encounter_procedure_id
WHERE ii.svb_procedure_id <> ep.svb_procedure_id

UNION ALL

-- C19: Invoice version total must equal the sum of its lines for versions with items.
SELECT 'C19 invoice_version_total_mismatch',
       COUNT(*)
FROM (
  SELECT
    iv.id,
    iv.total_amount,
    SUM(ii.amount) AS item_total
  FROM invoice_versions iv
  JOIN invoice_items ii ON ii.invoice_version_id = iv.id
  GROUP BY iv.id, iv.total_amount
  HAVING iv.total_amount <> SUM(ii.amount)
) totals

UNION ALL

-- C20: SIGNED/CLOSED/SUPERSEDED versions should have a content hash.
SELECT 'C20 immutable_version_missing_content_hash',
       COUNT(*)
FROM invoice_versions
WHERE status IN ('SIGNED','CLOSED','SUPERSEDED')
  AND (content_hash IS NULL OR CHAR_LENGTH(content_hash) <> 64)

UNION ALL

-- C21: SIGNED/CLOSED versions should have signed_at.
SELECT 'C21 signed_or_closed_version_missing_signed_at',
       COUNT(*)
FROM invoice_versions
WHERE status IN ('SIGNED','CLOSED')
  AND signed_at IS NULL

UNION ALL

-- C22: CLOSED version should have closed_at.
SELECT 'C22 closed_version_missing_closed_at',
       COUNT(*)
FROM invoice_versions
WHERE status = 'CLOSED'
  AND closed_at IS NULL

UNION ALL

-- C23: SIGNED/CLOSED version should have at least one VALID signature.
SELECT 'C23 signed_or_closed_version_without_valid_signature',
       COUNT(*)
FROM invoice_versions iv
WHERE iv.status IN ('SIGNED','CLOSED')
  AND NOT EXISTS (
    SELECT 1
    FROM signatures s
    WHERE s.invoice_version_id = iv.id
      AND s.status = 'VALID'
  )

UNION ALL

-- C24: Signature patient must match invoice patient.
SELECT 'C24 signature_patient_invoice_mismatch',
       COUNT(*)
FROM signatures s
JOIN invoice_versions iv ON iv.id = s.invoice_version_id
JOIN invoices i ON i.id = iv.invoice_id
WHERE s.patient_id <> i.patient_id

UNION ALL

-- C25: Valid signature must sign the current version content hash.
SELECT 'C25 signature_content_hash_mismatch',
       COUNT(*)
FROM signatures s
JOIN invoice_versions iv ON iv.id = s.invoice_version_id
WHERE s.status = 'VALID'
  AND (
    iv.content_hash IS NULL
    OR s.signed_content_hash <> iv.content_hash
  )

UNION ALL

-- C26: Correction source version must belong to correction invoice.
SELECT 'C26 correction_source_version_mismatch',
       COUNT(*)
FROM invoice_corrections ic
JOIN invoice_versions src ON src.id = ic.source_version_id
WHERE src.invoice_id <> ic.invoice_id

UNION ALL

-- C27: Correction replacement version must belong to correction invoice.
SELECT 'C27 correction_replacement_version_mismatch',
       COUNT(*)
FROM invoice_corrections ic
JOIN invoice_versions repl ON repl.id = ic.replacement_version_id
WHERE ic.replacement_version_id IS NOT NULL
  AND repl.invoice_id <> ic.invoice_id

UNION ALL

-- C28: APPLIED correction should have a replacement version and resolution.
SELECT 'C28 applied_correction_incomplete',
       COUNT(*)
FROM invoice_corrections
WHERE status = 'APPLIED'
  AND (
    replacement_version_id IS NULL
    OR resolved_by_user_id IS NULL
    OR resolved_at IS NULL
  )

UNION ALL

-- C29: Overlapping SVB tariffs for same procedure/currency.
SELECT 'C29 overlapping_svb_tariffs',
       COUNT(*)
FROM svb_tariffs a
JOIN svb_tariffs b
  ON a.svb_procedure_id = b.svb_procedure_id
 AND a.currency_code = b.currency_code
 AND a.id < b.id
 AND a.valid_from <= COALESCE(b.valid_to, '9999-12-31')
 AND b.valid_from <= COALESCE(a.valid_to, '9999-12-31')

UNION ALL

-- C30: Overlapping insurance history for same patient/payer/insured ID.
SELECT 'C30 overlapping_patient_insurance',
       COUNT(*)
FROM patient_insurance a
JOIN patient_insurance b
  ON a.patient_id = b.patient_id
 AND a.payer_id = b.payer_id
 AND a.insured_id = b.insured_id
 AND a.id < b.id
 AND COALESCE(a.valid_from, '1000-01-01') <= COALESCE(b.valid_to, '9999-12-31')
 AND COALESCE(b.valid_from, '1000-01-01') <= COALESCE(a.valid_to, '9999-12-31')

UNION ALL

-- C31: Provider schedule overlap, excluding cancelled/no-show appointments.
SELECT 'C31 provider_double_booking',
       COUNT(*)
FROM appointments a
JOIN appointments b
  ON a.provider_id = b.provider_id
 AND a.id < b.id
 AND a.status NOT IN ('CANCELLED','NO_SHOW')
 AND b.status NOT IN ('CANCELLED','NO_SHOW')
 AND a.scheduled_start_at < b.scheduled_end_at
 AND b.scheduled_start_at < a.scheduled_end_at

UNION ALL

-- C32: Invoice item source item must come from the same logical invoice.
SELECT 'C32 invoice_item_source_other_invoice',
       COUNT(*)
FROM invoice_items ii
JOIN invoice_items src ON src.id = ii.source_invoice_item_id
JOIN invoice_versions iv ON iv.id = ii.invoice_version_id
JOIN invoice_versions srcv ON srcv.id = src.invoice_version_id
WHERE ii.source_invoice_item_id IS NOT NULL
  AND iv.invoice_id <> srcv.invoice_id

UNION ALL

-- C33: Declaration item should point to an invoice item whose invoice belongs to same organization.
SELECT 'C33 declaration_item_wrong_organization',
       COUNT(*)
FROM declaration_items di
JOIN declaration_batches db ON db.id = di.declaration_batch_id
JOIN invoice_items ii ON ii.id = di.invoice_item_id
JOIN invoice_versions iv ON iv.id = ii.invoice_version_id
JOIN invoices i ON i.id = iv.invoice_id
WHERE db.organization_id <> i.organization_id

ORDER BY rule_name;

SELECT 'Expected: every violation_count = 0' AS expected_result;
