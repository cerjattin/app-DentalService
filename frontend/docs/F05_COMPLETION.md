# F05 Clinical Workflow Completion

Implemented and validated on 2026-09-04. Scope stops at clinical completion.
Frontend: http://127.0.0.1:5173. API: http://127.0.0.1:3000/api/v1.
No Backend files, database structure, dependencies, or billing workflow changed.

## Contract and Features

See [F05_CONTRACT.md](./F05_CONTRACT.md) for the method/path/request/response and
permission inventory. The implemented API adapter is
`src/features/clinical/clinical-api.ts`; response and separate write types are
in `src/types/clinical.ts`. All entity IDs and financial decimals remain strings.

- Route `/clinical/:appointmentId` requires `encounter.read` and `appointment.read`.
  The non-ID sidebar destination is a controlled appointment-selection screen,
  never an API request with `current` as an ID.
- Reuses F04 appointment data and F03 insurance queries. Provider identity comes
  from Backend appointment/encounter context, never authenticated user-ID inference.
- Explicit appointment start uses the existing PATCH status endpoint and
  `appointment.start`; encounter creation is offered only after IN_PROGRESS.
- Encounter lookup resumes existing data. Only the documented missing-encounter
  404 becomes the no-encounter state. Create sends no invented relationship fields.
- Chief complaint and clinical notes use RHF/Zod with Backend length limits.
- Diagnoses: paginated/debounced catalogue lookup, assignment, primary flag/notes
  update, confirmed removal. Diagnosis code cannot be edited after assignment.
- Treatment context: appointment TreatmentCase reference and authoritative
  procedure TreatmentId snapshots only. No TreatmentId input or synthesized value.
- SVB catalogue: bounded server search, active/service-date filters, pagination,
  authorization/referral flags. Tariff preview uses applicable-tariff with clinic
  service date and ANG, matching the performed-procedure service currency.
- Multiple procedures: add with selected insurance, optional encounter diagnosis,
  quantity and authorization item; edit diagnosis/notes only; confirmed removal.
  No price override or client-side financial arithmetic. NumberOfTreatments and
  Assistance are not inputs and are never derived from quantity.
- Authorizations: paginated patient-scoped read, create/edit record, create/edit
  items, Backend status/remaining balance display. Used items cannot reassign
  procedure. Derived PARTIALLY_USED/EXHAUSTED status is retained unless explicitly
  changed through a permitted administrative status. Optional metadata is untouched.
- Every clinical action is permission-gated. Completed/VOID encounters and
  non-PERFORMED procedures expose no clinical edit/delete controls.
- Completion POST has no invented prerequisites. It is blocked while notes are
  unsaved or mutations are pending, confirmed explicitly, and produces read-only
  history. Appointment queries are invalidated; appointment status is not changed
  locally. No invoice or billing endpoint is called.
- Targeted query invalidation covers encounter/appointment/reception, diagnosis,
  procedures and the affected patient's authorization balance, not the whole cache.

## Exact Permissions

```text
appointment.read appointment.start patient.read insurance.read
encounter.read encounter.create encounter.update encounter.complete
diagnosis.read diagnosis.assign
svb_procedure.read svb_tariff.read
procedure.read procedure.update
authorization.read authorization.create authorization.update
```

Read permissions needed to select dependent records do not grant mutations.
Roles are not used as authorization predicates. Existing memory-only auth and
central Bearer/error handling are unchanged.

## Added Error Mappings

These exact codes were verified in the relevant Backend services. Existing
AUTHENTICATION_REQUIRED, PERMISSION_DENIED, VALIDATION_ERROR, INVALID_ID and
F03/F04 mappings remain available. Logic never matches Backend message text.

```text
CLINICAL_ENCOUNTER_NOT_FOUND CLINICAL_ENCOUNTER_ALREADY_EXISTS
CLINICAL_ENCOUNTER_NOT_EDITABLE CLINICAL_ENCOUNTER_ALREADY_COMPLETED
INVALID_CLINICAL_ENCOUNTER_STATUS INVALID_APPOINTMENT_STATUS
DIAGNOSIS_CODE_NOT_FOUND DIAGNOSIS_CODE_INACTIVE DIAGNOSIS_CODE_NOT_VALID
DIAGNOSIS_ALREADY_ASSIGNED ENCOUNTER_DIAGNOSIS_NOT_FOUND
SVB_PROCEDURE_NOT_FOUND SVB_PROCEDURE_INACTIVE SVB_PROCEDURE_NOT_VALID
SVB_TARIFF_NOT_FOUND SVB_TARIFF_AMBIGUOUS
PATIENT_INSURANCE_NOT_FOUND INSURANCE_NOT_VALID INVALID_PROCEDURE_QUANTITY
PROCEDURE_INSURANCE_PATIENT_MISMATCH PROCEDURE_DIAGNOSIS_ENCOUNTER_MISMATCH
PROCEDURE_AUTHORIZATION_REQUIRED ENCOUNTER_PROCEDURE_NOT_FOUND
ENCOUNTER_PROCEDURE_NOT_EDITABLE ENCOUNTER_PROCEDURE_ALREADY_BILLED
AUTHORIZATION_NOT_FOUND AUTHORIZATION_ALREADY_EXISTS AUTHORIZATION_NOT_USABLE
AUTHORIZATION_NOT_VALID AUTHORIZATION_ITEM_NOT_FOUND AUTHORIZATION_ITEM_NOT_VALID
AUTHORIZATION_ITEM_AMBIGUOUS AUTHORIZATION_QUANTITY_EXCEEDED
AUTHORIZATION_PROCEDURE_MISMATCH AUTHORIZATION_PATIENT_MISMATCH
AUTHORIZATION_INSURANCE_MISMATCH AUTHORIZATION_INSURANCE_PATIENT_MISMATCH
INVALID_AUTHORIZATION_PERIOD INVALID_AUTHORIZATION_ITEM_PERIOD
```

## Live Validation and QA Effects

All browser interaction used the canonical origin with the existing QA provider
account. The following mutations were deliberate QA validation, not real care:

| Resource | Result / final state |
| --- | --- |
| Appointment 3272, QA-POSTMAN-APT-NORMAL | CHECKED_IN -> IN_PROGRESS via PATCH /appointments/3272/status; remains IN_PROGRESS |
| Encounter 2889 | Created (201), notes updated (200), completed (200); final COMPLETED at 2026-09-04T16:51:00.715Z |
| Diagnosis 511 | Added (201), catalogue diagnosisCodeId 369, primary, explicit QA note |
| Procedure 2571 | Added (201), svbProcedureId 757, quantity "1.00", tariff "75.00" ANG; QA note updated via PATCH (200) |
| Procedure 2572 | Added (201), svbProcedureId 758, quantity "1.00", tariff "125.50" ANG, authorizationItemId 586 |
| Authorization 497 / item 586 | Used quantity rose from "1.00" to "2.00"; Backend remaining balance "8.00"; status PARTIALLY_USED |
| TreatmentCase reference 6 | Backend returned TreatmentId snapshot "QAT0001" on both procedures; never edited |

Encounter providerId "2977" and creator userId "2206" were distinct. Patient
"2993" and insurance "2632" were existing QA records. No patient/insurance edits,
hard deletes, history restoration, appointment completion, or billing operations.
Both procedures remain PERFORMED within the now immutable completed encounter.

Live reads passed: appointment, insurance, encounter (initial expected missing
404, then successful resume/readback), diagnoses, diagnosis catalogue search,
procedure catalogue, applicable tariffs, authorizations and performed procedures.
GET responses were 200 or normal 304 cache revalidations. Backend readback verified
string IDs, string tariff/quantity snapshots, final encounter status and record IDs.

Browser console captured no errors/warnings. No CORS error, React warning or
unexpected authentication failure occurred. API requests used port 3000 and exactly
one `/api/v1`; no billing requests. Browser login and `/auth/me` each ran once;
separate shell readback used its own login. StrictMode caused some cancelled GETs
followed by successful reads, not duplicated mutations. Source/tests verify Bearer
injection without printing credentials. No complete HAR export is claimed.

Visual inspection covered desktop plus 820x1180 tablet portrait and 1180x820
landscape; workspace and confirmation dialog remained readable without overlap.
Temporary viewport override was reset. Full mobile-device interaction and all
permission combinations were not separately exercised in the live browser.

Live diagnosis edit/removal, procedure removal and authorization administrative
mutations were not repeated unnecessarily; they are covered at the mocked API
boundary. No attempt was made to mutate immutable records or rewrite QA history.

## Contract Gaps

1. No TreatmentCase lookup/create/update API: only references/snapshots shown.
2. Freeze prose says DELETE procedure logically voids; the service physically
   deletes and returns the removed record. The UI warns about permanent removal;
   no live DELETE was performed. Backend reconciliation remains its owner's task.
3. Encounter completion only requires OPEN and does not complete the appointment.
   No diagnosis/procedure count prerequisite or billing action was invented.
4. No public authorization-eligibility resolver or referral capture workflow is
   frozen. Backend procedure creation remains the authority for coverage/limits.
5. ClinicLocation lookup gap is unchanged; no appointment-creation workaround.

## Files Created or Modified for F05

Created/reintroduced relative to the approved F04 working state:

```text
docs/F05_CONTRACT.md
docs/F05_COMPLETION.md
src/types/clinical.ts
src/features/clinical/clinical-api.ts
src/features/clinical/clinical-model.ts
src/features/clinical/clinical-ui.tsx
src/features/clinical/catalogue-search.tsx
src/features/clinical/diagnosis-section.tsx
src/features/clinical/procedure-section.tsx
src/features/clinical/authorization-section.tsx
src/test/clinical.test.tsx
```

Modified: `src/features/clinical/clinical-appointment-page.tsx`,
`src/features/appointments/appointment-detail-page.tsx`,
`src/components/app-shell/app-shell.tsx`, `src/components/app-shell/navigation.ts`,
`src/routes/route-permissions.ts`, `src/api/error-messages.ts`,
`src/test/appointments.test.tsx` (handoff requires encounter read).
Pre-existing unrelated changes and earlier PRE-F05 changes were left intact.

## Final Checks

- Previous baseline: 46 tests. F05 added 35 tests. New total: **81 passing in 4 files**.
- Coverage: route denial/no forbidden reads, encounter loading/absence/create/resume,
  explicit start, context/ID reuse, notes, dirty-state completion guard, completion,
  read-only history, invalid state, 403 retention, diagnoses CRUD/search, TreatmentId,
  SVB search/date, string tariffs/quantities, performed procedure add/update/remove,
  authorization requirement/balance/create/update/items/permissions, targeted cache
  invalidation, pending-dialog protection and unavailable/ambiguous tariff handling.
- `npm run lint`: passed, no warnings.
- `npm run build`: passed (TypeScript and Vite).
- `npm test`: passed; mocked API only, no live Backend dependency.
- JS bundle: **564.28 kB / 168.04 kB gzip**, versus 518.54 / 157.99 kB baseline.
  Increase: 45.74 / 10.05 kB. Existing >500 kB advisory remains non-blocking.
  No unrelated bundle optimization or dependency installation.

F05 implementation ends here. F06, invoices, signatures, corrections, declarations,
exports, settings, refresh tokens and Backend logout are not implemented.
