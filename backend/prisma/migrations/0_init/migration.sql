-- ODONTHO SERVICES — SVB BILLING APP
-- MySQL 8.0.16+ recommended (CHECK constraints enforced from 8.0.16)
-- Schema v0.1 - Initial physical model

SET NAMES utf8mb4;
SET time_zone = '+00:00';



-- =========================================================
-- 01. ORGANIZATION / SECURITY
-- =========================================================

CREATE TABLE organizations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  legal_name VARCHAR(200) NOT NULL,
  trade_name VARCHAR(200) NULL,
  declarant_id VARCHAR(64) NULL,
  registration_number VARCHAR(80) NULL,
  email VARCHAR(320) NULL,
  phone VARCHAR(40) NULL,
  address_line1 VARCHAR(255) NULL,
  address_line2 VARCHAR(255) NULL,
  city VARCHAR(120) NULL,
  country_code CHAR(2) CHARACTER SET ascii NULL,
  timezone VARCHAR(64) NOT NULL DEFAULT 'America/Curacao',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  archived_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_organizations_declarant_id (declarant_id),
  KEY idx_organizations_active (is_active)
) ENGINE=InnoDB;

CREATE TABLE roles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_code (code)
) ENGINE=InnoDB;

CREATE TABLE permissions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(255) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_permissions_code (code)
) ENGINE=InnoDB;

CREATE TABLE users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  email VARCHAR(320) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(120) NOT NULL,
  last_name VARCHAR(120) NOT NULL,
  status ENUM('ACTIVE','INACTIVE','LOCKED') NOT NULL DEFAULT 'ACTIVE',
  last_login_at DATETIME(3) NULL,
  password_changed_at DATETIME(3) NULL,
  failed_login_attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  locked_until DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  archived_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_org_status (organization_id, status),
  CONSTRAINT fk_users_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE user_roles (
  user_id BIGINT UNSIGNED NOT NULL,
  role_id BIGINT UNSIGNED NOT NULL,
  assigned_by_user_id BIGINT UNSIGNED NULL,
  assigned_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, role_id),
  KEY idx_user_roles_role (role_id),
  KEY idx_user_roles_assigned_by (assigned_by_user_id),
  CONSTRAINT fk_user_roles_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_user_roles_role
    FOREIGN KEY (role_id) REFERENCES roles(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_user_roles_assigned_by
    FOREIGN KEY (assigned_by_user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE role_permissions (
  role_id BIGINT UNSIGNED NOT NULL,
  permission_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (role_id, permission_id),
  KEY idx_role_permissions_permission (permission_id),
  CONSTRAINT fk_role_permissions_role
    FOREIGN KEY (role_id) REFERENCES roles(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_role_permissions_permission
    FOREIGN KEY (permission_id) REFERENCES permissions(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE clinic_locations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  policlinic_code VARCHAR(64) NULL,
  address_line1 VARCHAR(255) NULL,
  address_line2 VARCHAR(255) NULL,
  city VARCHAR(120) NULL,
  country_code CHAR(2) CHARACTER SET ascii NOT NULL DEFAULT 'CW',
  phone VARCHAR(40) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  archived_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_locations_org_code (organization_id, code),
  UNIQUE KEY uq_locations_org_policlinic (organization_id, policlinic_code),
  KEY idx_locations_org_active (organization_id, is_active),
  CONSTRAINT fk_locations_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE providers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  svb_provider_id VARCHAR(64) NULL,
  first_name VARCHAR(120) NOT NULL,
  last_name VARCHAR(120) NOT NULL,
  license_number VARCHAR(80) NULL,
  specialty VARCHAR(150) NULL,
  email VARCHAR(320) NULL,
  phone VARCHAR(40) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  archived_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_providers_user (user_id),
  UNIQUE KEY uq_providers_org_svb (organization_id, svb_provider_id),
  KEY idx_providers_org_active (organization_id, is_active),
  CONSTRAINT fk_providers_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_providers_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE referrers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  referrer_identifier VARCHAR(64) NOT NULL,
  first_name VARCHAR(120) NULL,
  last_name VARCHAR(120) NULL,
  organization_name VARCHAR(200) NULL,
  provider_type VARCHAR(100) NULL,
  phone VARCHAR(40) NULL,
  email VARCHAR(320) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_referrers_org_identifier (organization_id, referrer_identifier),
  CONSTRAINT fk_referrers_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE number_sequences (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  sequence_type ENUM('PATIENT','APPOINTMENT','INVOICE','DECLARATION') NOT NULL,
  sequence_year SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  prefix VARCHAR(30) NOT NULL DEFAULT '',
  current_value BIGINT UNSIGNED NOT NULL DEFAULT 0,
  padding TINYINT UNSIGNED NOT NULL DEFAULT 6,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_sequences_org_type_year (organization_id, sequence_type, sequence_year),
  CONSTRAINT ck_sequences_padding CHECK (padding BETWEEN 1 AND 18),
  CONSTRAINT fk_sequences_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

-- =========================================================
-- 02. PATIENT / INSURANCE
-- =========================================================

CREATE TABLE payers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  payer_type ENUM('STATE_INSURANCE','PRIVATE_INSURANCE','OTHER') NOT NULL DEFAULT 'OTHER',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_payers_code (code)
) ENGINE=InnoDB;

CREATE TABLE patients (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  patient_number VARCHAR(50) NOT NULL,
  first_name VARCHAR(120) NOT NULL,
  middle_name VARCHAR(120) NULL,
  last_name VARCHAR(120) NOT NULL,
  second_last_name VARCHAR(120) NULL,
  date_of_birth DATE NULL,
  sex ENUM('FEMALE','MALE','OTHER','UNKNOWN') NULL,
  document_type VARCHAR(50) NULL,
  document_number VARCHAR(80) NULL,
  email VARCHAR(320) NULL,
  phone VARCHAR(40) NULL,
  mobile_phone VARCHAR(40) NULL,
  address_line1 VARCHAR(255) NULL,
  address_line2 VARCHAR(255) NULL,
  city VARCHAR(120) NULL,
  country_code CHAR(2) CHARACTER SET ascii NULL,
  status ENUM('ACTIVE','INACTIVE','ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  archived_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_patients_org_number (organization_id, patient_number),
  UNIQUE KEY uq_patients_org_document (organization_id, document_type, document_number),
  KEY idx_patients_org_name (organization_id, last_name, first_name),
  KEY idx_patients_status (organization_id, status),
  CONSTRAINT fk_patients_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE patient_insurance (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  patient_id BIGINT UNSIGNED NOT NULL,
  payer_id BIGINT UNSIGNED NOT NULL,
  insured_id VARCHAR(80) NOT NULL,
  valid_from DATE NULL,
  valid_to DATE NULL,
  status ENUM('ACTIVE','INACTIVE','EXPIRED','SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  verified_at DATETIME(3) NULL,
  verified_by_user_id BIGINT UNSIGNED NULL,
  verification_source VARCHAR(80) NULL,
  metadata JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_insurance_history (patient_id, payer_id, insured_id, valid_from),
  KEY idx_insurance_patient_status (patient_id, status),
  KEY idx_insurance_payer_insured (payer_id, insured_id),
  CONSTRAINT ck_insurance_dates CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from),
  CONSTRAINT fk_insurance_patient
    FOREIGN KEY (patient_id) REFERENCES patients(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_insurance_payer
    FOREIGN KEY (payer_id) REFERENCES payers(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_insurance_verified_by
    FOREIGN KEY (verified_by_user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

-- =========================================================
-- 03. TREATMENT / ACCIDENT / APPOINTMENTS
-- =========================================================

CREATE TABLE treatment_cases (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  patient_id BIGINT UNSIGNED NOT NULL,
  treatment_id VARCHAR(80) NULL,
  treatment_type VARCHAR(100) NULL,
  description TEXT NULL,
  status ENUM('PLANNED','ACTIVE','COMPLETED','CANCELLED') NOT NULL DEFAULT 'PLANNED',
  started_at DATETIME(3) NULL,
  completed_at DATETIME(3) NULL,
  created_by_user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_treatment_patient_external (patient_id, treatment_id),
  KEY idx_treatment_patient_status (patient_id, status),
  CONSTRAINT ck_treatment_dates CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at),
  CONSTRAINT fk_treatment_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_treatment_patient
    FOREIGN KEY (patient_id) REFERENCES patients(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_treatment_created_by
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE accident_cases (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  patient_id BIGINT UNSIGNED NOT NULL,
  patient_insurance_id BIGINT UNSIGNED NULL,
  accident_form_number VARCHAR(80) NOT NULL,
  accident_date DATE NULL,
  description TEXT NULL,
  status ENUM('OPEN','CLOSED','CANCELLED') NOT NULL DEFAULT 'OPEN',
  created_by_user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_accident_patient_form (patient_id, accident_form_number),
  KEY idx_accident_patient_status (patient_id, status),
  CONSTRAINT fk_accident_patient
    FOREIGN KEY (patient_id) REFERENCES patients(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_accident_insurance
    FOREIGN KEY (patient_insurance_id) REFERENCES patient_insurance(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_accident_created_by
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE appointments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  appointment_number VARCHAR(50) NOT NULL,
  patient_id BIGINT UNSIGNED NOT NULL,
  provider_id BIGINT UNSIGNED NOT NULL,
  clinic_location_id BIGINT UNSIGNED NOT NULL,
  treatment_case_id BIGINT UNSIGNED NULL,
  accident_case_id BIGINT UNSIGNED NULL,
  scheduled_start_at DATETIME(3) NOT NULL,
  scheduled_end_at DATETIME(3) NOT NULL,
  status ENUM('SCHEDULED','CONFIRMED','CHECKED_IN','IN_PROGRESS','COMPLETED','CANCELLED','NO_SHOW') NOT NULL DEFAULT 'SCHEDULED',
  reason VARCHAR(255) NULL,
  notes TEXT NULL,
  created_by_user_id BIGINT UNSIGNED NOT NULL,
  checked_in_at DATETIME(3) NULL,
  started_at DATETIME(3) NULL,
  completed_at DATETIME(3) NULL,
  cancelled_at DATETIME(3) NULL,
  cancellation_reason VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_appointments_org_number (organization_id, appointment_number),
  KEY idx_appointments_provider_time (provider_id, scheduled_start_at, scheduled_end_at),
  KEY idx_appointments_patient_time (patient_id, scheduled_start_at),
  KEY idx_appointments_status_time (status, scheduled_start_at),
  CONSTRAINT ck_appointments_time CHECK (scheduled_end_at > scheduled_start_at),
  CONSTRAINT ck_appointments_cancelled CHECK (
    status <> 'CANCELLED' OR (cancelled_at IS NOT NULL AND cancellation_reason IS NOT NULL)
  ),
  CONSTRAINT ck_appointments_completed CHECK (
    status <> 'COMPLETED' OR completed_at IS NOT NULL
  ),
  CONSTRAINT fk_appointments_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_appointments_patient
    FOREIGN KEY (patient_id) REFERENCES patients(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_appointments_provider
    FOREIGN KEY (provider_id) REFERENCES providers(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_appointments_location
    FOREIGN KEY (clinic_location_id) REFERENCES clinic_locations(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_appointments_treatment
    FOREIGN KEY (treatment_case_id) REFERENCES treatment_cases(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_appointments_accident
    FOREIGN KEY (accident_case_id) REFERENCES accident_cases(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_appointments_created_by
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE appointment_status_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  appointment_id BIGINT UNSIGNED NOT NULL,
  old_status ENUM('SCHEDULED','CONFIRMED','CHECKED_IN','IN_PROGRESS','COMPLETED','CANCELLED','NO_SHOW') NULL,
  new_status ENUM('SCHEDULED','CONFIRMED','CHECKED_IN','IN_PROGRESS','COMPLETED','CANCELLED','NO_SHOW') NOT NULL,
  reason VARCHAR(500) NULL,
  changed_by_user_id BIGINT UNSIGNED NOT NULL,
  changed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  metadata JSON NULL,
  PRIMARY KEY (id),
  KEY idx_appointment_history_appt_time (appointment_id, changed_at),
  CONSTRAINT fk_appointment_history_appointment
    FOREIGN KEY (appointment_id) REFERENCES appointments(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_appointment_history_user
    FOREIGN KEY (changed_by_user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

-- =========================================================
-- 04. CLINICAL
-- =========================================================

CREATE TABLE clinical_encounters (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  appointment_id BIGINT UNSIGNED NOT NULL,
  provider_id BIGINT UNSIGNED NOT NULL,
  status ENUM('OPEN','COMPLETED','VOID') NOT NULL DEFAULT 'OPEN',
  started_at DATETIME(3) NOT NULL,
  completed_at DATETIME(3) NULL,
  chief_complaint TEXT NULL,
  clinical_notes TEXT NULL,
  created_by_user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_encounters_appointment (appointment_id),
  KEY idx_encounters_provider_status (provider_id, status),
  CONSTRAINT ck_encounter_completed CHECK (status <> 'COMPLETED' OR completed_at IS NOT NULL),
  CONSTRAINT ck_encounter_dates CHECK (completed_at IS NULL OR completed_at >= started_at),
  CONSTRAINT fk_encounters_appointment
    FOREIGN KEY (appointment_id) REFERENCES appointments(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_encounters_provider
    FOREIGN KEY (provider_id) REFERENCES providers(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_encounters_created_by
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE diagnosis_codes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code_system VARCHAR(50) NOT NULL,
  code VARCHAR(50) NOT NULL,
  description VARCHAR(500) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  valid_from DATE NULL,
  valid_to DATE NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_diagnosis_system_code (code_system, code),
  CONSTRAINT ck_diagnosis_dates CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from)
) ENGINE=InnoDB;

CREATE TABLE encounter_diagnoses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  encounter_id BIGINT UNSIGNED NOT NULL,
  diagnosis_code_id BIGINT UNSIGNED NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  code_snapshot VARCHAR(50) NOT NULL,
  description_snapshot VARCHAR(500) NOT NULL,
  notes TEXT NULL,
  created_by_user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_encounter_diagnosis (encounter_id, diagnosis_code_id),
  KEY idx_encounter_diagnoses_primary (encounter_id, is_primary),
  CONSTRAINT fk_encounter_diagnoses_encounter
    FOREIGN KEY (encounter_id) REFERENCES clinical_encounters(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_encounter_diagnoses_code
    FOREIGN KEY (diagnosis_code_id) REFERENCES diagnosis_codes(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_encounter_diagnoses_user
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

-- =========================================================
-- 05. SVB CATALOG / TARIFFS / AUTHORIZATIONS
-- =========================================================

CREATE TABLE svb_procedures (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL,
  description VARCHAR(500) NOT NULL,
  category VARCHAR(120) NULL,
  unit VARCHAR(50) NULL,
  requires_authorization BOOLEAN NOT NULL DEFAULT FALSE,
  requires_referral BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  valid_from DATE NULL,
  valid_to DATE NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_svb_procedures_code (code),
  KEY idx_svb_procedures_active (is_active),
  CONSTRAINT ck_svb_procedures_dates CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from)
) ENGINE=InnoDB;

CREATE TABLE svb_tariffs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  svb_procedure_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  currency_code CHAR(3) CHARACTER SET ascii NOT NULL,
  valid_from DATE NOT NULL,
  valid_to DATE NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_svb_tariffs_start (svb_procedure_id, currency_code, valid_from),
  KEY idx_svb_tariffs_lookup (svb_procedure_id, valid_from, valid_to, is_active),
  CONSTRAINT ck_svb_tariffs_amount CHECK (amount >= 0),
  CONSTRAINT ck_svb_tariffs_dates CHECK (valid_to IS NULL OR valid_to >= valid_from),
  CONSTRAINT fk_svb_tariffs_procedure
    FOREIGN KEY (svb_procedure_id) REFERENCES svb_procedures(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE svb_authorizations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  patient_id BIGINT UNSIGNED NOT NULL,
  patient_insurance_id BIGINT UNSIGNED NOT NULL,
  authorization_id VARCHAR(80) NOT NULL,
  status ENUM('PENDING','APPROVED','PARTIALLY_USED','EXHAUSTED','EXPIRED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  valid_from DATE NULL,
  valid_to DATE NULL,
  issued_at DATETIME(3) NULL,
  notes TEXT NULL,
  metadata JSON NULL,
  created_by_user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_svb_authorization_insurance (patient_insurance_id, authorization_id),
  KEY idx_svb_authorization_patient_status (patient_id, status),
  CONSTRAINT ck_svb_authorization_dates CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from),
  CONSTRAINT fk_svb_authorization_patient
    FOREIGN KEY (patient_id) REFERENCES patients(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_svb_authorization_insurance
    FOREIGN KEY (patient_insurance_id) REFERENCES patient_insurance(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_svb_authorization_created_by
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE svb_authorization_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  authorization_id BIGINT UNSIGNED NOT NULL,
  svb_procedure_id BIGINT UNSIGNED NULL,
  procedure_code_snapshot VARCHAR(50) NULL,
  authorized_quantity DECIMAL(10,2) NULL,
  used_quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  valid_from DATE NULL,
  valid_to DATE NULL,
  notes TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_authorization_items_auth (authorization_id),
  KEY idx_authorization_items_procedure (svb_procedure_id),
  CONSTRAINT ck_authorization_item_qty CHECK (
    used_quantity >= 0 AND
    (authorized_quantity IS NULL OR authorized_quantity >= 0) AND
    (authorized_quantity IS NULL OR used_quantity <= authorized_quantity)
  ),
  CONSTRAINT ck_authorization_item_dates CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from),
  CONSTRAINT fk_authorization_items_authorization
    FOREIGN KEY (authorization_id) REFERENCES svb_authorizations(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_authorization_items_procedure
    FOREIGN KEY (svb_procedure_id) REFERENCES svb_procedures(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE encounter_procedures (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  encounter_id BIGINT UNSIGNED NOT NULL,
  patient_insurance_id BIGINT UNSIGNED NOT NULL,
  svb_procedure_id BIGINT UNSIGNED NOT NULL,
  svb_tariff_id BIGINT UNSIGNED NOT NULL,
  authorization_item_id BIGINT UNSIGNED NULL,
  diagnosis_id BIGINT UNSIGNED NULL,
  referrer_id BIGINT UNSIGNED NULL,
  performed_by_provider_id BIGINT UNSIGNED NOT NULL,
  procedure_code_snapshot VARCHAR(50) NOT NULL,
  procedure_description_snapshot VARCHAR(500) NOT NULL,
  provider_id_snapshot VARCHAR(64) NULL,
  insured_id_snapshot VARCHAR(80) NOT NULL,
  unit_tariff_snapshot DECIMAL(15,2) NOT NULL,
  currency_code_snapshot CHAR(3) CHARACTER SET ascii NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  amount DECIMAL(15,2) NOT NULL,
  authorization_id_snapshot VARCHAR(80) NULL,
  diagnostic_code_snapshot VARCHAR(50) NULL,
  treatment_id_snapshot VARCHAR(80) NULL,
  accident_form_number_snapshot VARCHAR(80) NULL,
  number_of_treatments_snapshot INT UNSIGNED NULL,
  assistance_snapshot VARCHAR(100) NULL,
  referrer_id_snapshot VARCHAR(64) NULL,
  policlinic_snapshot VARCHAR(64) NULL,
  performed_at DATETIME(3) NULL,
  additional_note TEXT NULL,
  status ENUM('PLANNED','PERFORMED','VOID') NOT NULL DEFAULT 'PERFORMED',
  created_by_user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_encounter_procedures_encounter_status (encounter_id, status),
  KEY idx_encounter_procedures_svb (svb_procedure_id),
  KEY idx_encounter_procedures_auth (authorization_item_id),
  KEY idx_encounter_procedures_performed (performed_at),
  CONSTRAINT ck_encounter_procedure_qty CHECK (quantity > 0),
  CONSTRAINT ck_encounter_procedure_tariff CHECK (unit_tariff_snapshot >= 0),
  CONSTRAINT ck_encounter_procedure_amount CHECK (amount >= 0),
  CONSTRAINT ck_encounter_procedure_performed CHECK (status <> 'PERFORMED' OR performed_at IS NOT NULL),
  CONSTRAINT fk_encounter_procedures_encounter
    FOREIGN KEY (encounter_id) REFERENCES clinical_encounters(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_encounter_procedures_insurance
    FOREIGN KEY (patient_insurance_id) REFERENCES patient_insurance(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_encounter_procedures_svb_procedure
    FOREIGN KEY (svb_procedure_id) REFERENCES svb_procedures(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_encounter_procedures_tariff
    FOREIGN KEY (svb_tariff_id) REFERENCES svb_tariffs(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_encounter_procedures_auth_item
    FOREIGN KEY (authorization_item_id) REFERENCES svb_authorization_items(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_encounter_procedures_diagnosis
    FOREIGN KEY (diagnosis_id) REFERENCES encounter_diagnoses(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_encounter_procedures_referrer
    FOREIGN KEY (referrer_id) REFERENCES referrers(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_encounter_procedures_provider
    FOREIGN KEY (performed_by_provider_id) REFERENCES providers(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_encounter_procedures_created_by
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

-- =========================================================
-- 06. BILLING / VERSIONING / CORRECTIONS
-- =========================================================

CREATE TABLE invoices (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  appointment_id BIGINT UNSIGNED NOT NULL,
  patient_id BIGINT UNSIGNED NOT NULL,
  patient_insurance_id BIGINT UNSIGNED NOT NULL,
  invoice_number VARCHAR(80) NULL,
  status ENUM('DRAFT','PENDING_SIGNATURE','SIGNED','CLOSED','DECLARED','CORRECTION_REQUIRED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  current_version_id BIGINT UNSIGNED NULL,
  created_by_user_id BIGINT UNSIGNED NOT NULL,
  cancelled_by_user_id BIGINT UNSIGNED NULL,
  cancelled_at DATETIME(3) NULL,
  cancellation_reason VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_invoices_appointment (appointment_id),
  UNIQUE KEY uq_invoices_org_number (organization_id, invoice_number),
  KEY idx_invoices_patient (patient_id, created_at),
  KEY idx_invoices_status (organization_id, status, created_at),
  KEY idx_invoices_current_version (current_version_id),
  CONSTRAINT ck_invoice_cancelled CHECK (
    status <> 'CANCELLED' OR (cancelled_at IS NOT NULL AND cancellation_reason IS NOT NULL)
  ),
  CONSTRAINT fk_invoices_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_invoices_appointment
    FOREIGN KEY (appointment_id) REFERENCES appointments(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_invoices_patient
    FOREIGN KEY (patient_id) REFERENCES patients(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_invoices_insurance
    FOREIGN KEY (patient_insurance_id) REFERENCES patient_insurance(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_invoices_created_by
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_invoices_cancelled_by
    FOREIGN KEY (cancelled_by_user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE invoice_versions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  invoice_id BIGINT UNSIGNED NOT NULL,
  version_number INT UNSIGNED NOT NULL,
  version_type ENUM('ORIGINAL','CORRECTION') NOT NULL DEFAULT 'ORIGINAL',
  supersedes_version_id BIGINT UNSIGNED NULL,
  status ENUM('DRAFT','PENDING_SIGNATURE','SIGNED','CLOSED','SUPERSEDED','VOID') NOT NULL DEFAULT 'DRAFT',
  invoice_date DATE NULL,
  currency_code CHAR(3) CHARACTER SET ascii NOT NULL,
  total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  declarant_id_snapshot VARCHAR(64) NULL,
  patient_name_snapshot VARCHAR(255) NOT NULL,
  patient_document_type_snapshot VARCHAR(50) NULL,
  patient_document_number_snapshot VARCHAR(80) NULL,
  insured_id_snapshot VARCHAR(80) NOT NULL,
  content_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  prepared_by_user_id BIGINT UNSIGNED NOT NULL,
  locked_at DATETIME(3) NULL,
  signed_at DATETIME(3) NULL,
  closed_at DATETIME(3) NULL,
  superseded_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_invoice_versions_number (invoice_id, version_number),
  KEY idx_invoice_versions_status (invoice_id, status),
  KEY idx_invoice_versions_supersedes (supersedes_version_id),
  CONSTRAINT ck_invoice_version_number CHECK (version_number > 0),
  CONSTRAINT ck_invoice_version_total CHECK (total_amount >= 0),
  CONSTRAINT fk_invoice_versions_invoice
    FOREIGN KEY (invoice_id) REFERENCES invoices(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_invoice_versions_supersedes
    FOREIGN KEY (supersedes_version_id) REFERENCES invoice_versions(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_invoice_versions_prepared_by
    FOREIGN KEY (prepared_by_user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

ALTER TABLE invoices
  ADD CONSTRAINT fk_invoices_current_version
    FOREIGN KEY (current_version_id) REFERENCES invoice_versions(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TABLE invoice_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  invoice_version_id BIGINT UNSIGNED NOT NULL,
  line_number INT UNSIGNED NOT NULL,
  detail_invoice_number VARCHAR(100) NULL,
  encounter_procedure_id BIGINT UNSIGNED NOT NULL,
  source_invoice_item_id BIGINT UNSIGNED NULL,
  svb_procedure_id BIGINT UNSIGNED NOT NULL,
  svb_tariff_id BIGINT UNSIGNED NOT NULL,
  service_date_snapshot DATE NOT NULL,
  procedure_code_snapshot VARCHAR(50) NOT NULL,
  procedure_description_snapshot VARCHAR(500) NOT NULL,
  provider_id_snapshot VARCHAR(64) NOT NULL,
  insured_id_snapshot VARCHAR(80) NOT NULL,
  unit_tariff_snapshot DECIMAL(15,2) NOT NULL,
  currency_code_snapshot CHAR(3) CHARACTER SET ascii NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  authorization_id_snapshot VARCHAR(80) NULL,
  diagnostic_code_snapshot VARCHAR(50) NULL,
  treatment_id_snapshot VARCHAR(80) NULL,
  accident_form_number_snapshot VARCHAR(80) NULL,
  number_of_treatments_snapshot INT UNSIGNED NULL,
  assistance_snapshot VARCHAR(100) NULL,
  referrer_id_snapshot VARCHAR(64) NULL,
  policlinic_snapshot VARCHAR(64) NULL,
  additional_note TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_invoice_items_line (invoice_version_id, line_number),
  UNIQUE KEY uq_invoice_items_detail (invoice_version_id, detail_invoice_number),
  UNIQUE KEY uq_invoice_items_source_proc (invoice_version_id, encounter_procedure_id),
  KEY idx_invoice_items_source_item (source_invoice_item_id),
  KEY idx_invoice_items_procedure (svb_procedure_id),
  CONSTRAINT ck_invoice_item_line CHECK (line_number > 0),
  CONSTRAINT ck_invoice_item_qty CHECK (quantity > 0),
  CONSTRAINT ck_invoice_item_tariff CHECK (unit_tariff_snapshot >= 0),
  CONSTRAINT ck_invoice_item_amount CHECK (amount >= 0),
  CONSTRAINT fk_invoice_items_version
    FOREIGN KEY (invoice_version_id) REFERENCES invoice_versions(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_invoice_items_encounter_procedure
    FOREIGN KEY (encounter_procedure_id) REFERENCES encounter_procedures(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_invoice_items_source_item
    FOREIGN KEY (source_invoice_item_id) REFERENCES invoice_items(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_invoice_items_svb_procedure
    FOREIGN KEY (svb_procedure_id) REFERENCES svb_procedures(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_invoice_items_tariff
    FOREIGN KEY (svb_tariff_id) REFERENCES svb_tariffs(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE invoice_status_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  invoice_id BIGINT UNSIGNED NOT NULL,
  invoice_version_id BIGINT UNSIGNED NULL,
  old_status ENUM('DRAFT','PENDING_SIGNATURE','SIGNED','CLOSED','DECLARED','CORRECTION_REQUIRED','CANCELLED') NULL,
  new_status ENUM('DRAFT','PENDING_SIGNATURE','SIGNED','CLOSED','DECLARED','CORRECTION_REQUIRED','CANCELLED') NOT NULL,
  reason VARCHAR(500) NULL,
  changed_by_user_id BIGINT UNSIGNED NOT NULL,
  changed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  metadata JSON NULL,
  PRIMARY KEY (id),
  KEY idx_invoice_history_invoice_time (invoice_id, changed_at),
  CONSTRAINT fk_invoice_history_invoice
    FOREIGN KEY (invoice_id) REFERENCES invoices(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_invoice_history_version
    FOREIGN KEY (invoice_version_id) REFERENCES invoice_versions(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_invoice_history_user
    FOREIGN KEY (changed_by_user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE invoice_corrections (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  invoice_id BIGINT UNSIGNED NOT NULL,
  source_version_id BIGINT UNSIGNED NOT NULL,
  replacement_version_id BIGINT UNSIGNED NULL,
  reason_code VARCHAR(50) NOT NULL,
  reason_text TEXT NOT NULL,
  status ENUM('REQUESTED','APPROVED','APPLIED','REJECTED','CANCELLED') NOT NULL DEFAULT 'REQUESTED',
  requested_by_user_id BIGINT UNSIGNED NOT NULL,
  requested_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  approved_by_user_id BIGINT UNSIGNED NULL,
  approved_at DATETIME(3) NULL,
  resolved_by_user_id BIGINT UNSIGNED NULL,
  resolved_at DATETIME(3) NULL,
  metadata JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_invoice_correction_replacement (replacement_version_id),
  KEY idx_invoice_corrections_invoice_status (invoice_id, status),
  CONSTRAINT fk_invoice_corrections_invoice
    FOREIGN KEY (invoice_id) REFERENCES invoices(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_invoice_corrections_source
    FOREIGN KEY (source_version_id) REFERENCES invoice_versions(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_invoice_corrections_replacement
    FOREIGN KEY (replacement_version_id) REFERENCES invoice_versions(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_invoice_corrections_requested_by
    FOREIGN KEY (requested_by_user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_invoice_corrections_approved_by
    FOREIGN KEY (approved_by_user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_invoice_corrections_resolved_by
    FOREIGN KEY (resolved_by_user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

-- =========================================================
-- 07. DOCUMENTS / SIGNATURES
-- =========================================================

CREATE TABLE documents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  document_type ENUM('SIGNATURE','INVOICE_PDF','SIGNED_INVOICE_PDF','AUTHORIZATION','SUPPORTING_DOCUMENT','DECLARATION_EXPORT','OTHER') NOT NULL,
  storage_provider ENUM('LOCAL','NAS','S3','OTHER') NOT NULL DEFAULT 'LOCAL',
  storage_uri VARCHAR(1024) CHARACTER SET ascii NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(150) NOT NULL,
  size_bytes BIGINT UNSIGNED NOT NULL,
  sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  metadata JSON NULL,
  created_by_user_id BIGINT UNSIGNED NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_documents_storage_uri (storage_uri),
  KEY idx_documents_org_type_time (organization_id, document_type, created_at),
  KEY idx_documents_sha256 (sha256),
  CONSTRAINT ck_documents_size CHECK (size_bytes > 0),
  CONSTRAINT fk_documents_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_documents_created_by
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE signatures (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  invoice_version_id BIGINT UNSIGNED NOT NULL,
  patient_id BIGINT UNSIGNED NOT NULL,
  signature_document_id BIGINT UNSIGNED NOT NULL,
  signature_type ENUM('PATIENT','LEGAL_REPRESENTATIVE','GUARDIAN','OTHER') NOT NULL DEFAULT 'PATIENT',
  signer_name VARCHAR(255) NOT NULL,
  signer_relationship VARCHAR(120) NULL,
  capture_method ENUM('SIGNATURE_PAD','TOUCHSCREEN','MOUSE','UPLOADED','OTHER') NOT NULL,
  signed_content_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  signature_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  status ENUM('VALID','VOID') NOT NULL DEFAULT 'VALID',
  signed_at DATETIME(3) NOT NULL,
  captured_by_user_id BIGINT UNSIGNED NOT NULL,
  device_identifier VARCHAR(255) NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(512) NULL,
  metadata JSON NULL,
  voided_at DATETIME(3) NULL,
  voided_by_user_id BIGINT UNSIGNED NULL,
  void_reason VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_signatures_document (signature_document_id),
  KEY idx_signatures_version_status (invoice_version_id, status),
  CONSTRAINT ck_signature_void CHECK (
    status <> 'VOID' OR (voided_at IS NOT NULL AND voided_by_user_id IS NOT NULL AND void_reason IS NOT NULL)
  ),
  CONSTRAINT fk_signatures_version
    FOREIGN KEY (invoice_version_id) REFERENCES invoice_versions(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_signatures_patient
    FOREIGN KEY (patient_id) REFERENCES patients(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_signatures_document
    FOREIGN KEY (signature_document_id) REFERENCES documents(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_signatures_captured_by
    FOREIGN KEY (captured_by_user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_signatures_voided_by
    FOREIGN KEY (voided_by_user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE invoice_documents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  invoice_version_id BIGINT UNSIGNED NOT NULL,
  document_id BIGINT UNSIGNED NOT NULL,
  document_role ENUM('INVOICE_PDF','SIGNED_INVOICE_PDF','SUPPORTING_DOCUMENT','OTHER') NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_invoice_documents_link (invoice_version_id, document_id, document_role),
  KEY idx_invoice_documents_document (document_id),
  CONSTRAINT fk_invoice_documents_version
    FOREIGN KEY (invoice_version_id) REFERENCES invoice_versions(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_invoice_documents_document
    FOREIGN KEY (document_id) REFERENCES documents(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

-- =========================================================
-- 08. DECLARATIONS / EXPORTS / SUBMISSIONS
-- =========================================================

CREATE TABLE declaration_batches (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  payer_id BIGINT UNSIGNED NOT NULL,
  declaration_number VARCHAR(80) NULL,
  status ENUM('DRAFT','READY','EXPORTED','SUBMITTED','ACCEPTED','PARTIALLY_REJECTED','REJECTED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  period_start DATE NULL,
  period_end DATE NULL,
  declarant_id_snapshot VARCHAR(64) NULL,
  submission_reference VARCHAR(120) NULL,
  notes TEXT NULL,
  created_by_user_id BIGINT UNSIGNED NOT NULL,
  ready_at DATETIME(3) NULL,
  exported_at DATETIME(3) NULL,
  submitted_at DATETIME(3) NULL,
  accepted_at DATETIME(3) NULL,
  rejected_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_declaration_org_number (organization_id, declaration_number),
  KEY idx_declaration_status_time (organization_id, status, created_at),
  CONSTRAINT ck_declaration_period CHECK (period_end IS NULL OR period_start IS NULL OR period_end >= period_start),
  CONSTRAINT fk_declaration_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_declaration_payer
    FOREIGN KEY (payer_id) REFERENCES payers(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_declaration_created_by
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE declaration_batch_status_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  declaration_batch_id BIGINT UNSIGNED NOT NULL,
  old_status ENUM('DRAFT','READY','EXPORTED','SUBMITTED','ACCEPTED','PARTIALLY_REJECTED','REJECTED','CANCELLED') NULL,
  new_status ENUM('DRAFT','READY','EXPORTED','SUBMITTED','ACCEPTED','PARTIALLY_REJECTED','REJECTED','CANCELLED') NOT NULL,
  reason VARCHAR(500) NULL,
  changed_by_user_id BIGINT UNSIGNED NOT NULL,
  changed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  metadata JSON NULL,
  PRIMARY KEY (id),
  KEY idx_declaration_history_batch_time (declaration_batch_id, changed_at),
  CONSTRAINT fk_declaration_history_batch
    FOREIGN KEY (declaration_batch_id) REFERENCES declaration_batches(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_declaration_history_user
    FOREIGN KEY (changed_by_user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE declaration_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  declaration_batch_id BIGINT UNSIGNED NOT NULL,
  invoice_item_id BIGINT UNSIGNED NOT NULL,
  sequence_number INT UNSIGNED NOT NULL,
  line_status ENUM('PENDING','SUBMITTED','ACCEPTED','REJECTED') NOT NULL DEFAULT 'PENDING',
  declarant_id_snapshot VARCHAR(64) NOT NULL,
  invoice_number_snapshot VARCHAR(80) NOT NULL,
  detail_invoice_number_snapshot VARCHAR(100) NOT NULL,
  provider_id_snapshot VARCHAR(64) NOT NULL,
  service_date_snapshot DATE NOT NULL,
  insured_id_snapshot VARCHAR(80) NOT NULL,
  accident_form_number_snapshot VARCHAR(80) NULL,
  treatment_id_snapshot VARCHAR(80) NULL,
  amount_snapshot DECIMAL(15,2) NOT NULL,
  authorization_id_snapshot VARCHAR(80) NULL,
  number_of_treatments_snapshot INT UNSIGNED NULL,
  assistance_snapshot VARCHAR(100) NULL,
  referrer_id_snapshot VARCHAR(64) NULL,
  diagnostic_code_snapshot VARCHAR(50) NULL,
  policlinic_snapshot VARCHAR(64) NULL,
  additional_note_snapshot TEXT NULL,
  response_code VARCHAR(80) NULL,
  response_message VARCHAR(1000) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_declaration_items_sequence (declaration_batch_id, sequence_number),
  UNIQUE KEY uq_declaration_items_invoice_item (declaration_batch_id, invoice_item_id),
  KEY idx_declaration_items_status (declaration_batch_id, line_status),
  KEY idx_declaration_items_invoice (invoice_item_id),
  CONSTRAINT ck_declaration_item_sequence CHECK (sequence_number > 0),
  CONSTRAINT ck_declaration_item_amount CHECK (amount_snapshot >= 0),
  CONSTRAINT fk_declaration_items_batch
    FOREIGN KEY (declaration_batch_id) REFERENCES declaration_batches(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_declaration_items_invoice_item
    FOREIGN KEY (invoice_item_id) REFERENCES invoice_items(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE declaration_exports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  declaration_batch_id BIGINT UNSIGNED NOT NULL,
  document_id BIGINT UNSIGNED NOT NULL,
  format ENUM('CSV','TXT','XLSX','JSON','XML','API_PAYLOAD') NOT NULL,
  schema_version VARCHAR(50) NULL,
  adapter_version VARCHAR(50) NOT NULL,
  record_count INT UNSIGNED NOT NULL,
  exported_by_user_id BIGINT UNSIGNED NOT NULL,
  exported_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  metadata JSON NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_declaration_exports_document (document_id),
  KEY idx_declaration_exports_batch_time (declaration_batch_id, exported_at),
  CONSTRAINT ck_declaration_export_records CHECK (record_count > 0),
  CONSTRAINT fk_declaration_exports_batch
    FOREIGN KEY (declaration_batch_id) REFERENCES declaration_batches(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_declaration_exports_document
    FOREIGN KEY (document_id) REFERENCES documents(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_declaration_exports_user
    FOREIGN KEY (exported_by_user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE declaration_submissions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  declaration_batch_id BIGINT UNSIGNED NOT NULL,
  declaration_export_id BIGINT UNSIGNED NULL,
  attempt_number INT UNSIGNED NOT NULL,
  channel ENUM('PORTAL_UPLOAD','API','MANUAL','OTHER') NOT NULL,
  status ENUM('SUBMITTED','ACCEPTED','PARTIALLY_REJECTED','REJECTED','FAILED') NOT NULL,
  external_reference VARCHAR(120) NULL,
  request_metadata JSON NULL,
  response_metadata JSON NULL,
  submitted_by_user_id BIGINT UNSIGNED NOT NULL,
  submitted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  responded_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_declaration_submission_attempt (declaration_batch_id, attempt_number),
  KEY idx_declaration_submissions_status (declaration_batch_id, status, submitted_at),
  CONSTRAINT ck_declaration_submission_attempt CHECK (attempt_number > 0),
  CONSTRAINT fk_declaration_submissions_batch
    FOREIGN KEY (declaration_batch_id) REFERENCES declaration_batches(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_declaration_submissions_export
    FOREIGN KEY (declaration_export_id) REFERENCES declaration_exports(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_declaration_submissions_user
    FOREIGN KEY (submitted_by_user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

-- =========================================================
-- 09. AUDIT / CONFIGURATION
-- =========================================================

CREATE TABLE audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  actor_user_id BIGINT UNSIGNED NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id BIGINT UNSIGNED NULL,
  entity_key VARCHAR(255) NULL,
  old_values JSON NULL,
  new_values JSON NULL,
  reason TEXT NULL,
  metadata JSON NULL,
  correlation_id VARCHAR(80) NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(512) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_audit_entity (organization_id, entity_type, entity_id, created_at),
  KEY idx_audit_actor_time (actor_user_id, created_at),
  KEY idx_audit_correlation (correlation_id),
  CONSTRAINT fk_audit_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_audit_actor
    FOREIGN KEY (actor_user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE system_settings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  setting_key VARCHAR(120) NOT NULL,
  setting_value JSON NOT NULL,
  description VARCHAR(500) NULL,
  is_secret BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by_user_id BIGINT UNSIGNED NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_system_settings_org_key (organization_id, setting_key),
  CONSTRAINT fk_system_settings_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_system_settings_updated_by
    FOREIGN KEY (updated_by_user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

-- =========================================================
-- END OF INITIAL SCHEMA
-- =========================================================
