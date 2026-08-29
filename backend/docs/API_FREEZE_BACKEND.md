# API Freeze Backend

Base URL: `/api/v1`

## API Conventions

All protected endpoints require `Authorization: Bearer <accessToken>`. Success responses use `{ "success": true, "data": ... }`; paginated lists also include `meta`. Errors use `{ "success": false, "error": { "code", "message", "details?", "correlationId" } }`.

Identifiers backed by MySQL `BIGINT` are serialized as strings. Financial and quantity `Decimal` values are serialized as strings with fixed scale. Date-only fields use `YYYY-MM-DD`; timestamps use ISO 8601. Business timezone is `America/Curacao`.

## Public Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health/live` | Process liveness |
| GET | `/health/ready` | Database readiness |
| POST | `/auth/login` | Access token login, rate limited |
| GET | `/api/openapi.json` | Current OpenAPI document |
| GET | `/api/docs` | Swagger UI |

## Auth And RBAC

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/auth/me` | authenticated user |
| GET | `/users` | `user.read` |
| GET | `/users/:id` | `user.read` |
| POST | `/users` | `user.create` |
| PATCH | `/users/:id` | `user.update` |
| PATCH | `/users/:id/status` | `user.update` |
| PUT | `/users/:id/roles` | `user.assign_roles` |
| GET | `/roles` | `role.read` |

## Master And Clinical Workflow

| Module | Endpoints | Permissions |
| --- | --- | --- |
| Patients | `GET /patients`, `GET /patients/:id`, `POST /patients`, `PATCH /patients/:id`, `PATCH /patients/:id/archive` | `patient.read`, `patient.create`, `patient.update`, `patient.archive` |
| Insurance | `GET /payers`, `GET/POST /patients/:patientId/insurance`, `GET/PATCH /patients/:patientId/insurance/:insuranceId`, `POST /patients/:patientId/insurance/:insuranceId/verify` | `insurance.read`, `insurance.create`, `insurance.update`, `insurance.verify` |
| Providers | `GET /providers`, `GET /providers/:id`, `POST /providers`, `PATCH /providers/:id` | `provider.read`, `provider.create`, `provider.update` |
| Appointments | `GET /appointments`, `GET /appointments/:id`, `POST /appointments`, `PATCH /appointments/:id`, `PATCH /appointments/:id/status` | `appointment.read`, `appointment.create`, `appointment.update`, status-specific appointment permissions |
| Encounters | `GET /clinical-encounters`, `GET /clinical-encounters/:id`, `PATCH /clinical-encounters/:id`, `POST /clinical-encounters/:id/complete`, `GET/POST /appointments/:appointmentId/clinical-encounter` | `encounter.read`, `encounter.update`, `encounter.complete`, `encounter.create` |
| Diagnosis | `GET /diagnosis-codes`, `GET /diagnosis-codes/:id`, `GET/POST /clinical-encounters/:encounterId/diagnoses`, `PATCH/DELETE /clinical-encounters/:encounterId/diagnoses/:diagnosisId` | `diagnosis.read`, `diagnosis.assign` |

## SVB, Billing, Documents, Declarations

| Module | Endpoints | Permissions |
| --- | --- | --- |
| SVB Catalog | `GET /svb-procedures`, `GET /svb-procedures/:id`, `GET /svb-procedures/:procedureId/tariffs`, `GET /svb-procedures/:procedureId/applicable-tariff` | `svb_procedure.read`, `svb_tariff.read` |
| Authorizations | `GET/POST /authorizations`, `GET/PATCH /authorizations/:id`, `GET/POST /authorizations/:authorizationId/items`, `PATCH /authorizations/:authorizationId/items/:itemId` | `authorization.read`, `authorization.create`, `authorization.update` |
| Encounter Procedures | `GET/POST /clinical-encounters/:encounterId/procedures`, `GET/PATCH/DELETE /clinical-encounters/:encounterId/procedures/:procedureId` | `procedure.read`, `procedure.add`, `procedure.update`, `procedure.void` |
| Invoices | `GET /invoices`, `GET /invoices/:id`, `POST /appointments/:appointmentId/invoice`, correction/version/status/document/signature subroutes | `invoice.read`, `invoice.create`, `invoice.prepare_signature`, `invoice.sign`, `invoice.close`, `invoice.request_correction`, `invoice.apply_correction`, `invoice.cancel`, `document.generate` |
| Documents | `POST /documents`, `GET /documents/:id`, `GET /documents/:id/download`, `GET /invoices/:invoiceId/documents` | `document.upload`, `document.read` |
| Declarations | `GET/POST /declarations`, `GET /declarations/:id`, `POST /declarations/:id/items`, `POST /declarations/:id/ready`, `GET/POST /declarations/:id/exports`, submission subroutes | `declaration.read`, `declaration.create`, `declaration.update`, `declaration.export`, `declaration.submit` |
| Submission | `GET /declarations/:id/submissions`, `GET /declarations/:id/submissions/:submissionId`, `POST /declarations/:id/submit`, `POST /declarations/:id/submissions/:submissionId/result` | `declaration.read`, `declaration.submit` |

## Relevant Enums

Appointment status: `SCHEDULED`, `CONFIRMED`, `CHECKED_IN`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `NO_SHOW`.

Declaration status: `DRAFT`, `READY`, `EXPORTED`, `SUBMITTED`, `ACCEPTED`, `PARTIALLY_REJECTED`, `REJECTED`, `CANCELLED`.

Submission channel/status: `PORTAL_UPLOAD`, `API`, `MANUAL`, `OTHER`; `SUBMITTED`, `ACCEPTED`, `PARTIALLY_REJECTED`, `REJECTED`, `FAILED`.

Document type: `SIGNATURE`, `INVOICE_PDF`, `SIGNED_INVOICE_PDF`, `AUTHORIZATION`, `SUPPORTING_DOCUMENT`, `DECLARATION_EXPORT`, `OTHER`.

## Freeze Notes

OpenAPI is partially documented in code and currently covers health/auth through the registry. This Markdown file is the API freeze source for Frontend handoff until the OpenAPI registry is expanded module by module.

Known blockers: DBR-001 auth session persistence, official SVB procedure/tariff master data, official SVB PDF/layout, confirmed CSV/TXT declaration headers, real SVB submission adapter, production declarant configuration.
