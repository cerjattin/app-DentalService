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

## MASTER-02R — SVB procedure and tariff administration

Domain: Service/SKU = `SvbProcedure`; performed care = `EncounterProcedure`; price history = `SvbTariff`. No separate service model or mapping. All paths below are mounted under `/api/v1`. Bearer authentication is required. Permissions are independent; no role-name shortcut and no read-implies-manage rule.

| Method | Path (after `/api/v1`) | Required permission | Success |
|---|---|---|---|
| GET | `/svb-procedures` | `svb_procedure.read` | 200 paginated procedures |
| GET | `/svb-procedures/:id` | `svb_procedure.read` | 200 procedure |
| POST | `/svb-procedures` | `svb_procedure.manage` | 201 procedure |
| PATCH | `/svb-procedures/:id` | `svb_procedure.manage` | 200 procedure |
| PATCH | `/svb-procedures/:id/status` | `svb_procedure.manage` | 200 procedure |
| GET | `/svb-procedures/:procedureId/tariffs` | `svb_tariff.read` | 200 paginated tariffs |
| GET | `/svb-procedures/:procedureId/applicable-tariff` | `svb_tariff.read` | 200 procedure + tariff + serviceDate |
| POST | `/svb-procedures/:procedureId/tariffs` | `svb_tariff.manage` | 201 tariff |
| PATCH | `/svb-procedures/:procedureId/tariffs/:tariffId` | `svb_tariff.manage` | 200 tariff |

Mutation bodies are strict: unknown and system fields are rejected. A PATCH requires at least one mutable field. No DELETE endpoint exists for either master resource. Response envelope: `{ success: true, data, meta? }`; pagination meta contains `page`, `pageSize`, `total`, `totalPages`. IDs and parent IDs are strings, never JS numbers.

### Procedure input and output

| Field | Create | PATCH | Validation/default |
|---|---|---|---|
| code | required | optional | Trimmed nonempty string, max 50; unique authoritative SKU |
| description | required | optional | Trimmed nonempty string, max 500 |
| category | optional | optional | Nullable string, max 120; omitted create => null |
| unit | optional | optional | Nullable string, max 50; omitted create => null |
| requiresAuthorization | optional | optional | Boolean; create default false; master configuration only |
| requiresReferral | optional | optional | Boolean; create default false; no referral workflow |
| isActive | optional | optional | Boolean; create default true |
| validFrom | optional | optional | Nullable business date YYYY-MM-DD; create default null |
| validTo | optional | optional | Nullable business date YYYY-MM-DD; create default null |

Responses expose these fields plus string `id`, `createdAt`, `updatedAt`. Status accepts exactly `{ "isActive": boolean }` and uses the same audited update transaction as normal PATCH. Inactivation preserves the row and historical readability. Null validity bounds are open-ended. Merged PATCH state is validated, so changing only one bound cannot create an inverted period. Dates must be real calendar dates; no client timezone conversion is required.

### Tariff input and output

Create requires `amount` (nonnegative decimal **string**, 1–13 integer digits and up to 2 fractional digits), explicit three-letter `currencyCode` (trimmed/uppercased), and `validFrom` (YYYY-MM-DD). Optional `validTo` is nullable/open-ended and `isActive` defaults to true. PATCH permits only those five fields and preserves omitted values. Responses additionally contain string `id`, string `svbProcedureId`, timestamps; `amount` always has two fractional digits (e.g. `"88.80"`). No JS float conversion occurs. The existing Decimal(15,2) storage and exact string API boundary are preserved. Currency is never silently defaulted to ANG.

`validTo >= validFrom` is inclusive. Duplicate `(svbProcedureId, currencyCode, validFrom)` is rejected even for inactive tariffs (existing DB unique key). Active tariffs may not overlap for the same procedure and currency. Periods ending June 30 and beginning July 1 are adjacent, allowed periods. Sharing June 30 is an overlap. Inactive tariffs may overlap but activating one rechecks the invariant; currency/date changes also recheck. Open-ended periods participate in the same comparison. All procedure/tariff writers for an existing procedure first lock that parent row inside the transaction, serializing concurrent overlap checks. Legacy ambiguous data is not rewritten; resolution retains `SVB_TARIFF_AMBIGUOUS`.

Tariff update verifies the parent and scopes ownership using procedure ID + tariff ID. A tariff belonging to another procedure returns `SVB_TARIFF_NOT_FOUND` and is unchanged. A missing parent returns `SVB_PROCEDURE_NOT_FOUND`.

### Catalogue selection and applicable tariff (preserved contract)

Procedure list filters: optional `q` (code/description, max 120), `category` (max 120), `requiresAuthorization`, `requiresReferral`, `isActive`, `serviceDate`; pagination `page` default 1, `pageSize` default 20/max 100. Boolean query values are `true` or `false`. No active or validity filter is implicit: `isActive=true` alone includes active procedures outside validity. Supplying `serviceDate` applies inclusive validity filtering independently of active state. Existing Clinical lookup supplies **both** `isActive=true` and its service date.

Tariff list supports optional `currencyCode`, `isActive`, `serviceDate`, `page`, `pageSize` with the same pagination defaults. It shows history, including inactive records when no active filter is supplied. Applicable tariff requires both `serviceDate` and `currencyCode`, verifies the parent is active/valid on that date, then selects an active same-currency tariff valid on that date. Zero matches => 404 `SVB_TARIFF_NOT_FOUND`; multiple => 409 `SVB_TARIFF_AMBIGUOUS`. Inactive procedure => **409 `SVB_PROCEDURE_INACTIVE`**; outside validity => 409 `SVB_PROCEDURE_NOT_VALID`.

### Stable errors

| HTTP | Domain error |
|---|---|
| 409 | SVB_PROCEDURE_CODE_ALREADY_EXISTS |
| 400 | INVALID_SVB_PROCEDURE_PERIOD |
| 404 | SVB_PROCEDURE_NOT_FOUND |
| 409 | SVB_PROCEDURE_INACTIVE / SVB_PROCEDURE_NOT_VALID |
| 404 | SVB_TARIFF_NOT_FOUND |
| 409 | SVB_TARIFF_ALREADY_EXISTS |
| 400 | INVALID_SVB_TARIFF_PERIOD |
| 409 | SVB_TARIFF_PERIOD_OVERLAP / SVB_TARIFF_AMBIGUOUS |

Malformed bodies use 400 `VALIDATION_ERROR`, invalid calendar dates use 400 `INVALID_DATE`, malformed IDs use 400 `INVALID_ID`. Existing authentication middleware controls 401 responses; absent permissions produce 403 `PERMISSION_DENIED`. Unique conflicts are translated; no Prisma/database details are exposed.

### Audit and historical safety

Business mutation and audit insertion commit in the **same** transaction. Actions: `SVB_PROCEDURE_CREATE`, `SVB_PROCEDURE_UPDATE` (including status), `SVB_TARIFF_CREATE`, `SVB_TARIFF_UPDATE`. Events include organization, actor, entity type/ID, old/new serialized values as appropriate and available request metadata. Audit failure rolls back both records.

Master mutations touch only `SvbProcedure`/`SvbTariff` and `AuditLog`. They do not create/update patient authorizations or rewrite `EncounterProcedure`, `InvoiceItem`, `InvoiceVersion`, PDFs or declarations. Existing snapshots remain authoritative for past care/billing. Existing PDFs are not regenerated. No schema, migration or seed change is required. MASTER-03 remains a separate paused Frontend sprint; runtime compliance evidence is recorded in `MASTER_02R_RESULTS.md`.


## Operational forward corrections

Appointment creation is now available through the existing POST /api/v1/appointments plus GET /api/v1/clinic-locations?isActive=true (clinic_location.read). Shared Frontend creation requires independent patient/provider/location read permissions and appointment.create. Dashboard now consumes GET /api/v1/reports/dashboard (dashboard.read) with inclusive Curacao from/to dates and optional organization-scoped providerId. Exact request/response fields, Decimal string/currency rules, metric/date/correction/assignment semantics and errors are documented in [OPERATIONAL_CORRECTIONS.md](OPERATIONAL_CORRECTIONS.md). No schema, migration, seed or existing catalogue contract changes.
