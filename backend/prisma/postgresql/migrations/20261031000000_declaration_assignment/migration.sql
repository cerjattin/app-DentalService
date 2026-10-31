-- NEG-FUNC-04: apply only after reviewing duplicate/legacy diagnostics.
-- No historical invoice/declaration snapshots are rewritten.
BEGIN;
LOCK TABLE declaration_batches, declaration_items IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (
    SELECT di.invoice_item_id FROM declaration_items di
    JOIN declaration_batches db ON db.id = di.declaration_batch_id
    WHERE db.status <> 'CANCELLED'
    GROUP BY di.invoice_item_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'NEG-FUNC-04: duplicate active assignments; review protected diagnostics before applying';
  END IF;
  IF EXISTS (SELECT 1 FROM audit_logs WHERE action = 'DECLARATION_ITEM_REMOVE'
    AND (old_values->>'sequenceNumber' IS NULL OR old_values->>'declarationBatchId' IS NULL)) THEN
    RAISE EXCEPTION 'NEG-FUNC-04: removed ordinal history is incomplete; explicit reconciliation required';
  END IF;
END $$;

ALTER TABLE declaration_batches ADD COLUMN last_item_sequence INTEGER NOT NULL DEFAULT 0
  CHECK (last_item_sequence >= 0);
-- One-time high-water initialization includes removed lines from protected audit.
-- Runtime allocation is UPDATE ... increment, never MAX + 1.
WITH used AS (
  SELECT declaration_batch_id AS batch_id, sequence_number AS ordinal FROM declaration_items
  UNION ALL
  SELECT (old_values->>'declarationBatchId')::bigint, (old_values->>'sequenceNumber')::integer
    FROM audit_logs WHERE action = 'DECLARATION_ITEM_REMOVE'
), high_water AS (SELECT batch_id, max(ordinal) AS ordinal FROM used GROUP BY batch_id)
UPDATE declaration_batches db SET last_item_sequence = h.ordinal FROM high_water h WHERE db.id = h.batch_id;

CREATE TABLE declaration_active_assignments (
  invoice_item_id BIGINT PRIMARY KEY,
  declaration_item_id BIGINT NOT NULL CONSTRAINT uq_declaration_active_item UNIQUE,
  declaration_batch_id BIGINT NOT NULL,
  CONSTRAINT fk_declaration_active_invoice_item FOREIGN KEY (invoice_item_id) REFERENCES invoice_items(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_declaration_active_item FOREIGN KEY (declaration_item_id) REFERENCES declaration_items(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_declaration_active_batch FOREIGN KEY (declaration_batch_id) REFERENCES declaration_batches(id) ON DELETE CASCADE ON UPDATE RESTRICT
);
CREATE INDEX idx_declaration_active_batch ON declaration_active_assignments(declaration_batch_id);
ALTER TABLE declaration_active_assignments ENABLE ROW LEVEL SECURITY;
INSERT INTO declaration_active_assignments
SELECT di.invoice_item_id, di.id, di.declaration_batch_id FROM declaration_items di
JOIN declaration_batches db ON db.id = di.declaration_batch_id WHERE db.status <> 'CANCELLED';

CREATE FUNCTION public.sync_declaration_item_assignment() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public AS $$
DECLARE batch_status public."DeclarationBatchStatus";
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.invoice_item_id, NEW.declaration_batch_id) IS DISTINCT FROM (OLD.invoice_item_id, OLD.declaration_batch_id) THEN
      RAISE EXCEPTION 'Declaration assignment identity is immutable';
    END IF;
    RETURN NEW;
  END IF;
  -- Also keep the counter correct for controlled imports/fixtures, under a row lock.
  UPDATE public.declaration_batches SET last_item_sequence = greatest(last_item_sequence, NEW.sequence_number)
    WHERE id = NEW.declaration_batch_id RETURNING status INTO batch_status;
  IF batch_status <> 'CANCELLED' THEN
    INSERT INTO public.declaration_active_assignments VALUES (NEW.invoice_item_id, NEW.id, NEW.declaration_batch_id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER declaration_item_assignment_insert AFTER INSERT ON declaration_items
FOR EACH ROW EXECUTE FUNCTION public.sync_declaration_item_assignment();
CREATE TRIGGER declaration_item_identity_update BEFORE UPDATE OF invoice_item_id, declaration_batch_id ON declaration_items
FOR EACH ROW EXECUTE FUNCTION public.sync_declaration_item_assignment();

CREATE FUNCTION public.sync_declaration_batch_assignments() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.status = 'CANCELLED' AND OLD.status <> 'CANCELLED' THEN
    DELETE FROM public.declaration_active_assignments WHERE declaration_batch_id = NEW.id;
  ELSIF OLD.status = 'CANCELLED' AND NEW.status <> 'CANCELLED' THEN
    INSERT INTO public.declaration_active_assignments
      SELECT invoice_item_id, id, declaration_batch_id FROM public.declaration_items WHERE declaration_batch_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER declaration_batch_assignments AFTER UPDATE OF status ON declaration_batches
FOR EACH ROW EXECUTE FUNCTION public.sync_declaration_batch_assignments();
COMMIT;
