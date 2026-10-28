# MASTER-03 — Services administration UI

Status: implementation complete; live browser and responsive QA pending. Do not treat source completion as final QA signoff.

## Scope and routes

Service / SKU is the existing SvbProcedure resource. Performed clinical care remains EncounterProcedure and tariff history remains SvbTariff. No separate service model or service-to-SVB mapping is introduced.

- `/admin/services`: lazy loaded administrative catalogue, Backend search/filters/pagination, explicit all/active/inactive selection.
- `/admin/services/:serviceId`: lazy loaded details, edit/status actions, tariff history and optional applicable-tariff lookup.
- Sidebar: Administration → Services. Administration landing includes Services for authorized readers. Direct routes require svb_procedure.read independently of user/provider administration permissions.

## Permissions and endpoints

API client uses the configured base URL including `/api/v1`. All entity IDs remain strings.

| Endpoint | Permission | UI |
|---|---|---|
| GET /svb-procedures | svb_procedure.read | List and shared Clinical search |
| GET /svb-procedures/:id | svb_procedure.read | Detail |
| POST /svb-procedures | svb_procedure.manage | Create service |
| PATCH /svb-procedures/:id | svb_procedure.manage | Edit service |
| PATCH /svb-procedures/:id/status | svb_procedure.manage | Confirm activate/deactivate |
| GET /svb-procedures/:id/tariffs | svb_tariff.read | Paginated history, including inactive tariffs |
| POST /svb-procedures/:id/tariffs | svb_tariff.manage | Add tariff |
| PATCH /svb-procedures/:id/tariffs/:tariffId | svb_tariff.manage | Edit tariff and active flag |
| GET /svb-procedures/:id/applicable-tariff | svb_tariff.read | Explicit service date + currency lookup; shared Clinical resolver |

No permission implies another permission. Tariff readers cannot mutate; service readers do not automatically read tariffs. A tariff manager without tariff.read can create a tariff, but the history is not requested or disclosed. All actions use centralized PermissionGuard; no role-name authorization is used. Backend remains authoritative. HTTP 403 does not clear the memory-only session.

## List, create and edit

List filters use exact Backend fields: q, category, isActive, requiresAuthorization, requiresReferral, serviceDate, page, pageSize. Search submits the current filter form and resets to page 1. No fabricated category enumeration or implicit date/active filter. Validity filtering occurs only when serviceDate is supplied; Clinical supplies its service date and isActive=true.

Create/edit fields: code, description, category, unit, requiresAuthorization, requiresReferral, validFrom, validTo. Creation exposes isActive explicitly; existing service status is changed through the confirmation workflow. Optional empty text/date values are sent as null; no immutable fields are submitted. code is the authoritative Service/SKU. Referral/authorization controls are master configuration only.

All visible copy is English. The feature reuses existing navy navigation, clinical blue, compact tables, form controls, Radix dialogs, Lucide icons and loading/empty/error feedback. Unrelated Administration screens are not redesigned.

## Lifecycle and historical safety

Service activation/deactivation requires confirmation and calls the dedicated status PATCH. There are no delete actions or DELETE requests for services/tariffs. Inactive masters remain accessible for administration/history. Tariff status is editable via the supported tariff PATCH.

The UI displays: “Changes to service master data do not alter previously recorded clinical or billing history.” No operation rewrites EncounterProcedure, InvoiceItem, InvoiceVersion, PDFs, declarations or patient authorizations. Clinical continues rendering its existing snapshots.

## Tariffs and decimal safety

Tariff history shows amount, currencyCode, validFrom, validTo, status and permitted edit actions. Pagination is server-driven. Applicable tariff is a separate optional lookup and never replaces history.

Tariff form submits exactly amount, currencyCode, validFrom, validTo, isActive. Amount is always a DecimalString in state and payload, including trailing zeros and large exact decimals. Input uses text with decimal inputMode; no Number/parseFloat conversion occurs. Currency is explicitly entered, with ANG only as a visible example; there is no hidden default currency.

Dates remain YYYY-MM-DD strings, independent of workstation timezone. Forms validate real calendar dates and the obvious validTo >= validFrom condition. The Backend owns overlap/duplicate logic, including active overlap and reactivation checks; the Frontend does not reproduce that algorithm.

## Errors

Central mappings include SVB_PROCEDURE_CODE_ALREADY_EXISTS, INVALID_SVB_PROCEDURE_PERIOD, SVB_PROCEDURE_NOT_FOUND, SVB_PROCEDURE_INACTIVE, SVB_PROCEDURE_NOT_VALID, SVB_TARIFF_NOT_FOUND, SVB_TARIFF_ALREADY_EXISTS, INVALID_SVB_TARIFF_PERIOD, SVB_TARIFF_PERIOD_OVERLAP and SVB_TARIFF_AMBIGUOUS. Unknown Backend details are not displayed. Failed forms retain values and expose English errors; status errors stay inside the confirmation dialog.

## Shared queries and Clinical integration

`features/svb-catalog/svb-catalog-api.ts` owns endpoint access and centralized svbServiceKeys.all/lists/list/detail/tariffLists/tariffs/applicableTariffs/applicableTariff. Clinical API delegates catalogue calls and keys to that module. Existing clinical contracts and the established explicit Clinical ANG lookup convention are preserved.

Procedure create invalidates catalogue lists; update/status invalidates those same shared lists and the selected detail subtree, including applicable tariffs. Tariff mutations invalidate only that parent's tariff lists and applicable-tariff queries. Unrelated services, encounters, invoices and historical snapshots are not invalidated or mutated. There are no competing administrative and Clinical caches for the same filter selection.

## Validation and limitations

Baseline at the actual repository checkout: 209 Frontend tests (9 files), not the 232 count quoted in earlier external context. MASTER-03 adds 58 tests covering API DTOs/string IDs/Decimal, route and navigation permissions, list states/search/pagination, creation/edit/status/errors, tariff permissions/create/edit/overlap, exact shared Clinical keys and targeted invalidation. Existing Clinical snapshot regressions remain in the full suite.

Required commands: npm run lint, npm run build, npm test. Live QA is automated in `.github/workflows/master-03.yml` with an isolated MySQL 8.0 database, unchanged Backend migrations/seed, normal browser login, actual UI mutations and Clinical selector regression. Browser tooling is installed only in the runner's temporary directory; no application dependency or lockfile is added/changed. `scripts/master03-browser-qa.mjs` refuses any database other than localhost/odontho_master03_test. No clinic data or credentials are used. QA records are not deleted by application calls; the disposable CI environment is removed after evidence upload.

Responsive targets: 1440×900, 1024×768, 768×1024, 390×844. Existing accessible horizontal table regions and viewport-constrained dialogs are reused. Screenshots, console/page errors, network statuses, created IDs and viewport assertions are retained as CI artifacts.

The repository's missing Recursos/frontend-reference folder was reconciled with its existing Recursos/Crear basadi en archivo.zip visual reference; production components and English copy take precedence over prototype implementation. The work certifies the tested GitHub branch, not unseen/unpushed Windows changes. No Backend, schema, migration, seed, invoice, report, PDF, import/sync or Settings CRUD work is included. MASTER-03 is the stopping point.
