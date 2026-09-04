# F06 Billing Completion Report

Date: 2026-09-04. Scope: invoice creation, original version preparation, signature,
close and document access. No F07 implementation. Backend contracts, configuration,
database structure and dependencies were not modified.

## Endpoints and Permissions

See [F06_CONTRACT.md](F06_CONTRACT.md) for exact methods, paths, request/response
shapes, permission requirements, lifecycle restrictions and all 47 added error codes.

Billing: invoice.read, invoice.create, invoice.prepare_signature, invoice.sign,
invoice.close. Signature: signature.capture plus document.upload for the PNG.
Documents: document.read, document.generate. Existing appointment.read gates
navigation; the existing appointment.complete action was used explicitly for QA.
No role names authorize actions.

## Implemented Workflow

- Invoice list with supported server search, status filter and pagination; loading,
  empty, denied and error states. Appointment lookup uses appointmentId filtering.
- Appointment and completed encounter screens reuse a permission-guarded billing
  entry. Existing invoices are opened, never replaced. Creation requires explicit
  confirmation and delegates all prerequisites/snapshots/calculations to Backend.
- One logical invoice, ORIGINAL v1, multiple authoritative items. Full snapshots
  are readable; totals, tariffs and quantities stay strings. IDs stay strings.
- Version selector retrieves historical versions read-only. F06 exposes no item
  editing, correction or replacement operation, including on correction versions.
- DRAFT -> PENDING_SIGNATURE preparation locks Backend content/hash. Signature
  dialog reviews canonical content, captures proportional pointer strokes as PNG,
  validates signer fields with RHF/Zod, supports Clear/Cancel and explicit consent.
- PNG upload -> evidence capture with expectedContentHash. PATIENT names remain
  Backend-derived; representative/guardian requirements follow the actual schema.
  Evidence capture does not sign or close automatically. Pending writes disable
  repeat submission; uncertain capture responses trigger reconciliation before
  offering another capture. Uploaded document references remain memory-only.
- Explicit confirm-signed -> SIGNED, then explicit close -> CLOSED. Current status
  and independent permissions gate each action and its confirmation dialog.
- Closed original versions expose Backend PDF generation; document retrieval uses
  authenticated binary fetch and temporary object URLs. Download is available;
  View PDF uses a browser-native viewer in a new tab when advertised as supported.
  URLs are revoked when the document dialog unmounts. No server storage path is shown.
- Targeted invoice/list/version/signature/document invalidation. No global cache
  invalidation except the existing authentication logout/401 behavior.

## Live Local Validation

Frontend: http://127.0.0.1:5173. API: http://127.0.0.1:3000/api/v1.
Backend readiness returned ready/database ok. Both existing npm development commands
started normally. QA admin identity and effective permissions came from auth/me.

Confirmed in the canonical browser: invoice creation, invoice list/search/detail,
preparation, canonical signature content, raw PNG upload, signature capture,
confirm signed, close, PDF generation, document listing and authenticated download.
Historical version retrieval was also verified against existing invoice 1716,
without modifying it. Local logout returned to login.

The browser/server observations show correct methods and API port 3000, assets on
5173, no duplicated /api/v1 and no duplicate signature upload/capture/sign/close.
Development StrictMode produces cancelled GET probes and some conditional 304
responses; these are not duplicate mutations. Console capture contained no React,
input, runtime or CORS errors. Bearer and binary headers are additionally covered
at the mocked fetch boundary. No new token persistence or credential logging exists.

Responsive visual checks: desktop, tablet 820x1180 and 1180x820, mobile 390x844.
Signature ink survived viewport changes; tables scroll internally; mobile document
width matched its viewport, including the longer historical-version selector.

### PDF Viewer Limitation

The embedded development browser advertised PDF support but rendered an empty
inline viewer. The frontend now offers native View PDF and Download PDF actions,
without an empty embedded frame. The browser automation policy blocked opening
the blob PDF in a new tab; no bypass was attempted. Authenticated binary retrieval
returned HTTP 200/application/pdf and the download action was exercised. Visual
rendering in a normal browser's native PDF viewer remains a manual acceptance check.
No heavyweight viewer dependency was added solely for this test-browser limitation.

## QA Historical Records Affected

Identity was verified before mutations: patient 2993, QA-POSTMAN-PAT-001,
document QA-POSTMAN-DOC-001, appointment 3272 / QA-POSTMAN-APT-NORMAL, encounter
2889 already COMPLETED. No production patient was used.

| Resource | ID / change |
| --- | --- |
| Appointment | 3272: IN_PROGRESS -> COMPLETED via existing explicit F04 action |
| Logical invoice | 1854 / QAI-000002: created, prepared, signed, CLOSED |
| Original version | 1952 / v1: CLOSED |
| Invoice items | 2021, 2022 from existing procedures 2571, 2572 |
| Total | ANG 200.50, unchanged throughout signing/close |
| Signature image document | 1311, raw PNG |
| Signature evidence | 873, VALID, OTHER, MOUSE |
| Signer label | F06 QA TEST - NOT A PERSON |
| Relationship | Synthetic local integration test |
| Signed invoice PDF | document 1312, invoice-document link 58 |

The signature is a synthetic cross-shaped QA mark, not a person's signature.
No history was deleted or rewritten. No billing corrections, declarations or
submission operations were executed.

## Tests and Validation

- Prior baseline: 81 tests. F06: 47 added. Total: 128 tests across five files.
- Coverage: list states/filtering/pagination, details, original/multiple items,
  string IDs/Decimals, preparation, historical versions, immutable/correction state,
  action permissions, hash errors, pointer scaling and mouse/touch/stylus capture,
  required confirmation, duplicate prevention, lost-response reconciliation,
  close, binary upload/download, PDF generation/fallback/resource cleanup,
  appointment creation/reuse, 401 clearing, 403 retention and no browser storage.
- All automated tests mock fetch; no live Backend dependency.
- npm run lint: PASS. npm run build: PASS. npm test: PASS (128).
- Bundle: JS 596.00 kB / gzip 175.83 kB; CSS 28.67 kB / gzip 6.30 kB.
  F05 JS baseline 564.28 kB / gzip 168.04 kB: increase 31.72 kB / gzip 7.79 kB.
  Existing >500 kB advisory remains non-blocking. No bundle refactor or dependency added.

## Files Created / Modified for F06

Created:
- docs/F06_CONTRACT.md
- docs/F06_COMPLETION.md
- src/types/billing.ts
- src/features/billing/billing-api.ts
- src/features/billing/billing-model.ts
- src/features/billing/billing-ui.tsx
- src/features/billing/appointment-billing.tsx
- src/features/billing/signature-dialog.tsx
- src/features/billing/invoice-documents.tsx
- src/test/billing.test.tsx

Modified:
- src/api/client.ts
- src/api/error-messages.ts
- src/features/billing/invoices-page.tsx
- src/features/billing/invoice-detail-page.tsx
- src/features/appointments/appointment-detail-page.tsx (billing entry only)
- src/features/clinical/clinical-appointment-page.tsx (completed billing entry only)
- src/components/app-shell/app-shell.tsx (billing labels)
- src/features/dashboard/dashboard-page.tsx (billing label)

Pre-existing unrelated worktree changes were left intact.

## Gaps and Intentional Omissions

- No direct GET appointment/invoice: supported invoice list filter is used.
- No original item edit API. No invented monetary/SVB defaults or snapshot edits.
- Upload and capture are separate operations; there is no document deletion/cleanup
  API. A failed capture may leave an unlinked upload. Frontend retries reuse its
  in-memory document reference; no deletion or invented cleanup endpoint is used.
- PDF generation is current CLOSED only; historical documents are read-only.
- Handoff pagination nesting and the freeze signature error name differ from
  implemented source. Frontend follows flat meta and actual hash error codes.
- No automatic appointment completion, billing calculations or clinical mutation.
- No cancellation/void-signature UI, corrections/replacements, declarations,
  submissions, exports, settings, refresh/logout endpoint or location workaround.

F06 implementation and live QA lifecycle are complete. Native PDF visual acceptance
is explicitly limited as noted above. F07 was not started.
