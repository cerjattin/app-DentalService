# Return an invoice to clinical care

Decision confirmed by the user on 2026-10-30: Admin must be able to return billing to the clinical encounter, correct performed services and bill again. Professionals can remove and re-add a mistaken service before completing an open encounter. Admin receives the complete seeded permission set; backend authorization continues to check permissions and organization ownership, never role names.

## Clinical return

`POST /api/v1/invoices/:id/reopen-encounter`

Required permissions: `invoice.apply_correction`, `encounter.update`, `procedure.update`. Body is strict: `{ reason: string, expectedVersionId: string }`; reason is trimmed, nonempty, at most 500 characters. Success is HTTP 200 with the existing invoice DTO/envelope. The UI also requires clinical/appointment read access to navigate to care.

Preconditions: actor owns the invoice organization; current invoice/version states agree and are DRAFT, PENDING_SIGNATURE, SIGNED or CLOSED; supplied version is current; appointment and encounter are completed; no requested/approved correction exists; no item from this invoice is assigned to a non-CANCELLED declaration. Active declaration assignments are not silently deleted or transmitted again. Resolving declarations is a separate operation.

One serializable transaction creates an APPROVED correction with `reasonCode=CLINICAL_REOPEN` and workflow metadata, creates an empty DRAFT CORRECTION version referencing the source, sets the invoice to CORRECTION_REQUIRED and reopens the clinical encounter (OPEN, completedAt cleared). Actor, reason, prior completion timestamp and source/replacement versions are audited. The appointment remains COMPLETED: this corrects clinical care without rescheduling the agenda. Source version content, hash, items, signatures and documents are retained.

## Correct services and rebuild

In Clinical, remove mistaken services and add the correct services using the shared catalogue, effective tariffs and authorization validation. Professionals use their existing `procedure.update` permission. Unbilled mistakes retain the existing physical-delete behavior. A previously invoiced procedure can be removed only during an approved clinical return: its status becomes VOID, invoice links and financial snapshots are retained, and its authorization quantity is released once. Repeated removal is rejected. VOID records remain readable as history and are excluded from active production and rebuilding.

Complete the encounter again, then use **Rebuild invoice from corrected services**. This calls the existing `POST /api/v1/appointments/:appointmentId/invoice` with `invoice.create`. Only an empty, unlocked DRAFT clinical replacement can be rebuilt. Existing duplicate-invoice rejection remains for other cases.

Rebuild uses all PERFORMED clinical services, retaining the logical invoice ID, invoice number, insurance and currency. It recalculates with Decimal and keeps string API amounts/IDs. Retained services link to source invoice items when available; newly added services have no source item. No new invoice number is consumed. At least one billable service is required. Insurance/currency changes require a separate decision and are rejected in this workflow.

The empty replacement cannot be prepared or signed. After rebuilding, prepare, capture a **new** signature, confirm signed and close. Closing requires `invoice.close` and `invoice.apply_correction`; it marks the source SUPERSEDED and the correction APPLIED in the same transaction. Source signature/content remain unchanged. This controlled path can supersede an earlier DRAFT/PENDING_SIGNATURE/SIGNED version as well as CLOSED; ordinary correction requests still require CLOSED sources.

## Stable errors

Existing auth, validation and not-found errors apply. Conflicts include:

- `INVOICE_VERSION_CONFLICT`: stale/concurrently replaced current version.
- `INVOICE_ENCOUNTER_NOT_REOPENABLE`: invoice/version/encounter state is ineligible.
- `INVOICE_CORRECTION_ALREADY_ACTIVE`: finish the existing correction first.
- `INVOICE_DECLARATION_ASSIGNED`: active declaration assignment prevents clinical return.
- `INVOICE_REBILLING_CONTEXT_MISMATCH`: replacement insurance/currency differs.
- Existing `CLINICAL_ENCOUNTER_NOT_EDITABLE`, `ENCOUNTER_PROCEDURE_ALREADY_BILLED`, `ENCOUNTER_PROCEDURE_NOT_EDITABLE`, `INVOICE_NOT_PREPARABLE` and `INVOICE_ALREADY_EXISTS` remain enforced.

## Acceptance and affected files

Unit/service tests cover eligible states, permission checks without role shortcuts, organization scope, stale versions, active correction/declaration conflicts, unsigned empty replacement, exact rebuild totals with the same invoice/number, physical removal before billing, logical removal after clinical return and single authorization release. UI tests cover return reason/navigation, denied controls, modal errors, rebuild entry, signature blocking and professional remove/re-add before completion.

The PostgreSQL integration suite additionally contains the closed invoice → clinical return → replace service → complete → rebuild → new signature → close flow and concurrent return requests. These require a dedicated local test database; they must never be run against clinic/Supabase operational data. No schema, migration, seed or production data change is part of this feature.

Product files: `src/modules/invoices/invoice-clinical-reopen.service.ts`, `invoice-clinical-reopen.openapi.ts`, invoice routes/controller/schemas/service, `src/docs/openapi.ts`, encounter procedure service; Frontend billing API, return dialog, invoice detail, appointment billing, procedure section and centralized error messages. Tests: two new Backend unit files, additive invoice integration scenarios, and Frontend Billing/Clinical regression cases. Existing unrelated PostgreSQL/PDF/Dashboard/declaration changes are preserved.

Fresh checks in this task: Backend typecheck/build and 106 unit tests pass; Frontend lint/build and 309 tests pass. Diff whitespace and local documentation links pass. The initial sandbox blocked local Supertest connections (EACCES); the unit suite passed with authorized local socket access. Database integration and browser/API acceptance remain unexecuted: no dedicated local test database is configured in this session, and clinic/Supabase operational data were not used for testing this feature.
