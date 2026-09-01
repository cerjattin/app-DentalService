# API Freeze Backend

Status: frozen for Frontend integration after Sprint 19 QA Postman. This file documents implemented and tested behavior only. Do not infer future SVB semantics from this contract.

## Platform Contract

- Base API URL: `/api/v1`.
- Health and docs: `/health/live`, `/health/ready`, `/api/openapi.json`, `/api/docs`.
- Auth: `POST /api/v1/auth/login`, `GET /api/v1/auth/me`.
- Success envelope: `{ "success": true, "data": ..., "meta"?: ... }`.
- Error envelope: `{ "success": false, "error": { "code", "message", "details"?, "correlationId"? } }`.
- MySQL `BIGINT` values are returned as strings.
- Money and quantity `Decimal` values are returned as fixed-scale strings.
- Date-only fields use `YYYY-MM-DD`; timestamps use ISO 8601 with timezone.
- Business timezone: `America/Curacao`.
- Auth tokens are access tokens only. Revocable refresh/logout remains blocked by DBR-001.

## RBAC

Authorization is permission-based through `requirePermission(...)`, not role-name checks. `ADMIN` receives all seeded permissions. `RECEPTION` covers front desk, insurance, appointments, signature/PDF, invoice close/correction request, and declaration read. `PROVIDER` covers clinical work, encounter procedures, invoice read/create/prepare/sign, signature capture, and document read/generate.

## Endpoint Freeze

| Module | Endpoints | Main permissions |
| --- | --- | --- |
| Auth | `POST /auth/login`, `GET /auth/me` | authenticated |
| Roles | `GET /roles` | `role.read` |
| Users | `GET /users`, `GET /users/:id`, `POST /users`, `PATCH /users/:id`, `PATCH /users/:id/status`, `PUT /users/:id/roles` | `user.*`, `role.read` |
| Patients | `GET /patients`, `GET /patients/:id`, `POST /patients`, `PATCH /patients/:id`, `PATCH /patients/:id/archive` | `patient.read/create/update/archive` |
| Insurance | `GET /payers`, `GET/POST /patients/:patientId/insurance`, `GET/PATCH /patients/:patientId/insurance/:insuranceId`, `POST /patients/:patientId/insurance/:insuranceId/verify` | `insurance.read/create/update/verify` |
| Providers | `GET /providers`, `GET /providers/:id`, `POST /providers`, `PATCH /providers/:id` | `provider.read/create/update` |
| Appointments | `GET /appointments`, `GET /appointments/:id`, `POST /appointments`, `PATCH /appointments/:id`, `PATCH /appointments/:id/status` | `appointment.read/create/update/check_in/start/complete/cancel` |
| Clinical encounters | `GET /clinical-encounters`, `GET /clinical-encounters/:id`, `GET/POST /appointments/:appointmentId/clinical-encounter`, `PATCH /clinical-encounters/:id`, `POST /clinical-encounters/:id/complete` | `encounter.read/create/update/complete` |
| Diagnosis | `GET /diagnosis-codes`, `GET /diagnosis-codes/:id`, `GET/POST/PATCH/DELETE /clinical-encounters/:encounterId/diagnoses...` | `diagnosis.read/assign` |
| SVB catalog | `GET /svb-procedures`, `GET /svb-procedures/:id`, `GET /svb-procedures/:procedureId/tariffs`, `GET /svb-procedures/:procedureId/applicable-tariff` | `svb_procedure.read`, `svb_tariff.read` |
| Authorizations | `GET/POST /authorizations`, `GET/PATCH /authorizations/:id`, `GET/POST /authorizations/:authorizationId/items`, `PATCH /authorizations/:authorizationId/items/:itemId` | `authorization.read/create/update` |
| Encounter procedures | `GET/POST /clinical-encounters/:encounterId/procedures`, `GET/PATCH/DELETE /clinical-encounters/:encounterId/procedures/:encounterProcedureId` | route uses `procedure.read` and `procedure.update` |
| Invoices | `GET /invoices`, `GET /invoices/:id`, `POST /appointments/:appointmentId/invoice`, `POST /invoices/:id/cancel`, versions/corrections/status/PDF subroutes | `invoice.*`, `document.generate` |
| Signatures | `POST /invoices/:invoiceId/versions/:versionId/prepare-signature`, `GET .../signature-content`, `GET/POST .../signatures`, `POST .../sign`, `POST .../close`, `POST .../signatures/:signatureId/void` | `invoice.prepare_signature/read/sign/close`, `signature.capture/void` |
| Documents | `POST /documents`, `GET /documents/:id`, `GET /documents/:id/download`, `GET /invoices/:invoiceId/documents` | `document.upload/read` |
| Declarations | `GET/POST /declarations`, `GET /declarations/:id`, `GET/POST /declarations/:id/items`, `POST /declarations/:id/ready`, `GET/POST /declarations/:id/exports`, `GET /declarations/:id/submissions`, `POST /declarations/:id/submit`, `POST /declarations/:id/submissions/:submissionId/result` | `declaration.read/create/update/export/submit` |

## State Machines

- Appointment: `SCHEDULED -> CONFIRMED/CHECKED_IN/CANCELLED/NO_SHOW`; `CONFIRMED -> CHECKED_IN/CANCELLED/NO_SHOW`; `CHECKED_IN -> IN_PROGRESS/CANCELLED/NO_SHOW`; `IN_PROGRESS -> COMPLETED/CANCELLED`. Final: `COMPLETED`, `CANCELLED`, `NO_SHOW`.
- Blocking appointment statuses for provider overlap: `SCHEDULED`, `CONFIRMED`, `CHECKED_IN`, `IN_PROGRESS`.
- Clinical encounter: `OPEN -> COMPLETED`; `VOID` is readable if present. Completed/void encounters are not editable.
- Encounter procedure: created as `PERFORMED`; delete route voids logically. Billed procedures cannot be modified.
- Invoice: `DRAFT -> PENDING_SIGNATURE -> SIGNED -> CLOSED`; draft can be `CANCELLED`. `CLOSED` can enter `CORRECTION_REQUIRED`; correction replacement closes back to `CLOSED` and supersedes the prior version.
- Invoice version: `DRAFT`, `PENDING_SIGNATURE`, `SIGNED`, `CLOSED`, `SUPERSEDED`, `VOID`.
- Correction: `REQUESTED -> APPROVED -> APPLIED` or `REJECTED`/`CANCELLED`.
- Declaration: `DRAFT -> READY -> EXPORTED -> SUBMITTED -> ACCEPTED/PARTIALLY_REJECTED/REJECTED`.
- Submission result statuses: `ACCEPTED`, `PARTIALLY_REJECTED`, `REJECTED`; missing adapter returns `SUBMISSION_ADAPTER_NOT_CONFIGURED`.

## Main DTO Notes

- IDs are strings in request bodies and responses.
- List endpoints support `page` and `pageSize`; response `meta` contains pagination.
- Upload: `POST /documents?documentType=SIGNATURE|AUTHORIZATION|SUPPORTING_DOCUMENT|OTHER&originalFilename=...` with raw binary body.
- Download: `GET /documents/:id/download` returns the stored binary.
- Signature capture requires `signatureDocumentId`, `signatureType`, `captureMethod`, and `expectedContentHash`.
- Invoice PDF generation is `POST /invoices/:id/versions/:versionId/pdf`; it uses PDFKit, stores through document storage, and is available for closed signed invoice versions.
- Monetary/quantity snapshots are strings, for example `"75.00"` or `"1.00"`.

## SVB Snapshot Rules

- TreatmentId is frozen from `TreatmentCase.treatmentId` into procedure/invoice/declaration snapshots.
- PoliClinic is frozen from `ClinicLocation.policlinicCode`.
- The backend does not invent production semantics for `numberOfTreatmentsSnapshot` or `assistanceSnapshot`; they stay null unless explicitly set in a correction item.
- Correction item update allows explicit snapshot fields, including treatment, policlinic, number of treatments, and assistance.
- SVB procedure/tariff catalog is read-only; productive master data remains external.

## Common Error Codes

Auth/RBAC: `AUTHENTICATION_REQUIRED`, `INVALID_CREDENTIALS`, `ACCOUNT_LOCKED`, `PERMISSION_DENIED`, `VALIDATION_ERROR`, `INVALID_ID`, `ROUTE_NOT_FOUND`.

Domain errors include: `PATIENT_NOT_FOUND`, `INSURANCE_NOT_FOUND`, `PROVIDER_NOT_FOUND`, `LOCATION_NOT_FOUND`, `APPOINTMENT_PROVIDER_OVERLAP`, `INVALID_APPOINTMENT_STATUS_TRANSITION`, `CLINICAL_ENCOUNTER_ALREADY_EXISTS`, `CLINICAL_ENCOUNTER_NOT_EDITABLE`, `SVB_TARIFF_AMBIGUOUS`, `AUTHORIZATION_QUANTITY_EXCEEDED`, `ENCOUNTER_PROCEDURE_ALREADY_BILLED`, `INVOICE_ALREADY_EXISTS`, `INVOICE_VERSION_NOT_SIGNATURE_READY`, `INVOICE_SIGNATURE_CONTENT_MISMATCH`, `INVOICE_ALREADY_CLOSED`, `INVOICE_CORRECTION_ALREADY_ACTIVE`, `DECLARATION_NOT_READY`, `DECLARATION_SVB_DATA_INCOMPLETE`, `UNSUPPORTED_EXPORT_FORMAT`, `SUBMISSION_ADAPTER_NOT_CONFIGURED`.

## Freeze Boundaries

No frontend should rely on unimplemented endpoints for organization/settings/audit administration. No CRUD exists for SVB productive master data. No revocable refresh token/logout is implemented until DBR-001. Declaration submission is recorded locally unless a real adapter is configured.
