# F07 Corrections Completion Report

Date: 2026-09-04. F07 is limited to corrections and invoice versioning. Backend
contracts, application code, database structure and dependencies were not changed.

## Implemented

- Correction history, request, approve, reject and cancel actions use independent
  `invoice.request_correction` and `invoice.apply_correction` guards.
- Approved requests create a Backend-owned replacement version. Version number,
  copied items, source links, snapshots and totals are never assembled client-side.
- Only current draft correction items expose editing. All exact PATCH fields are
  supported with RHF/Zod; IDs and financial values stay strings. No semantics or
  defaults were introduced for NumberOfTreatments or Assistance.
- Version selection shows type, state, correction reason, source/replacement links,
  status history, signatures and version-specific PDF documents. Historical
  versions never expose mutation controls.
- F06 signature capture, signing, close and PDF infrastructure now supports the
  current correction version. Every operation includes its replacement version ID.
  Close relies on Backend to supersede history and make the replacement immutable.
- Centralized correction query keys and targeted invalidation cover correction,
  invoice, version, history and existing document/signature resources.

## Live Validation

Backend readiness returned HTTP 200 with `ready` / database `ok`. Canonical UI:
`http://127.0.0.1:5173`; API: `http://127.0.0.1:3000/api/v1`.

Verified QA invoice `1854 / QAI-000002`, patient `QA-POSTMAN-PAT-001`, began as
`CLOSED` with only original version `1952 CLOSED` and zero corrections. The test
left a valid historical chain:

| Resource | Result |
| --- | --- |
| Rejected correction | `127 REJECTED`, source `1952`, no replacement |
| Applied correction | `128 APPLIED`, source `1952`, replacement `1953` |
| Original version | `1952 ORIGINAL SUPERSEDED`, original content/signature/PDF retained |
| Replacement version | `1953 CORRECTION CLOSED`, supersedes `1952` |
| Replacement items | `2023` from `2021`; `2024` from `2022` |
| Controlled edit | Item `2023` additional note only; total remained `ANG 200.50` |
| Signature | `874 VALID`, version `1953`; PNG document `1313` |
| Replacement PDF | document `1314`, link `59`, version `1953`, 8,603 bytes |

Original item `2021` retained its prior note while replacement item `2023` received
the F07 note. Original signature `873` and PDF `1312 / QAI-000002-v1.pdf` remained
attached to version `1952`; signature `874` and PDF `1314 / QAI-000002-v2.pdf`
belong to `1953`. Authenticated PDF download returned 200 `application/pdf`.
No history was rewritten and no declaration/submission operation ran.

The canonical browser rendered both correction records, the replacement chain,
read-only closed/superseded states, correct v1/v2 documents and no correction edit
controls on the original. Console logs contained only Vite debug and React DevTools
information: no React warning, exception or CORS error. Requests used port 3000 and
the single `/api/v1` prefix; direct endpoint evidence confirmed exact methods and
version IDs. Desktop rendering was visually checked. The approved app browser does
not expose viewport resizing, so a separate tablet pixel capture was not claimed;
the responsive layout and wide-dialog behavior are covered by existing CSS patterns.

The F06 native PDF follow-up reached the real View PDF action for v2, but Browser
Use blocked blob navigation under its security policy. No bypass was attempted.
Binary retrieval and document/version association passed; normal-browser visual
PDF acceptance remains manual.

## Validation

- Previous baseline: 128 tests. F07 added 18. Total: 146 tests in six files.
- `npm run lint`: PASS.
- `npm run build`: PASS.
- `npm test`: PASS, 146/146.
- Bundle: JS 609.30 kB / gzip 178.59 kB; CSS 28.79 kB / gzip 6.31 kB.
  F06 baseline was approximately 596 kB. The existing >500 kB Vite advisory remains
  non-blocking; no dependency or unrelated bundle refactor was added.

## Contract Gaps and Omissions

No correction item create/delete or explicit recalculation endpoint exists; only
PATCH of copied items is exposed and recalculation is part of that Backend mutation.
Approval accepts no reason body; rejection/cancellation accept an optional reason.
Correction request metadata is supported but intentionally not fabricated by the UI.
No declarations, submission, export, settings, refresh-token, Backend logout or
historical editing functionality was implemented.

