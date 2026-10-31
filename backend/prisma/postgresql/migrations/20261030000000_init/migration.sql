-- PostgreSQL baseline for a new database; MySQL history remains in prisma/migrations.
-- Never mark the MySQL 0_init as applied here. Apply through Prisma migrate deploy.
BEGIN;
CREATE COLLATION "odontho_ai_ci" (provider = icu, locale = 'und-u-ks-level1', deterministic = false);
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AppointmentStatusHistoryOldStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "DeclarationBatchStatusHistoryOldStatus" AS ENUM ('DRAFT', 'READY', 'EXPORTED', 'SUBMITTED', 'ACCEPTED', 'PARTIALLY_REJECTED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('SIGNATURE', 'INVOICE_PDF', 'SIGNED_INVOICE_PDF', 'AUTHORIZATION', 'SUPPORTING_DOCUMENT', 'DECLARATION_EXPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "NumberSequenceType" AS ENUM ('PATIENT', 'APPOINTMENT', 'INVOICE', 'DECLARATION');

-- CreateEnum
CREATE TYPE "AppointmentStatusHistoryNewStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "ClinicalEncounterStatus" AS ENUM ('OPEN', 'COMPLETED', 'VOID');

-- CreateEnum
CREATE TYPE "DeclarationBatchStatusHistoryNewStatus" AS ENUM ('DRAFT', 'READY', 'EXPORTED', 'SUBMITTED', 'ACCEPTED', 'PARTIALLY_REJECTED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeclarationExportFormat" AS ENUM ('CSV', 'TXT', 'XLSX', 'JSON', 'XML', 'API_PAYLOAD');

-- CreateEnum
CREATE TYPE "DocumentStorageProvider" AS ENUM ('LOCAL', 'NAS', 'S3', 'OTHER');

-- CreateEnum
CREATE TYPE "InvoiceDocumentRole" AS ENUM ('INVOICE_PDF', 'SIGNED_INVOICE_PDF', 'SUPPORTING_DOCUMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "InvoiceStatusHistoryOldStatus" AS ENUM ('DRAFT', 'PENDING_SIGNATURE', 'SIGNED', 'CLOSED', 'DECLARED', 'CORRECTION_REQUIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceVersionType" AS ENUM ('ORIGINAL', 'CORRECTION');

-- CreateEnum
CREATE TYPE "PayerType" AS ENUM ('STATE_INSURANCE', 'PRIVATE_INSURANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "DeclarationBatchStatus" AS ENUM ('DRAFT', 'READY', 'EXPORTED', 'SUBMITTED', 'ACCEPTED', 'PARTIALLY_REJECTED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeclarationItemLineStatus" AS ENUM ('PENDING', 'SUBMITTED', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DeclarationSubmissionChannel" AS ENUM ('PORTAL_UPLOAD', 'API', 'MANUAL', 'OTHER');

-- CreateEnum
CREATE TYPE "InvoiceStatusHistoryNewStatus" AS ENUM ('DRAFT', 'PENDING_SIGNATURE', 'SIGNED', 'CLOSED', 'DECLARED', 'CORRECTION_REQUIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SignatureType" AS ENUM ('PATIENT', 'LEGAL_REPRESENTATIVE', 'GUARDIAN', 'OTHER');

-- CreateEnum
CREATE TYPE "SvbAuthorizationStatus" AS ENUM ('PENDING', 'APPROVED', 'PARTIALLY_USED', 'EXHAUSTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeclarationSubmissionStatus" AS ENUM ('SUBMITTED', 'ACCEPTED', 'PARTIALLY_REJECTED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "InvoiceVersionStatus" AS ENUM ('DRAFT', 'PENDING_SIGNATURE', 'SIGNED', 'CLOSED', 'SUPERSEDED', 'VOID');

-- CreateEnum
CREATE TYPE "AccidentCaseStatus" AS ENUM ('OPEN', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceCorrectionStatus" AS ENUM ('REQUESTED', 'APPROVED', 'APPLIED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'PENDING_SIGNATURE', 'SIGNED', 'CLOSED', 'DECLARED', 'CORRECTION_REQUIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PatientInsuranceStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'EXPIRED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "TreatmentCaseStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'LOCKED');

-- CreateEnum
CREATE TYPE "SignatureCaptureMethod" AS ENUM ('SIGNATURE_PAD', 'TOUCHSCREEN', 'MOUSE', 'UPLOADED', 'OTHER');

-- CreateEnum
CREATE TYPE "PatientSex" AS ENUM ('FEMALE', 'MALE', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "SignatureStatus" AS ENUM ('VALID', 'VOID');

-- CreateEnum
CREATE TYPE "PatientStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EncounterProcedureStatus" AS ENUM ('PLANNED', 'PERFORMED', 'VOID');

-- CreateTable
CREATE TABLE "accident_cases" (
    "id" BIGSERIAL NOT NULL,
    "patient_id" BIGINT NOT NULL,
    "patient_insurance_id" BIGINT,
    "accident_form_number" VARCHAR(80) COLLATE "odontho_ai_ci" NOT NULL,
    "accident_date" DATE,
    "description" TEXT COLLATE "odontho_ai_ci",
    "status" "AccidentCaseStatus" NOT NULL DEFAULT 'OPEN',
    "created_by_user_id" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accident_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_status_history" (
    "id" BIGSERIAL NOT NULL,
    "appointment_id" BIGINT NOT NULL,
    "old_status" "AppointmentStatusHistoryOldStatus",
    "new_status" "AppointmentStatusHistoryNewStatus" NOT NULL,
    "reason" VARCHAR(500) COLLATE "odontho_ai_ci",
    "changed_by_user_id" BIGINT NOT NULL,
    "changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "appointment_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" BIGINT NOT NULL,
    "appointment_number" VARCHAR(50) COLLATE "odontho_ai_ci" NOT NULL,
    "patient_id" BIGINT NOT NULL,
    "provider_id" BIGINT NOT NULL,
    "clinic_location_id" BIGINT NOT NULL,
    "treatment_case_id" BIGINT,
    "accident_case_id" BIGINT,
    "scheduled_start_at" TIMESTAMPTZ(3) NOT NULL,
    "scheduled_end_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "reason" VARCHAR(255) COLLATE "odontho_ai_ci",
    "notes" TEXT COLLATE "odontho_ai_ci",
    "created_by_user_id" BIGINT NOT NULL,
    "checked_in_at" TIMESTAMPTZ(3),
    "started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "cancellation_reason" VARCHAR(500) COLLATE "odontho_ai_ci",
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appointment_number_search" TEXT COLLATE "C" NOT NULL DEFAULT '',
    "reason_search" TEXT COLLATE "C",

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" BIGINT NOT NULL,
    "actor_user_id" BIGINT,
    "action" VARCHAR(80) COLLATE "odontho_ai_ci" NOT NULL,
    "entity_type" VARCHAR(80) COLLATE "odontho_ai_ci" NOT NULL,
    "entity_id" BIGINT,
    "entity_key" VARCHAR(255) COLLATE "odontho_ai_ci",
    "old_values" JSONB,
    "new_values" JSONB,
    "reason" TEXT COLLATE "odontho_ai_ci",
    "metadata" JSONB,
    "correlation_id" VARCHAR(80) COLLATE "odontho_ai_ci",
    "ip_address" VARCHAR(45) COLLATE "odontho_ai_ci",
    "user_agent" VARCHAR(512) COLLATE "odontho_ai_ci",
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entity_key_search" TEXT COLLATE "C",
    "entity_type_search" TEXT COLLATE "C" NOT NULL DEFAULT '',

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinic_locations" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" BIGINT NOT NULL,
    "code" VARCHAR(50) COLLATE "odontho_ai_ci" NOT NULL,
    "name" VARCHAR(150) COLLATE "odontho_ai_ci" NOT NULL,
    "policlinic_code" VARCHAR(64) COLLATE "odontho_ai_ci",
    "address_line1" VARCHAR(255) COLLATE "odontho_ai_ci",
    "address_line2" VARCHAR(255) COLLATE "odontho_ai_ci",
    "city" VARCHAR(120) COLLATE "odontho_ai_ci",
    "country_code" CHAR(2) COLLATE "odontho_ai_ci" NOT NULL DEFAULT 'CW',
    "phone" VARCHAR(40) COLLATE "odontho_ai_ci",
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at" TIMESTAMPTZ(3),
    "code_search" TEXT COLLATE "C" NOT NULL DEFAULT '',

    CONSTRAINT "clinic_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_encounters" (
    "id" BIGSERIAL NOT NULL,
    "appointment_id" BIGINT NOT NULL,
    "provider_id" BIGINT NOT NULL,
    "status" "ClinicalEncounterStatus" NOT NULL DEFAULT 'OPEN',
    "started_at" TIMESTAMPTZ(3) NOT NULL,
    "completed_at" TIMESTAMPTZ(3),
    "chief_complaint" TEXT COLLATE "odontho_ai_ci",
    "clinical_notes" TEXT COLLATE "odontho_ai_ci",
    "created_by_user_id" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinical_encounters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "declaration_batch_status_history" (
    "id" BIGSERIAL NOT NULL,
    "declaration_batch_id" BIGINT NOT NULL,
    "old_status" "DeclarationBatchStatusHistoryOldStatus",
    "new_status" "DeclarationBatchStatusHistoryNewStatus" NOT NULL,
    "reason" VARCHAR(500) COLLATE "odontho_ai_ci",
    "changed_by_user_id" BIGINT NOT NULL,
    "changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "declaration_batch_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "declaration_batches" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" BIGINT NOT NULL,
    "payer_id" BIGINT NOT NULL,
    "declaration_number" VARCHAR(80) COLLATE "odontho_ai_ci",
    "status" "DeclarationBatchStatus" NOT NULL DEFAULT 'DRAFT',
    "period_start" DATE,
    "period_end" DATE,
    "declarant_id_snapshot" VARCHAR(64) COLLATE "odontho_ai_ci",
    "submission_reference" VARCHAR(120) COLLATE "odontho_ai_ci",
    "notes" TEXT COLLATE "odontho_ai_ci",
    "created_by_user_id" BIGINT NOT NULL,
    "ready_at" TIMESTAMPTZ(3),
    "exported_at" TIMESTAMPTZ(3),
    "submitted_at" TIMESTAMPTZ(3),
    "accepted_at" TIMESTAMPTZ(3),
    "rejected_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "declaration_number_search" TEXT COLLATE "C",
    "notes_search" TEXT COLLATE "C",

    CONSTRAINT "declaration_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "declaration_exports" (
    "id" BIGSERIAL NOT NULL,
    "declaration_batch_id" BIGINT NOT NULL,
    "document_id" BIGINT NOT NULL,
    "format" "DeclarationExportFormat" NOT NULL,
    "schema_version" VARCHAR(50) COLLATE "odontho_ai_ci",
    "adapter_version" VARCHAR(50) COLLATE "odontho_ai_ci" NOT NULL,
    "record_count" INTEGER NOT NULL,
    "exported_by_user_id" BIGINT NOT NULL,
    "exported_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "declaration_exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "declaration_items" (
    "id" BIGSERIAL NOT NULL,
    "declaration_batch_id" BIGINT NOT NULL,
    "invoice_item_id" BIGINT NOT NULL,
    "sequence_number" INTEGER NOT NULL,
    "line_status" "DeclarationItemLineStatus" NOT NULL DEFAULT 'PENDING',
    "declarant_id_snapshot" VARCHAR(64) COLLATE "odontho_ai_ci" NOT NULL,
    "invoice_number_snapshot" VARCHAR(80) COLLATE "odontho_ai_ci" NOT NULL,
    "detail_invoice_number_snapshot" VARCHAR(100) COLLATE "odontho_ai_ci" NOT NULL,
    "provider_id_snapshot" VARCHAR(64) COLLATE "odontho_ai_ci" NOT NULL,
    "service_date_snapshot" DATE NOT NULL,
    "insured_id_snapshot" VARCHAR(80) COLLATE "odontho_ai_ci" NOT NULL,
    "accident_form_number_snapshot" VARCHAR(80) COLLATE "odontho_ai_ci",
    "treatment_id_snapshot" VARCHAR(80) COLLATE "odontho_ai_ci",
    "amount_snapshot" DECIMAL(15,2) NOT NULL,
    "authorization_id_snapshot" VARCHAR(80) COLLATE "odontho_ai_ci",
    "number_of_treatments_snapshot" INTEGER,
    "assistance_snapshot" VARCHAR(100) COLLATE "odontho_ai_ci",
    "referrer_id_snapshot" VARCHAR(64) COLLATE "odontho_ai_ci",
    "diagnostic_code_snapshot" VARCHAR(50) COLLATE "odontho_ai_ci",
    "policlinic_snapshot" VARCHAR(64) COLLATE "odontho_ai_ci",
    "additional_note_snapshot" TEXT COLLATE "odontho_ai_ci",
    "response_code" VARCHAR(80) COLLATE "odontho_ai_ci",
    "response_message" VARCHAR(1000) COLLATE "odontho_ai_ci",
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "declaration_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "declaration_submissions" (
    "id" BIGSERIAL NOT NULL,
    "declaration_batch_id" BIGINT NOT NULL,
    "declaration_export_id" BIGINT,
    "attempt_number" INTEGER NOT NULL,
    "channel" "DeclarationSubmissionChannel" NOT NULL,
    "status" "DeclarationSubmissionStatus" NOT NULL,
    "external_reference" VARCHAR(120) COLLATE "odontho_ai_ci",
    "request_metadata" JSONB,
    "response_metadata" JSONB,
    "submitted_by_user_id" BIGINT NOT NULL,
    "submitted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMPTZ(3),

    CONSTRAINT "declaration_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnosis_codes" (
    "id" BIGSERIAL NOT NULL,
    "code_system" VARCHAR(50) COLLATE "odontho_ai_ci" NOT NULL,
    "code" VARCHAR(50) COLLATE "odontho_ai_ci" NOT NULL,
    "description" VARCHAR(500) COLLATE "odontho_ai_ci" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "valid_from" DATE,
    "valid_to" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "code_search" TEXT COLLATE "C" NOT NULL DEFAULT '',
    "description_search" TEXT COLLATE "C" NOT NULL DEFAULT '',

    CONSTRAINT "diagnosis_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" BIGINT NOT NULL,
    "document_type" "DocumentType" NOT NULL,
    "storage_provider" "DocumentStorageProvider" NOT NULL DEFAULT 'LOCAL',
    "storage_uri" VARCHAR(1024) COLLATE "odontho_ai_ci" NOT NULL,
    "original_filename" VARCHAR(255) COLLATE "odontho_ai_ci" NOT NULL,
    "mime_type" VARCHAR(150) COLLATE "odontho_ai_ci" NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "sha256" CHAR(64) COLLATE "C" NOT NULL,
    "metadata" JSONB,
    "created_by_user_id" BIGINT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "original_filename_search" TEXT COLLATE "C" NOT NULL DEFAULT '',
    "storage_uri_search" TEXT COLLATE "C" NOT NULL DEFAULT '',

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encounter_diagnoses" (
    "id" BIGSERIAL NOT NULL,
    "encounter_id" BIGINT NOT NULL,
    "diagnosis_code_id" BIGINT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "code_snapshot" VARCHAR(50) COLLATE "odontho_ai_ci" NOT NULL,
    "description_snapshot" VARCHAR(500) COLLATE "odontho_ai_ci" NOT NULL,
    "notes" TEXT COLLATE "odontho_ai_ci",
    "created_by_user_id" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "code_snapshot_search" TEXT COLLATE "C" NOT NULL DEFAULT '',

    CONSTRAINT "encounter_diagnoses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encounter_procedures" (
    "id" BIGSERIAL NOT NULL,
    "encounter_id" BIGINT NOT NULL,
    "patient_insurance_id" BIGINT NOT NULL,
    "svb_procedure_id" BIGINT NOT NULL,
    "svb_tariff_id" BIGINT NOT NULL,
    "authorization_item_id" BIGINT,
    "diagnosis_id" BIGINT,
    "referrer_id" BIGINT,
    "performed_by_provider_id" BIGINT NOT NULL,
    "procedure_code_snapshot" VARCHAR(50) COLLATE "odontho_ai_ci" NOT NULL,
    "procedure_description_snapshot" VARCHAR(500) COLLATE "odontho_ai_ci" NOT NULL,
    "provider_id_snapshot" VARCHAR(64) COLLATE "odontho_ai_ci",
    "insured_id_snapshot" VARCHAR(80) COLLATE "odontho_ai_ci" NOT NULL,
    "unit_tariff_snapshot" DECIMAL(15,2) NOT NULL,
    "currency_code_snapshot" CHAR(3) COLLATE "odontho_ai_ci" NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1.00,
    "amount" DECIMAL(15,2) NOT NULL,
    "authorization_id_snapshot" VARCHAR(80) COLLATE "odontho_ai_ci",
    "diagnostic_code_snapshot" VARCHAR(50) COLLATE "odontho_ai_ci",
    "treatment_id_snapshot" VARCHAR(80) COLLATE "odontho_ai_ci",
    "accident_form_number_snapshot" VARCHAR(80) COLLATE "odontho_ai_ci",
    "number_of_treatments_snapshot" INTEGER,
    "assistance_snapshot" VARCHAR(100) COLLATE "odontho_ai_ci",
    "referrer_id_snapshot" VARCHAR(64) COLLATE "odontho_ai_ci",
    "policlinic_snapshot" VARCHAR(64) COLLATE "odontho_ai_ci",
    "performed_at" TIMESTAMPTZ(3),
    "additional_note" TEXT COLLATE "odontho_ai_ci",
    "status" "EncounterProcedureStatus" NOT NULL DEFAULT 'PERFORMED',
    "created_by_user_id" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "procedure_code_snapshot_search" TEXT COLLATE "C" NOT NULL DEFAULT '',

    CONSTRAINT "encounter_procedures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_corrections" (
    "id" BIGSERIAL NOT NULL,
    "invoice_id" BIGINT NOT NULL,
    "source_version_id" BIGINT NOT NULL,
    "replacement_version_id" BIGINT,
    "reason_code" VARCHAR(50) COLLATE "odontho_ai_ci" NOT NULL,
    "reason_text" TEXT COLLATE "odontho_ai_ci" NOT NULL,
    "status" "InvoiceCorrectionStatus" NOT NULL DEFAULT 'REQUESTED',
    "requested_by_user_id" BIGINT NOT NULL,
    "requested_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_by_user_id" BIGINT,
    "approved_at" TIMESTAMPTZ(3),
    "resolved_by_user_id" BIGINT,
    "resolved_at" TIMESTAMPTZ(3),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_documents" (
    "id" BIGSERIAL NOT NULL,
    "invoice_version_id" BIGINT NOT NULL,
    "document_id" BIGINT NOT NULL,
    "document_role" "InvoiceDocumentRole" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" BIGSERIAL NOT NULL,
    "invoice_version_id" BIGINT NOT NULL,
    "line_number" INTEGER NOT NULL,
    "detail_invoice_number" VARCHAR(100) COLLATE "odontho_ai_ci",
    "encounter_procedure_id" BIGINT NOT NULL,
    "source_invoice_item_id" BIGINT,
    "svb_procedure_id" BIGINT NOT NULL,
    "svb_tariff_id" BIGINT NOT NULL,
    "service_date_snapshot" DATE NOT NULL,
    "procedure_code_snapshot" VARCHAR(50) COLLATE "odontho_ai_ci" NOT NULL,
    "procedure_description_snapshot" VARCHAR(500) COLLATE "odontho_ai_ci" NOT NULL,
    "provider_id_snapshot" VARCHAR(64) COLLATE "odontho_ai_ci" NOT NULL,
    "insured_id_snapshot" VARCHAR(80) COLLATE "odontho_ai_ci" NOT NULL,
    "unit_tariff_snapshot" DECIMAL(15,2) NOT NULL,
    "currency_code_snapshot" CHAR(3) COLLATE "odontho_ai_ci" NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "authorization_id_snapshot" VARCHAR(80) COLLATE "odontho_ai_ci",
    "diagnostic_code_snapshot" VARCHAR(50) COLLATE "odontho_ai_ci",
    "treatment_id_snapshot" VARCHAR(80) COLLATE "odontho_ai_ci",
    "accident_form_number_snapshot" VARCHAR(80) COLLATE "odontho_ai_ci",
    "number_of_treatments_snapshot" INTEGER,
    "assistance_snapshot" VARCHAR(100) COLLATE "odontho_ai_ci",
    "referrer_id_snapshot" VARCHAR(64) COLLATE "odontho_ai_ci",
    "policlinic_snapshot" VARCHAR(64) COLLATE "odontho_ai_ci",
    "additional_note" TEXT COLLATE "odontho_ai_ci",
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_status_history" (
    "id" BIGSERIAL NOT NULL,
    "invoice_id" BIGINT NOT NULL,
    "invoice_version_id" BIGINT,
    "old_status" "InvoiceStatusHistoryOldStatus",
    "new_status" "InvoiceStatusHistoryNewStatus" NOT NULL,
    "reason" VARCHAR(500) COLLATE "odontho_ai_ci",
    "changed_by_user_id" BIGINT NOT NULL,
    "changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "invoice_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_versions" (
    "id" BIGSERIAL NOT NULL,
    "invoice_id" BIGINT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "version_type" "InvoiceVersionType" NOT NULL DEFAULT 'ORIGINAL',
    "supersedes_version_id" BIGINT,
    "status" "InvoiceVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "invoice_date" DATE,
    "currency_code" CHAR(3) COLLATE "odontho_ai_ci" NOT NULL,
    "total_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "declarant_id_snapshot" VARCHAR(64) COLLATE "odontho_ai_ci",
    "patient_name_snapshot" VARCHAR(255) COLLATE "odontho_ai_ci" NOT NULL,
    "patient_document_type_snapshot" VARCHAR(50) COLLATE "odontho_ai_ci",
    "patient_document_number_snapshot" VARCHAR(80) COLLATE "odontho_ai_ci",
    "insured_id_snapshot" VARCHAR(80) COLLATE "odontho_ai_ci" NOT NULL,
    "content_hash" CHAR(64) COLLATE "C",
    "prepared_by_user_id" BIGINT NOT NULL,
    "locked_at" TIMESTAMPTZ(3),
    "signed_at" TIMESTAMPTZ(3),
    "closed_at" TIMESTAMPTZ(3),
    "superseded_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" BIGINT NOT NULL,
    "appointment_id" BIGINT NOT NULL,
    "patient_id" BIGINT NOT NULL,
    "patient_insurance_id" BIGINT NOT NULL,
    "invoice_number" VARCHAR(80) COLLATE "odontho_ai_ci",
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "current_version_id" BIGINT,
    "created_by_user_id" BIGINT NOT NULL,
    "cancelled_by_user_id" BIGINT,
    "cancelled_at" TIMESTAMPTZ(3),
    "cancellation_reason" VARCHAR(500) COLLATE "odontho_ai_ci",
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invoice_number_search" TEXT COLLATE "C",

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "number_sequences" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" BIGINT NOT NULL,
    "sequence_type" "NumberSequenceType" NOT NULL,
    "sequence_year" INTEGER NOT NULL DEFAULT 0,
    "prefix" VARCHAR(30) COLLATE "odontho_ai_ci" NOT NULL DEFAULT '',
    "current_value" BIGINT NOT NULL DEFAULT 0,
    "padding" INTEGER NOT NULL DEFAULT 6,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "number_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" BIGSERIAL NOT NULL,
    "legal_name" VARCHAR(200) COLLATE "odontho_ai_ci" NOT NULL,
    "trade_name" VARCHAR(200) COLLATE "odontho_ai_ci",
    "declarant_id" VARCHAR(64) COLLATE "odontho_ai_ci",
    "registration_number" VARCHAR(80) COLLATE "odontho_ai_ci",
    "email" VARCHAR(320) COLLATE "odontho_ai_ci",
    "phone" VARCHAR(40) COLLATE "odontho_ai_ci",
    "address_line1" VARCHAR(255) COLLATE "odontho_ai_ci",
    "address_line2" VARCHAR(255) COLLATE "odontho_ai_ci",
    "city" VARCHAR(120) COLLATE "odontho_ai_ci",
    "country_code" CHAR(2) COLLATE "odontho_ai_ci",
    "timezone" VARCHAR(64) COLLATE "odontho_ai_ci" NOT NULL DEFAULT 'America/Curacao',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at" TIMESTAMPTZ(3),
    "legal_name_search" TEXT COLLATE "C" NOT NULL DEFAULT '',
    "declarant_id_search" TEXT COLLATE "C",

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_insurance" (
    "id" BIGSERIAL NOT NULL,
    "patient_id" BIGINT NOT NULL,
    "payer_id" BIGINT NOT NULL,
    "insured_id" VARCHAR(80) COLLATE "odontho_ai_ci" NOT NULL,
    "valid_from" DATE,
    "valid_to" DATE,
    "status" "PatientInsuranceStatus" NOT NULL DEFAULT 'ACTIVE',
    "is_primary" BOOLEAN NOT NULL DEFAULT true,
    "verified_at" TIMESTAMPTZ(3),
    "verified_by_user_id" BIGINT,
    "verification_source" VARCHAR(80) COLLATE "odontho_ai_ci",
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "insured_id_search" TEXT COLLATE "C" NOT NULL DEFAULT '',

    CONSTRAINT "patient_insurance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" BIGINT NOT NULL,
    "patient_number" VARCHAR(50) COLLATE "odontho_ai_ci" NOT NULL,
    "first_name" VARCHAR(120) COLLATE "odontho_ai_ci" NOT NULL,
    "middle_name" VARCHAR(120) COLLATE "odontho_ai_ci",
    "last_name" VARCHAR(120) COLLATE "odontho_ai_ci" NOT NULL,
    "second_last_name" VARCHAR(120) COLLATE "odontho_ai_ci",
    "date_of_birth" DATE,
    "sex" "PatientSex",
    "document_type" VARCHAR(50) COLLATE "odontho_ai_ci",
    "document_number" VARCHAR(80) COLLATE "odontho_ai_ci",
    "email" VARCHAR(320) COLLATE "odontho_ai_ci",
    "phone" VARCHAR(40) COLLATE "odontho_ai_ci",
    "mobile_phone" VARCHAR(40) COLLATE "odontho_ai_ci",
    "address_line1" VARCHAR(255) COLLATE "odontho_ai_ci",
    "address_line2" VARCHAR(255) COLLATE "odontho_ai_ci",
    "city" VARCHAR(120) COLLATE "odontho_ai_ci",
    "country_code" CHAR(2) COLLATE "odontho_ai_ci",
    "status" "PatientStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at" TIMESTAMPTZ(3),
    "patient_number_search" TEXT COLLATE "C" NOT NULL DEFAULT '',
    "first_name_search" TEXT COLLATE "C" NOT NULL DEFAULT '',
    "middle_name_search" TEXT COLLATE "C",
    "last_name_search" TEXT COLLATE "C" NOT NULL DEFAULT '',
    "second_last_name_search" TEXT COLLATE "C",
    "document_number_search" TEXT COLLATE "C",
    "phone_search" TEXT COLLATE "C",
    "mobile_phone_search" TEXT COLLATE "C",

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payers" (
    "id" BIGSERIAL NOT NULL,
    "code" VARCHAR(50) COLLATE "odontho_ai_ci" NOT NULL,
    "name" VARCHAR(150) COLLATE "odontho_ai_ci" NOT NULL,
    "payer_type" "PayerType" NOT NULL DEFAULT 'OTHER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "code_search" TEXT COLLATE "C" NOT NULL DEFAULT '',
    "name_search" TEXT COLLATE "C" NOT NULL DEFAULT '',

    CONSTRAINT "payers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" BIGSERIAL NOT NULL,
    "code" VARCHAR(100) COLLATE "odontho_ai_ci" NOT NULL,
    "name" VARCHAR(120) COLLATE "odontho_ai_ci" NOT NULL,
    "description" VARCHAR(255) COLLATE "odontho_ai_ci",
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "providers" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" BIGINT NOT NULL,
    "user_id" BIGINT,
    "svb_provider_id" VARCHAR(64) COLLATE "odontho_ai_ci",
    "first_name" VARCHAR(120) COLLATE "odontho_ai_ci" NOT NULL,
    "last_name" VARCHAR(120) COLLATE "odontho_ai_ci" NOT NULL,
    "license_number" VARCHAR(80) COLLATE "odontho_ai_ci",
    "specialty" VARCHAR(150) COLLATE "odontho_ai_ci",
    "email" VARCHAR(320) COLLATE "odontho_ai_ci",
    "phone" VARCHAR(40) COLLATE "odontho_ai_ci",
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at" TIMESTAMPTZ(3),
    "first_name_search" TEXT COLLATE "C" NOT NULL DEFAULT '',
    "last_name_search" TEXT COLLATE "C" NOT NULL DEFAULT '',
    "svb_provider_id_search" TEXT COLLATE "C",
    "license_number_search" TEXT COLLATE "C",
    "email_search" TEXT COLLATE "C",
    "phone_search" TEXT COLLATE "C",
    "specialty_search" TEXT COLLATE "C",

    CONSTRAINT "providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrers" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" BIGINT NOT NULL,
    "referrer_identifier" VARCHAR(64) COLLATE "odontho_ai_ci" NOT NULL,
    "first_name" VARCHAR(120) COLLATE "odontho_ai_ci",
    "last_name" VARCHAR(120) COLLATE "odontho_ai_ci",
    "organization_name" VARCHAR(200) COLLATE "odontho_ai_ci",
    "provider_type" VARCHAR(100) COLLATE "odontho_ai_ci",
    "phone" VARCHAR(40) COLLATE "odontho_ai_ci",
    "email" VARCHAR(320) COLLATE "odontho_ai_ci",
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referrers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" BIGINT NOT NULL,
    "permission_id" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" BIGSERIAL NOT NULL,
    "code" VARCHAR(50) COLLATE "odontho_ai_ci" NOT NULL,
    "name" VARCHAR(100) COLLATE "odontho_ai_ci" NOT NULL,
    "description" VARCHAR(255) COLLATE "odontho_ai_ci",
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signatures" (
    "id" BIGSERIAL NOT NULL,
    "invoice_version_id" BIGINT NOT NULL,
    "patient_id" BIGINT NOT NULL,
    "signature_document_id" BIGINT NOT NULL,
    "signature_type" "SignatureType" NOT NULL DEFAULT 'PATIENT',
    "signer_name" VARCHAR(255) COLLATE "odontho_ai_ci" NOT NULL,
    "signer_relationship" VARCHAR(120) COLLATE "odontho_ai_ci",
    "capture_method" "SignatureCaptureMethod" NOT NULL,
    "signed_content_hash" CHAR(64) COLLATE "C" NOT NULL,
    "signature_hash" CHAR(64) COLLATE "C" NOT NULL,
    "status" "SignatureStatus" NOT NULL DEFAULT 'VALID',
    "signed_at" TIMESTAMPTZ(3) NOT NULL,
    "captured_by_user_id" BIGINT NOT NULL,
    "device_identifier" VARCHAR(255) COLLATE "odontho_ai_ci",
    "ip_address" VARCHAR(45) COLLATE "odontho_ai_ci",
    "user_agent" VARCHAR(512) COLLATE "odontho_ai_ci",
    "metadata" JSONB,
    "voided_at" TIMESTAMPTZ(3),
    "voided_by_user_id" BIGINT,
    "void_reason" VARCHAR(500) COLLATE "odontho_ai_ci",
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "svb_authorization_items" (
    "id" BIGSERIAL NOT NULL,
    "authorization_id" BIGINT NOT NULL,
    "svb_procedure_id" BIGINT,
    "procedure_code_snapshot" VARCHAR(50) COLLATE "odontho_ai_ci",
    "authorized_quantity" DECIMAL(10,2),
    "used_quantity" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "valid_from" DATE,
    "valid_to" DATE,
    "notes" TEXT COLLATE "odontho_ai_ci",
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "svb_authorization_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "svb_authorizations" (
    "id" BIGSERIAL NOT NULL,
    "patient_id" BIGINT NOT NULL,
    "patient_insurance_id" BIGINT NOT NULL,
    "authorization_id" VARCHAR(80) COLLATE "odontho_ai_ci" NOT NULL,
    "status" "SvbAuthorizationStatus" NOT NULL DEFAULT 'PENDING',
    "valid_from" DATE,
    "valid_to" DATE,
    "issued_at" TIMESTAMPTZ(3),
    "notes" TEXT COLLATE "odontho_ai_ci",
    "metadata" JSONB,
    "created_by_user_id" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorization_id_search" TEXT COLLATE "C" NOT NULL DEFAULT '',

    CONSTRAINT "svb_authorizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "svb_procedures" (
    "id" BIGSERIAL NOT NULL,
    "code" VARCHAR(50) COLLATE "odontho_ai_ci" NOT NULL,
    "description" VARCHAR(500) COLLATE "odontho_ai_ci" NOT NULL,
    "category" VARCHAR(120) COLLATE "odontho_ai_ci",
    "unit" VARCHAR(50) COLLATE "odontho_ai_ci",
    "requires_authorization" BOOLEAN NOT NULL DEFAULT false,
    "requires_referral" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "valid_from" DATE,
    "valid_to" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "code_search" TEXT COLLATE "C" NOT NULL DEFAULT '',
    "description_search" TEXT COLLATE "C" NOT NULL DEFAULT '',

    CONSTRAINT "svb_procedures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "svb_tariffs" (
    "id" BIGSERIAL NOT NULL,
    "svb_procedure_id" BIGINT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency_code" CHAR(3) COLLATE "odontho_ai_ci" NOT NULL,
    "valid_from" DATE NOT NULL,
    "valid_to" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "svb_tariffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" BIGINT NOT NULL,
    "setting_key" VARCHAR(120) COLLATE "odontho_ai_ci" NOT NULL,
    "setting_value" JSONB NOT NULL,
    "description" VARCHAR(500) COLLATE "odontho_ai_ci",
    "is_secret" BOOLEAN NOT NULL DEFAULT false,
    "updated_by_user_id" BIGINT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treatment_cases" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" BIGINT NOT NULL,
    "patient_id" BIGINT NOT NULL,
    "treatment_id" VARCHAR(80) COLLATE "odontho_ai_ci",
    "treatment_type" VARCHAR(100) COLLATE "odontho_ai_ci",
    "description" TEXT COLLATE "odontho_ai_ci",
    "status" "TreatmentCaseStatus" NOT NULL DEFAULT 'PLANNED',
    "started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "created_by_user_id" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "treatment_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" BIGINT NOT NULL,
    "role_id" BIGINT NOT NULL,
    "assigned_by_user_id" BIGINT,
    "assigned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" BIGINT NOT NULL,
    "email" VARCHAR(320) COLLATE "odontho_ai_ci" NOT NULL,
    "password_hash" VARCHAR(255) COLLATE "C" NOT NULL,
    "first_name" VARCHAR(120) COLLATE "odontho_ai_ci" NOT NULL,
    "last_name" VARCHAR(120) COLLATE "odontho_ai_ci" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_login_at" TIMESTAMPTZ(3),
    "password_changed_at" TIMESTAMPTZ(3),
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at" TIMESTAMPTZ(3),
    "email_search" TEXT COLLATE "C" NOT NULL DEFAULT '',
    "first_name_search" TEXT COLLATE "C" NOT NULL DEFAULT '',
    "last_name_search" TEXT COLLATE "C" NOT NULL DEFAULT '',

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ix_accident_created_by" ON "accident_cases"("created_by_user_id");

-- CreateIndex
CREATE INDEX "ix_accident_insurance" ON "accident_cases"("patient_insurance_id");

-- CreateIndex
CREATE INDEX "idx_accident_patient_status" ON "accident_cases"("patient_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_accident_patient_form" ON "accident_cases"("patient_id", "accident_form_number");

-- CreateIndex
CREATE INDEX "ix_appointment_history_user" ON "appointment_status_history"("changed_by_user_id");

-- CreateIndex
CREATE INDEX "idx_appointment_history_appt_time" ON "appointment_status_history"("appointment_id", "changed_at");

-- CreateIndex
CREATE INDEX "ix_appointments_accident" ON "appointments"("accident_case_id");

-- CreateIndex
CREATE INDEX "ix_appointments_created_by" ON "appointments"("created_by_user_id");

-- CreateIndex
CREATE INDEX "ix_appointments_location" ON "appointments"("clinic_location_id");

-- CreateIndex
CREATE INDEX "ix_appointments_treatment" ON "appointments"("treatment_case_id");

-- CreateIndex
CREATE INDEX "idx_appointments_patient_time" ON "appointments"("patient_id", "scheduled_start_at");

-- CreateIndex
CREATE INDEX "idx_appointments_provider_time" ON "appointments"("provider_id", "scheduled_start_at", "scheduled_end_at");

-- CreateIndex
CREATE INDEX "idx_appointments_status_time" ON "appointments"("status", "scheduled_start_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_appointments_org_number" ON "appointments"("organization_id", "appointment_number");

-- CreateIndex
CREATE INDEX "idx_audit_actor_time" ON "audit_logs"("actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_audit_correlation" ON "audit_logs"("correlation_id");

-- CreateIndex
CREATE INDEX "idx_audit_entity" ON "audit_logs"("organization_id", "entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_locations_org_active" ON "clinic_locations"("organization_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "uq_locations_org_code" ON "clinic_locations"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "uq_locations_org_policlinic" ON "clinic_locations"("organization_id", "policlinic_code");

-- CreateIndex
CREATE UNIQUE INDEX "uq_encounters_appointment" ON "clinical_encounters"("appointment_id");

-- CreateIndex
CREATE INDEX "ix_encounters_created_by" ON "clinical_encounters"("created_by_user_id");

-- CreateIndex
CREATE INDEX "idx_encounters_provider_status" ON "clinical_encounters"("provider_id", "status");

-- CreateIndex
CREATE INDEX "ix_declaration_history_user" ON "declaration_batch_status_history"("changed_by_user_id");

-- CreateIndex
CREATE INDEX "idx_declaration_history_batch_time" ON "declaration_batch_status_history"("declaration_batch_id", "changed_at");

-- CreateIndex
CREATE INDEX "ix_declaration_created_by" ON "declaration_batches"("created_by_user_id");

-- CreateIndex
CREATE INDEX "ix_declaration_payer" ON "declaration_batches"("payer_id");

-- CreateIndex
CREATE INDEX "idx_declaration_status_time" ON "declaration_batches"("organization_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_declaration_org_number" ON "declaration_batches"("organization_id", "declaration_number");

-- CreateIndex
CREATE UNIQUE INDEX "uq_declaration_exports_document" ON "declaration_exports"("document_id");

-- CreateIndex
CREATE INDEX "ix_declaration_exports_user" ON "declaration_exports"("exported_by_user_id");

-- CreateIndex
CREATE INDEX "idx_declaration_exports_batch_time" ON "declaration_exports"("declaration_batch_id", "exported_at");

-- CreateIndex
CREATE INDEX "idx_declaration_items_invoice" ON "declaration_items"("invoice_item_id");

-- CreateIndex
CREATE INDEX "idx_declaration_items_status" ON "declaration_items"("declaration_batch_id", "line_status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_declaration_items_invoice_item" ON "declaration_items"("declaration_batch_id", "invoice_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_declaration_items_sequence" ON "declaration_items"("declaration_batch_id", "sequence_number");

-- CreateIndex
CREATE INDEX "ix_declaration_submissions_export" ON "declaration_submissions"("declaration_export_id");

-- CreateIndex
CREATE INDEX "ix_declaration_submissions_user" ON "declaration_submissions"("submitted_by_user_id");

-- CreateIndex
CREATE INDEX "idx_declaration_submissions_status" ON "declaration_submissions"("declaration_batch_id", "status", "submitted_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_declaration_submission_attempt" ON "declaration_submissions"("declaration_batch_id", "attempt_number");

-- CreateIndex
CREATE UNIQUE INDEX "uq_diagnosis_system_code" ON "diagnosis_codes"("code_system", "code");

-- CreateIndex
CREATE UNIQUE INDEX "uq_documents_storage_uri" ON "documents"("storage_uri");

-- CreateIndex
CREATE INDEX "ix_documents_created_by" ON "documents"("created_by_user_id");

-- CreateIndex
CREATE INDEX "idx_documents_org_type_time" ON "documents"("organization_id", "document_type", "created_at");

-- CreateIndex
CREATE INDEX "idx_documents_sha256" ON "documents"("sha256");

-- CreateIndex
CREATE INDEX "ix_encounter_diagnoses_code" ON "encounter_diagnoses"("diagnosis_code_id");

-- CreateIndex
CREATE INDEX "ix_encounter_diagnoses_user" ON "encounter_diagnoses"("created_by_user_id");

-- CreateIndex
CREATE INDEX "idx_encounter_diagnoses_primary" ON "encounter_diagnoses"("encounter_id", "is_primary");

-- CreateIndex
CREATE UNIQUE INDEX "uq_encounter_diagnosis" ON "encounter_diagnoses"("encounter_id", "diagnosis_code_id");

-- CreateIndex
CREATE INDEX "ix_encounter_procedures_created_by" ON "encounter_procedures"("created_by_user_id");

-- CreateIndex
CREATE INDEX "ix_encounter_procedures_diagnosis" ON "encounter_procedures"("diagnosis_id");

-- CreateIndex
CREATE INDEX "ix_encounter_procedures_insurance" ON "encounter_procedures"("patient_insurance_id");

-- CreateIndex
CREATE INDEX "ix_encounter_procedures_provider" ON "encounter_procedures"("performed_by_provider_id");

-- CreateIndex
CREATE INDEX "ix_encounter_procedures_referrer" ON "encounter_procedures"("referrer_id");

-- CreateIndex
CREATE INDEX "ix_encounter_procedures_tariff" ON "encounter_procedures"("svb_tariff_id");

-- CreateIndex
CREATE INDEX "idx_encounter_procedures_auth" ON "encounter_procedures"("authorization_item_id");

-- CreateIndex
CREATE INDEX "idx_encounter_procedures_encounter_status" ON "encounter_procedures"("encounter_id", "status");

-- CreateIndex
CREATE INDEX "idx_encounter_procedures_performed" ON "encounter_procedures"("performed_at");

-- CreateIndex
CREATE INDEX "idx_encounter_procedures_svb" ON "encounter_procedures"("svb_procedure_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_invoice_correction_replacement" ON "invoice_corrections"("replacement_version_id");

-- CreateIndex
CREATE INDEX "ix_invoice_corrections_approved_by" ON "invoice_corrections"("approved_by_user_id");

-- CreateIndex
CREATE INDEX "ix_invoice_corrections_requested_by" ON "invoice_corrections"("requested_by_user_id");

-- CreateIndex
CREATE INDEX "ix_invoice_corrections_resolved_by" ON "invoice_corrections"("resolved_by_user_id");

-- CreateIndex
CREATE INDEX "ix_invoice_corrections_source" ON "invoice_corrections"("source_version_id");

-- CreateIndex
CREATE INDEX "idx_invoice_corrections_invoice_status" ON "invoice_corrections"("invoice_id", "status");

-- CreateIndex
CREATE INDEX "idx_invoice_documents_document" ON "invoice_documents"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_invoice_documents_link" ON "invoice_documents"("invoice_version_id", "document_id", "document_role");

-- CreateIndex
CREATE INDEX "ix_invoice_items_encounter_procedure" ON "invoice_items"("encounter_procedure_id");

-- CreateIndex
CREATE INDEX "ix_invoice_items_tariff" ON "invoice_items"("svb_tariff_id");

-- CreateIndex
CREATE INDEX "idx_invoice_items_procedure" ON "invoice_items"("svb_procedure_id");

-- CreateIndex
CREATE INDEX "idx_invoice_items_source_item" ON "invoice_items"("source_invoice_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_invoice_items_detail" ON "invoice_items"("invoice_version_id", "detail_invoice_number");

-- CreateIndex
CREATE UNIQUE INDEX "uq_invoice_items_line" ON "invoice_items"("invoice_version_id", "line_number");

-- CreateIndex
CREATE UNIQUE INDEX "uq_invoice_items_source_proc" ON "invoice_items"("invoice_version_id", "encounter_procedure_id");

-- CreateIndex
CREATE INDEX "ix_invoice_history_user" ON "invoice_status_history"("changed_by_user_id");

-- CreateIndex
CREATE INDEX "ix_invoice_history_version" ON "invoice_status_history"("invoice_version_id");

-- CreateIndex
CREATE INDEX "idx_invoice_history_invoice_time" ON "invoice_status_history"("invoice_id", "changed_at");

-- CreateIndex
CREATE INDEX "ix_invoice_versions_prepared_by" ON "invoice_versions"("prepared_by_user_id");

-- CreateIndex
CREATE INDEX "idx_invoice_versions_status" ON "invoice_versions"("invoice_id", "status");

-- CreateIndex
CREATE INDEX "idx_invoice_versions_supersedes" ON "invoice_versions"("supersedes_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_invoice_versions_number" ON "invoice_versions"("invoice_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "uq_invoices_appointment" ON "invoices"("appointment_id");

-- CreateIndex
CREATE INDEX "ix_invoices_cancelled_by" ON "invoices"("cancelled_by_user_id");

-- CreateIndex
CREATE INDEX "ix_invoices_created_by" ON "invoices"("created_by_user_id");

-- CreateIndex
CREATE INDEX "ix_invoices_insurance" ON "invoices"("patient_insurance_id");

-- CreateIndex
CREATE INDEX "idx_invoices_current_version" ON "invoices"("current_version_id");

-- CreateIndex
CREATE INDEX "idx_invoices_patient" ON "invoices"("patient_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_invoices_status" ON "invoices"("organization_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_invoices_org_number" ON "invoices"("organization_id", "invoice_number");

-- CreateIndex
CREATE UNIQUE INDEX "uq_sequences_org_type_year" ON "number_sequences"("organization_id", "sequence_type", "sequence_year");

-- CreateIndex
CREATE UNIQUE INDEX "uq_organizations_declarant_id" ON "organizations"("declarant_id");

-- CreateIndex
CREATE INDEX "idx_organizations_active" ON "organizations"("is_active");

-- CreateIndex
CREATE INDEX "ix_insurance_verified_by" ON "patient_insurance"("verified_by_user_id");

-- CreateIndex
CREATE INDEX "idx_insurance_patient_status" ON "patient_insurance"("patient_id", "status");

-- CreateIndex
CREATE INDEX "idx_insurance_payer_insured" ON "patient_insurance"("payer_id", "insured_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_insurance_history" ON "patient_insurance"("patient_id", "payer_id", "insured_id", "valid_from");

-- CreateIndex
CREATE INDEX "idx_patients_org_name" ON "patients"("organization_id", "last_name", "first_name");

-- CreateIndex
CREATE INDEX "idx_patients_status" ON "patients"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_patients_org_document" ON "patients"("organization_id", "document_type", "document_number");

-- CreateIndex
CREATE UNIQUE INDEX "uq_patients_org_number" ON "patients"("organization_id", "patient_number");

-- CreateIndex
CREATE UNIQUE INDEX "uq_payers_code" ON "payers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "uq_permissions_code" ON "permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "uq_providers_user" ON "providers"("user_id");

-- CreateIndex
CREATE INDEX "idx_providers_org_active" ON "providers"("organization_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "uq_providers_org_svb" ON "providers"("organization_id", "svb_provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_referrers_org_identifier" ON "referrers"("organization_id", "referrer_identifier");

-- CreateIndex
CREATE INDEX "idx_role_permissions_permission" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_roles_code" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "uq_signatures_document" ON "signatures"("signature_document_id");

-- CreateIndex
CREATE INDEX "ix_signatures_captured_by" ON "signatures"("captured_by_user_id");

-- CreateIndex
CREATE INDEX "ix_signatures_patient" ON "signatures"("patient_id");

-- CreateIndex
CREATE INDEX "ix_signatures_voided_by" ON "signatures"("voided_by_user_id");

-- CreateIndex
CREATE INDEX "idx_signatures_version_status" ON "signatures"("invoice_version_id", "status");

-- CreateIndex
CREATE INDEX "idx_authorization_items_auth" ON "svb_authorization_items"("authorization_id");

-- CreateIndex
CREATE INDEX "idx_authorization_items_procedure" ON "svb_authorization_items"("svb_procedure_id");

-- CreateIndex
CREATE INDEX "ix_svb_authorization_created_by" ON "svb_authorizations"("created_by_user_id");

-- CreateIndex
CREATE INDEX "idx_svb_authorization_patient_status" ON "svb_authorizations"("patient_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_svb_authorization_insurance" ON "svb_authorizations"("patient_insurance_id", "authorization_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_svb_procedures_code" ON "svb_procedures"("code");

-- CreateIndex
CREATE INDEX "idx_svb_procedures_active" ON "svb_procedures"("is_active");

-- CreateIndex
CREATE INDEX "idx_svb_tariffs_lookup" ON "svb_tariffs"("svb_procedure_id", "valid_from", "valid_to", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "uq_svb_tariffs_start" ON "svb_tariffs"("svb_procedure_id", "currency_code", "valid_from");

-- CreateIndex
CREATE INDEX "ix_system_settings_updated_by" ON "system_settings"("updated_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_system_settings_org_key" ON "system_settings"("organization_id", "setting_key");

-- CreateIndex
CREATE INDEX "ix_treatment_created_by" ON "treatment_cases"("created_by_user_id");

-- CreateIndex
CREATE INDEX "ix_treatment_organization" ON "treatment_cases"("organization_id");

-- CreateIndex
CREATE INDEX "idx_treatment_patient_status" ON "treatment_cases"("patient_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_treatment_patient_external" ON "treatment_cases"("patient_id", "treatment_id");

-- CreateIndex
CREATE INDEX "idx_user_roles_assigned_by" ON "user_roles"("assigned_by_user_id");

-- CreateIndex
CREATE INDEX "idx_user_roles_role" ON "user_roles"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_users_email" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_users_org_status" ON "users"("organization_id", "status");

-- AddForeignKey
ALTER TABLE "accident_cases" ADD CONSTRAINT "fk_accident_created_by" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "accident_cases" ADD CONSTRAINT "fk_accident_insurance" FOREIGN KEY ("patient_insurance_id") REFERENCES "patient_insurance"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "accident_cases" ADD CONSTRAINT "fk_accident_patient" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "appointment_status_history" ADD CONSTRAINT "fk_appointment_history_appointment" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "appointment_status_history" ADD CONSTRAINT "fk_appointment_history_user" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "fk_appointments_accident" FOREIGN KEY ("accident_case_id") REFERENCES "accident_cases"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "fk_appointments_created_by" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "fk_appointments_location" FOREIGN KEY ("clinic_location_id") REFERENCES "clinic_locations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "fk_appointments_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "fk_appointments_patient" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "fk_appointments_provider" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "fk_appointments_treatment" FOREIGN KEY ("treatment_case_id") REFERENCES "treatment_cases"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "fk_audit_actor" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "fk_audit_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "clinic_locations" ADD CONSTRAINT "fk_locations_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "clinical_encounters" ADD CONSTRAINT "fk_encounters_appointment" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "clinical_encounters" ADD CONSTRAINT "fk_encounters_created_by" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "clinical_encounters" ADD CONSTRAINT "fk_encounters_provider" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "declaration_batch_status_history" ADD CONSTRAINT "fk_declaration_history_batch" FOREIGN KEY ("declaration_batch_id") REFERENCES "declaration_batches"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "declaration_batch_status_history" ADD CONSTRAINT "fk_declaration_history_user" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "declaration_batches" ADD CONSTRAINT "fk_declaration_created_by" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "declaration_batches" ADD CONSTRAINT "fk_declaration_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "declaration_batches" ADD CONSTRAINT "fk_declaration_payer" FOREIGN KEY ("payer_id") REFERENCES "payers"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "declaration_exports" ADD CONSTRAINT "fk_declaration_exports_batch" FOREIGN KEY ("declaration_batch_id") REFERENCES "declaration_batches"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "declaration_exports" ADD CONSTRAINT "fk_declaration_exports_document" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "declaration_exports" ADD CONSTRAINT "fk_declaration_exports_user" FOREIGN KEY ("exported_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "declaration_items" ADD CONSTRAINT "fk_declaration_items_batch" FOREIGN KEY ("declaration_batch_id") REFERENCES "declaration_batches"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "declaration_items" ADD CONSTRAINT "fk_declaration_items_invoice_item" FOREIGN KEY ("invoice_item_id") REFERENCES "invoice_items"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "declaration_submissions" ADD CONSTRAINT "fk_declaration_submissions_batch" FOREIGN KEY ("declaration_batch_id") REFERENCES "declaration_batches"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "declaration_submissions" ADD CONSTRAINT "fk_declaration_submissions_export" FOREIGN KEY ("declaration_export_id") REFERENCES "declaration_exports"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "declaration_submissions" ADD CONSTRAINT "fk_declaration_submissions_user" FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "fk_documents_created_by" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "fk_documents_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "encounter_diagnoses" ADD CONSTRAINT "fk_encounter_diagnoses_code" FOREIGN KEY ("diagnosis_code_id") REFERENCES "diagnosis_codes"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "encounter_diagnoses" ADD CONSTRAINT "fk_encounter_diagnoses_encounter" FOREIGN KEY ("encounter_id") REFERENCES "clinical_encounters"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "encounter_diagnoses" ADD CONSTRAINT "fk_encounter_diagnoses_user" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "encounter_procedures" ADD CONSTRAINT "fk_encounter_procedures_auth_item" FOREIGN KEY ("authorization_item_id") REFERENCES "svb_authorization_items"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "encounter_procedures" ADD CONSTRAINT "fk_encounter_procedures_created_by" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "encounter_procedures" ADD CONSTRAINT "fk_encounter_procedures_diagnosis" FOREIGN KEY ("diagnosis_id") REFERENCES "encounter_diagnoses"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "encounter_procedures" ADD CONSTRAINT "fk_encounter_procedures_encounter" FOREIGN KEY ("encounter_id") REFERENCES "clinical_encounters"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "encounter_procedures" ADD CONSTRAINT "fk_encounter_procedures_insurance" FOREIGN KEY ("patient_insurance_id") REFERENCES "patient_insurance"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "encounter_procedures" ADD CONSTRAINT "fk_encounter_procedures_provider" FOREIGN KEY ("performed_by_provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "encounter_procedures" ADD CONSTRAINT "fk_encounter_procedures_referrer" FOREIGN KEY ("referrer_id") REFERENCES "referrers"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "encounter_procedures" ADD CONSTRAINT "fk_encounter_procedures_svb_procedure" FOREIGN KEY ("svb_procedure_id") REFERENCES "svb_procedures"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "encounter_procedures" ADD CONSTRAINT "fk_encounter_procedures_tariff" FOREIGN KEY ("svb_tariff_id") REFERENCES "svb_tariffs"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "invoice_corrections" ADD CONSTRAINT "fk_invoice_corrections_approved_by" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "invoice_corrections" ADD CONSTRAINT "fk_invoice_corrections_invoice" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "invoice_corrections" ADD CONSTRAINT "fk_invoice_corrections_replacement" FOREIGN KEY ("replacement_version_id") REFERENCES "invoice_versions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "invoice_corrections" ADD CONSTRAINT "fk_invoice_corrections_requested_by" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "invoice_corrections" ADD CONSTRAINT "fk_invoice_corrections_resolved_by" FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "invoice_corrections" ADD CONSTRAINT "fk_invoice_corrections_source" FOREIGN KEY ("source_version_id") REFERENCES "invoice_versions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "invoice_documents" ADD CONSTRAINT "fk_invoice_documents_document" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "invoice_documents" ADD CONSTRAINT "fk_invoice_documents_version" FOREIGN KEY ("invoice_version_id") REFERENCES "invoice_versions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "fk_invoice_items_encounter_procedure" FOREIGN KEY ("encounter_procedure_id") REFERENCES "encounter_procedures"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "fk_invoice_items_source_item" FOREIGN KEY ("source_invoice_item_id") REFERENCES "invoice_items"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "fk_invoice_items_svb_procedure" FOREIGN KEY ("svb_procedure_id") REFERENCES "svb_procedures"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "fk_invoice_items_tariff" FOREIGN KEY ("svb_tariff_id") REFERENCES "svb_tariffs"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "fk_invoice_items_version" FOREIGN KEY ("invoice_version_id") REFERENCES "invoice_versions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "invoice_status_history" ADD CONSTRAINT "fk_invoice_history_invoice" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "invoice_status_history" ADD CONSTRAINT "fk_invoice_history_user" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "invoice_status_history" ADD CONSTRAINT "fk_invoice_history_version" FOREIGN KEY ("invoice_version_id") REFERENCES "invoice_versions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "invoice_versions" ADD CONSTRAINT "fk_invoice_versions_invoice" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "invoice_versions" ADD CONSTRAINT "fk_invoice_versions_prepared_by" FOREIGN KEY ("prepared_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "invoice_versions" ADD CONSTRAINT "fk_invoice_versions_supersedes" FOREIGN KEY ("supersedes_version_id") REFERENCES "invoice_versions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "fk_invoices_appointment" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "fk_invoices_cancelled_by" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "fk_invoices_created_by" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "fk_invoices_current_version" FOREIGN KEY ("current_version_id") REFERENCES "invoice_versions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "fk_invoices_insurance" FOREIGN KEY ("patient_insurance_id") REFERENCES "patient_insurance"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "fk_invoices_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "fk_invoices_patient" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "number_sequences" ADD CONSTRAINT "fk_sequences_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "patient_insurance" ADD CONSTRAINT "fk_insurance_patient" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "patient_insurance" ADD CONSTRAINT "fk_insurance_payer" FOREIGN KEY ("payer_id") REFERENCES "payers"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "patient_insurance" ADD CONSTRAINT "fk_insurance_verified_by" FOREIGN KEY ("verified_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "fk_patients_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "providers" ADD CONSTRAINT "fk_providers_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "providers" ADD CONSTRAINT "fk_providers_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "referrers" ADD CONSTRAINT "fk_referrers_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "fk_role_permissions_permission" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "fk_role_permissions_role" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "fk_signatures_captured_by" FOREIGN KEY ("captured_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "fk_signatures_document" FOREIGN KEY ("signature_document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "fk_signatures_patient" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "fk_signatures_version" FOREIGN KEY ("invoice_version_id") REFERENCES "invoice_versions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "fk_signatures_voided_by" FOREIGN KEY ("voided_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "svb_authorization_items" ADD CONSTRAINT "fk_authorization_items_authorization" FOREIGN KEY ("authorization_id") REFERENCES "svb_authorizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "svb_authorization_items" ADD CONSTRAINT "fk_authorization_items_procedure" FOREIGN KEY ("svb_procedure_id") REFERENCES "svb_procedures"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "svb_authorizations" ADD CONSTRAINT "fk_svb_authorization_created_by" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "svb_authorizations" ADD CONSTRAINT "fk_svb_authorization_insurance" FOREIGN KEY ("patient_insurance_id") REFERENCES "patient_insurance"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "svb_authorizations" ADD CONSTRAINT "fk_svb_authorization_patient" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "svb_tariffs" ADD CONSTRAINT "fk_svb_tariffs_procedure" FOREIGN KEY ("svb_procedure_id") REFERENCES "svb_procedures"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "system_settings" ADD CONSTRAINT "fk_system_settings_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "system_settings" ADD CONSTRAINT "fk_system_settings_updated_by" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "treatment_cases" ADD CONSTRAINT "fk_treatment_created_by" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "treatment_cases" ADD CONSTRAINT "fk_treatment_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "treatment_cases" ADD CONSTRAINT "fk_treatment_patient" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "fk_user_roles_assigned_by" FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "fk_user_roles_role" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "fk_user_roles_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "fk_users_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Preserve the 33 manually defined business CHECK constraints from MySQL.
ALTER TABLE "number_sequences" ADD CONSTRAINT "ck_sequences_padding" CHECK (padding BETWEEN 1 AND 18);
ALTER TABLE "patient_insurance" ADD CONSTRAINT "ck_insurance_dates" CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from);
ALTER TABLE "treatment_cases" ADD CONSTRAINT "ck_treatment_dates" CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at);
ALTER TABLE "appointments" ADD CONSTRAINT "ck_appointments_time" CHECK (scheduled_end_at > scheduled_start_at);
ALTER TABLE "appointments" ADD CONSTRAINT "ck_appointments_cancelled" CHECK (
    status <> 'CANCELLED' OR (cancelled_at IS NOT NULL AND cancellation_reason IS NOT NULL)
  );
ALTER TABLE "appointments" ADD CONSTRAINT "ck_appointments_completed" CHECK (
    status <> 'COMPLETED' OR completed_at IS NOT NULL
  );
ALTER TABLE "clinical_encounters" ADD CONSTRAINT "ck_encounter_completed" CHECK (status <> 'COMPLETED' OR completed_at IS NOT NULL);
ALTER TABLE "clinical_encounters" ADD CONSTRAINT "ck_encounter_dates" CHECK (completed_at IS NULL OR completed_at >= started_at);
ALTER TABLE "diagnosis_codes" ADD CONSTRAINT "ck_diagnosis_dates" CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from);
ALTER TABLE "svb_procedures" ADD CONSTRAINT "ck_svb_procedures_dates" CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from);
ALTER TABLE "svb_tariffs" ADD CONSTRAINT "ck_svb_tariffs_amount" CHECK (amount >= 0);
ALTER TABLE "svb_tariffs" ADD CONSTRAINT "ck_svb_tariffs_dates" CHECK (valid_to IS NULL OR valid_to >= valid_from);
ALTER TABLE "svb_authorizations" ADD CONSTRAINT "ck_svb_authorization_dates" CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from);
ALTER TABLE "svb_authorization_items" ADD CONSTRAINT "ck_authorization_item_qty" CHECK (
    used_quantity >= 0 AND
    (authorized_quantity IS NULL OR authorized_quantity >= 0) AND
    (authorized_quantity IS NULL OR used_quantity <= authorized_quantity)
  );
ALTER TABLE "svb_authorization_items" ADD CONSTRAINT "ck_authorization_item_dates" CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from);
ALTER TABLE "encounter_procedures" ADD CONSTRAINT "ck_encounter_procedure_qty" CHECK (quantity > 0);
ALTER TABLE "encounter_procedures" ADD CONSTRAINT "ck_encounter_procedure_tariff" CHECK (unit_tariff_snapshot >= 0);
ALTER TABLE "encounter_procedures" ADD CONSTRAINT "ck_encounter_procedure_amount" CHECK (amount >= 0);
ALTER TABLE "encounter_procedures" ADD CONSTRAINT "ck_encounter_procedure_performed" CHECK (status <> 'PERFORMED' OR performed_at IS NOT NULL);
ALTER TABLE "invoices" ADD CONSTRAINT "ck_invoice_cancelled" CHECK (
    status <> 'CANCELLED' OR (cancelled_at IS NOT NULL AND cancellation_reason IS NOT NULL)
  );
ALTER TABLE "invoice_versions" ADD CONSTRAINT "ck_invoice_version_number" CHECK (version_number > 0);
ALTER TABLE "invoice_versions" ADD CONSTRAINT "ck_invoice_version_total" CHECK (total_amount >= 0);
ALTER TABLE "invoice_items" ADD CONSTRAINT "ck_invoice_item_line" CHECK (line_number > 0);
ALTER TABLE "invoice_items" ADD CONSTRAINT "ck_invoice_item_qty" CHECK (quantity > 0);
ALTER TABLE "invoice_items" ADD CONSTRAINT "ck_invoice_item_tariff" CHECK (unit_tariff_snapshot >= 0);
ALTER TABLE "invoice_items" ADD CONSTRAINT "ck_invoice_item_amount" CHECK (amount >= 0);
ALTER TABLE "documents" ADD CONSTRAINT "ck_documents_size" CHECK (size_bytes > 0);
ALTER TABLE "signatures" ADD CONSTRAINT "ck_signature_void" CHECK (
    status <> 'VOID' OR (voided_at IS NOT NULL AND voided_by_user_id IS NOT NULL AND void_reason IS NOT NULL)
  );
ALTER TABLE "declaration_batches" ADD CONSTRAINT "ck_declaration_period" CHECK (period_end IS NULL OR period_start IS NULL OR period_end >= period_start);
ALTER TABLE "declaration_items" ADD CONSTRAINT "ck_declaration_item_sequence" CHECK (sequence_number > 0);
ALTER TABLE "declaration_items" ADD CONSTRAINT "ck_declaration_item_amount" CHECK (amount_snapshot >= 0);
ALTER TABLE "declaration_exports" ADD CONSTRAINT "ck_declaration_export_records" CHECK (record_count > 0);
ALTER TABLE "declaration_submissions" ADD CONSTRAINT "ck_declaration_submission_attempt" CHECK (attempt_number > 0);
ALTER TABLE "accident_cases" ADD CONSTRAINT "ck_unsigned_accident_cases_id" CHECK ("id" >= 0);
ALTER TABLE "accident_cases" ADD CONSTRAINT "ck_unsigned_accident_cases_patient_id" CHECK ("patient_id" >= 0);
ALTER TABLE "accident_cases" ADD CONSTRAINT "ck_unsigned_accident_cases_patient_insurance_id" CHECK ("patient_insurance_id" >= 0);
ALTER TABLE "accident_cases" ADD CONSTRAINT "ck_unsigned_accident_cases_created_by_user_id" CHECK ("created_by_user_id" >= 0);
ALTER TABLE "appointment_status_history" ADD CONSTRAINT "ck_unsigned_appointment_status_history_id" CHECK ("id" >= 0);
ALTER TABLE "appointment_status_history" ADD CONSTRAINT "ck_unsigned_appointment_status_history_appointment_id" CHECK ("appointment_id" >= 0);
ALTER TABLE "appointment_status_history" ADD CONSTRAINT "ck_unsigned_appointment_status_history_changed_by_user_id" CHECK ("changed_by_user_id" >= 0);
ALTER TABLE "appointments" ADD CONSTRAINT "ck_unsigned_appointments_id" CHECK ("id" >= 0);
ALTER TABLE "appointments" ADD CONSTRAINT "ck_unsigned_appointments_organization_id" CHECK ("organization_id" >= 0);
ALTER TABLE "appointments" ADD CONSTRAINT "ck_unsigned_appointments_patient_id" CHECK ("patient_id" >= 0);
ALTER TABLE "appointments" ADD CONSTRAINT "ck_unsigned_appointments_provider_id" CHECK ("provider_id" >= 0);
ALTER TABLE "appointments" ADD CONSTRAINT "ck_unsigned_appointments_clinic_location_id" CHECK ("clinic_location_id" >= 0);
ALTER TABLE "appointments" ADD CONSTRAINT "ck_unsigned_appointments_treatment_case_id" CHECK ("treatment_case_id" >= 0);
ALTER TABLE "appointments" ADD CONSTRAINT "ck_unsigned_appointments_accident_case_id" CHECK ("accident_case_id" >= 0);
ALTER TABLE "appointments" ADD CONSTRAINT "ck_unsigned_appointments_created_by_user_id" CHECK ("created_by_user_id" >= 0);
ALTER TABLE "audit_logs" ADD CONSTRAINT "ck_unsigned_audit_logs_id" CHECK ("id" >= 0);
ALTER TABLE "audit_logs" ADD CONSTRAINT "ck_unsigned_audit_logs_organization_id" CHECK ("organization_id" >= 0);
ALTER TABLE "audit_logs" ADD CONSTRAINT "ck_unsigned_audit_logs_actor_user_id" CHECK ("actor_user_id" >= 0);
ALTER TABLE "audit_logs" ADD CONSTRAINT "ck_unsigned_audit_logs_entity_id" CHECK ("entity_id" >= 0);
ALTER TABLE "clinic_locations" ADD CONSTRAINT "ck_unsigned_clinic_locations_id" CHECK ("id" >= 0);
ALTER TABLE "clinic_locations" ADD CONSTRAINT "ck_unsigned_clinic_locations_organization_id" CHECK ("organization_id" >= 0);
ALTER TABLE "clinical_encounters" ADD CONSTRAINT "ck_unsigned_clinical_encounters_id" CHECK ("id" >= 0);
ALTER TABLE "clinical_encounters" ADD CONSTRAINT "ck_unsigned_clinical_encounters_appointment_id" CHECK ("appointment_id" >= 0);
ALTER TABLE "clinical_encounters" ADD CONSTRAINT "ck_unsigned_clinical_encounters_provider_id" CHECK ("provider_id" >= 0);
ALTER TABLE "clinical_encounters" ADD CONSTRAINT "ck_unsigned_clinical_encounters_created_by_user_id" CHECK ("created_by_user_id" >= 0);
ALTER TABLE "declaration_batch_status_history" ADD CONSTRAINT "ck_unsigned_declaration_batch_status_history_id" CHECK ("id" >= 0);
ALTER TABLE "declaration_batch_status_history" ADD CONSTRAINT "ck_unsigned_declaration_batch_status_history_declarati_5b274475" CHECK ("declaration_batch_id" >= 0);
ALTER TABLE "declaration_batch_status_history" ADD CONSTRAINT "ck_unsigned_declaration_batch_status_history_changed_by_user_id" CHECK ("changed_by_user_id" >= 0);
ALTER TABLE "declaration_batches" ADD CONSTRAINT "ck_unsigned_declaration_batches_id" CHECK ("id" >= 0);
ALTER TABLE "declaration_batches" ADD CONSTRAINT "ck_unsigned_declaration_batches_organization_id" CHECK ("organization_id" >= 0);
ALTER TABLE "declaration_batches" ADD CONSTRAINT "ck_unsigned_declaration_batches_payer_id" CHECK ("payer_id" >= 0);
ALTER TABLE "declaration_batches" ADD CONSTRAINT "ck_unsigned_declaration_batches_created_by_user_id" CHECK ("created_by_user_id" >= 0);
ALTER TABLE "declaration_exports" ADD CONSTRAINT "ck_unsigned_declaration_exports_id" CHECK ("id" >= 0);
ALTER TABLE "declaration_exports" ADD CONSTRAINT "ck_unsigned_declaration_exports_declaration_batch_id" CHECK ("declaration_batch_id" >= 0);
ALTER TABLE "declaration_exports" ADD CONSTRAINT "ck_unsigned_declaration_exports_document_id" CHECK ("document_id" >= 0);
ALTER TABLE "declaration_exports" ADD CONSTRAINT "ck_unsigned_declaration_exports_record_count" CHECK ("record_count" >= 0);
ALTER TABLE "declaration_exports" ADD CONSTRAINT "ck_unsigned_declaration_exports_exported_by_user_id" CHECK ("exported_by_user_id" >= 0);
ALTER TABLE "declaration_items" ADD CONSTRAINT "ck_unsigned_declaration_items_id" CHECK ("id" >= 0);
ALTER TABLE "declaration_items" ADD CONSTRAINT "ck_unsigned_declaration_items_declaration_batch_id" CHECK ("declaration_batch_id" >= 0);
ALTER TABLE "declaration_items" ADD CONSTRAINT "ck_unsigned_declaration_items_invoice_item_id" CHECK ("invoice_item_id" >= 0);
ALTER TABLE "declaration_items" ADD CONSTRAINT "ck_unsigned_declaration_items_sequence_number" CHECK ("sequence_number" >= 0);
ALTER TABLE "declaration_items" ADD CONSTRAINT "ck_unsigned_declaration_items_number_of_treatments_snapshot" CHECK ("number_of_treatments_snapshot" >= 0);
ALTER TABLE "declaration_submissions" ADD CONSTRAINT "ck_unsigned_declaration_submissions_id" CHECK ("id" >= 0);
ALTER TABLE "declaration_submissions" ADD CONSTRAINT "ck_unsigned_declaration_submissions_declaration_batch_id" CHECK ("declaration_batch_id" >= 0);
ALTER TABLE "declaration_submissions" ADD CONSTRAINT "ck_unsigned_declaration_submissions_declaration_export_id" CHECK ("declaration_export_id" >= 0);
ALTER TABLE "declaration_submissions" ADD CONSTRAINT "ck_unsigned_declaration_submissions_attempt_number" CHECK ("attempt_number" >= 0);
ALTER TABLE "declaration_submissions" ADD CONSTRAINT "ck_unsigned_declaration_submissions_submitted_by_user_id" CHECK ("submitted_by_user_id" >= 0);
ALTER TABLE "diagnosis_codes" ADD CONSTRAINT "ck_unsigned_diagnosis_codes_id" CHECK ("id" >= 0);
ALTER TABLE "documents" ADD CONSTRAINT "ck_unsigned_documents_id" CHECK ("id" >= 0);
ALTER TABLE "documents" ADD CONSTRAINT "ck_unsigned_documents_organization_id" CHECK ("organization_id" >= 0);
ALTER TABLE "documents" ADD CONSTRAINT "ck_unsigned_documents_size_bytes" CHECK ("size_bytes" >= 0);
ALTER TABLE "documents" ADD CONSTRAINT "ck_unsigned_documents_created_by_user_id" CHECK ("created_by_user_id" >= 0);
ALTER TABLE "encounter_diagnoses" ADD CONSTRAINT "ck_unsigned_encounter_diagnoses_id" CHECK ("id" >= 0);
ALTER TABLE "encounter_diagnoses" ADD CONSTRAINT "ck_unsigned_encounter_diagnoses_encounter_id" CHECK ("encounter_id" >= 0);
ALTER TABLE "encounter_diagnoses" ADD CONSTRAINT "ck_unsigned_encounter_diagnoses_diagnosis_code_id" CHECK ("diagnosis_code_id" >= 0);
ALTER TABLE "encounter_diagnoses" ADD CONSTRAINT "ck_unsigned_encounter_diagnoses_created_by_user_id" CHECK ("created_by_user_id" >= 0);
ALTER TABLE "encounter_procedures" ADD CONSTRAINT "ck_unsigned_encounter_procedures_id" CHECK ("id" >= 0);
ALTER TABLE "encounter_procedures" ADD CONSTRAINT "ck_unsigned_encounter_procedures_encounter_id" CHECK ("encounter_id" >= 0);
ALTER TABLE "encounter_procedures" ADD CONSTRAINT "ck_unsigned_encounter_procedures_patient_insurance_id" CHECK ("patient_insurance_id" >= 0);
ALTER TABLE "encounter_procedures" ADD CONSTRAINT "ck_unsigned_encounter_procedures_svb_procedure_id" CHECK ("svb_procedure_id" >= 0);
ALTER TABLE "encounter_procedures" ADD CONSTRAINT "ck_unsigned_encounter_procedures_svb_tariff_id" CHECK ("svb_tariff_id" >= 0);
ALTER TABLE "encounter_procedures" ADD CONSTRAINT "ck_unsigned_encounter_procedures_authorization_item_id" CHECK ("authorization_item_id" >= 0);
ALTER TABLE "encounter_procedures" ADD CONSTRAINT "ck_unsigned_encounter_procedures_diagnosis_id" CHECK ("diagnosis_id" >= 0);
ALTER TABLE "encounter_procedures" ADD CONSTRAINT "ck_unsigned_encounter_procedures_referrer_id" CHECK ("referrer_id" >= 0);
ALTER TABLE "encounter_procedures" ADD CONSTRAINT "ck_unsigned_encounter_procedures_performed_by_provider_id" CHECK ("performed_by_provider_id" >= 0);
ALTER TABLE "encounter_procedures" ADD CONSTRAINT "ck_unsigned_encounter_procedures_number_of_treatments_snapshot" CHECK ("number_of_treatments_snapshot" >= 0);
ALTER TABLE "encounter_procedures" ADD CONSTRAINT "ck_unsigned_encounter_procedures_created_by_user_id" CHECK ("created_by_user_id" >= 0);
ALTER TABLE "invoice_corrections" ADD CONSTRAINT "ck_unsigned_invoice_corrections_id" CHECK ("id" >= 0);
ALTER TABLE "invoice_corrections" ADD CONSTRAINT "ck_unsigned_invoice_corrections_invoice_id" CHECK ("invoice_id" >= 0);
ALTER TABLE "invoice_corrections" ADD CONSTRAINT "ck_unsigned_invoice_corrections_source_version_id" CHECK ("source_version_id" >= 0);
ALTER TABLE "invoice_corrections" ADD CONSTRAINT "ck_unsigned_invoice_corrections_replacement_version_id" CHECK ("replacement_version_id" >= 0);
ALTER TABLE "invoice_corrections" ADD CONSTRAINT "ck_unsigned_invoice_corrections_requested_by_user_id" CHECK ("requested_by_user_id" >= 0);
ALTER TABLE "invoice_corrections" ADD CONSTRAINT "ck_unsigned_invoice_corrections_approved_by_user_id" CHECK ("approved_by_user_id" >= 0);
ALTER TABLE "invoice_corrections" ADD CONSTRAINT "ck_unsigned_invoice_corrections_resolved_by_user_id" CHECK ("resolved_by_user_id" >= 0);
ALTER TABLE "invoice_documents" ADD CONSTRAINT "ck_unsigned_invoice_documents_id" CHECK ("id" >= 0);
ALTER TABLE "invoice_documents" ADD CONSTRAINT "ck_unsigned_invoice_documents_invoice_version_id" CHECK ("invoice_version_id" >= 0);
ALTER TABLE "invoice_documents" ADD CONSTRAINT "ck_unsigned_invoice_documents_document_id" CHECK ("document_id" >= 0);
ALTER TABLE "invoice_items" ADD CONSTRAINT "ck_unsigned_invoice_items_id" CHECK ("id" >= 0);
ALTER TABLE "invoice_items" ADD CONSTRAINT "ck_unsigned_invoice_items_invoice_version_id" CHECK ("invoice_version_id" >= 0);
ALTER TABLE "invoice_items" ADD CONSTRAINT "ck_unsigned_invoice_items_line_number" CHECK ("line_number" >= 0);
ALTER TABLE "invoice_items" ADD CONSTRAINT "ck_unsigned_invoice_items_encounter_procedure_id" CHECK ("encounter_procedure_id" >= 0);
ALTER TABLE "invoice_items" ADD CONSTRAINT "ck_unsigned_invoice_items_source_invoice_item_id" CHECK ("source_invoice_item_id" >= 0);
ALTER TABLE "invoice_items" ADD CONSTRAINT "ck_unsigned_invoice_items_svb_procedure_id" CHECK ("svb_procedure_id" >= 0);
ALTER TABLE "invoice_items" ADD CONSTRAINT "ck_unsigned_invoice_items_svb_tariff_id" CHECK ("svb_tariff_id" >= 0);
ALTER TABLE "invoice_items" ADD CONSTRAINT "ck_unsigned_invoice_items_number_of_treatments_snapshot" CHECK ("number_of_treatments_snapshot" >= 0);
ALTER TABLE "invoice_status_history" ADD CONSTRAINT "ck_unsigned_invoice_status_history_id" CHECK ("id" >= 0);
ALTER TABLE "invoice_status_history" ADD CONSTRAINT "ck_unsigned_invoice_status_history_invoice_id" CHECK ("invoice_id" >= 0);
ALTER TABLE "invoice_status_history" ADD CONSTRAINT "ck_unsigned_invoice_status_history_invoice_version_id" CHECK ("invoice_version_id" >= 0);
ALTER TABLE "invoice_status_history" ADD CONSTRAINT "ck_unsigned_invoice_status_history_changed_by_user_id" CHECK ("changed_by_user_id" >= 0);
ALTER TABLE "invoice_versions" ADD CONSTRAINT "ck_unsigned_invoice_versions_id" CHECK ("id" >= 0);
ALTER TABLE "invoice_versions" ADD CONSTRAINT "ck_unsigned_invoice_versions_invoice_id" CHECK ("invoice_id" >= 0);
ALTER TABLE "invoice_versions" ADD CONSTRAINT "ck_unsigned_invoice_versions_version_number" CHECK ("version_number" >= 0);
ALTER TABLE "invoice_versions" ADD CONSTRAINT "ck_unsigned_invoice_versions_supersedes_version_id" CHECK ("supersedes_version_id" >= 0);
ALTER TABLE "invoice_versions" ADD CONSTRAINT "ck_unsigned_invoice_versions_prepared_by_user_id" CHECK ("prepared_by_user_id" >= 0);
ALTER TABLE "invoices" ADD CONSTRAINT "ck_unsigned_invoices_id" CHECK ("id" >= 0);
ALTER TABLE "invoices" ADD CONSTRAINT "ck_unsigned_invoices_organization_id" CHECK ("organization_id" >= 0);
ALTER TABLE "invoices" ADD CONSTRAINT "ck_unsigned_invoices_appointment_id" CHECK ("appointment_id" >= 0);
ALTER TABLE "invoices" ADD CONSTRAINT "ck_unsigned_invoices_patient_id" CHECK ("patient_id" >= 0);
ALTER TABLE "invoices" ADD CONSTRAINT "ck_unsigned_invoices_patient_insurance_id" CHECK ("patient_insurance_id" >= 0);
ALTER TABLE "invoices" ADD CONSTRAINT "ck_unsigned_invoices_current_version_id" CHECK ("current_version_id" >= 0);
ALTER TABLE "invoices" ADD CONSTRAINT "ck_unsigned_invoices_created_by_user_id" CHECK ("created_by_user_id" >= 0);
ALTER TABLE "invoices" ADD CONSTRAINT "ck_unsigned_invoices_cancelled_by_user_id" CHECK ("cancelled_by_user_id" >= 0);
ALTER TABLE "number_sequences" ADD CONSTRAINT "ck_unsigned_number_sequences_id" CHECK ("id" >= 0);
ALTER TABLE "number_sequences" ADD CONSTRAINT "ck_unsigned_number_sequences_organization_id" CHECK ("organization_id" >= 0);
ALTER TABLE "number_sequences" ADD CONSTRAINT "ck_unsigned_number_sequences_sequence_year" CHECK ("sequence_year" >= 0 AND "sequence_year" <= 65535);
ALTER TABLE "number_sequences" ADD CONSTRAINT "ck_unsigned_number_sequences_current_value" CHECK ("current_value" >= 0);
ALTER TABLE "number_sequences" ADD CONSTRAINT "ck_unsigned_number_sequences_padding" CHECK ("padding" >= 0 AND "padding" <= 255);
ALTER TABLE "organizations" ADD CONSTRAINT "ck_unsigned_organizations_id" CHECK ("id" >= 0);
ALTER TABLE "patient_insurance" ADD CONSTRAINT "ck_unsigned_patient_insurance_id" CHECK ("id" >= 0);
ALTER TABLE "patient_insurance" ADD CONSTRAINT "ck_unsigned_patient_insurance_patient_id" CHECK ("patient_id" >= 0);
ALTER TABLE "patient_insurance" ADD CONSTRAINT "ck_unsigned_patient_insurance_payer_id" CHECK ("payer_id" >= 0);
ALTER TABLE "patient_insurance" ADD CONSTRAINT "ck_unsigned_patient_insurance_verified_by_user_id" CHECK ("verified_by_user_id" >= 0);
ALTER TABLE "patients" ADD CONSTRAINT "ck_unsigned_patients_id" CHECK ("id" >= 0);
ALTER TABLE "patients" ADD CONSTRAINT "ck_unsigned_patients_organization_id" CHECK ("organization_id" >= 0);
ALTER TABLE "payers" ADD CONSTRAINT "ck_unsigned_payers_id" CHECK ("id" >= 0);
ALTER TABLE "permissions" ADD CONSTRAINT "ck_unsigned_permissions_id" CHECK ("id" >= 0);
ALTER TABLE "providers" ADD CONSTRAINT "ck_unsigned_providers_id" CHECK ("id" >= 0);
ALTER TABLE "providers" ADD CONSTRAINT "ck_unsigned_providers_organization_id" CHECK ("organization_id" >= 0);
ALTER TABLE "providers" ADD CONSTRAINT "ck_unsigned_providers_user_id" CHECK ("user_id" >= 0);
ALTER TABLE "referrers" ADD CONSTRAINT "ck_unsigned_referrers_id" CHECK ("id" >= 0);
ALTER TABLE "referrers" ADD CONSTRAINT "ck_unsigned_referrers_organization_id" CHECK ("organization_id" >= 0);
ALTER TABLE "role_permissions" ADD CONSTRAINT "ck_unsigned_role_permissions_role_id" CHECK ("role_id" >= 0);
ALTER TABLE "role_permissions" ADD CONSTRAINT "ck_unsigned_role_permissions_permission_id" CHECK ("permission_id" >= 0);
ALTER TABLE "roles" ADD CONSTRAINT "ck_unsigned_roles_id" CHECK ("id" >= 0);
ALTER TABLE "signatures" ADD CONSTRAINT "ck_unsigned_signatures_id" CHECK ("id" >= 0);
ALTER TABLE "signatures" ADD CONSTRAINT "ck_unsigned_signatures_invoice_version_id" CHECK ("invoice_version_id" >= 0);
ALTER TABLE "signatures" ADD CONSTRAINT "ck_unsigned_signatures_patient_id" CHECK ("patient_id" >= 0);
ALTER TABLE "signatures" ADD CONSTRAINT "ck_unsigned_signatures_signature_document_id" CHECK ("signature_document_id" >= 0);
ALTER TABLE "signatures" ADD CONSTRAINT "ck_unsigned_signatures_captured_by_user_id" CHECK ("captured_by_user_id" >= 0);
ALTER TABLE "signatures" ADD CONSTRAINT "ck_unsigned_signatures_voided_by_user_id" CHECK ("voided_by_user_id" >= 0);
ALTER TABLE "svb_authorization_items" ADD CONSTRAINT "ck_unsigned_svb_authorization_items_id" CHECK ("id" >= 0);
ALTER TABLE "svb_authorization_items" ADD CONSTRAINT "ck_unsigned_svb_authorization_items_authorization_id" CHECK ("authorization_id" >= 0);
ALTER TABLE "svb_authorization_items" ADD CONSTRAINT "ck_unsigned_svb_authorization_items_svb_procedure_id" CHECK ("svb_procedure_id" >= 0);
ALTER TABLE "svb_authorizations" ADD CONSTRAINT "ck_unsigned_svb_authorizations_id" CHECK ("id" >= 0);
ALTER TABLE "svb_authorizations" ADD CONSTRAINT "ck_unsigned_svb_authorizations_patient_id" CHECK ("patient_id" >= 0);
ALTER TABLE "svb_authorizations" ADD CONSTRAINT "ck_unsigned_svb_authorizations_patient_insurance_id" CHECK ("patient_insurance_id" >= 0);
ALTER TABLE "svb_authorizations" ADD CONSTRAINT "ck_unsigned_svb_authorizations_created_by_user_id" CHECK ("created_by_user_id" >= 0);
ALTER TABLE "svb_procedures" ADD CONSTRAINT "ck_unsigned_svb_procedures_id" CHECK ("id" >= 0);
ALTER TABLE "svb_tariffs" ADD CONSTRAINT "ck_unsigned_svb_tariffs_id" CHECK ("id" >= 0);
ALTER TABLE "svb_tariffs" ADD CONSTRAINT "ck_unsigned_svb_tariffs_svb_procedure_id" CHECK ("svb_procedure_id" >= 0);
ALTER TABLE "system_settings" ADD CONSTRAINT "ck_unsigned_system_settings_id" CHECK ("id" >= 0);
ALTER TABLE "system_settings" ADD CONSTRAINT "ck_unsigned_system_settings_organization_id" CHECK ("organization_id" >= 0);
ALTER TABLE "system_settings" ADD CONSTRAINT "ck_unsigned_system_settings_updated_by_user_id" CHECK ("updated_by_user_id" >= 0);
ALTER TABLE "treatment_cases" ADD CONSTRAINT "ck_unsigned_treatment_cases_id" CHECK ("id" >= 0);
ALTER TABLE "treatment_cases" ADD CONSTRAINT "ck_unsigned_treatment_cases_organization_id" CHECK ("organization_id" >= 0);
ALTER TABLE "treatment_cases" ADD CONSTRAINT "ck_unsigned_treatment_cases_patient_id" CHECK ("patient_id" >= 0);
ALTER TABLE "treatment_cases" ADD CONSTRAINT "ck_unsigned_treatment_cases_created_by_user_id" CHECK ("created_by_user_id" >= 0);
ALTER TABLE "user_roles" ADD CONSTRAINT "ck_unsigned_user_roles_user_id" CHECK ("user_id" >= 0);
ALTER TABLE "user_roles" ADD CONSTRAINT "ck_unsigned_user_roles_role_id" CHECK ("role_id" >= 0);
ALTER TABLE "user_roles" ADD CONSTRAINT "ck_unsigned_user_roles_assigned_by_user_id" CHECK ("assigned_by_user_id" >= 0);
ALTER TABLE "users" ADD CONSTRAINT "ck_unsigned_users_id" CHECK ("id" >= 0);
ALTER TABLE "users" ADD CONSTRAINT "ck_unsigned_users_organization_id" CHECK ("organization_id" >= 0);
ALTER TABLE "users" ADD CONSTRAINT "ck_unsigned_users_failed_login_attempts" CHECK ("failed_login_attempts" >= 0 AND "failed_login_attempts" <= 65535);

-- Extension schema can differ on an existing Supabase project.
DO $setup$
DECLARE extension_schema text;
BEGIN
  SELECT n.nspname INTO extension_schema FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'unaccent';
  EXECUTE format('CREATE FUNCTION odontho_fold_search(value text) RETURNS text LANGUAGE sql STABLE STRICT AS %L',
    format('SELECT lower(%I.unaccent(normalize(value, NFC)) COLLATE "und-x-icu") COLLATE "C"', extension_schema));
END
$setup$;

CREATE FUNCTION odontho_update_search() RETURNS trigger LANGUAGE plpgsql AS $trigger$
DECLARE source_column text;
BEGIN
  FOREACH source_column IN ARRAY TG_ARGV LOOP
    NEW := jsonb_populate_record(NEW, jsonb_build_object(source_column || '_search', odontho_fold_search(to_jsonb(NEW) ->> source_column)));
  END LOOP;
  RETURN NEW;
END
$trigger$;

CREATE FUNCTION odontho_update_timestamp() RETURNS trigger LANGUAGE plpgsql AS $trigger$
BEGIN
  IF to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) AND NEW.updated_at IS NOT DISTINCT FROM OLD.updated_at THEN
    NEW.updated_at := clock_timestamp();
  END IF;
  RETURN NEW;
END
$trigger$;
CREATE TRIGGER odontho_10_search BEFORE INSERT OR UPDATE ON "appointments" FOR EACH ROW EXECUTE FUNCTION odontho_update_search('appointment_number', 'reason');
CREATE TRIGGER odontho_10_search BEFORE INSERT OR UPDATE ON "audit_logs" FOR EACH ROW EXECUTE FUNCTION odontho_update_search('entity_key', 'entity_type');
CREATE TRIGGER odontho_10_search BEFORE INSERT OR UPDATE ON "clinic_locations" FOR EACH ROW EXECUTE FUNCTION odontho_update_search('code');
CREATE TRIGGER odontho_10_search BEFORE INSERT OR UPDATE ON "declaration_batches" FOR EACH ROW EXECUTE FUNCTION odontho_update_search('declaration_number', 'notes');
CREATE TRIGGER odontho_10_search BEFORE INSERT OR UPDATE ON "diagnosis_codes" FOR EACH ROW EXECUTE FUNCTION odontho_update_search('code', 'description');
CREATE TRIGGER odontho_10_search BEFORE INSERT OR UPDATE ON "documents" FOR EACH ROW EXECUTE FUNCTION odontho_update_search('original_filename', 'storage_uri');
CREATE TRIGGER odontho_10_search BEFORE INSERT OR UPDATE ON "encounter_diagnoses" FOR EACH ROW EXECUTE FUNCTION odontho_update_search('code_snapshot');
CREATE TRIGGER odontho_10_search BEFORE INSERT OR UPDATE ON "encounter_procedures" FOR EACH ROW EXECUTE FUNCTION odontho_update_search('procedure_code_snapshot');
CREATE TRIGGER odontho_10_search BEFORE INSERT OR UPDATE ON "invoices" FOR EACH ROW EXECUTE FUNCTION odontho_update_search('invoice_number');
CREATE TRIGGER odontho_10_search BEFORE INSERT OR UPDATE ON "organizations" FOR EACH ROW EXECUTE FUNCTION odontho_update_search('legal_name', 'declarant_id');
CREATE TRIGGER odontho_10_search BEFORE INSERT OR UPDATE ON "patient_insurance" FOR EACH ROW EXECUTE FUNCTION odontho_update_search('insured_id');
CREATE TRIGGER odontho_10_search BEFORE INSERT OR UPDATE ON "patients" FOR EACH ROW EXECUTE FUNCTION odontho_update_search('patient_number', 'first_name', 'middle_name', 'last_name', 'second_last_name', 'document_number', 'phone', 'mobile_phone');
CREATE TRIGGER odontho_10_search BEFORE INSERT OR UPDATE ON "payers" FOR EACH ROW EXECUTE FUNCTION odontho_update_search('code', 'name');
CREATE TRIGGER odontho_10_search BEFORE INSERT OR UPDATE ON "providers" FOR EACH ROW EXECUTE FUNCTION odontho_update_search('first_name', 'last_name', 'svb_provider_id', 'license_number', 'email', 'phone', 'specialty');
CREATE TRIGGER odontho_10_search BEFORE INSERT OR UPDATE ON "svb_authorizations" FOR EACH ROW EXECUTE FUNCTION odontho_update_search('authorization_id');
CREATE TRIGGER odontho_10_search BEFORE INSERT OR UPDATE ON "svb_procedures" FOR EACH ROW EXECUTE FUNCTION odontho_update_search('code', 'description');
CREATE TRIGGER odontho_10_search BEFORE INSERT OR UPDATE ON "users" FOR EACH ROW EXECUTE FUNCTION odontho_update_search('email', 'first_name', 'last_name');
CREATE TRIGGER odontho_20_timestamp BEFORE UPDATE ON "accident_cases" FOR EACH ROW EXECUTE FUNCTION odontho_update_timestamp();
CREATE TRIGGER odontho_20_timestamp BEFORE UPDATE ON "appointments" FOR EACH ROW EXECUTE FUNCTION odontho_update_timestamp();
CREATE TRIGGER odontho_20_timestamp BEFORE UPDATE ON "clinic_locations" FOR EACH ROW EXECUTE FUNCTION odontho_update_timestamp();
CREATE TRIGGER odontho_20_timestamp BEFORE UPDATE ON "clinical_encounters" FOR EACH ROW EXECUTE FUNCTION odontho_update_timestamp();
CREATE TRIGGER odontho_20_timestamp BEFORE UPDATE ON "declaration_batches" FOR EACH ROW EXECUTE FUNCTION odontho_update_timestamp();
CREATE TRIGGER odontho_20_timestamp BEFORE UPDATE ON "declaration_items" FOR EACH ROW EXECUTE FUNCTION odontho_update_timestamp();
CREATE TRIGGER odontho_20_timestamp BEFORE UPDATE ON "diagnosis_codes" FOR EACH ROW EXECUTE FUNCTION odontho_update_timestamp();
CREATE TRIGGER odontho_20_timestamp BEFORE UPDATE ON "encounter_procedures" FOR EACH ROW EXECUTE FUNCTION odontho_update_timestamp();
CREATE TRIGGER odontho_20_timestamp BEFORE UPDATE ON "invoice_corrections" FOR EACH ROW EXECUTE FUNCTION odontho_update_timestamp();
CREATE TRIGGER odontho_20_timestamp BEFORE UPDATE ON "invoice_items" FOR EACH ROW EXECUTE FUNCTION odontho_update_timestamp();
CREATE TRIGGER odontho_20_timestamp BEFORE UPDATE ON "invoice_versions" FOR EACH ROW EXECUTE FUNCTION odontho_update_timestamp();
CREATE TRIGGER odontho_20_timestamp BEFORE UPDATE ON "invoices" FOR EACH ROW EXECUTE FUNCTION odontho_update_timestamp();
CREATE TRIGGER odontho_20_timestamp BEFORE UPDATE ON "number_sequences" FOR EACH ROW EXECUTE FUNCTION odontho_update_timestamp();
CREATE TRIGGER odontho_20_timestamp BEFORE UPDATE ON "organizations" FOR EACH ROW EXECUTE FUNCTION odontho_update_timestamp();
CREATE TRIGGER odontho_20_timestamp BEFORE UPDATE ON "patient_insurance" FOR EACH ROW EXECUTE FUNCTION odontho_update_timestamp();
CREATE TRIGGER odontho_20_timestamp BEFORE UPDATE ON "patients" FOR EACH ROW EXECUTE FUNCTION odontho_update_timestamp();
CREATE TRIGGER odontho_20_timestamp BEFORE UPDATE ON "payers" FOR EACH ROW EXECUTE FUNCTION odontho_update_timestamp();
CREATE TRIGGER odontho_20_timestamp BEFORE UPDATE ON "permissions" FOR EACH ROW EXECUTE FUNCTION odontho_update_timestamp();
CREATE TRIGGER odontho_20_timestamp BEFORE UPDATE ON "providers" FOR EACH ROW EXECUTE FUNCTION odontho_update_timestamp();
CREATE TRIGGER odontho_20_timestamp BEFORE UPDATE ON "referrers" FOR EACH ROW EXECUTE FUNCTION odontho_update_timestamp();
CREATE TRIGGER odontho_20_timestamp BEFORE UPDATE ON "roles" FOR EACH ROW EXECUTE FUNCTION odontho_update_timestamp();
CREATE TRIGGER odontho_20_timestamp BEFORE UPDATE ON "svb_authorization_items" FOR EACH ROW EXECUTE FUNCTION odontho_update_timestamp();
CREATE TRIGGER odontho_20_timestamp BEFORE UPDATE ON "svb_authorizations" FOR EACH ROW EXECUTE FUNCTION odontho_update_timestamp();
CREATE TRIGGER odontho_20_timestamp BEFORE UPDATE ON "svb_procedures" FOR EACH ROW EXECUTE FUNCTION odontho_update_timestamp();
CREATE TRIGGER odontho_20_timestamp BEFORE UPDATE ON "svb_tariffs" FOR EACH ROW EXECUTE FUNCTION odontho_update_timestamp();
CREATE TRIGGER odontho_20_timestamp BEFORE UPDATE ON "system_settings" FOR EACH ROW EXECUTE FUNCTION odontho_update_timestamp();
CREATE TRIGGER odontho_20_timestamp BEFORE UPDATE ON "treatment_cases" FOR EACH ROW EXECUTE FUNCTION odontho_update_timestamp();
CREATE TRIGGER odontho_20_timestamp BEFORE UPDATE ON "users" FOR EACH ROW EXECUTE FUNCTION odontho_update_timestamp();

-- Express/Prisma authenticates users. No anonymous Data API table access.
ALTER TABLE "accident_cases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointment_status_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "clinic_locations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "clinical_encounters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "declaration_batch_status_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "declaration_batches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "declaration_exports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "declaration_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "declaration_submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "diagnosis_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "encounter_diagnoses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "encounter_procedures" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice_corrections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice_status_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "number_sequences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "patient_insurance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "patients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "providers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "referrers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "role_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "signatures" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "svb_authorization_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "svb_authorizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "svb_procedures" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "svb_tariffs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "system_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "treatment_cases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;

COMMIT;
