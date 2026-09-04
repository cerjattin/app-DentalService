# PRE-F05 Live Integration Checkpoint

Last verified: 2026-09-04. Scope: F02-F04 only. F05 remains disabled.

## Outcome

**PRE-F05 LIVE INTEGRATION — APPROVED / CLOSED**

The user authorized the minimal Backend environment change on September 4.
Canonical browser validation now passes from `http://127.0.0.1:5173` to
`http://127.0.0.1:3000/api/v1`. The localhost preflight regression also passes.

Only `backend/.env` was changed for this final acceptance, alongside this report.
No REST contracts, application code, business rules, permissions, or database
schema changed. No domain mutations were repeated in this final smoke test.
Earlier QA record effects remain documented below.

## Runtime and Environment

- Backend: `http://127.0.0.1:3000`.
- API base: `http://127.0.0.1:3000/api/v1`.
- Requested Frontend: `http://127.0.0.1:5173`, HTTP 200.
- Supplementary browser validation: `http://localhost:5173`.
- Created `.env.local` with `VITE_API_BASE_URL=http://127.0.0.1:3000/api/v1`.
- Existing `*.local` ignore rule excludes this file; no secrets were added.
- Backend started with its existing `npm run dev` command.
- Frontend started with `npm run dev -- --host 127.0.0.1 --strictPort`.
- Existing `GET /health/ready` returned 200, status `ready`, database `ok`.

## CORS Configuration: Resolved

`backend/.env` preserves `CORS_ORIGIN=http://localhost:5173` and now also sets
the user-authorized `CORS_ALLOWED_ORIGINS` below.
`backend/src/config/cors.config.ts` reads `CORS_ALLOWED_ORIGINS` first, falling
back to `CORS_ORIGIN`, then matches explicit comma-separated origins.

- Preflight from `http://localhost:5173`: 204 with matching allow-origin header.
- Preflight from `http://127.0.0.1:5173`: 204 with
  `Access-Control-Allow-Origin: http://127.0.0.1:5173`.
- Both allow the requested `content-type,authorization` headers. No wildcard.
- Applied configuration, followed by restart with existing `npm run dev`:

```env
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

`cors.config.ts` was not modified. Readiness after restart returned HTTP 200,
`status: ready`, `database: ok`. The prior canonical-origin blocker is resolved.

## Final Canonical Browser Retest

All browser steps in this final acceptance used `http://127.0.0.1:5173`, not
localhost. The unchanged Frontend environment points at the full port-3000 API
base. Real QA Reception login returned HTTP 200; `/auth/me` returned HTTP 200
and populated identity, roles for display, and effective permissions. Dashboard
and permission-aware navigation rendered. Local Sign out returned to `/login`
with Email focused; no Backend logout endpoint was called.

| Area | Final canonical-origin result |
| --- | --- |
| Patients | Three records loaded; document search returned one patient; detail loaded |
| Insurance | Existing policy, payer, coverage dates and verification metadata displayed; `/payers` returned 200 |
| Appointments | Five records loaded; detail showed patient, provider, location, status and insurance |
| Reception | Current-day query for 2026-09-04 returned 200; correct no-appointments empty state |
| Console | Captured error/warning list empty after navigation and logout |
| Network | Expected API paths reached port 3000; no duplicate API prefix, 401/403, or CORS failures |

Backend logs recorded exactly one POST login and one GET `/auth/me` during the
smoke test. Other completed reads returned 200, with one insurance cache
revalidation returning 304. A StrictMode-mounted patient query was cancelled
before its successful replacement, as already observed during the earlier check.
This is not a duplicated login or mutation. Frontend entry assets remain relative
to the port-5173 document (`/@vite/client`, `/src/main.tsx`, `/favicon.svg`).
Authenticated reads succeeded with the existing centralized Bearer injection;
no request-header secrets were printed or saved.

Security behavior is unchanged: production-source search found no localStorage,
sessionStorage, IndexedDB, cookie writes, or console logging. Memory-only auth
and Bearer behavior remain covered by the existing tests. The browser's read-only
inspection surface does not expose storage here, so no independent browser
storage dump or complete HAR is claimed. Effective permissions still come from
`/auth/me`, not role-name authorization or JWT decoding.

Final regression rerun: lint passed, build passed, and **46/46 tests passed in
3 files**. Production JS remains 518.54 kB (157.99 kB gzip); the >500 kB advisory
is non-blocking and no bundle optimization was performed. The only files changed
in this final closure are `backend/.env` and this report. Earlier checkpoint
changes and testing limitations are retained below as historical evidence.

## Authentication and Security

Real QA administrator, reception, and provider logins were exercised. Login uses
the documented email/password DTO and returned accessToken. `/auth/me` supplies
identity and effective permissions; the administrator had 68 permissions.
The live localhost browser signed in as QA Reception, rendered Dashboard and
permission-composed navigation, and signed out to the focused login form.
A fresh protected `/patients` page redirected to `/login` without a session.

Source review confirms a module-memory token/user store, no production browser
storage or cookie writes, no credential logging, and Bearer injection only when
a token exists. Automated tests cover token absence in localStorage/sessionStorage,
401 session clearing, 403 session retention, permissions, and local logout.
IndexedDB persistence is absent from production source; browser storage contents
were not independently inspected. No JWT-derived authorization was added.

Direct unauthenticated requests produced 401 `AUTHENTICATION_REQUIRED`; a provider
patient-create request produced 403 `PERMISSION_DENIED`. Full browser session
expiry was not induced; redirect/cache behavior for authenticated 401 is covered
by source review and mocked tests rather than an expired real browser token.

## Successful Endpoint Checks

Paths below are relative to `/api/v1`. Live API checks span September 1 and the
September 4 resumption; they are not all browser-driven checks.

| Endpoints | Observed result |
| --- | --- |
| `POST /auth/login`, `GET /auth/me` | Real login, identity, permission hydration |
| `GET /patients` | List, q search, status and pagination |
| `GET /patients/:id` | Patient detail, string ID, nullable fields |
| `POST /patients`, `PATCH /patients/:id` | QA creation and update |
| `GET /payers` | Real payer options |
| `GET /patients/:patientId/insurance` | Policy, coverage dates, verification metadata |
| `POST /patients/:patientId/insurance` | QA insurance creation |
| `PATCH /patients/:patientId/insurance/:insuranceId` | QA insurance update |
| `POST /patients/:patientId/insurance/:insuranceId/verify` | Verification metadata returned |
| `GET /appointments`, `GET /appointments/:id` | List/detail and contracted relationships |
| `PATCH /appointments/:id` | Notes update and restoration |
| `PATCH /appointments/:id/status` | Confirmation and check-in |
| `GET /providers?isActive=true&page=1&pageSize=100` | Real provider lookup |
| `PATCH /patients/:id/archive` | QA cleanup using the frozen archive method |

Patient pagination returned flat meta `{page,pageSize,total,totalPages}`; the
September 4 page-2 request with pageSize 1 returned one record. Appointment
filters `date`, `q`, `status`, `providerId`, `page`, and `pageSize` worked, including
a combined filter returning the checked-in QA appointment.

Browser validation covered patient search/detail, edit-form loading without
submission, insurance display, appointment list/detail, terminal-state action
visibility, clinical handoff link visibility, and reception's empty current-day
worklist. Reception reused date-filtered appointments and patient/insurance data;
no reception endpoint was invented. September 4 had no appointments today.
The September 1 API check used an existing future QA date to verify a populated
worklist; a populated current-day reception screen was not exercised.

Insurance verification is presented as verification, not service-date eligibility.
Appointment creation stays unavailable: no authoritative ClinicLocation lookup
endpoint exists. No IDs were hardcoded or inferred to bypass that gap.

## Status and Error Validation

Live QA transitions: `SCHEDULED -> CONFIRMED -> CHECKED_IN`.
`CHECKED_IN -> CONFIRMED` was correctly rejected. Completed, cancelled, and
no-show rows showed no illegal transition controls in the browser.
The full transition matrix was not exhaustively mutated against live data;
existing mocked tests cover confirmation, check-in, cancellation and no-show.
No clinical encounter was created or started.

Expected negative checks returned `INVALID_CREDENTIALS`,
`AUTHENTICATION_REQUIRED`, `PERMISSION_DENIED`, `VALIDATION_ERROR`, and
`INVALID_APPOINTMENT_STATUS_TRANSITION`. These are successful error-contract
checks, not unexpected endpoint failures. Account lockout was not deliberately
triggered. Other retained F02-F04 mappings were checked against Backend source,
not all forced as live errors:

```text
ACCOUNT_LOCKED INVALID_ID PATIENT_NOT_FOUND PATIENT_DOCUMENT_ALREADY_EXISTS
INSURANCE_NOT_FOUND INVALID_PAYER INVALID_INSURANCE_PERIOD INSURANCE_PERIOD_OVERLAP
APPOINTMENT_NOT_FOUND INVALID_DATE INVALID_APPOINTMENT_PERIOD PROVIDER_NOT_FOUND
PROVIDER_INACTIVE LOCATION_NOT_FOUND LOCATION_INACTIVE APPOINTMENT_PROVIDER_OVERLAP
```

An earlier cleanup attempt used POST for archive and got 404. This was a testing
method error, not a missing Backend endpoint; PATCH archive subsequently worked.

## Contract Findings and Frontend Fix

1. The client appended `/api/v1` to an environment value already containing it.
   Fixed URL normalization so the full environment base is used once. Missing,
   relative, non-HTTP(S), query-bearing and fragment-bearing bases fail clearly.
2. Handoff prose describes `meta.pagination`; tested runtime responses use flat
   `meta`. Existing Frontend types already match runtime; no DTO change needed.
3. Handoff prose includes user `status` for `/auth/me`; the actual response does
   not. Existing Frontend identity types correctly omit it.
4. Entity IDs remained strings in tested responses. F02-F04 responses exercised
   here did not contain financial Decimal values; no live financial serialization
   claim is made. `EntityId` and `DecimalString` remain string aliases.

## Earlier Browser and Network Evidence

Captured browser error/warning logs were empty on the allowed localhost origin.
Real screen interactions and Backend request logs showed the expected API port,
prefix, methods and query parameters, with no duplicated `/api/v1` or observed
API calls to port 5173. Login and `/auth/me` each executed once. A development
StrictMode query mount caused an aborted initial patients request followed by a
successful request; no duplicate mutation was observed.

JSON request encoding, Content-Type and Bearer behavior were inspected in the
central client and exercised by API tests. This was not a complete saved browser
HAR/header audit. The then-observed canonical-origin CORS failure was resolved
by the authorized configuration change and final retest documented above.

## QA Record Effects

- Patient 3209, created during the earlier live check, was verified by its QA
  document and archived on September 4 with the documented PATCH operation.
  Its test insurance remains attached to the archived record; no hard deletion.
- Appointment 3272 remains CHECKED_IN after the explicitly tested transitions.
  No history was rewritten to restore a prior state.
- Appointment notes changed for validation were restored.

## Files Changed

Integration changes: `.env.local` (ignored), `src/api/client.ts`, `vite.config.ts`,
`src/test/foundation.test.tsx`, `src/test/patients.test.tsx`,
`src/test/appointments.test.tsx`, and this report.

Earlier scope restoration removed the out-of-scope F05 implementation and restored
the F04 clinical placeholder/navigation behavior. Modified:
`src/api/error-messages.ts`, `src/components/app-shell/navigation.ts`,
`src/components/app-shell/sidebar.tsx`,
`src/features/appointments/appointment-detail-page.tsx`,
`src/features/clinical/clinical-appointment-page.tsx`,
`src/routes/permission-route.tsx`, `src/routes/route-permissions.ts`,
`src/routes/router.tsx`. Removed F05-only files:
`src/features/clinical/clinical-api.ts`, `diagnosis-section.tsx`,
`procedure-section.tsx`, `src/types/clinical.ts`, `src/test/clinical.test.tsx`.
Unrelated pre-existing changes outside Frontend were left untouched.

## Final Validation

- `npm run lint`: passed, exit 0.
- `npm run build`: passed, exit 0.
- `npm test`: passed, **46 tests in 3 files**.
- Two added regression tests cover base normalization and missing/invalid base;
  existing endpoint assertions now use an isolated test-only absolute API base.
- Production JS: 518.54 kB, gzip 157.99 kB. Existing >500 kB advisory remains;
  no unrelated bundle optimization or dependency installation was introduced.
- Dev server and Backend health remained reachable after validation.

Checkpoint closed after the authorized canonical-origin retest. F05, billing,
settings CRUD, fake location lookup and additional domain workflows remain out
of scope. The known ClinicLocation lookup limitation is unchanged and is not a
CORS acceptance blocker. Do not continue automatically into F05.
