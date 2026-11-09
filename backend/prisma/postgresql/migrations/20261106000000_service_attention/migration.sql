BEGIN;

ALTER TABLE "encounter_procedures"
  ALTER COLUMN "patient_insurance_id" DROP NOT NULL,
  ALTER COLUMN "svb_tariff_id" DROP NOT NULL,
  ALTER COLUMN "insured_id_snapshot" DROP NOT NULL,
  ALTER COLUMN "unit_tariff_snapshot" DROP NOT NULL,
  ALTER COLUMN "currency_code_snapshot" DROP NOT NULL,
  ALTER COLUMN "amount" DROP NOT NULL,
  ADD CONSTRAINT "ck_encounter_procedure_billing_context" CHECK (
    (
      num_nonnulls(patient_insurance_id, svb_tariff_id, insured_id_snapshot,
        unit_tariff_snapshot, currency_code_snapshot, amount) = 0
      AND authorization_item_id IS NULL
    ) OR num_nonnulls(patient_insurance_id, svb_tariff_id, insured_id_snapshot,
      unit_tariff_snapshot, currency_code_snapshot, amount) = 6
  );

-- Built-in professionals record services. Reception and Admin retain billing permissions.
DELETE FROM "role_permissions" rp USING "roles" r, "permissions" p
WHERE rp.role_id = r.id AND rp.permission_id = p.id
  AND r.code = 'PROVIDER' AND r.is_system
  AND p.code IN ('invoice.create', 'invoice.prepare_signature', 'invoice.sign', 'signature.capture');

COMMIT;
