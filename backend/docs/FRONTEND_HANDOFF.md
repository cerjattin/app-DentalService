# Frontend Handoff

This is the compact React/Vite integration guide for the frozen backend contract.

## Runtime

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
3. Mark ready.
4. Export in supported format: `CSV`, `TXT`, `JSON`, `XML`, `XLSX`, `API_PAYLOAD`.
5. Submit only after export. Without adapter, backend returns `SUBMISSION_ADAPTER_NOT_CONFIGURED`.
6. Record/read submission result when available.

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
