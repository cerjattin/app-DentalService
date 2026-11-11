# SVB form and operational fixes — 2026-10-30

## Layout update — 2026-11-11

The user now explicitly requests the saved signature above the line labeled **Paraaf**. Layout `svb_notaform_v2` / storage suffix `svb-nota-v2` supersedes the positioning described below for newly generated PDFs. The trace is placed at the lower right, above the Paraaf line; the line is lowered within the available footer space to keep the trace clear of the provider field. Signer identity, patient/representative label and Curaçao timestamp remain visible at the left. This is still the existing patient/representative signature evidence; it does not attest a professional signature.

The route, permissions, signed snapshots, source image and signature/content hashes are unchanged. A new storage suffix prevents reuse or overwrite of historical v1 PDFs; the invoice PDF service retains its existing per-version/content/layout idempotence. Stored PDFs remain available and are not regenerated in place. To obtain v2 for an eligible closed version, explicitly generate a new PDF after publishing the Backend update.

Fresh local validation: Backend typecheck/build PASS, unit suite **183/183 in 23 files PASS**. Two new regression cases verify patient/representative image bounds on every page and the distinct layout key. Initial sandbox execution blocked HTTP unit sockets; the same unit suite passed outside that restriction. Visual review used synthetic one-page and two-page fixtures only, with all three pages rendered by Poppler and inspected. No clinical signatures, database writes, integration tests or deployment were performed. Synthetic previews: [one page](../../output/pdf/QA-paraaf-v2.pdf), [two pages](../../output/pdf/QA-paraaf-v2-multipage.pdf).

## Historical v1 delivery — 2026-10-30

The user authorized both operational corrections and the invoice layout supplied in `declaratie_formulier.pdf`. They explicitly confirmed **Aantal = performed-procedure quantity**, not `NumberOfTreatments`, and accepted empty cells when no authoritative snapshot exists.

## Contracts

- `GET /api/v1/appointments?date=YYYY-MM-DD` retains the same fields, permissions, pagination and organization scope. Its date now denotes `[00:00, next 00:00)` in `America/Curacao`, converted to UTC instants. `from`/`to` retain their existing timestamp semantics. Date-only values used for insurance and other domains are unchanged.
- Declaration validation and submission errors appear inside the active confirmation dialog as accessible alerts. No state transition, authorization or request shape changed.
- `POST /api/v1/invoices/:id/versions/:versionId/pdf` retains its contract and requires a current CLOSED version with valid signed content. It now generates layout `svb_notaform_v1` using the supplied Letter form and a visible saved signature.
- The new storage key ends in `-svb-nota-v1.pdf`; the download filename ends in `-svb.pdf`. Generation is idempotent for that version/content/layout. Existing technical PDFs and their metadata/bytes are preserved and remain listed separately.
- No schema, migration, snapshot, signature or signed-content hash is changed. No new signature is captured for this delivery.

## Field mapping

| Form field | Authoritative source |
| --- | --- |
| Naam SVB-verzekerde | `InvoiceVersion.patientNameSnapshot` |
| SVB Seguro Cardnr | `InvoiceVersion.insuredIdSnapshot` |
| Detail factuurnummer | Distinct `InvoiceItem.detailInvoiceNumber` values on that page; also retained in each row's remarks |
| OMF-nummer | `accidentFormNumberSnapshot` |
| Diagnosecode | `diagnosticCodeSnapshot` |
| Code & naam verwijzend arts | `referrerIdSnapshot` (only the saved reference; no live name lookup) |
| Datum | `serviceDateSnapshot`, unchanged date-only |
| Verrichtingscode / Omschrijving | `procedureCodeSnapshot` / `procedureDescriptionSnapshot` |
| Machtnummer | `authorizationIdSnapshot` |
| Aantal | `quantity.toFixed(2)`, per explicit user decision |
| Assistentie J/N | `assistanceSnapshot` verbatim, blank when null; no inferred default or conversion |
| (Poli) Klinisch P/K | `policlinicSnapshot` verbatim, blank when null |
| Bedrag | `currencyCodeSnapshot` and exact Decimal `amount` |
| Opmerkingen | Detail number and `additionalNote` |
| Totaal bedrag | Exact frozen `InvoiceVersion.totalAmount` and currency, repeated as the invoice total on continuation pages |
| Code en naam medewerkende | Saved `providerIdSnapshot` codes only; the model contains no frozen professional name |
| Paraaf | Left blank: no professional-signature evidence exists in the invoice contract |
| Separate patient-signature block | Saved valid version signature, signer name, signed time in Curaçao; representative evidence is labeled as representative |

Empty snapshot fields stay empty. `NumberOfTreatments` semantics remain unresolved and unchanged. Current provider/referrer names must not replace missing historical snapshots. The patient image is distinct from the professional's Paraaf.

Each form has one OMF/diagnosis/referrer header context. Long rows continue across available grid rows/pages without truncation. Pages carry the logical invoice/version and page count; pagination does not create invoices or invoice versions. Groups contain up to four detail numbers to keep the header legible.

## Signature/document integrity

The existing service checks patient/version/organization, valid status and signed-content hash. It now reads the evidence via the backend storage adapter and verifies the original bytes against `signatureHash` before decoding. PNG, JPEG and WebP are normalized to PNG using Sharp; unreadable, mismatched-MIME or tampered evidence fails with existing `SIGNATURE_EVIDENCE_INVALID`, rather than producing a form without its signature. Source files and hashes are untouched. Sharp was added for the image formats already accepted by the capture API ([official image-input documentation](https://sharp.pixelplumbing.com/api-constructor/)).

The blank form is a 300 dpi image asset; filled values remain PDF text. The supplied form retains its Dutch labels by the user's format request. This does not change English production UI copy or claim an SVB submission certification.

## Fresh validation

| Check | Result |
| --- | --- |
| Backend typecheck and build | PASS |
| Backend unit suite | PASS: 80 tests, 9 files; includes date boundaries, PDF pagination/context, exact strings, signature embedding, PNG/JPEG/WebP and invalid evidence |
| Frontend lint and build | PASS |
| Frontend suite | PASS: 303 tests, 11 files; includes validation/submission errors within the modal and retry/cancel behavior |
| Live appointment date filter | PASS: IDs 6 and 7 at 20:00/21:00 Curaçao now returned on 2026-10-30 |
| Live browser Reception | PASS: both appointments visible in Today's worklist |
| Live browser declaration | PASS: incomplete SVB snapshot error is readable inside Validate declaration; draft preserved |
| Live PDF | PASS: QAI-000002 version 1, ANG 177.60, document 5; saved patient QA trace visible |
| PDF preservation/idempotence | PASS: repeated generation returns document 5; old document 4 byte hash, CLOSED items and signed-content hash unchanged |
| Visual QA | Filled one-page document inspected after Poppler rendering. Separate 3-page stress fixture inspected; terminal long text preserved and all text bounds within the page |

The first sandboxed backend HTTP unit run was blocked by local-socket EACCES; rerun outside that restriction passed. No database integration suite was run against Supabase. The integration PDF fixture was updated to upload real PNG bytes; its database run remains for a dedicated `_test` database. `npm install` reported 16 audit findings; no automatic audit fix was applied and their pre-existing baseline was not established in this task.

Local deliverable: `output/pdf/QAI-000002-v1-svb.pdf`; image preview beside it. HTTP evidence: [fix validation](../../frontend/docs/SUPABASE_FIXES_20261030.json). Browser screenshots remain under the existing ignored `frontend/docs/qa/` directory. Historical validation reports are preserved as historical evidence.

## Changed implementation files

- `backend/src/shared/utils/business-day.ts`, `backend/src/modules/appointments/appointment.service.ts`.
- `frontend/src/components/ui/confirm-dialog.tsx`, `frontend/src/features/declarations/declaration-detail-page.tsx`.
- `backend/src/modules/documents/invoice-pdf.generator.ts`, new `svb-invoice-form.ts`, `backend/src/modules/invoices/invoice.service.ts`, template asset and README.
- `backend/package.json` and lock: Sharp only on top of pre-existing PostgreSQL changes.
- Tests: `backend/tests/unit/business-day.test.ts`, `backend/tests/unit/invoice-pdf.test.ts`, `backend/tests/integration/invoice.test.ts`, `frontend/src/test/declarations.test.tsx`.

The pre-existing Dashboard fixes, migration code and other local edits were preserved. No commit, reset, cleanup, seed, migration or deployment was performed. Remaining MVP acceptance items from the prior pass (complete correction/replacement, a complete SVB export fixture, cross-organization browser matrix, responsive matrix) remain separate.
