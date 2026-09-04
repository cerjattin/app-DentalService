# F07 Correction Contract

Sources: frozen API/handoff/release checklist plus invoice routes, Zod schemas,
serializers and service lifecycle guards. Paths are relative to `/api/v1`.

| Method and path | Request / response | Permission |
| --- | --- | --- |
| GET `/invoices/:id/corrections` | None / `InvoiceCorrection[]` | `invoice.read` |
| GET `/invoices/:id/corrections/:correctionId` | None / `InvoiceCorrection` | `invoice.read` |
| POST `/invoices/:id/corrections` | `reasonCode`, `reasonText`, optional metadata / correction | `invoice.request_correction` |
| POST `/invoices/:id/corrections/:correctionId/approve` | No body / correction | `invoice.apply_correction` |
| POST `/invoices/:id/corrections/:correctionId/reject` | Optional `reason` / correction | `invoice.apply_correction` |
| POST `/invoices/:id/corrections/:correctionId/cancel` | Optional `reason` / correction | `invoice.apply_correction` |
| POST `/invoices/:id/corrections/:correctionId/replacement` | No body / correction | `invoice.apply_correction` |
| PATCH `/invoices/:id/versions/:versionId/items/:itemId` | Strict optional correction snapshot fields / item | `invoice.apply_correction` |
| GET `/invoices/:id/status-history` | None / status history | `invoice.read` |

F06 version, signature, close, PDF and document endpoints are reused unchanged.
The Backend accepts item updates only on the current `DRAFT` `CORRECTION`
version. It copies source items and creates the version number, snapshot links,
totals and supersession relationship. There are no add/remove correction-item
endpoints. Financial values remain strings; Backend recalculates item amount and
version total with Decimal arithmetic.

Lifecycle: current `CLOSED` version -> `REQUESTED` -> `APPROVED` -> replacement
`CORRECTION/DRAFT` -> `PENDING_SIGNATURE` -> `SIGNED` -> `CLOSED`; close marks the
correction `APPLIED` and source version `SUPERSEDED`. `REJECTED` and `CANCELLED`
requests return the logical invoice to `CLOSED` without a replacement.

F07 maps: `INVOICE_CORRECTION_NOT_FOUND`, `INVOICE_CORRECTION_ALREADY_ACTIVE`,
`INVOICE_CORRECTION_NOT_REQUESTABLE`, `INVOICE_CORRECTION_NOT_APPROVABLE`,
`INVOICE_CORRECTION_NOT_RESOLVABLE`, `INVOICE_CORRECTION_NOT_APPROVED`,
`INVOICE_CORRECTION_REPLACEMENT_ALREADY_EXISTS`,
`INVOICE_CORRECTION_SOURCE_INVALID`, `INVOICE_CORRECTION_ITEM_NOT_EDITABLE`, and
`INVOICE_ITEM_NOT_FOUND`. Existing `INVOICE_CURRENCY_MISMATCH`, invoice lifecycle,
signature, document, validation and authorization mappings remain in force.

