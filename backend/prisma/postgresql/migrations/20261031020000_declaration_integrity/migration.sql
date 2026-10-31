-- Incremental review of NEG-FUNC-04. Does not rewrite applied migrations.
BEGIN;
LOCK TABLE declaration_batches, declaration_items, declaration_active_assignments IN SHARE ROW EXCLUSIVE MODE;
DO $$
DECLARE ev record; payload jsonb; ordinal numeric; batch_id bigint; raw_id text;
BEGIN
  FOR ev IN SELECT * FROM audit_logs WHERE action IN ('DECLARATION_ITEM_ADD','DECLARATION_ITEM_REMOVE') LOOP
    payload := CASE WHEN ev.action = 'DECLARATION_ITEM_ADD' THEN ev.new_values ELSE ev.old_values END;
    IF jsonb_typeof(payload) IS DISTINCT FROM 'object' OR
       coalesce(payload->>'sequenceNumber','') COLLATE "C" !~ '^[1-9][0-9]*$' THEN
      RAISE EXCEPTION 'NEG-FUNC-04: invalid ordinal audit evidence; protected reconciliation required';
    END IF;
    ordinal := (payload->>'sequenceNumber')::numeric;
    IF ordinal > 2147483647 THEN RAISE EXCEPTION 'NEG-FUNC-04: ordinal audit evidence exceeds integer range'; END IF;
    raw_id := payload->>'declarationBatchId';
    IF raw_id IS NOT NULL THEN
      IF raw_id COLLATE "C" !~ '^[1-9][0-9]*$' OR length(raw_id) > 19 THEN
        RAISE EXCEPTION 'NEG-FUNC-04: invalid batch identity in ordinal audit evidence';
      END IF;
      IF raw_id::numeric > 9223372036854775807 THEN RAISE EXCEPTION 'NEG-FUNC-04: audit batch identity exceeds bigint range'; END IF;
      batch_id := raw_id::bigint;
    ELSE
      -- Older ADD events did not include batch ID. Resolve only retained item or
      -- the authoritative organization-scoped batch number in the original key.
      SELECT declaration_batch_id INTO batch_id FROM declaration_items WHERE id = ev.entity_id;
      IF batch_id IS NULL THEN
        SELECT id INTO batch_id FROM declaration_batches
          WHERE organization_id = ev.organization_id AND declaration_number =
            regexp_replace(ev.entity_key COLLATE "C", ':[0-9]+$', '');
      END IF;
    END IF;
    IF batch_id IS NULL OR NOT EXISTS (SELECT 1 FROM declaration_batches WHERE id = batch_id AND organization_id = ev.organization_id) THEN
      RAISE EXCEPTION 'NEG-FUNC-04: unresolved ordinal audit evidence; protected reconciliation required';
    END IF;
    UPDATE declaration_batches SET last_item_sequence = greatest(last_item_sequence, ordinal::integer) WHERE id = batch_id;
  END LOOP;
END $$;

CREATE FUNCTION public.validate_declaration_active_assignment() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.declaration_items di
    JOIN public.declaration_batches db ON db.id = di.declaration_batch_id
    WHERE di.id = NEW.declaration_item_id AND di.invoice_item_id = NEW.invoice_item_id
      AND di.declaration_batch_id = NEW.declaration_batch_id AND db.status <> 'CANCELLED') THEN
    RAISE EXCEPTION 'Active declaration assignment does not match its historical item and active batch';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validate_declaration_active_assignment BEFORE INSERT OR UPDATE ON declaration_active_assignments
FOR EACH ROW EXECUTE FUNCTION public.validate_declaration_active_assignment();
COMMIT;
