-- NEG-FINAL-06: structural counts only; no clinical values or repair.
-- Zero findings do not authorize real submission, pilot scope, or master loading.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '10s';
SELECT 'ACCIDENT_INSURANCE_PATIENT_MISMATCH' AS code, count(*) AS affected_count FROM (SELECT ac.id FROM accident_cases ac
    JOIN patient_insurance pi ON pi.id=ac.patient_insurance_id WHERE pi.patient_id<>ac.patient_id) affected
UNION ALL
SELECT 'ACCIDENT_CREATOR_ORGANIZATION_MISMATCH' AS code, count(*) AS affected_count FROM (SELECT ac.id FROM accident_cases ac
    JOIN patients p ON p.id=ac.patient_id JOIN users u ON u.id=ac.created_by_user_id
    WHERE p.organization_id<>u.organization_id) affected
UNION ALL
SELECT 'APPOINTMENT_ACCIDENT_CONTEXT_MISMATCH' AS code, count(*) AS affected_count FROM (SELECT a.id FROM appointments a
    JOIN accident_cases ac ON ac.id=a.accident_case_id JOIN patients p ON p.id=ac.patient_id
    WHERE ac.patient_id<>a.patient_id OR p.organization_id<>a.organization_id
      OR (ac.patient_insurance_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM clinical_encounters ce JOIN encounter_procedures ep ON ep.encounter_id=ce.id
        WHERE ce.appointment_id=a.id AND ep.patient_insurance_id<>ac.patient_insurance_id))) affected
UNION ALL
SELECT 'APPOINTMENT_LOCATION_ORGANIZATION_MISMATCH' AS code, count(*) AS affected_count FROM (SELECT a.id FROM appointments a
    JOIN clinic_locations cl ON cl.id=a.clinic_location_id WHERE cl.organization_id<>a.organization_id) affected
UNION ALL
SELECT 'PROCEDURE_INSURANCE_PATIENT_MISMATCH' AS code, count(*) AS affected_count FROM (SELECT ep.id FROM encounter_procedures ep
    JOIN clinical_encounters ce ON ce.id=ep.encounter_id JOIN appointments a ON a.id=ce.appointment_id
    JOIN patient_insurance pi ON pi.id=ep.patient_insurance_id WHERE pi.patient_id<>a.patient_id) affected
UNION ALL
SELECT 'PROCEDURE_REFERRER_ORGANIZATION_MISMATCH' AS code, count(*) AS affected_count FROM (SELECT ep.id FROM encounter_procedures ep
    JOIN referrers r ON r.id=ep.referrer_id JOIN clinical_encounters ce ON ce.id=ep.encounter_id
    JOIN appointments a ON a.id=ce.appointment_id WHERE r.organization_id<>a.organization_id) affected
UNION ALL
SELECT 'PROCEDURE_TARIFF_PROCEDURE_MISMATCH' AS code, count(*) AS affected_count FROM (SELECT ep.id FROM encounter_procedures ep
    JOIN svb_tariffs t ON t.id=ep.svb_tariff_id WHERE t.svb_procedure_id<>ep.svb_procedure_id) affected
UNION ALL
SELECT 'PROCEDURE_AUTHORIZATION_CONTEXT_MISMATCH' AS code, count(*) AS affected_count FROM (SELECT ep.id FROM encounter_procedures ep
    JOIN clinical_encounters ce ON ce.id=ep.encounter_id JOIN appointments a ON a.id=ce.appointment_id
    JOIN svb_authorization_items ai ON ai.id=ep.authorization_item_id
    JOIN svb_authorizations au ON au.id=ai.authorization_id
    WHERE au.patient_id<>a.patient_id OR au.patient_insurance_id<>ep.patient_insurance_id
      OR (ai.svb_procedure_id IS NOT NULL AND ai.svb_procedure_id<>ep.svb_procedure_id)) affected
UNION ALL
SELECT 'TARIFF_ACTIVE_OVERLAP' AS code, count(*) AS affected_count FROM (SELECT t.id FROM svb_tariffs t WHERE t.is_active AND EXISTS (
    SELECT 1 FROM svb_tariffs x WHERE x.id<>t.id AND x.svb_procedure_id=t.svb_procedure_id
      AND x.currency_code=t.currency_code AND x.is_active
      AND (t.valid_to IS NULL OR x.valid_from<=t.valid_to)
      AND (x.valid_to IS NULL OR t.valid_from<=x.valid_to))) affected
UNION ALL
SELECT 'TARIFF_INVALID_PERIOD' AS code, count(*) AS affected_count FROM (SELECT id FROM svb_tariffs WHERE valid_to<valid_from) affected
UNION ALL
SELECT 'PROCEDURE_INVALID_PERIOD' AS code, count(*) AS affected_count FROM (SELECT id FROM svb_procedures WHERE valid_to<valid_from) affected;
ROLLBACK;

