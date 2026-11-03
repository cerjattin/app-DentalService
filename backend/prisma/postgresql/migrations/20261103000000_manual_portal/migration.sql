BEGIN;
-- AlterTable
ALTER TABLE "declaration_batches" ADD COLUMN     "last_submission_attempt" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "declaration_manual_entries" (
    "id" BIGSERIAL NOT NULL,
    "organization_id" BIGINT NOT NULL,
    "declaration_batch_id" BIGINT NOT NULL,
    "state" VARCHAR(20) NOT NULL DEFAULT 'PREPARED',
    "claim_key" VARCHAR(128) COLLATE "C" NOT NULL,
    "content_hash" CHAR(64) NOT NULL,
    "content_snapshot" JSONB NOT NULL,
    "prepared_by_user_id" BIGINT NOT NULL,
    "prepared_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uncertainty_reason" VARCHAR(500),
    "release_reason" VARCHAR(500),
    "released_at" TIMESTAMPTZ(3),
    "resolution_document_id" BIGINT,
    "record_key" VARCHAR(128) COLLATE "C",
    "record_hash" CHAR(64),
    "submission_id" BIGINT,
    "receipt_document_id" BIGINT,
    "receipt_sha256" CHAR(64),
    "external_submitted_at" TIMESTAMPTZ(3),
    "confirmed_at" TIMESTAMPTZ(3),

    CONSTRAINT "declaration_manual_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "declaration_manual_results" (
    "id" BIGSERIAL NOT NULL,
    "manual_entry_id" BIGINT NOT NULL,
    "organization_id" BIGINT NOT NULL,
    "idempotency_key" VARCHAR(128) COLLATE "C" NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "status" "DeclarationSubmissionStatus" NOT NULL,
    "result_document_id" BIGINT NOT NULL,
    "result_sha256" CHAR(64) NOT NULL,
    "external_reference" VARCHAR(120),
    "reason" VARCHAR(500),
    "external_responded_at" TIMESTAMPTZ(3) NOT NULL,
    "recorded_by_user_id" BIGINT NOT NULL,
    "recorded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "line_results" JSONB NOT NULL,

    CONSTRAINT "declaration_manual_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_manual_entry_submission" ON "declaration_manual_entries"("submission_id");

-- CreateIndex
CREATE INDEX "idx_manual_entry_batch_state" ON "declaration_manual_entries"("declaration_batch_id", "state");

-- CreateIndex
CREATE INDEX "idx_manual_entry_user" ON "declaration_manual_entries"("prepared_by_user_id");

-- CreateIndex
CREATE INDEX "idx_manual_entry_receipt" ON "declaration_manual_entries"("receipt_document_id");

-- CreateIndex
CREATE INDEX "idx_manual_entry_resolution" ON "declaration_manual_entries"("resolution_document_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_manual_entry_claim_key" ON "declaration_manual_entries"("organization_id", "claim_key");

-- CreateIndex
CREATE UNIQUE INDEX "uq_manual_entry_record_key" ON "declaration_manual_entries"("organization_id", "record_key");

-- CreateIndex
CREATE UNIQUE INDEX "uq_manual_result_entry" ON "declaration_manual_results"("manual_entry_id");

-- CreateIndex
CREATE INDEX "idx_manual_result_user" ON "declaration_manual_results"("recorded_by_user_id");

-- CreateIndex
CREATE INDEX "idx_manual_result_document" ON "declaration_manual_results"("result_document_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_manual_result_key" ON "declaration_manual_results"("organization_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "declaration_manual_entries" ADD CONSTRAINT "declaration_manual_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "declaration_manual_entries" ADD CONSTRAINT "declaration_manual_entries_declaration_batch_id_fkey" FOREIGN KEY ("declaration_batch_id") REFERENCES "declaration_batches"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "declaration_manual_entries" ADD CONSTRAINT "declaration_manual_entries_prepared_by_user_id_fkey" FOREIGN KEY ("prepared_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "declaration_manual_entries" ADD CONSTRAINT "declaration_manual_entries_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "declaration_submissions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "declaration_manual_entries" ADD CONSTRAINT "declaration_manual_entries_receipt_document_id_fkey" FOREIGN KEY ("receipt_document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "declaration_manual_entries" ADD CONSTRAINT "declaration_manual_entries_resolution_document_id_fkey" FOREIGN KEY ("resolution_document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "declaration_manual_results" ADD CONSTRAINT "declaration_manual_results_manual_entry_id_fkey" FOREIGN KEY ("manual_entry_id") REFERENCES "declaration_manual_entries"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "declaration_manual_results" ADD CONSTRAINT "declaration_manual_results_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "declaration_manual_results" ADD CONSTRAINT "declaration_manual_results_recorded_by_user_id_fkey" FOREIGN KEY ("recorded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "declaration_manual_results" ADD CONSTRAINT "declaration_manual_results_result_document_id_fkey" FOREIGN KEY ("result_document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- One-time high-water backfill; runtime allocation is transactional increment.
WITH attempts AS (SELECT declaration_batch_id, max(attempt_number) AS value
  FROM declaration_submissions GROUP BY declaration_batch_id)
UPDATE declaration_batches b SET last_submission_attempt=a.value FROM attempts a WHERE b.id=a.declaration_batch_id;
ALTER TABLE declaration_batches ADD CONSTRAINT ck_submission_attempt_counter CHECK (last_submission_attempt >= 0);
ALTER TABLE declaration_manual_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE declaration_manual_results ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX uq_manual_entry_active_batch ON declaration_manual_entries(declaration_batch_id)
  WHERE state IN ('PREPARED','UNCERTAIN','RECORDED');
ALTER TABLE declaration_manual_entries ADD CONSTRAINT ck_manual_entry_state
  CHECK (state IN ('PREPARED','UNCERTAIN','RECORDED','RELEASED'));
ALTER TABLE declaration_manual_entries ADD CONSTRAINT ck_manual_entry_hash
  CHECK (content_hash COLLATE "C" ~ '^[a-f0-9]{64}$' AND jsonb_typeof(content_snapshot)='object');
ALTER TABLE declaration_manual_entries ADD CONSTRAINT ck_manual_entry_confirmed CHECK (
  (state='RECORDED' AND submission_id IS NOT NULL AND receipt_document_id IS NOT NULL AND receipt_sha256 IS NOT NULL
    AND record_key IS NOT NULL AND record_hash IS NOT NULL AND external_submitted_at IS NOT NULL AND confirmed_at IS NOT NULL)
  OR (state<>'RECORDED' AND submission_id IS NULL AND receipt_document_id IS NULL AND receipt_sha256 IS NULL
    AND record_key IS NULL AND record_hash IS NULL AND external_submitted_at IS NULL AND confirmed_at IS NULL));
ALTER TABLE declaration_manual_entries ADD CONSTRAINT ck_manual_entry_release CHECK (
  (state='RELEASED' AND released_at IS NOT NULL AND release_reason IS NOT NULL AND length(btrim(release_reason))>0)
  OR (state<>'RELEASED' AND released_at IS NULL AND release_reason IS NULL));
ALTER TABLE declaration_manual_entries ADD CONSTRAINT ck_manual_entry_uncertain
  CHECK (state<>'UNCERTAIN' OR (uncertainty_reason IS NOT NULL AND length(btrim(uncertainty_reason))>0));
ALTER TABLE declaration_manual_results ADD CONSTRAINT ck_manual_result_status
  CHECK (status IN ('ACCEPTED','PARTIALLY_REJECTED','REJECTED') AND jsonb_typeof(line_results)='array' AND jsonb_array_length(line_results)>0);
CREATE FUNCTION public.validate_manual_entry() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF TG_OP='UPDATE' THEN
    IF (OLD.organization_id,OLD.declaration_batch_id,OLD.claim_key,OLD.content_hash,OLD.content_snapshot,OLD.prepared_by_user_id,OLD.prepared_at)
       IS DISTINCT FROM (NEW.organization_id,NEW.declaration_batch_id,NEW.claim_key,NEW.content_hash,NEW.content_snapshot,NEW.prepared_by_user_id,NEW.prepared_at)
       OR OLD.state IN ('RECORDED','RELEASED') OR NEW.state NOT IN ('UNCERTAIN','RECORDED','RELEASED') THEN
      RAISE EXCEPTION 'Manual entry history is immutable';
    END IF;
  ELSIF NEW.state<>'PREPARED' THEN RAISE EXCEPTION 'Manual entry must be prepared first'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.declaration_batches b JOIN public.users u ON u.id=NEW.prepared_by_user_id
    WHERE b.id=NEW.declaration_batch_id AND b.organization_id=NEW.organization_id AND u.organization_id=NEW.organization_id) THEN
    RAISE EXCEPTION 'Manual entry organization mismatch';
  END IF;
  IF NEW.submission_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.declaration_submissions s
    WHERE s.id=NEW.submission_id AND s.declaration_batch_id=NEW.declaration_batch_id AND s.channel='MANUAL') THEN
    RAISE EXCEPTION 'Manual entry submission mismatch';
  END IF;
  IF EXISTS (SELECT 1 FROM (VALUES (NEW.receipt_document_id),(NEW.resolution_document_id)) x(id)
    LEFT JOIN public.documents d ON d.id=x.id WHERE x.id IS NOT NULL AND
      (d.id IS NULL OR d.organization_id<>NEW.organization_id OR d.document_type NOT IN ('OTHER','SUPPORTING_DOCUMENT'))) THEN
    RAISE EXCEPTION 'Manual entry document mismatch';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validate_manual_entry BEFORE INSERT OR UPDATE ON declaration_manual_entries
  FOR EACH ROW EXECUTE FUNCTION public.validate_manual_entry();
CREATE FUNCTION public.validate_manual_result() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Manual result history is immutable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.declaration_manual_entries e JOIN public.documents d ON d.id=NEW.result_document_id
    JOIN public.users u ON u.id=NEW.recorded_by_user_id
    WHERE e.id=NEW.manual_entry_id AND e.state='RECORDED' AND e.organization_id=NEW.organization_id
      AND d.organization_id=NEW.organization_id AND d.document_type IN ('OTHER','SUPPORTING_DOCUMENT') AND u.organization_id=NEW.organization_id) THEN
    RAISE EXCEPTION 'Manual result context mismatch';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validate_manual_result BEFORE INSERT OR UPDATE ON declaration_manual_results
  FOR EACH ROW EXECUTE FUNCTION public.validate_manual_result();
ALTER TABLE declaration_manual_entries ADD CONSTRAINT ck_manual_entry_receipt_hash CHECK (
  (receipt_sha256 IS NULL OR receipt_sha256 COLLATE "C" ~ '^[a-f0-9]{64}$') AND
  (record_hash IS NULL OR record_hash COLLATE "C" ~ '^[a-f0-9]{64}$'));
ALTER TABLE declaration_manual_results ADD CONSTRAINT ck_manual_result_hash CHECK (
  request_hash COLLATE "C" ~ '^[a-f0-9]{64}$' AND result_sha256 COLLATE "C" ~ '^[a-f0-9]{64}$');
ALTER TABLE declaration_manual_entries ADD CONSTRAINT ck_manual_entry_positive CHECK (id>0);
ALTER TABLE declaration_manual_results ADD CONSTRAINT ck_manual_result_positive CHECK (id>0);
CREATE FUNCTION public.protect_manual_evidence_delete() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public AS $$ BEGIN
  IF TG_TABLE_NAME='declaration_manual_results' OR OLD.state='RECORDED' THEN
    RAISE EXCEPTION 'Final manual evidence must not be deleted';
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER protect_manual_entry_delete BEFORE DELETE ON declaration_manual_entries
  FOR EACH ROW EXECUTE FUNCTION public.protect_manual_evidence_delete();
-- Separate function avoids referencing a non-existent state column on results.
CREATE FUNCTION public.protect_manual_result_delete() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public AS $$ BEGIN RAISE EXCEPTION 'Final manual evidence must not be deleted'; END $$;
CREATE TRIGGER protect_manual_result_delete BEFORE DELETE ON declaration_manual_results
  FOR EACH ROW EXECUTE FUNCTION public.protect_manual_result_delete();
CREATE FUNCTION public.protect_manual_item_identity() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE batch_id bigint;
BEGIN
  batch_id := CASE WHEN TG_OP='INSERT' THEN NEW.declaration_batch_id ELSE OLD.declaration_batch_id END;
  IF EXISTS (SELECT 1 FROM public.declaration_manual_entries e WHERE e.declaration_batch_id=batch_id AND e.state IN ('PREPARED','UNCERTAIN','RECORDED')) THEN
    IF TG_OP<>'UPDATE' OR (to_jsonb(OLD)-ARRAY['line_status','response_code','response_message','updated_at']) IS DISTINCT FROM
       (to_jsonb(NEW)-ARRAY['line_status','response_code','response_message','updated_at']) THEN
      RAISE EXCEPTION 'Manual declaration item identity is frozen';
    END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER protect_manual_item_identity BEFORE INSERT OR UPDATE OR DELETE ON declaration_items
  FOR EACH ROW EXECUTE FUNCTION public.protect_manual_item_identity();
CREATE FUNCTION public.protect_manual_batch_identity() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.declaration_manual_entries e WHERE e.declaration_batch_id=OLD.id AND e.state IN ('PREPARED','UNCERTAIN','RECORDED')) AND
     (NEW.organization_id,NEW.payer_id,NEW.declaration_number,NEW.declarant_id_snapshot,NEW.period_start,NEW.period_end) IS DISTINCT FROM
     (OLD.organization_id,OLD.payer_id,OLD.declaration_number,OLD.declarant_id_snapshot,OLD.period_start,OLD.period_end) THEN
    RAISE EXCEPTION 'Manual declaration identity is frozen';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_manual_batch_identity BEFORE UPDATE ON declaration_batches
  FOR EACH ROW EXECUTE FUNCTION public.protect_manual_batch_identity();
ALTER TABLE declaration_manual_entries ADD CONSTRAINT ck_manual_entry_keys CHECK (
  claim_key COLLATE "C" ~ '^[A-Za-z0-9._:-]{16,128}$' AND
  (record_key IS NULL OR record_key COLLATE "C" ~ '^[A-Za-z0-9._:-]{16,128}$'));
ALTER TABLE declaration_manual_results ADD CONSTRAINT ck_manual_result_key CHECK (
  idempotency_key COLLATE "C" ~ '^[A-Za-z0-9._:-]{16,128}$');
COMMIT;
