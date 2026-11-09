BEGIN;

-- CreateEnum
CREATE TYPE "DentalinkMappingKind" AS ENUM ('PROVIDER', 'LOCATION');

-- CreateEnum
CREATE TYPE "DentalinkEntityType" AS ENUM ('PATIENT', 'APPOINTMENT');

-- CreateEnum
CREATE TYPE "DentalinkImportRunState" AS ENUM ('READING', 'PREVIEW_READY', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "DentalinkImportDisposition" AS ENUM ('READY', 'ISSUE', 'IMPORTED', 'SKIPPED');

-- CreateTable
CREATE TABLE "dentalink_accounts" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "external_account_id" VARCHAR(255) COLLATE "C" NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "dentalink_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dentalink_mappings" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" BIGINT NOT NULL,
    "account_id" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" "DentalinkMappingKind" NOT NULL,
    "external_id" VARCHAR(255) COLLATE "C" NOT NULL,
    "provider_id" BIGINT,
    "clinic_location_id" BIGINT,

    CONSTRAINT "dentalink_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dentalink_import_runs" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" BIGINT NOT NULL,
    "account_id" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "request_key" VARCHAR(120) COLLATE "C" NOT NULL,
    "from_at" TIMESTAMPTZ(3),
    "to_at" TIMESTAMPTZ(3),
    "cursor" VARCHAR(2000),
    "state" "DentalinkImportRunState" NOT NULL DEFAULT 'READING',
    "preview_hash" CHAR(64),
    "confirm_key" VARCHAR(120) COLLATE "C",
    "confirm_hash" CHAR(64),
    "counts" JSONB NOT NULL DEFAULT '{}',
    "created_by_user_id" BIGINT NOT NULL,
    "confirmed_at" TIMESTAMPTZ(3),

    CONSTRAINT "dentalink_import_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dentalink_import_items" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" BIGINT NOT NULL,
    "account_id" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "patient_id" BIGINT,
    "appointment_id" BIGINT,
    "run_id" BIGINT NOT NULL,
    "entity_type" "DentalinkEntityType" NOT NULL,
    "external_id" VARCHAR(255) COLLATE "C" NOT NULL,
    "payload_json" JSONB NOT NULL,
    "payload_hash" CHAR(64) NOT NULL,
    "disposition" "DentalinkImportDisposition" NOT NULL DEFAULT 'READY',
    "issue_codes" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "dentalink_import_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dentalink_external_identities" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" BIGINT NOT NULL,
    "account_id" BIGINT NOT NULL,
    "patient_id" BIGINT,
    "appointment_id" BIGINT,
    "entity_type" "DentalinkEntityType" NOT NULL,
    "external_id" VARCHAR(255) COLLATE "C" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dentalink_external_identities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_dentalink_account_external" ON "dentalink_accounts"("organization_id", "external_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_dentalink_accounts_org_id" ON "dentalink_accounts"("organization_id", "id");

-- CreateIndex
CREATE INDEX "idx_dentalink_mapping_provider" ON "dentalink_mappings"("organization_id", "provider_id");

-- CreateIndex
CREATE INDEX "idx_dentalink_mapping_location" ON "dentalink_mappings"("organization_id", "clinic_location_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_dentalink_mapping_external" ON "dentalink_mappings"("account_id", "kind", "external_id");

-- CreateIndex
CREATE INDEX "idx_dentalink_run_account" ON "dentalink_import_runs"("organization_id", "account_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_dentalink_run_creator" ON "dentalink_import_runs"("organization_id", "created_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_dentalink_run_request" ON "dentalink_import_runs"("account_id", "request_key");

-- CreateIndex
CREATE UNIQUE INDEX "uq_dentalink_run_confirm" ON "dentalink_import_runs"("account_id", "confirm_key");

-- CreateIndex
CREATE UNIQUE INDEX "uq_dentalink_run_scope" ON "dentalink_import_runs"("organization_id", "account_id", "id");

-- CreateIndex
CREATE INDEX "idx_dentalink_item_review" ON "dentalink_import_items"("organization_id", "account_id", "run_id", "disposition");

-- CreateIndex
CREATE INDEX "idx_dentalink_item_patient" ON "dentalink_import_items"("organization_id", "patient_id");

-- CreateIndex
CREATE INDEX "idx_dentalink_item_appointment" ON "dentalink_import_items"("organization_id", "appointment_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_dentalink_item_external" ON "dentalink_import_items"("run_id", "entity_type", "external_id");

-- CreateIndex
CREATE INDEX "idx_dentalink_identity_patient" ON "dentalink_external_identities"("organization_id", "patient_id");

-- CreateIndex
CREATE INDEX "idx_dentalink_identity_appointment" ON "dentalink_external_identities"("organization_id", "appointment_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_dentalink_identity_external" ON "dentalink_external_identities"("account_id", "entity_type", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_dentalink_identity_patient" ON "dentalink_external_identities"("account_id", "patient_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_dentalink_identity_appointment" ON "dentalink_external_identities"("account_id", "appointment_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_appointments_org_id" ON "appointments"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_clinic_locations_org_id" ON "clinic_locations"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_patients_org_id" ON "patients"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_providers_org_id" ON "providers"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_users_org_id" ON "users"("organization_id", "id");

-- AddForeignKey
ALTER TABLE "dentalink_accounts" ADD CONSTRAINT "dentalink_accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "dentalink_mappings" ADD CONSTRAINT "dentalink_mappings_organization_id_account_id_fkey" FOREIGN KEY ("organization_id", "account_id") REFERENCES "dentalink_accounts"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "dentalink_mappings" ADD CONSTRAINT "dentalink_mappings_organization_id_provider_id_fkey" FOREIGN KEY ("organization_id", "provider_id") REFERENCES "providers"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "dentalink_mappings" ADD CONSTRAINT "dentalink_mappings_organization_id_clinic_location_id_fkey" FOREIGN KEY ("organization_id", "clinic_location_id") REFERENCES "clinic_locations"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "dentalink_import_runs" ADD CONSTRAINT "dentalink_import_runs_organization_id_account_id_fkey" FOREIGN KEY ("organization_id", "account_id") REFERENCES "dentalink_accounts"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "dentalink_import_runs" ADD CONSTRAINT "dentalink_import_runs_organization_id_created_by_user_id_fkey" FOREIGN KEY ("organization_id", "created_by_user_id") REFERENCES "users"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "dentalink_import_items" ADD CONSTRAINT "dentalink_import_items_organization_id_account_id_fkey" FOREIGN KEY ("organization_id", "account_id") REFERENCES "dentalink_accounts"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "dentalink_import_items" ADD CONSTRAINT "dentalink_import_items_organization_id_patient_id_fkey" FOREIGN KEY ("organization_id", "patient_id") REFERENCES "patients"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "dentalink_import_items" ADD CONSTRAINT "dentalink_import_items_organization_id_appointment_id_fkey" FOREIGN KEY ("organization_id", "appointment_id") REFERENCES "appointments"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "dentalink_import_items" ADD CONSTRAINT "dentalink_import_items_organization_id_account_id_run_id_fkey" FOREIGN KEY ("organization_id", "account_id", "run_id") REFERENCES "dentalink_import_runs"("organization_id", "account_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "dentalink_external_identities" ADD CONSTRAINT "dentalink_external_identities_organization_id_account_id_fkey" FOREIGN KEY ("organization_id", "account_id") REFERENCES "dentalink_accounts"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "dentalink_external_identities" ADD CONSTRAINT "dentalink_external_identities_organization_id_patient_id_fkey" FOREIGN KEY ("organization_id", "patient_id") REFERENCES "patients"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "dentalink_external_identities" ADD CONSTRAINT "dentalink_external_identities_organization_id_appointment__fkey" FOREIGN KEY ("organization_id", "appointment_id") REFERENCES "appointments"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "dentalink_accounts" ADD CONSTRAINT "ck_dentalink_account_text" CHECK (btrim(external_account_id) <> '' AND btrim(label) <> '');

ALTER TABLE "dentalink_accounts" ADD CONSTRAINT "ck_dentalink_account_ids" CHECK (id > 0 AND organization_id > 0);

ALTER TABLE "dentalink_accounts" ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER odontho_20_timestamp BEFORE UPDATE ON "dentalink_accounts" FOR EACH ROW EXECUTE FUNCTION odontho_update_timestamp();

ALTER TABLE "dentalink_mappings" ADD CONSTRAINT "ck_dentalink_mapping_ids" CHECK (id > 0 AND organization_id > 0 AND account_id > 0 AND (provider_id IS NULL OR provider_id > 0) AND (clinic_location_id IS NULL OR clinic_location_id > 0));

ALTER TABLE "dentalink_mappings" ADD CONSTRAINT "ck_dentalink_mapping_text" CHECK (btrim(external_id) <> '');

ALTER TABLE "dentalink_mappings" ADD CONSTRAINT "ck_dentalink_mapping_target" CHECK ((kind='PROVIDER' AND provider_id IS NOT NULL AND clinic_location_id IS NULL) OR (kind='LOCATION' AND provider_id IS NULL AND clinic_location_id IS NOT NULL));

ALTER TABLE "dentalink_mappings" ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER odontho_20_timestamp BEFORE UPDATE ON "dentalink_mappings" FOR EACH ROW EXECUTE FUNCTION odontho_update_timestamp();

ALTER TABLE "dentalink_import_runs" ADD CONSTRAINT "ck_dentalink_run_ids" CHECK (id > 0 AND organization_id > 0 AND account_id > 0 AND created_by_user_id > 0);

ALTER TABLE "dentalink_import_runs" ADD CONSTRAINT "ck_dentalink_run_text" CHECK (btrim(request_key) <> '' AND (confirm_key IS NULL OR btrim(confirm_key) <> ''));

ALTER TABLE "dentalink_import_runs" ADD CONSTRAINT "ck_dentalink_run_period" CHECK (from_at IS NULL OR to_at IS NULL OR from_at <= to_at);

ALTER TABLE "dentalink_import_runs" ADD CONSTRAINT "ck_dentalink_run_counts" CHECK (jsonb_typeof(counts)='object');

ALTER TABLE "dentalink_import_runs" ADD CONSTRAINT "ck_dentalink_run_hashes" CHECK ((preview_hash IS NULL OR preview_hash ~ '^[a-f0-9]{64}$') AND (confirm_hash IS NULL OR confirm_hash ~ '^[a-f0-9]{64}$'));

ALTER TABLE "dentalink_import_runs" ADD CONSTRAINT "ck_dentalink_run_state" CHECK ((state='READING' AND preview_hash IS NULL AND confirm_key IS NULL AND confirm_hash IS NULL AND confirmed_at IS NULL) OR (state='PREVIEW_READY' AND preview_hash IS NOT NULL AND confirm_key IS NULL AND confirm_hash IS NULL AND confirmed_at IS NULL) OR (state='CONFIRMED' AND preview_hash IS NOT NULL AND confirm_key IS NOT NULL AND confirm_hash IS NOT NULL AND confirmed_at IS NOT NULL));

ALTER TABLE "dentalink_import_runs" ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER odontho_20_timestamp BEFORE UPDATE ON "dentalink_import_runs" FOR EACH ROW EXECUTE FUNCTION odontho_update_timestamp();

ALTER TABLE "dentalink_import_items" ADD CONSTRAINT "ck_dentalink_item_ids" CHECK (id > 0 AND organization_id > 0 AND account_id > 0 AND run_id > 0 AND (patient_id IS NULL OR patient_id > 0) AND (appointment_id IS NULL OR appointment_id > 0));

ALTER TABLE "dentalink_import_items" ADD CONSTRAINT "ck_dentalink_item_text" CHECK (btrim(external_id) <> '');

ALTER TABLE "dentalink_import_items" ADD CONSTRAINT "ck_dentalink_item_payload" CHECK (jsonb_typeof(payload_json)='object' AND jsonb_typeof(issue_codes)='array' AND payload_hash ~ '^[a-f0-9]{64}$');

ALTER TABLE "dentalink_import_items" ADD CONSTRAINT "ck_dentalink_item_target" CHECK ((entity_type='PATIENT' AND appointment_id IS NULL) OR (entity_type='APPOINTMENT' AND patient_id IS NULL));

ALTER TABLE "dentalink_import_items" ADD CONSTRAINT "ck_dentalink_item_imported" CHECK (disposition NOT IN ('IMPORTED','SKIPPED') OR num_nonnulls(patient_id,appointment_id)=1);

ALTER TABLE "dentalink_import_items" ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER odontho_20_timestamp BEFORE UPDATE ON "dentalink_import_items" FOR EACH ROW EXECUTE FUNCTION odontho_update_timestamp();

ALTER TABLE "dentalink_external_identities" ADD CONSTRAINT "ck_dentalink_identity_ids" CHECK (id > 0 AND organization_id > 0 AND account_id > 0 AND (patient_id IS NULL OR patient_id > 0) AND (appointment_id IS NULL OR appointment_id > 0));

ALTER TABLE "dentalink_external_identities" ADD CONSTRAINT "ck_dentalink_identity_text" CHECK (btrim(external_id) <> '');

ALTER TABLE "dentalink_external_identities" ADD CONSTRAINT "ck_dentalink_identity_target" CHECK ((entity_type='PATIENT' AND patient_id IS NOT NULL AND appointment_id IS NULL) OR (entity_type='APPOINTMENT' AND appointment_id IS NOT NULL AND patient_id IS NULL));

ALTER TABLE "dentalink_external_identities" ENABLE ROW LEVEL SECURITY;

INSERT INTO permissions(code,name,description) VALUES
 ('dentalink.read','Consultar importación Dentalink','Consultar cuentas, vista previa e incidencias de importación.'),
 ('dentalink.manage','Gestionar Dentalink','Configurar cuenta lógica y mapeos de importación.'),
 ('dentalink.import','Importar Dentalink','Preparar y confirmar altas desde el adaptador autorizado.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r CROSS JOIN permissions p
WHERE r.is_system AND r.is_active
  AND ((r.code='ADMIN' AND p.code IN ('dentalink.read','dentalink.manage','dentalink.import'))
    OR (r.code='RECEPTION' AND p.code IN ('dentalink.read','dentalink.import')))
ON CONFLICT (role_id,permission_id) DO NOTHING;

COMMIT;
