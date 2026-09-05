# F08 Completion

Status: **SPRINT F08 — CLOSED**

The declarations list and detail routes now provide permission-aware creation, filtering, item snapshots, Backend validation to READY, server export generation and authenticated downloads, submission initiation, and immutable submission-result history. IDs and declaration amounts remain strings. The UI never infers eligible versions, and final states expose no mutation controls.

## Live Validation

- Backend readiness: HTTP 200, database `ok`.
- Existing `QAD-000001` (`191`) remained EXPORTED. A new JSON export `207`, document `1315`, downloaded successfully (HTTP 200, 622 bytes).
- Corrected invoice `1854`: current replacement version `1953`/item `2023` was accepted into new `QAD-000002` (`237`), declaration item `202`.
- Superseded original version `1952`/item `2021` was rejected with `DECLARATION_ITEM_NOT_ELIGIBLE`.
- READY validation for `237` rejected incomplete QA snapshots with `DECLARATION_SVB_DATA_INCOMPLETE`; the declaration remains DRAFT.
- Submission for `191` returned `SUBMISSION_ADAPTER_NOT_CONFIGURED`; no submission record was created.
- Older export documents `1202`/`1203` have missing local files. Newly generated document `1315` is available.
- Canonical browser login, dashboard navigation, declaration list/detail, and JSON download passed at `127.0.0.1:5173`. Console contained Vite/React development messages only; no React, CORS, or uncaught errors.

## Validation

- `npm run lint`: passed
- `npm run build`: passed
- `npm test`: 173 tests passed
- Production JS: 631.04 kB (183.28 kB gzip); the existing Vite chunk advisory remains non-blocking.
