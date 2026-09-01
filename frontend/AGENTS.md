# ODONTHO SERVICES — SVB BILLING APP

## Frontend Engineering Instructions

Scope: everything under `/frontend`.

### Authoritative sources

Before implementing Backend integrations, read:

* `../backend/docs/API_FREEZE_BACKEND.md`
* `../backend/docs/FRONTEND_HANDOFF.md`
* `../backend/docs/BACKEND_RELEASE_CHECKLIST.md`

Do not invent endpoints, request fields, response fields, permissions, state transitions, or Backend behavior.

Do not modify `/backend` or `/database` unless explicitly authorized by the user.

### UI/UX reference

The authoritative visual and UX reference is:

`../Recursos/frontend-reference/`

Analyze and preserve its visual language, hierarchy, navigation patterns, proportions, density, cards, tables, forms, spacing and interaction model where compatible with the application requirements.

Do not blindly copy implementation code from the reference.

All production UI text must be in English.

### Frontend stack

Use:

* React
* Vite
* TypeScript strict
* Tailwind CSS 4
* React Router
* TanStack Query
* React Hook Form
* Zod

Do not add dependencies without a demonstrated requirement.

### Authentication

Access token stays in memory only.

Never persist access tokens in:

* localStorage
* sessionStorage
* IndexedDB

There is currently no Backend refresh-token/revocable-session contract.

A browser reload may require login again.

### Authorization

Authorization UX is permission-based.

Do not use role names as the primary authorization mechanism.

Use centralized route and action permissions plus `PermissionGuard`.

Backend remains the final authorization authority.

### Backend types

All Backend BigInt identifiers are strings.

Use:

`type EntityId = string`

Never use `Number()`, unary `+`, or `parseInt()` for entity IDs.

Backend Decimal values are strings.

Never use floating-point conversion for financial calculations.

Use:

`type DecimalString = string`

### Errors

Use Backend `error.code` as the primary error identifier.

Do not implement business logic by matching human-readable `message` strings.

Map Backend error codes to English UI messages in a centralized Frontend layer.

### Timezone

Business timezone:

`America/Curacao`

Never depend implicitly on the workstation timezone.

### Billing invariants

One appointment may contain multiple performed procedures.

All billable procedures for the appointment belong to one logical invoice.

The invoice may contain multiple invoice items.

Additional invoice versions exist only through correction/versioning.

Signed, closed and superseded historical versions are immutable.

A signature belongs to a specific invoice version.

### SVB fields

TreatmentId originates from the authoritative TreatmentCase snapshot.

PoliClinic originates from the authoritative ClinicLocation snapshot.

Do not invent production semantics/defaults for:

* NumberOfTreatments
* Assistance

### Architecture

Prefer:

* server state → TanStack Query
* auth/session → Auth context/store
* form state → React Hook Form
* component state → React state

Do not introduce Redux unless a future requirement proves it necessary.

### Quality

Maintain:

* accessible keyboard navigation
* visible focus states
* tablet-friendly controls
* desktop operational density
* responsive behavior
* clear loading, empty and error states
* English UI copy

Before completing a task run the available:

* lint
* typecheck/build
* automated tests

Report changed files, validations performed, and any unresolved issue.
