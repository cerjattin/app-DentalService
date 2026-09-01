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
