# Known Backend Contract Gaps

These are frozen Backend limitations, not Frontend defects. The Frontend must not work around them with inferred IDs, local business rules, or fabricated data.

## Scheduling And Coverage

- ClinicLocation lookup and shared appointment creation are available; patient/provider/location read permissions are required for selection.
- Appointment status history is not exposed as a read endpoint.
- Insurance verification metadata is not a service-date eligibility verdict. The Frontend must not label coverage as eligible from dates alone.

## Clinical And Billing

- TreatmentCase list/detail/create/update are published and integrated under patient routes in NEG-FUNC-05. Editing depends on server isEditable; no delete or state transitions are exposed.
- Production semantics for `NumberOfTreatments` and `Assistance` remain unresolved. No defaults are generated.
- Encounter completion does not automatically complete the appointment.
- Procedure deletion behavior differs between freeze prose and service implementation; no client workaround is used.
- Failed signature capture may leave an unlinked uploaded document because no cleanup endpoint exists.

## Declarations And Documents

- NEG-FUNC-04 publishes paginated candidates; selection submits the exact invoice-item ID and the Backend rechecks availability and SVB snapshots.
- Draft item removal/cancellation with reason are published and integrated. A declaration status-history read endpoint remains absent.
- `XLSX` and `API_PAYLOAD` appear in schema/domain types but are not supported by the mounted export service; the UI exposes only `CSV`, `TXT`, `JSON`, and `XML`.
- The submission adapter is not configured in the local environment; `SUBMISSION_ADAPTER_NOT_CONFIGURED` is expected.
- Historical document records `1202` and `1203` reference missing local files. Newly generated documents remain available.

## Administration And Session

- Organization settings GET/PATCH are published and integrated at `/admin/settings`, with independent permissions, reason and opaque revision. No organization create/delete workflow is exposed.
- Roles and permissions are read-only. No role mutation, custom permission assignment, or user-specific override endpoint exists.
- No administrative user deletion or password-reset endpoint is mounted.
- DBR-001 provides no refresh-token or server logout contract. Tokens remain memory-only, reload requires login, and logout discards the local token only.

NEG-FUNC-03/04/05 were verified against dedicated local PostgreSQL QA, not Supabase operational. See [validation and deployment prerequisites](NEG_FUNC_03_04_05_VALIDATION.md).

## NEG-FINAL-06 — Real Presentation

- `/svb-pilot/readiness` and embedded `realPresentationReadiness` publish the current blocked pilot and its empty enabled service/case lists. Frontend displays server status; technical COMPLETE/READY/export does not authorize real SVB presentation.
- Frontend READY/export explicitly request TECHNICAL. Backend rejects REAL_SVB until approved source rules and a verified destination format exist.
- Clinic location GET exposes stored policlinicCode. SVB-settings PATCH, authorized NumberOfTreatments/Assistance capture and accident/referral registration/lookup remain unpublished pending approved sources. No manual internal IDs or inferred fiscal defaults are offered.
- Candidate issues are server-provided per line. Assigned declaration items currently expose snapshots without per-line diagnostics; exhaustive pre-READY batch diagnosis requires a Backend read contract. Snapshot review does not replicate the fiscal validator.
- See [Frontend validation and source dependencies](NEG_FINAL_06_VALIDATION.md). The real ordinary-service/portal acceptance chain remains pending.

## NEG-FINAL-07/08/09 — Manual Recording And Pilot

- The seven manual-entry endpoints are mounted and published, and integrated by Frontend. No export is required for factual manual recording. Certified file/API readiness remains separate; the UI preserves the server's explicit manual capabilities.
- User confirmed one manual presentation per complete invoice. **FE-07-01 remains open:** Backend accepted a preparation containing only 1 of 22 items of a closed invoice. Frontend blocks multiple invoices/incomplete item sets against the exact version; server transactional enforcement is still required before pilot.
- Manual evidence uses private authenticated document upload/download. The UI limits evidence to 4 MB, preserves request keys/documents across retries, and requires every line result. No payment or automatic resubmission is inferred.
- Synthetic API evidence/idempotency/partial result and both invoice versions' signature/PDF after process restart passed in isolated QA. Full browser file selection/download and all agreed device/role paths remain incomplete because Computer Use stopped after failing to establish the current Windows browser URL.
- The operational destination still needs migration/permissions diagnostics, private persistent storage, recovery ownership and deployment smoke by its owners. Local build/Vercel configuration does not establish those facts.
- [Actual UAT matrix, blocker, files and evidence](NEG_FINAL_07_09_VALIDATION.md).

## DEP10/11 update — 2026-11-03

This section supersedes the historical FE-07-01 pending statement above: Backend now rejects an incomplete invoice with MANUAL_ENTRY_INCOMPLETE_INVOICE. Frontend retested 1/2 rejected and 2/2 prepared in explicitly enabled local QA. The original failure evidence remains unchanged. Manual recording is deferred by default; false/missing/error/refetch readiness disables new actions. Existing history/resolution remain permission protected. No client flag enables the server.

Frontend fixed dirty clinical navigation, dialog focus, Reception refresh and accessible attachment errors. Browser upload/download remain unverified because file chooser access failed and native Computer Use stopped when it could not verify the URL. DEP11 remains partial; see [current matrix and limits](NEG_DEP_11_12_VALIDATION.md). These Frontend acceptance items are not Backend contract gaps. Real SVB and remote deployment remain outside the current local-only acceptance.
