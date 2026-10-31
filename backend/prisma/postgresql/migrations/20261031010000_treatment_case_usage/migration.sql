BEGIN;
ALTER TABLE treatment_cases ADD COLUMN first_assigned_at TIMESTAMPTZ(3);
-- Retain use even if an unused appointment later clears its case reference.
WITH uses AS (
  SELECT treatment_case_id AS id, created_at AS assigned_at FROM appointments WHERE treatment_case_id IS NOT NULL
  UNION ALL
  SELECT (new_values->>'treatmentCaseId')::bigint, created_at FROM audit_logs
    WHERE action IN ('APPOINTMENT_CREATE','APPOINTMENT_UPDATE') AND new_values->>'treatmentCaseId' ~ '^[1-9][0-9]*$'
), first_use AS (SELECT id, min(assigned_at) AS assigned_at FROM uses GROUP BY id)
UPDATE treatment_cases tc SET first_assigned_at = u.assigned_at FROM first_use u WHERE tc.id = u.id;
CREATE FUNCTION public.mark_treatment_case_used() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.treatment_case_id IS NOT NULL THEN
    UPDATE public.treatment_cases SET first_assigned_at = coalesce(first_assigned_at, CURRENT_TIMESTAMP)
      WHERE id = NEW.treatment_case_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER appointment_treatment_case_used AFTER INSERT OR UPDATE OF treatment_case_id ON appointments
FOR EACH ROW EXECUTE FUNCTION public.mark_treatment_case_used();
COMMIT;
