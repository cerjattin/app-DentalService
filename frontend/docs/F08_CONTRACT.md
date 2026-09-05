# F08 Declaration Contract

## Endpoints

- `GET/POST /declarations`
- `GET /declarations/:id`
- `GET/POST /declarations/:id/items`
- `POST /declarations/:id/ready`
- `GET/POST /declarations/:id/exports`
- `GET /declarations/:id/submissions`
- `GET /declarations/:id/submissions/:submissionId`
- `POST /declarations/:id/submit`
- `POST /declarations/:id/submissions/:submissionId/result`
- `GET /documents/:documentId/download`

Permissions are `declaration.read`, `declaration.create`, `declaration.update`, `declaration.export`, `declaration.submit`, `document.read` for downloads, and `insurance.read` for the payer lookup used by creation/filtering.

## Lifecycle

The implemented Backend lifecycle is `DRAFT -> READY -> EXPORTED -> SUBMITTED -> ACCEPTED | PARTIALLY_REJECTED | REJECTED`. `CANCELLED` exists in the read model, but no cancellation endpoint is frozen. DRAFT item addition accepts an `invoiceItemId`; the Backend verifies that it belongs to the logical invoice's current CLOSED version and snapshots declaration data. There is no item removal or candidate lookup endpoint.

Exports are Backend-generated. The service renderer supports `CSV`, `TXT`, `JSON`, and `XML`; the request schema also advertises `XLSX` and `API_PAYLOAD`, but the service rejects both with `UNSUPPORTED_EXPORT_FORMAT`, so they are not offered. Submission requires a configured Backend adapter and does not imply direct SVB transmission.

## Contract Gaps

- No eligible InvoiceVersion/invoice-item candidate endpoint.
- No declaration item removal endpoint.
- No declaration status-history endpoint.
- No configured submission adapter in the local runtime.
- No server-calculated batch total in the declaration DTO.
- `XLSX` and `API_PAYLOAD` pass request validation but are rejected by the service.
