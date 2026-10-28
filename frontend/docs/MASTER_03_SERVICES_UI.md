# MASTER-03 — Services administration UI

**SERVICES ADMINISTRATION UI READY**

Validated source: 7c6197f8dc1fb3ab7033c900988d4733243f2478. [Successful CI run](https://github.com/cerjattin/app-DentalService/actions/runs/40756585601) and [review PR #2](https://github.com/cerjattin/app-DentalService/pull/2). The PR is based on the validated MASTER-02R branch; neither review has been merged into main. No work beyond MASTER-03 has begun.

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


## Final completion report

| # | Result | Evidence |
|---|---|---|
| 1 | Routes added | /admin/services and /admin/services/:serviceId, both lazy loaded and protected by svb_procedure.read. |
| 2 | Sidebar change | Administration → Services, visible only with svb_procedure.read; authorized Administration landing includes a Services card. |
| 3 | Exact endpoints | The nine GET/POST/PATCH paths and their permissions are listed in the endpoint table above; no invented endpoint. |
| 4 | Exact permissions | svb_procedure.read, svb_procedure.manage, svb_tariff.read, svb_tariff.manage, independently enforced. |
| 5 | Service list | Real Backend search/filter/pagination; loading, empty and safe error/retry states; active/inactive records supported; wide table scrolls accessibly. |
| 6 | Service creation | Actual DTO, required code/description, nullable optional fields, explicit active checkbox, duplicate error handling and navigation to returned string ID. Browser POST returned 201. |
| 7 | Service editing | Mutable fields only; successful scoped PATCH and refresh. Browser confirmed changed description/referral. |
| 8 | Activation/deactivation | Explicit confirmation; dedicated status PATCH; service row/history retained; both transitions verified from browser. Final QA state inactive. |
| 9 | No hard delete | No Services/tariff delete controls, API helper or DELETE request. All 68 browser API responses were successful GET/POST/PATCH calls. |
| 10 | Tariff list | Paginated history includes inactive entries by contract; amount/currency/validity/status/actions rendered, independent tariff.read permission. |
| 11 | Tariff creation | amount, currencyCode, validFrom, validTo, isActive only. Browser POST returned 201 and string 88.80. Currency explicitly entered. |
| 12 | Tariff editing | Scoped parent+tariff PATCH supports amount, currency, dates and active flag. Browser updated exact amount to string 89.90; status edit covered by automated UI test. |
| 13 | Decimal behavior | Text/string state and payload; no authoritative floating-point conversion. Trailing zeros and maximum valid Decimal strings covered. |
| 14 | Errors mapped | Six requested MASTER-02 mutation/not-found errors plus existing procedure not-found/inactive/not-valid and ambiguous tariff errors; exact codes, safe English messages. |
| 15 | Query strategy | Centralized svbServiceKeys family and shared catalogue API; Clinical delegates existing lookups to the same module. |
| 16 | Clinical cache | Procedure mutations invalidate shared lists and selected detail subtree. Tariff mutations invalidate that parent's history/applicable queries. Unrelated clinical/invoice snapshots remain untouched. Browser active/inactive selector and original snapshot regression passed. |
| 17 | Files | Inventory below. All implementation changes are under frontend/, plus the dedicated validation workflow; Backend/database files untouched. |
| 18 | Tests added | 58 automated tests in services.test.tsx. |
| 19 | Total tests | 267 passed, 0 failed, 0 skipped, 10 test files. Actual baseline was 209 tests in 9 files, not the 232 count quoted externally. |
| 20 | Lint | npm run lint: PASS locally and in CI. |
| 21 | Build | npm run build: PASS locally and in CI; TypeScript checks included. |
| 22 | Bundle | Raw entry JS 310,001 → 311,199 bytes (+1,198 / 0.39%). Total distributed JS 683,206 → 706,858 bytes (+23,652 / 3.46%). New lazy list 5,120 bytes; detail 7,914; shared service UI/forms 7,351; shared catalogue API 1,400. No dependency additions and no chunk-size warning. See MASTER_03_VALIDATION.json for measurement scope. |
| 23 | Live QA | PASS with real MySQL 8.0.46, actual Backend, Chromium browser and normal login. UI create/detail/edit/status, tariff history/create/edit/applicable lookup and Clinical regression all passed. |
| 24 | QA IDs | Service 1, code TEST-M03-UI-1793216631350, tariff 1, appointment 1, encounter 1, encounter procedure 1. IDs belong to disposable CI data, not the clinic. Final service state inactive. No QA DELETE. |
| 25 | Browser console/network | 68 API responses, only HTTP 200/201. Zero console errors, console warnings, page exceptions or failed non-aborted requests. Normal React development aborts are excluded from transport-failure classification. |
| 26 | Responsive | PASS at 1440×900, 1024×768, 768×1024 and 390×844. List, detail, service form and tariff form checked at every size; 16 screenshots visually reviewed; document overflow/dialog bounds assertions passed. |
| 27 | Limitations | Certifies this GitHub branch, not unseen Windows changes. Existing login lands on Dashboard; QA therefore uses real Sidebar/Appointment navigation. No global authentication redesign. Tariff overlap remains Backend-authoritative. No imports/sync/private catalogue/Settings CRUD or unrelated modules. Live environment is disposable. |
| 28 | Final status | **SERVICES ADMINISTRATION UI READY**. Stop after MASTER-03; no next sprint implemented. |

The initial browser harness incorrectly assumed login would remain at a requested Services deep link. That run stopped before master mutations. The harness was corrected to enter Services through the Sidebar and Clinical through Appointments → View → Open clinical workspace. The final passing run exercised normal single-session navigation and the shared cache. No authentication production code was changed.

### Evidence and files

`MASTER_03_VALIDATION.json` preserves counts, exact QA IDs, all browser API statuses, console/network results, responsive outcomes and bundle measurements. The successful workflow's master-03-validation artifact contains full Vitest JSON, browser report and all 16 screenshots. Artifact ID: 12845234614; SHA-256: b467a04fd534a308b7223a2708da2c3fc45423eeb98aa8b3a69b878f812996a6.

Created:

- .github/workflows/master-03.yml
- frontend/docs/MASTER_03_SERVICES_UI.md
- frontend/docs/MASTER_03_VALIDATION.json
- frontend/scripts/master03-browser-qa.mjs
- frontend/src/features/administration/services/services-page.tsx
- frontend/src/features/administration/services/service-detail-page.tsx
- frontend/src/features/administration/services/service-dialogs.tsx
- frontend/src/features/administration/services/service-model.ts
- frontend/src/features/administration/services/service-ui.tsx
- frontend/src/features/svb-catalog/svb-catalog-api.ts
- frontend/src/types/svb-catalog.ts
- frontend/src/test/services.test.tsx

Modified:

- frontend/.gitignore (generated QA evidence excluded)
- frontend/src/api/error-messages.ts
- frontend/src/components/app-shell/app-shell.tsx
- frontend/src/components/app-shell/navigation.ts
- frontend/src/features/administration/admin-page.tsx
- frontend/src/features/clinical/clinical-api.ts
- frontend/src/routes/route-permissions.ts
- frontend/src/routes/router.tsx
- frontend/src/types/clinical.ts (catalogue types moved without changing clinical contracts)

No Backend/database, package.json, package-lock, invoice, reporting, PDF or Settings CRUD changes. No hard delete, unsafe type suppression, role shortcut or identity/financial float conversion introduced. git diff --check passed.
