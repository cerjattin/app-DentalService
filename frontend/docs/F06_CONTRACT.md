# F06 Billing Contract

Sources: frozen API/handoff/release checklist; invoice, signature and document
routes, schemas, serializers and services read to resolve DTO/lifecycle omissions.
All paths below are relative to the environment-configured `/api/v1` base.

| Method / path | Request | Response data | Permission |
| --- | --- | --- | --- |
| GET /invoices | page, pageSize; optional q, status, appointmentId, patientId, patientInsuranceId, from, to | Invoice[]; flat pagination meta | invoice.read |
| POST /appointments/:appointmentId/invoice | No body | Invoice with original version/items | invoice.create |
| GET /invoices/:id | None | Invoice, currentVersion/items, version summaries | invoice.read |
| GET /invoices/:id/versions/:versionId | None | Full version including items | invoice.read |
| POST /invoices/:id/versions/:versionId/prepare-signature | No body | Invoice | invoice.prepare_signature |
| GET /invoices/:id/versions/:versionId/signature-content | None | schema, contentHash, lockedAt, canonical content | invoice.read |
| GET /invoices/:id/versions/:versionId/signatures | None | Signature[] with document metadata | invoice.read |
| POST /documents | Raw PNG; query documentType=SIGNATURE, originalFilename | Document metadata | document.upload |
| POST /invoices/:id/versions/:versionId/signatures | signatureDocumentId, signatureType, captureMethod, expectedContentHash; conditional signerName, signerRelationship | Signature | signature.capture |
| POST /invoices/:id/versions/:versionId/sign | No body | Invoice | invoice.sign |
| POST /invoices/:id/versions/:versionId/close | No body | Invoice | invoice.close |
| GET /invoices/:id/documents | None | Version/document links with metadata | document.read |
| POST /invoices/:id/versions/:versionId/pdf | No body | Version/document link with metadata | document.generate |
| GET /documents/:id/download | None | Authenticated binary | document.read |

## Lifecycle and DTO Rules

- Creation requires COMPLETED appointment and COMPLETED encounter; at least one
  billable procedure, one insurance and currency. Backend creates one logical
  invoice, ORIGINAL v1 DRAFT and all items/snapshots/totals atomically. No input DTO.
- Preparation locks DRAFT ORIGINAL, stores contentHash, moves invoice and version
  to PENDING_SIGNATURE. Capture records evidence but does NOT mark invoice signed.
- Signature types: PATIENT, LEGAL_REPRESENTATIVE, GUARDIAN, OTHER. Non-patient
  requires name; representative/guardian also relationship. PATIENT name is server
  snapshot. Capture methods: SIGNATURE_PAD, TOUCHSCREEN, MOUSE, UPLOADED, OTHER.
- Sign requires valid matching evidence/hash. Close requires SIGNED/current version
  and valid locked snapshots/evidence. Both return refreshed Invoice.
- PDF generation is idempotent for the CURRENT CLOSED version and returns stored
  metadata, not bytes or a public URL. Existing historical documents remain readable.
- Invoice/version/item financial and quantity fields are strings. All IDs are
  strings; line/version numbers are numbers. Snapshot nulls remain null.
- NumberOfTreatments/Assistance are not preparation inputs. No defaults or edits.

## Scope Boundaries / Gaps

- No GET appointment/invoice endpoint: lookup uses documented appointmentId filter.
- Versions and items are embedded; no redundant list/items calls needed.
- No original item editing endpoint. Correction-only writes are excluded.
- Signature void, invoice cancellation and corrections are not exposed in F06.
- Clinical completion does not complete appointment; existing F04 transition remains
  explicit. No automatic appointment mutation during invoice creation.
- PDF is a backend technical invoice document, not a frontend-created official SVB layout.
- Handoff pagination prose says meta.pagination; controller returns flat meta.
- Freeze mentions INVOICE_SIGNATURE_CONTENT_MISMATCH, but the implemented services
  use SIGNATURE_CONTENT_HASH_MISMATCH and INVOICE_CONTENT_INTEGRITY_MISMATCH. Only
  implemented codes are mapped.

## Error Codes Mapped in F06

Existing shared AUTHENTICATION_REQUIRED, PERMISSION_DENIED, VALIDATION_ERROR and
INVALID_ID handling is retained. Added codes:

```text
INVOICE_NOT_FOUND
INVOICE_VERSION_NOT_FOUND
INVOICE_ALREADY_EXISTS
APPOINTMENT_NOT_BILLABLE
CLINICAL_ENCOUNTER_REQUIRED
CLINICAL_ENCOUNTER_NOT_COMPLETED
CLINICAL_ENCOUNTER_NOT_BILLABLE
INVOICE_NO_BILLABLE_PROCEDURES
INVOICE_MULTIPLE_INSURANCES
INVOICE_MIXED_CURRENCIES
INVOICE_INSURANCE_PATIENT_MISMATCH
INVOICE_ITEM_WRONG_APPOINTMENT
INVOICE_ITEM_TARIFF_PROCEDURE_MISMATCH
INVOICE_ITEM_AMOUNT_MISMATCH
INVOICE_TOTAL_MISMATCH
INVOICE_CURRENCY_MISMATCH
INVOICE_NOT_PREPARABLE
INVOICE_DECLARANT_ID_REQUIRED
INVOICE_INSURED_ID_REQUIRED
INVOICE_PROVIDER_SNAPSHOT_REQUIRED
INVOICE_SNAPSHOT_INCOMPLETE
INVOICE_VERSION_NOT_CURRENT
INVOICE_VERSION_NOT_SIGNATURE_READY
INVOICE_ALREADY_PREPARED_FOR_SIGNATURE
INVOICE_CONTENT_INTEGRITY_MISMATCH
SIGNATURE_CONTENT_HASH_MISMATCH
SIGNATURE_DOCUMENT_NOT_FOUND
SIGNATURE_DOCUMENT_INVALID
SIGNATURE_DOCUMENT_ALREADY_USED
SIGNATURE_EVIDENCE_INVALID
VALID_SIGNATURE_REQUIRED
INVOICE_ALREADY_SIGNED
INVOICE_ALREADY_CLOSED
INVOICE_NOT_CLOSABLE
INVOICE_SIGNATURE_STATE_INVALID
INVOICE_CONTENT_NOT_LOCKED
INVOICE_PDF_NOT_GENERATABLE
INVALID_DOCUMENT_FILENAME
DOCUMENT_MIME_TYPE_NOT_ALLOWED
DOCUMENT_EMPTY
DOCUMENT_TOO_LARGE
DOCUMENT_NOT_FOUND
DOCUMENT_FILE_NOT_FOUND
DOCUMENT_INTEGRITY_MISMATCH
DOCUMENT_STORAGE_INVALID
DOCUMENT_STORAGE_URI_INVALID
DOCUMENT_STORAGE_UNSUPPORTED
```
