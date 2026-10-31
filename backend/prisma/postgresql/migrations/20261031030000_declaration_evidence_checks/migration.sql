-- Reject conflicting legacy evidence before this feature is enabled.
BEGIN;
LOCK TABLE declaration_batches, declaration_items, declaration_active_assignments IN SHARE ROW EXCLUSIVE MODE;
DO $$
DECLARE ev record; payload jsonb; explicit_batch bigint; item_batch bigint; key_batch bigint;
  item_ordinal integer; key_ordinal text; key_prefix text; expected_batch bigint; expected_ordinal integer;
BEGIN
  IF EXISTS (
    SELECT 1 FROM declaration_active_assignments a
    LEFT JOIN declaration_items di ON di.id = a.declaration_item_id
    LEFT JOIN declaration_batches db ON db.id = a.declaration_batch_id
    WHERE di.id IS NULL OR db.id IS NULL OR db.status = 'CANCELLED'
      OR di.invoice_item_id <> a.invoice_item_id OR di.declaration_batch_id <> a.declaration_batch_id
  ) THEN
    RAISE EXCEPTION 'NEG-FUNC-04: existing active assignment tuple is inconsistent; protected reconciliation required';
  END IF;
  FOR ev IN SELECT * FROM audit_logs WHERE action IN ('DECLARATION_ITEM_ADD','DECLARATION_ITEM_REMOVE') LOOP
    payload := CASE WHEN ev.action = 'DECLARATION_ITEM_ADD' THEN ev.new_values ELSE ev.old_values END;
    -- The prior incremental migration validates types/ranges and resolution.
    expected_ordinal := (payload->>'sequenceNumber')::integer;
    explicit_batch := (payload->>'declarationBatchId')::bigint;
    SELECT declaration_batch_id, sequence_number INTO item_batch, item_ordinal
      FROM declaration_items WHERE id = ev.entity_id;
    key_batch := NULL;
    IF ev.entity_key IS NOT NULL THEN
      IF ev.entity_key COLLATE "C" !~ ':[1-9][0-9]*$' THEN
        RAISE EXCEPTION 'NEG-FUNC-04: invalid audit entity key; protected reconciliation required';
      END IF;
      key_ordinal := substring(ev.entity_key COLLATE "C" FROM ':([0-9]+)$');
      key_prefix := regexp_replace(ev.entity_key COLLATE "C", ':[0-9]+$', '');
      IF key_ordinal::numeric <> expected_ordinal THEN
        RAISE EXCEPTION 'NEG-FUNC-04: conflicting audit ordinal evidence; no source was selected';
      END IF;
      SELECT id INTO key_batch FROM declaration_batches WHERE organization_id = ev.organization_id
        AND coalesce(declaration_number, id::text) = key_prefix;
      IF key_batch IS NULL THEN RAISE EXCEPTION 'NEG-FUNC-04: unresolved audit entity key'; END IF;
    END IF;
    expected_batch := coalesce(explicit_batch, item_batch, key_batch);
    IF (explicit_batch IS NOT NULL AND explicit_batch <> expected_batch) OR
       (item_batch IS NOT NULL AND item_batch <> expected_batch) OR
       (key_batch IS NOT NULL AND key_batch <> expected_batch) OR
       (item_ordinal IS NOT NULL AND item_ordinal <> expected_ordinal) THEN
      RAISE EXCEPTION 'NEG-FUNC-04: conflicting audit batch or ordinal evidence; no source was selected';
    END IF;
  END LOOP;
END $$;
COMMIT;
