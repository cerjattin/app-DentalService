# Forward corrections on current main

Scope: appointment creation and live operational Dashboard. Starts at main b6cf48d0056994354d10fcb01d7c70f9a04f84fc. No reset, stash application, old-tree restoration, schema/migration/seed/dependency changes or MASTER catalogue rewrite.

AppointmentCreateAction is shared by Appointments/Reception. It gates appointment.create independently from the three lookup read permissions. The dialog obtains active organization locations and searchable active patients/providers from actual APIs; IDs remain strings, no seeded ID or automatic first selection. Search shows at most 100 matches with a refine hint; searching clears the prior selection. Browser-local datetime fields are converted with the established explicit Curacao offset helper. Existing Backend validation handles overlap and organizational integrity; failure retains form input and session on 403. Success invalidates appointment lists, reception worklists and Dashboard reports.

DashboardPage renders DashboardReport only with dashboard.read and keeps existing navigation access. Provider choices require provider.read; inactive providers remain selectable for historical reports. Default is today's Curacao business date; explicit from/to/provider filters drive centralized dashboardKeys. Financial values remain strings and separate by currency. All aggregation and chart ratios come from Backend. Seven indicators, timeline and provider production expose loading/error/retry/empty states using existing components; no chart dependencies added. New report/lookup contracts and exact metric definitions: backend/docs/OPERATIONAL_CORRECTIONS.md.

Validation workflow: .github/workflows/operational-gaps.yml runs full Backend and Frontend suites plus Chromium with MySQL, exercising both creation entry points, live Dashboard filters, and the complete existing MASTER-03 browser regression. Source/type/test failures will be corrected before completion. Tests use isolated QA data; no clinic connection or credentials. The local Windows checkout is not changed by publishing this review branch.


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
