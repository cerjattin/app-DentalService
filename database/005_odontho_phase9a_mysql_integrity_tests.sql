-- ============================================================
-- ODONTHO SERVICES — SVB BILLING APP
-- FASE 9A — MYSQL INTEGRITY TESTS
-- MySQL 8.x / InnoDB
--
-- PURPOSE:
--   Validate physical UNIQUE, CHECK and FK/RESTRICT constraints.
--
-- SAFETY:
--   All fixture data is created inside a transaction and rolled back.
--   Expected constraint violations will appear as ERROR lines in mysql.
--   The mysql SOURCE command normally continues after statement errors.
--
-- IMPORTANT:
--   Run against a development database only.
-- ============================================================

USE odontho_svb_billing;

-- If a previous manual test left a transaction open:
ROLLBACK;

SELECT '=== ODONTHO FASE 9A - MYSQL INTEGRITY TESTS ===' AS test_suite;

-- ------------------------------------------------------------
-- Resolve existing structural seed data
-- ------------------------------------------------------------
SET @org_id := (
  SELECT id
  FROM organizations
  WHERE legal_name = 'Odontho Services B.V.'
  LIMIT 1
);

SET @admin_id := (
  SELECT id
  FROM users
  WHERE email = 'admin@odonthoservices.com'
  LIMIT 1
);

SET @payer_id := (
  SELECT id
  FROM payers
  WHERE code = 'SVB'
  LIMIT 1
);

SET @location_id := (
  SELECT id
  FROM clinic_locations
  WHERE organization_id = @org_id
    AND code = 'MAIN'
  LIMIT 1
);

SELECT
  @org_id AS organization_id,
  @admin_id AS admin_user_id,
  @payer_id AS payer_id,
  @location_id AS location_id;

-- Stop mentally here if any of the IDs above is NULL.
-- The statements below depend on the structural seed being present.

START TRANSACTION;

-- ------------------------------------------------------------
-- Test fixtures
-- ------------------------------------------------------------

INSERT INTO providers (
  organization_id,
  user_id,
  svb_provider_id,
  first_name,
  last_name,
  license_number,
  specialty,
  email,
  is_active
)
VALUES (
  @org_id,
  NULL,
  'TEST-PROVIDER-INTEGRITY',
  'Test',
  'Provider',
  'TEST-LICENSE',
  'General Dentistry',
  'test.provider.integrity@local.invalid',
  TRUE
);
SET @provider_id := LAST_INSERT_ID();

INSERT INTO patients (
  organization_id,
  patient_number,
  first_name,
  last_name,
  date_of_birth,
  document_type,
  document_number,
  country_code,
  status
)
VALUES (
  @org_id,
  'TEST-PAT-INTEGRITY-001',
  'Test',
  'Patient',
  '1990-01-01',
  'TEST',
  'TEST-DOC-INTEGRITY-001',
  'CW',
  'ACTIVE'
);
SET @patient_id := LAST_INSERT_ID();

INSERT INTO patient_insurance (
  patient_id,
  payer_id,
  insured_id,
  valid_from,
  valid_to,
  status,
  is_primary,
  verified_at,
  verified_by_user_id,
  verification_source
)
VALUES (
  @patient_id,
  @payer_id,
  'TEST-INSURED-INTEGRITY-001',
  '2026-01-01',
  '2026-12-31',
  'ACTIVE',
  TRUE,
  NOW(3),
  @admin_id,
  'INTEGRITY_TEST'
);
SET @insurance_id := LAST_INSERT_ID();

INSERT INTO appointments (
  organization_id,
  appointment_number,
  patient_id,
  provider_id,
  clinic_location_id,
  scheduled_start_at,
  scheduled_end_at,
  status,
  reason,
  created_by_user_id
)
VALUES (
  @org_id,
  'TEST-APT-INTEGRITY-001',
  @patient_id,
  @provider_id,
  @location_id,
  '2026-08-20 09:00:00.000',
  '2026-08-20 10:00:00.000',
  'SCHEDULED',
  'Integrity fixture',
  @admin_id
);
SET @appointment_id := LAST_INSERT_ID();

INSERT INTO clinical_encounters (
  appointment_id,
  provider_id,
  status,
  started_at,
  completed_at,
  chief_complaint,
  clinical_notes,
  created_by_user_id
)
VALUES (
  @appointment_id,
  @provider_id,
  'COMPLETED',
  '2026-08-20 09:05:00.000',
  '2026-08-20 09:50:00.000',
  'Integrity fixture',
  'Integrity fixture encounter',
  @admin_id
);
SET @encounter_id := LAST_INSERT_ID();

INSERT INTO svb_procedures (
  code,
  description,
  category,
  unit,
  requires_authorization,
  requires_referral,
  is_active,
  valid_from
)
VALUES (
  'TEST-PROC-INTEGRITY-001',
  'Integrity test procedure',
  'TEST',
  'UNIT',
  FALSE,
  FALSE,
  TRUE,
  '2026-01-01'
);
SET @svb_procedure_id := LAST_INSERT_ID();

INSERT INTO svb_tariffs (
  svb_procedure_id,
  amount,
  currency_code,
  valid_from,
  valid_to,
  is_active
)
VALUES (
  @svb_procedure_id,
  100.00,
  'ANG',
  '2026-01-01',
  '2026-12-31',
  TRUE
);
SET @svb_tariff_id := LAST_INSERT_ID();

INSERT INTO encounter_procedures (
  encounter_id,
  patient_insurance_id,
  svb_procedure_id,
  svb_tariff_id,
  performed_by_provider_id,
  procedure_code_snapshot,
  procedure_description_snapshot,
  provider_id_snapshot,
  insured_id_snapshot,
  unit_tariff_snapshot,
  currency_code_snapshot,
  quantity,
  amount,
  performed_at,
  status,
  created_by_user_id
)
VALUES (
  @encounter_id,
  @insurance_id,
  @svb_procedure_id,
  @svb_tariff_id,
  @provider_id,
  'TEST-PROC-INTEGRITY-001',
  'Integrity test procedure',
  'TEST-PROVIDER-INTEGRITY',
  'TEST-INSURED-INTEGRITY-001',
  100.00,
  'ANG',
  1.00,
  100.00,
  '2026-08-20 09:30:00.000',
  'PERFORMED',
  @admin_id
);
SET @encounter_procedure_id := LAST_INSERT_ID();


INSERT INTO encounter_procedures (
  encounter_id,
  patient_insurance_id,
  svb_procedure_id,
  svb_tariff_id,
  performed_by_provider_id,
  procedure_code_snapshot,
  procedure_description_snapshot,
  provider_id_snapshot,
  insured_id_snapshot,
  unit_tariff_snapshot,
  currency_code_snapshot,
  quantity,
  amount,
  performed_at,
  status,
  created_by_user_id
)
VALUES (
  @encounter_id,
  @insurance_id,
  @svb_procedure_id,
  @svb_tariff_id,
  @provider_id,
  'TEST-PROC-INTEGRITY-001',
  'Integrity test procedure - second performed instance',
  'TEST-PROVIDER-INTEGRITY',
  'TEST-INSURED-INTEGRITY-001',
  100.00,
  'ANG',
  1.00,
  100.00,
  '2026-08-20 09:35:00.000',
  'PERFORMED',
  @admin_id
);
SET @encounter_procedure_id_2 := LAST_INSERT_ID();

INSERT INTO invoices (
  organization_id,
  appointment_id,
  patient_id,
  patient_insurance_id,
  invoice_number,
  status,
  created_by_user_id
)
VALUES (
  @org_id,
  @appointment_id,
  @patient_id,
  @insurance_id,
  'TEST-INV-INTEGRITY-001',
  'DRAFT',
  @admin_id
);
SET @invoice_id := LAST_INSERT_ID();

INSERT INTO invoice_versions (
  invoice_id,
  version_number,
  version_type,
  status,
  invoice_date,
  currency_code,
  total_amount,
  declarant_id_snapshot,
  patient_name_snapshot,
  patient_document_type_snapshot,
  patient_document_number_snapshot,
  insured_id_snapshot,
  prepared_by_user_id
)
VALUES (
  @invoice_id,
  1,
  'ORIGINAL',
  'DRAFT',
  '2026-08-20',
  'ANG',
  100.00,
  'TEST-DECLARANT',
  'Test Patient',
  'TEST',
  'TEST-DOC-INTEGRITY-001',
  'TEST-INSURED-INTEGRITY-001',
  @admin_id
);
SET @invoice_version_id := LAST_INSERT_ID();

UPDATE invoices
SET current_version_id = @invoice_version_id
WHERE id = @invoice_id;

INSERT INTO invoice_items (
  invoice_version_id,
  line_number,
  detail_invoice_number,
  encounter_procedure_id,
  svb_procedure_id,
  svb_tariff_id,
  service_date_snapshot,
  procedure_code_snapshot,
  procedure_description_snapshot,
  provider_id_snapshot,
  insured_id_snapshot,
  unit_tariff_snapshot,
  currency_code_snapshot,
  quantity,
  amount
)
VALUES (
  @invoice_version_id,
  1,
  'TEST-INV-INTEGRITY-001-01',
  @encounter_procedure_id,
  @svb_procedure_id,
  @svb_tariff_id,
  '2026-08-20',
  'TEST-PROC-INTEGRITY-001',
  'Integrity test procedure',
  'TEST-PROVIDER-INTEGRITY',
  'TEST-INSURED-INTEGRITY-001',
  100.00,
  'ANG',
  1.00,
  100.00
);
SET @invoice_item_id := LAST_INSERT_ID();

SELECT
  @provider_id AS provider_id,
  @patient_id AS patient_id,
  @insurance_id AS insurance_id,
  @appointment_id AS appointment_id,
  @encounter_id AS encounter_id,
  @encounter_procedure_id AS encounter_procedure_id,
  @invoice_id AS invoice_id,
  @invoice_version_id AS invoice_version_id,
  @invoice_item_id AS invoice_item_id;

-- ============================================================
-- EXPECTED FAILURES
-- Every statement below MUST return an ERROR.
-- If any one succeeds, that test is a failure.
-- ============================================================

SELECT 'T01 EXPECT ERROR: duplicate patient_number in same organization' AS test;
INSERT INTO patients (
  organization_id, patient_number, first_name, last_name, status
)
VALUES (
  @org_id, 'TEST-PAT-INTEGRITY-001', 'Duplicate', 'Patient', 'ACTIVE'
);

SELECT 'T02 EXPECT ERROR: insurance valid_to before valid_from' AS test;
INSERT INTO patient_insurance (
  patient_id, payer_id, insured_id, valid_from, valid_to, status, is_primary
)
VALUES (
  @patient_id, @payer_id, 'TEST-INS-BAD-DATE', '2026-12-31', '2026-01-01', 'ACTIVE', FALSE
);

SELECT 'T03 EXPECT ERROR: appointment end must be after start' AS test;
INSERT INTO appointments (
  organization_id,
  appointment_number,
  patient_id,
  provider_id,
  clinic_location_id,
  scheduled_start_at,
  scheduled_end_at,
  status,
  created_by_user_id
)
VALUES (
  @org_id,
  'TEST-APT-BAD-TIME',
  @patient_id,
  @provider_id,
  @location_id,
  '2026-08-20 11:00:00',
  '2026-08-20 10:00:00',
  'SCHEDULED',
  @admin_id
);

SELECT 'T04 EXPECT ERROR: CANCELLED appointment requires cancelled_at and cancellation_reason' AS test;
INSERT INTO appointments (
  organization_id,
  appointment_number,
  patient_id,
  provider_id,
  clinic_location_id,
  scheduled_start_at,
  scheduled_end_at,
  status,
  created_by_user_id
)
VALUES (
  @org_id,
  'TEST-APT-BAD-CANCEL',
  @patient_id,
  @provider_id,
  @location_id,
  '2026-08-21 09:00:00',
  '2026-08-21 10:00:00',
  'CANCELLED',
  @admin_id
);

SELECT 'T05 EXPECT ERROR: only one clinical encounter per appointment' AS test;
INSERT INTO clinical_encounters (
  appointment_id,
  provider_id,
  status,
  started_at,
  created_by_user_id
)
VALUES (
  @appointment_id,
  @provider_id,
  'OPEN',
  '2026-08-20 09:10:00',
  @admin_id
);

-- Dedicated appointment fixture for deterministic encounter CHECK testing.
INSERT INTO appointments (
  organization_id,
  appointment_number,
  patient_id,
  provider_id,
  clinic_location_id,
  scheduled_start_at,
  scheduled_end_at,
  status,
  created_by_user_id
)
VALUES (
  @org_id,
  'TEST-APT-ENCOUNTER-CHECK',
  @patient_id,
  @provider_id,
  @location_id,
  '2026-08-22 09:00:00',
  '2026-08-22 10:00:00',
  'SCHEDULED',
  @admin_id
);
SET @appointment_check_id := LAST_INSERT_ID();

SELECT 'T06 EXPECT ERROR: COMPLETED encounter requires completed_at' AS test;
INSERT INTO clinical_encounters (
  appointment_id,
  provider_id,
  status,
  started_at,
  completed_at,
  created_by_user_id
)
VALUES (
  @appointment_check_id,
  @provider_id,
  'COMPLETED',
  '2026-08-22 09:00:00',
  NULL,
  @admin_id
);

SELECT 'T07 EXPECT ERROR: SVB tariff cannot be negative' AS test;
INSERT INTO svb_tariffs (
  svb_procedure_id,
  amount,
  currency_code,
  valid_from,
  is_active
)
VALUES (
  @svb_procedure_id,
  -1.00,
  'ANG',
  '2027-01-01',
  TRUE
);

SELECT 'T08 EXPECT ERROR: performed procedure quantity must be > 0' AS test;
INSERT INTO encounter_procedures (
  encounter_id,
  patient_insurance_id,
  svb_procedure_id,
  svb_tariff_id,
  performed_by_provider_id,
  procedure_code_snapshot,
  procedure_description_snapshot,
  provider_id_snapshot,
  insured_id_snapshot,
  unit_tariff_snapshot,
  currency_code_snapshot,
  quantity,
  amount,
  performed_at,
  status,
  created_by_user_id
)
VALUES (
  @encounter_id,
  @insurance_id,
  @svb_procedure_id,
  @svb_tariff_id,
  @provider_id,
  'TEST-PROC-INTEGRITY-001',
  'Integrity test procedure',
  'TEST-PROVIDER-INTEGRITY',
  'TEST-INSURED-INTEGRITY-001',
  100.00,
  'ANG',
  0.00,
  0.00,
  NOW(3),
  'PERFORMED',
  @admin_id
);

SELECT 'T09 EXPECT ERROR: PERFORMED procedure requires performed_at' AS test;
INSERT INTO encounter_procedures (
  encounter_id,
  patient_insurance_id,
  svb_procedure_id,
  svb_tariff_id,
  performed_by_provider_id,
  procedure_code_snapshot,
  procedure_description_snapshot,
  provider_id_snapshot,
  insured_id_snapshot,
  unit_tariff_snapshot,
  currency_code_snapshot,
  quantity,
  amount,
  performed_at,
  status,
  created_by_user_id
)
VALUES (
  @encounter_id,
  @insurance_id,
  @svb_procedure_id,
  @svb_tariff_id,
  @provider_id,
  'TEST-PROC-INTEGRITY-001',
  'Integrity test procedure',
  'TEST-PROVIDER-INTEGRITY',
  'TEST-INSURED-INTEGRITY-001',
  100.00,
  'ANG',
  1.00,
  100.00,
  NULL,
  'PERFORMED',
  @admin_id
);

SELECT 'T10 EXPECT ERROR: only one logical invoice per appointment' AS test;
INSERT INTO invoices (
  organization_id,
  appointment_id,
  patient_id,
  patient_insurance_id,
  invoice_number,
  status,
  created_by_user_id
)
VALUES (
  @org_id,
  @appointment_id,
  @patient_id,
  @insurance_id,
  'TEST-INV-DUPLICATE',
  'DRAFT',
  @admin_id
);

SELECT 'T11 EXPECT ERROR: CANCELLED invoice requires cancelled_at and cancellation_reason' AS test;
INSERT INTO invoices (
  organization_id,
  appointment_id,
  patient_id,
  patient_insurance_id,
  invoice_number,
  status,
  created_by_user_id
)
VALUES (
  @org_id,
  @appointment_check_id,
  @patient_id,
  @insurance_id,
  'TEST-INV-BAD-CANCEL',
  'CANCELLED',
  @admin_id
);

SELECT 'T12 EXPECT ERROR: invoice version number must be > 0' AS test;
INSERT INTO invoice_versions (
  invoice_id,
  version_number,
  version_type,
  status,
  currency_code,
  total_amount,
  patient_name_snapshot,
  insured_id_snapshot,
  prepared_by_user_id
)
VALUES (
  @invoice_id,
  0,
  'CORRECTION',
  'DRAFT',
  'ANG',
  0.00,
  'Test Patient',
  'TEST-INSURED-INTEGRITY-001',
  @admin_id
);

SELECT 'T13 EXPECT ERROR: duplicate version_number in same invoice' AS test;
INSERT INTO invoice_versions (
  invoice_id,
  version_number,
  version_type,
  status,
  currency_code,
  total_amount,
  patient_name_snapshot,
  insured_id_snapshot,
  prepared_by_user_id
)
VALUES (
  @invoice_id,
  1,
  'CORRECTION',
  'DRAFT',
  'ANG',
  100.00,
  'Test Patient',
  'TEST-INSURED-INTEGRITY-001',
  @admin_id
);

SELECT 'T14 EXPECT ERROR: invoice version total cannot be negative' AS test;
INSERT INTO invoice_versions (
  invoice_id,
  version_number,
  version_type,
  status,
  currency_code,
  total_amount,
  patient_name_snapshot,
  insured_id_snapshot,
  prepared_by_user_id
)
VALUES (
  @invoice_id,
  2,
  'CORRECTION',
  'DRAFT',
  'ANG',
  -1.00,
  'Test Patient',
  'TEST-INSURED-INTEGRITY-001',
  @admin_id
);


-- Create a valid second version exclusively as a fixture for item-level tests.
INSERT INTO invoice_versions (
  invoice_id,
  version_number,
  version_type,
  supersedes_version_id,
  status,
  invoice_date,
  currency_code,
  total_amount,
  patient_name_snapshot,
  insured_id_snapshot,
  prepared_by_user_id
)
VALUES (
  @invoice_id,
  2,
  'CORRECTION',
  @invoice_version_id,
  'DRAFT',
  '2026-08-20',
  'ANG',
  100.00,
  'Test Patient',
  'TEST-INSURED-INTEGRITY-001',
  @admin_id
);
SET @invoice_version_2_id := LAST_INSERT_ID();

SELECT 'T15 EXPECT ERROR: invoice item line_number must be > 0' AS test;
INSERT INTO invoice_items (
  invoice_version_id,
  line_number,
  detail_invoice_number,
  encounter_procedure_id,
  svb_procedure_id,
  svb_tariff_id,
  service_date_snapshot,
  procedure_code_snapshot,
  procedure_description_snapshot,
  provider_id_snapshot,
  insured_id_snapshot,
  unit_tariff_snapshot,
  currency_code_snapshot,
  quantity,
  amount
)
VALUES (
  @invoice_version_2_id,
  0,
  'TEST-BAD-LINE',
  @encounter_procedure_id,
  @svb_procedure_id,
  @svb_tariff_id,
  '2026-08-20',
  'TEST-PROC-INTEGRITY-001',
  'Integrity test procedure',
  'TEST-PROVIDER-INTEGRITY',
  'TEST-INSURED-INTEGRITY-001',
  100.00,
  'ANG',
  1.00,
  100.00
);


-- Valid line used only to test duplicate line_number in version 2.
INSERT INTO invoice_items (
  invoice_version_id,
  line_number,
  detail_invoice_number,
  encounter_procedure_id,
  svb_procedure_id,
  svb_tariff_id,
  service_date_snapshot,
  procedure_code_snapshot,
  procedure_description_snapshot,
  provider_id_snapshot,
  insured_id_snapshot,
  unit_tariff_snapshot,
  currency_code_snapshot,
  quantity,
  amount
)
VALUES (
  @invoice_version_2_id,
  1,
  'TEST-INV-INTEGRITY-001-V2-01',
  @encounter_procedure_id,
  @svb_procedure_id,
  @svb_tariff_id,
  '2026-08-20',
  'TEST-PROC-INTEGRITY-001',
  'Integrity test procedure',
  'TEST-PROVIDER-INTEGRITY',
  'TEST-INSURED-INTEGRITY-001',
  100.00,
  'ANG',
  1.00,
  100.00
);

SELECT 'T16 EXPECT ERROR: duplicate line_number in same invoice version' AS test;
INSERT INTO invoice_items (
  invoice_version_id,
  line_number,
  detail_invoice_number,
  encounter_procedure_id,
  svb_procedure_id,
  svb_tariff_id,
  service_date_snapshot,
  procedure_code_snapshot,
  procedure_description_snapshot,
  provider_id_snapshot,
  insured_id_snapshot,
  unit_tariff_snapshot,
  currency_code_snapshot,
  quantity,
  amount
)
VALUES (
  @invoice_version_2_id,
  1,
  'TEST-DUP-LINE-ALT',
  @encounter_procedure_id_2,
  @svb_procedure_id,
  @svb_tariff_id,
  '2026-08-20',
  'TEST-PROC-INTEGRITY-001',
  'Integrity test procedure',
  'TEST-PROVIDER-INTEGRITY',
  'TEST-INSURED-INTEGRITY-001',
  100.00,
  'ANG',
  1.00,
  100.00
);

SELECT 'T17 EXPECT ERROR: document size must be > 0' AS test;
INSERT INTO documents (
  organization_id,
  document_type,
  storage_provider,
  storage_uri,
  original_filename,
  mime_type,
  size_bytes,
  sha256,
  created_by_user_id
)
VALUES (
  @org_id,
  'OTHER',
  'LOCAL',
  'integrity-test://zero-size',
  'zero.txt',
  'text/plain',
  0,
  REPEAT('a', 64),
  @admin_id
);

SELECT 'T18 EXPECT ERROR: FK must reject nonexistent patient' AS test;
INSERT INTO patient_insurance (
  patient_id,
  payer_id,
  insured_id,
  status,
  is_primary
)
VALUES (
  18446744073709550000,
  @payer_id,
  'TEST-BROKEN-FK',
  'ACTIVE',
  FALSE
);

SELECT 'T19 EXPECT ERROR: RESTRICT must prevent deleting patient with dependent history' AS test;
DELETE FROM patients
WHERE id = @patient_id;

-- Authorization quantity constraint:
INSERT INTO svb_authorizations (
  patient_id,
  patient_insurance_id,
  authorization_id,
  status,
  created_by_user_id
)
VALUES (
  @patient_id,
  @insurance_id,
  'TEST-AUTH-INTEGRITY-001',
  'APPROVED',
  @admin_id
);
SET @authorization_id := LAST_INSERT_ID();

SELECT 'T20 EXPECT ERROR: used authorization quantity cannot exceed authorized quantity' AS test;
INSERT INTO svb_authorization_items (
  authorization_id,
  svb_procedure_id,
  procedure_code_snapshot,
  authorized_quantity,
  used_quantity
)
VALUES (
  @authorization_id,
  @svb_procedure_id,
  'TEST-PROC-INTEGRITY-001',
  2.00,
  3.00
);

-- ------------------------------------------------------------
-- Rollback all valid fixtures
-- ------------------------------------------------------------
ROLLBACK;

SELECT '=== ROLLBACK COMPLETE ===' AS rollback_status;

-- Verify no test fixtures remain.
SELECT
  (SELECT COUNT(*) FROM providers WHERE svb_provider_id = 'TEST-PROVIDER-INTEGRITY') AS test_providers,
  (SELECT COUNT(*) FROM patients WHERE patient_number = 'TEST-PAT-INTEGRITY-001') AS test_patients,
  (SELECT COUNT(*) FROM appointments WHERE appointment_number LIKE 'TEST-APT-%') AS test_appointments,
  (SELECT COUNT(*) FROM svb_procedures WHERE code = 'TEST-PROC-INTEGRITY-001') AS test_svb_procedures,
  (SELECT COUNT(*) FROM invoices WHERE invoice_number LIKE 'TEST-INV-%') AS test_invoices;

SELECT 'Expected final fixture counts: all 0' AS expected_result;
