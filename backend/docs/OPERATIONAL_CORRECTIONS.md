# Operational creation and reporting contracts


## Operational corrections from main b6cf48d00

GET /api/v1/clinic-locations?isActive=true requires clinic_location.read. It returns a data array of { id: string, code, name, isActive }, scoped to the actor organization, excluding archived records. isActive is an optional true/false string. No mutation endpoint is added.

Appointment creation uses the existing POST /api/v1/appointments and appointment.create. Required body fields are string patientId/providerId/clinicLocationId and timezone-qualified scheduledStart/scheduledEnd. Optional reason/notes are nullable strings. The Frontend exposes a shared dialog in Appointments and Reception and requires patient.read, provider.read and clinic_location.read for real selection. Times use America/Curacao. Existing Backend overlap, audit and numbering rules remain authoritative.

GET /api/v1/reports/dashboard requires dashboard.read. Query: required from/to inclusive YYYY-MM-DD Curacao business dates (maximum 366 days), optional providerId string belonging to the same organization (including inactive historical providers). Invalid period: 400 INVALID_REPORT_PERIOD; cross-organization/missing provider: 404 PROVIDER_NOT_FOUND. Existing auth/permission/validation errors apply. The report is read-only and uses a repeatable-read transaction. All currency amounts are exact strings and grouped separately by currency; counts and display-only chart percentages are numbers.

Response data: period { from, to, timezone }, providerId nullable; kpis { production: Money[], svbBilled: Money[], patientsSeen, appointments, pendingSignatures, closedInvoices, toDeclare }; productionTimeline: { date, currencyCode, amount, chartPercent }[]; productionByProvider: { providerId, providerName, currencyCode, amount, chartPercent }[]. Money = { currencyCode, amount }.

Metric definitions:
- Production: PERFORMED/BILLED encounter procedures, excluding VOID encounters, by performedAt (fallback encounter startedAt), attributed to performedByProviderId; includes unbilled work and never derives from invoices.
- Patients Seen: distinct patient + Curacao encounter start date across non-VOID encounters, summed over the period. Provider scope follows the encounter provider. Repeat encounters on one day count once; separate days count separately.
- Appointments: scheduled start in the period, all statuses. Provider scope follows assigned provider.
- SVB Billed: exact InvoiceItem snapshots of non-cancelled SVB invoices with CLOSED (not SUPERSEDED) versions, by serviceDateSnapshot and performing provider. A still-CLOSED source remains billed while a correction draft is in progress; once superseded only the replacement closed version contributes.
- Pending Signatures: distinct logical invoices whose current version is PENDING_SIGNATURE and has items dated within the period/provider scope.
- Closed Invoices: distinct logical invoices with CLOSED version items in the period/provider scope.
- To Declare: distinct CLOSED logical invoices with a current CLOSED version and SVB items in the period/provider scope not assigned to any non-CANCELLED declaration batch. This is assignment availability, not a promise that declaration snapshot/readiness validation will pass.
- Timeline/provider bars compare amounts within the same currency. Empty periods have zero counts and empty money/chart arrays. No mixed-currency sum or client-side financial aggregation.

No schema, migration or seed changes. MASTER-02R and MASTER-03 shared catalogue code is unchanged. These are new forward fixes, not a stash application, reset or restoration of an older tree.


## Completed validation

**APPOINTMENT CREATION AND LIVE DASHBOARD READY**

Validated code: 5759e33f7a4e7fad78f6f4d9644cc9c8aeaef0f1 on codex/operational-forward-fixes, based on main b6cf48d0056994354d10fcb01d7c70f9a04f84fc. Review: https://github.com/cerjattin/app-DentalService/pull/3. No merge or changes to the Windows working tree were performed.

| Check | Result |
|---|---|
| Backend typecheck/build | PASS |
| Backend full suite with MySQL | 290 passed, 29 files; 13 new tests |
| Frontend lint/build | PASS |
| Frontend full suite | 289 passed, 11 files; 22 new tests |
| Appointment creation | Browser created appointment 101 from Appointments and 102 from Reception, with actual patient/provider/location selections, Curacao timestamps, reason and notes |
| Dashboard | Live seven indicators, exact money strings, date/provider filtering, timeline/provider production and empty states verified |
| Historical production | Original performed amount remained ANG 88.80 after tariff edit and service deactivation |
| Financial/tenant regressions | Exact currency grouping, patient-days, boundary dates, pending signatures, performing-provider attribution, superseded invoice exclusion, declaration assignment/cancellation and organization isolation passed |
| MASTER-02R | Full suite and HTTP lifecycle QA passed again |
| MASTER-03 | Full Services/tariff/Clinical browser regression passed again, with the four existing responsive targets |
| Visual review | Dashboard desktop 1440×900 and mobile 390×844 screenshots inspected; no broken layout |
| Database/dependencies | No schema, migration, seed, package.json or package-lock changes |
| Delivery | Forward corrections only; no reset, checkout of an old tree, stash application or main push |

Evidence: https://github.com/cerjattin/app-DentalService/actions/runs/40776906896 (operational); https://github.com/cerjattin/app-DentalService/actions/runs/40776906776 (MASTER-02R); https://github.com/cerjattin/app-DentalService/actions/runs/40776906752 (MASTER-03). The operational-validation artifact contains full Backend/Frontend test JSON, browser requests/results and screenshots. Summary: frontend/docs/OPERATIONAL_VALIDATION.json.

The initial lint failure was an obsolete Reception import and was corrected. Browser QA exposed an implicit label issue in the Dashboard provider selector; an explicit label/control association fixed selection. The final code passed all three workflows.

Limits: QA IDs refer to an isolated disposable database, not clinic records. Patient/provider selectors show up to 100 matches and offer search refinement. Patients Seen is patient-days from non-VOID encounters, not unique patients across the entire range. To Declare counts assignment availability, not full declaration-readiness approval. Financial currencies are never combined. The implementation does not claim to reproduce an unseen old REPORT-01 DTO; its actual forward API contract is documented explicitly.
