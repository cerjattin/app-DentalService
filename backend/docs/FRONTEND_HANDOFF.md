# Frontend Handoff

## NEG-DEP-10/12 — prioridad sobre el flujo manual anterior

Primer despliegue con SVB aplazado: `manualPortalRecordingEnabled=false` por defecto; false/ausente/error no habilita preparar ni registrar. API directa rechaza nuevo prepare/registro con 409 SVB_PRESENTATION_DEFERRED. Mostrar “SVB submission pending — file specification not confirmed.” Historial, descarga interna, replays y resolución de reservas existentes se conservan. En QA explícito Backend impone factura/versión única CLOSED y todos sus ítems, con MANUAL_ENTRY_SINGLE_INVOICE_REQUIRED / MANUAL_ENTRY_INCOMPLETE_INVOICE, también al registrar. [Contrato exacto y pruebas](NEG_DEP_10_12.md). No basta guardia de pantalla; no transmitir al portal.

## NEG-FINAL-06 — alcance publicado 2026-11-02

Ver [handoff de datos y fuentes pendientes](NEG_FINAL_06.md). Se pueden leer `policlinicCode` de sedes y el estado GET `/svb-pilot/readiness`; realPresentationReadiness aparece en candidatos/declaraciones/exports y está BLOCKED. COMPLETE/READY y archivos actuales son validación técnica, no aprobación real. Una solicitud explícita REAL_SVB en READY/export recibe SVB_REAL_PRESENTATION_NOT_ENABLED. No habilitar captura NumberOfTreatments/Assistance, PATCH de SVB settings ni registro/lookup de accidente/remitente hasta publicar su contrato de fuente. Captura requiresReferral devuelve SVB_REFERRAL_FLOW_NOT_SUPPORTED; vínculos de accidente usan ACCIDENT_CASE_NOT_FOUND / ACCIDENT_INSURANCE_CONTEXT_MISMATCH / APPOINTMENT_CLINICAL_CONTEXT_LOCKED. POST/PATCH de procedimientos ahora rechazan campos desconocidos; no enviar quantity en PATCH ni snapshots/Referrer IDs por libre.

## NEG-FUNC-03/04/05 — API publicada 2026-10-31

Integrar FE03/04/05 con el [contrato Backend publicado](NEG_FUNC_03_04_05.md): Settings con revisión/motivo, Declarant ID administrado desde snapshots de factura, selección paginada de candidatos y casos por paciente. POST `/declarations` ahora rechaza Declarant ID no nulo del cliente; enviar ausencia/null. Los permisos nuevos `treatment_case.read/manage` requieren sincronización persistida antes de habilitar controles. DELETE Draft recibe body JSON `{ reason }`; cancelación conserva historial; ambos retornan Declaration completo. Candidates requiere declaración e invoice read. `isEditable` de casos es calculado por servidor. Aplicar las nuevas migraciones antes de usar estas rutas en otro entorno; no se ejecutaron sobre Supabase operativo desde esta entrega.

This is the compact React/Vite integration guide for the frozen backend contract.

## Runtime

PostgreSQL preparation: no Frontend API change. The local backend can be started with `npm run dev:supabase` after the database rollout; the browser still calls Express and never receives the database URL. Search support columns are internal and do not appear in DTOs. See [the rollout guide](../../docs/base-de-datos/MIGRACION_POSTGRESQL.md) for actual validation and pending Supabase/Postman steps.

- API base: `${VITE_API_BASE_URL}/api/v1`.
- Health: `${VITE_API_BASE_URL}/health/live` and `/health/ready`.
- Send `Authorization: Bearer <accessToken>` on protected calls.
- Store token according to the frontend security decision. Current backend has access tokens only; DBR-001 blocks revocable refresh/logout, so logout is client-side token discard.
- Every API response is an envelope: check `success` first. Use `error.code` for UX branching and show/log `correlationId`.

## Login Flow

1. `POST /auth/login` with `{ email, password }`.
2. Save `data.accessToken`.
3. Call `GET /auth/me` to load `{ id, email, firstName, lastName, status, roles, permissions, organizationId }`.
4. Drive menus/buttons from `permissions`, not role names.

## Permission Matrix

- ADMIN: all seeded permissions.
- RECEPTION: patients, insurance, appointment create/check-in/cancel, encounter read, catalog/auth read+write, invoice create/prepare/sign/close/request correction, signature capture, documents, declaration read.
- PROVIDER: patient/insurance read, appointment read/start/complete, encounter create/update/complete, diagnosis assign, procedure update flow, invoice read/create/prepare/sign, signature capture, documents read/generate.

## Screens And Routes

- Login: `POST /auth/login`, `GET /auth/me`.
- Users/Roles: `/users`, `/users/:id`, `/users/:id/status`, `/users/:id/roles`, `/roles`.
- Patients: `/patients`, `/patients/:id`, `/patients/:id/archive`.
- Insurance: `/payers`, `/patients/:patientId/insurance`, `/patients/:patientId/insurance/:insuranceId/verify`.
- Providers: `/providers`, `/providers/:id`.
- Agenda: `/appointments`, `/appointments/:id`, `/appointments/:id/status`.
- Clinical encounter: `/appointments/:appointmentId/clinical-encounter`, `/clinical-encounters`, `/clinical-encounters/:id`, `/clinical-encounters/:id/complete`.
- Diagnosis/procedures: `/diagnosis-codes`, `/clinical-encounters/:encounterId/diagnoses`, `/clinical-encounters/:encounterId/procedures`.
- SVB catalog/auth: `/svb-procedures`, `/svb-procedures/:id/applicable-tariff`, `/authorizations`, `/authorizations/:id`, `/authorizations/:authorizationId/items`.
- Invoice/signature/PDF: `/appointments/:appointmentId/invoice`, `/invoices`, `/invoices/:id`, `/invoices/:id/versions`, `/invoices/:id/versions/:versionId/*`.
- Documents: `/documents`, `/documents/:id`, `/documents/:id/download`, `/invoices/:invoiceId/documents`.
- Declarations: `/declarations`, `/declarations/:id/items`, `/declarations/:id/ready`, `/declarations/:id/exports`, `/declarations/:id/submit`, `/declarations/:id/submissions`.

## DTO Rules

- Treat all IDs as strings.
- Treat money and quantity as strings, not numbers.
- Use `YYYY-MM-DD` for date-only fields.
- Use ISO timestamps with timezone offset for appointment times.
- List screens should read `data` plus `meta.pagination`.

## Key States

- Appointment: `SCHEDULED`, `CONFIRMED`, `CHECKED_IN`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `NO_SHOW`.
- Encounter: `OPEN`, `COMPLETED`, `VOID`.
- Invoice: `DRAFT`, `PENDING_SIGNATURE`, `SIGNED`, `CLOSED`, `DECLARED`, `CORRECTION_REQUIRED`, `CANCELLED`.
- Correction: `REQUESTED`, `APPROVED`, `APPLIED`, `REJECTED`, `CANCELLED`.
- Declaration: `DRAFT`, `READY`, `EXPORTED`, `SUBMITTED`, `ACCEPTED`, `PARTIALLY_REJECTED`, `REJECTED`, `CANCELLED`.

## Signature To Closed PDF

1. Create invoice from completed appointment.
2. Prepare signature on invoice version.
3. Fetch signature content and content hash.
4. Upload signature image/document with `POST /documents`.
5. Capture signature with expected hash.
6. Confirm version signed.
7. Close version/invoice.
8. Generate PDF with `POST /invoices/:id/versions/:versionId/pdf`.
9. Download via returned document id or list invoice documents.

## Correction Flow

1. Request correction on a closed invoice.
2. Approve or reject/cancel the request.
3. For approved correction, create replacement version.
4. Optionally patch correction invoice items. Explicit snapshot fields are allowed.
5. Run the same prepare-signature, capture, sign, close, PDF flow.

## Declaration Flow

1. Create declaration batch for payer/period.
2. Add closed invoice items.
3. For the current field-by-field manual portal workflow, read and prepare `/manual-entry` before the operator enters the portal. No READY/export is required for this workflow.
4. Record the completed external action with proof through `/submissions/manual`; later record all line outcomes through `/official-result`. Download/preparation does not imply submission or acceptance.
5. Technical ready/export and the existing adapter path remain separate. Without a configured transport adapter the old submit route returns `SUBMISSION_ADAPTER_NOT_CONFIGURED`.
6. Exact permissions, DTOs, errors, immutable state and uncertainty handling: [manual entry handoff](NEG_FINAL_07_09.md). Do not use internal files as an official SVB upload layout.

## Files And Binaries

Uploads use raw binary body and query params for document type/name. Downloads return binary bytes. The frontend should not parse document metadata from file paths; use document DTOs returned by the API.

## MASTER-02R catalogue administration handoff

The exact nine-route contract, input field matrix, error codes, pagination, validity and overlap semantics are documented in [API_FREEZE_BACKEND.md](API_FREEZE_BACKEND.md#master-02r--svb-procedure-and-tariff-administration) and exposed in `/api/openapi.json`.

- `/api/v1/svb-procedures`: GET requires `svb_procedure.read`; POST requires `svb_procedure.manage`.
- `/api/v1/svb-procedures/:id`: GET requires `svb_procedure.read`; PATCH requires `svb_procedure.manage`.
- `/api/v1/svb-procedures/:id/status`: PATCH `{ isActive: boolean }` requires `svb_procedure.manage`.
- `/api/v1/svb-procedures/:procedureId/tariffs`: GET requires `svb_tariff.read`; POST requires `svb_tariff.manage`.
- `/api/v1/svb-procedures/:procedureId/tariffs/:tariffId`: PATCH requires `svb_tariff.manage`.
- `/api/v1/svb-procedures/:procedureId/applicable-tariff`: GET with mandatory `serviceDate` and `currencyCode` requires `svb_tariff.read`.

Service create accepts required `code`, `description` and optional nullable `category`, `unit`, `validFrom`, `validTo`, plus optional boolean `requiresAuthorization`, `requiresReferral`, `isActive`. Service PATCH accepts the same mutable fields, each optional, at least one required. Tariff create requires string `amount`, explicit `currencyCode`, `validFrom`; optional nullable `validTo` and boolean `isActive`. Tariff PATCH accepts those same five fields, at least one. Unknown fields, IDs, audit fields and historical fields are rejected. Dates stay YYYY-MM-DD business dates; monetary state must stay Decimal strings. `"88.80"` returns as `"88.80"`; currency has no implicit ANG default.

Display activation/inactivation, never deletion. No physical DELETE exists. Retain tariff history; applicable tariff is a separate date/currency lookup. Active overlaps within one procedure/currency are rejected on create, edit and reactivation; dates are inclusive. Adjacent June 30 / July 1 periods are allowed. Duplicate start dates remain disallowed for inactive tariffs too. Map `SVB_PROCEDURE_CODE_ALREADY_EXISTS`, `INVALID_SVB_PROCEDURE_PERIOD`, `SVB_TARIFF_NOT_FOUND`, `SVB_TARIFF_ALREADY_EXISTS`, `INVALID_SVB_TARIFF_PERIOD`, `SVB_TARIFF_PERIOD_OVERLAP` and existing not-found/inactive/not-valid/ambiguous codes exactly. Inactive applicable lookup remains 409 `SVB_PROCEDURE_INACTIVE`.

Clinical currently requests `isActive=true` and `serviceDate`. List filtering only checks dates when `serviceDate` is supplied. Future MASTER-03 should share this catalogue resource/cache and invalidate relevant queries after mutations. Master configuration changes preserve patient authorizations and all past clinical/billing snapshots, versions, PDFs and declarations. No Frontend work is included in MASTER-02R. Do not treat source completion as runtime QA signoff; consult `MASTER_02R_RESULTS.md`.


## Operational forward corrections

Appointment creation is now available through the existing POST /api/v1/appointments plus GET /api/v1/clinic-locations?isActive=true (clinic_location.read). Shared Frontend creation requires independent patient/provider/location read permissions and appointment.create. Dashboard now consumes GET /api/v1/reports/dashboard (dashboard.read) with inclusive Curacao from/to dates and optional organization-scoped providerId. Exact request/response fields, Decimal string/currency rules, metric/date/correction/assignment semantics and errors are documented in [OPERATIONAL_CORRECTIONS.md](OPERATIONAL_CORRECTIONS.md). No schema, migration, seed or existing catalogue contract changes.

## Supplied invoice form and confirmed fixes — 2026-10-30

The appointment `date` filter now denotes the Curaçao business day. Frontend keeps sending the existing YYYY-MM-DD value. Declaration confirmation errors are shown within the active modal.

PDF generation uses the existing endpoint and now returns a stored SVB form with visible saved signature, layout metadata `svb_notaform_v1` and filename ending `-svb.pdf`. Older technical PDFs remain separate downloadable records; keep filtering documents by the exact invoice version. No new signature or snapshot edit is needed to generate the new layout for an eligible CLOSED version. Blank historical fields remain blank; Aantal is procedure quantity as confirmed by the user. [Mapping, integrity and fresh validation](SVB_FORM_AND_OPERATIONAL_FIXES.md).

## Return to clinical care — 2026-10-30

Admin's complete seeded permission set includes the permissions for **Return to clinical care** on eligible invoice detail pages. UI uses permissions, never role names. The action requires a reason and sends the expected current version as a string to `POST /invoices/:id/reopen-encounter`; the existing invoice DTO is returned. An active declaration assignment or correction produces a visible conflict in the modal.

Navigate to `/clinical/:appointmentId`, remove/add services, and complete the clinical encounter. The appointment remains completed. **Rebuild invoice from corrected services** calls the existing appointment invoice endpoint; one logical invoice/number is retained. Until rebuilding, the empty replacement cannot be prepared for signature. A new signature and authorized close complete the correction. Historical versions/signatures/documents remain available. Before initial clinical completion, professionals can already remove an unbilled mistake and add the right service using `procedure.update`. [Full Backend rules and limitations](CLINICAL_REBILLING.md).
