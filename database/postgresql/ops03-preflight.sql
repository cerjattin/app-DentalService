-- OPS-03. Read-only diagnosis before an explicitly authorized deployment operation.
-- Run against the selected target only. This file changes no data or migration history.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '5s';

SELECT migration_name, finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS rolled_back
FROM public._prisma_migrations
ORDER BY migration_name;

SELECT
  count(*) FILTER (WHERE num_nonnulls(patient_insurance_id, svb_tariff_id, insured_id_snapshot,
    unit_tariff_snapshot, currency_code_snapshot, amount)=0 AND authorization_item_id IS NULL) AS pending_valuation,
  count(*) FILTER (WHERE num_nonnulls(patient_insurance_id, svb_tariff_id, insured_id_snapshot,
    unit_tariff_snapshot, currency_code_snapshot, amount)=6) AS valued,
  count(*) FILTER (WHERE NOT (
    (num_nonnulls(patient_insurance_id, svb_tariff_id, insured_id_snapshot,
      unit_tariff_snapshot, currency_code_snapshot, amount)=0 AND authorization_item_id IS NULL)
    OR num_nonnulls(patient_insurance_id, svb_tariff_id, insured_id_snapshot,
      unit_tariff_snapshot, currency_code_snapshot, amount)=6
  )) AS incompatible_rows
FROM public.encounter_procedures;

SELECT c.conname, c.convalidated
FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace
WHERE n.nspname='public' AND
 (c.conname='ck_encounter_procedure_billing_context' OR c.conname LIKE 'ck_dentalink_%')
ORDER BY c.conname;

SELECT r.code, p.code AS permission
FROM public.roles r JOIN public.role_permissions rp ON rp.role_id=r.id
JOIN public.permissions p ON p.id=rp.permission_id
WHERE r.is_system AND (
 p.code COLLATE "C" LIKE 'dentalink.%' OR p.code IN ('invoice.create','invoice.prepare_signature','invoice.sign','signature.capture'))
ORDER BY r.code,p.code;

SELECT c.relname, c.relrowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='r' AND c.relname LIKE 'dentalink_%'
ORDER BY c.relname;

ROLLBACK;

