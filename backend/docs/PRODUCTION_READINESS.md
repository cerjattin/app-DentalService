# Production Readiness

## Summary

Backend is ready for local-network hardening validation and Postman integral testing. It is not fully production-complete until external SVB contracts, master data, and auth session persistence are resolved.

## Status Matrix

| Area | Status | Notes |
| --- | --- | --- |
| Database | WARNING | Prisma 7 with MariaDB adapter and MySQL works. `allowPublicKeyRetrieval` remains enabled for local MySQL `caching_sha2_password`; production should use a secure DB/auth configuration and network controls. |
| Auth | BLOCKED | DBR-001 unresolved. Schema has no refresh/session/token-family/revocation persistence model, so refresh/logout revocation is intentionally not implemented. |
| RBAC | READY | API uses permission middleware rather than role-name authorization. Route audit found protected modules behind `authenticate` and `requirePermission`. |
| CORS | READY | Uses explicit configured origins through `CORS_ALLOWED_ORIGINS`; blocked origins are not reflected. No-origin requests remain allowed for Postman/server-to-server. |
| Security headers | READY | Helmet is enabled and Express `x-powered-by` is disabled. |
| Login protection | READY | Account lockout exists and `/auth/login` has localized rate limiting. |
| Error sanitization | READY | AppError/Zod/body-parser errors return safe API envelopes with correlation IDs. Unexpected errors return `INTERNAL_SERVER_ERROR` without stack details. |
| Logging | READY | Pino/pino-http include correlation, method, URL, status, and duration. Authorization, cookies, passwords, hashes, tokens, secrets, and DB credentials are redacted. |
| Request limits | READY | JSON and urlencoded payloads are capped at 1 MB. Document upload raw body uses `DOCUMENT_MAX_UPLOAD_BYTES`. |
| Storage | READY | Local storage resolves under configured root, rejects traversal, avoids `src`, uses controlled keys, validates hash on download, and hides `storageUri` from API responses. |
| PDF | WARNING | PDFKit is installed and retained as the standard PDF engine. Technical invoice PDFs are not official SVB forms. Official layout remains pending. |
| Declarations | WARNING | Declaration export adapters are implemented. CSV/TXT header details require final SVB confirmation. |
| Submission | WARNING | Submission layer is implemented behind an adapter interface. Production adapter is intentionally not configured, so real SVB submission remains pending. |
| SVB master data | BLOCKED | Official procedures/tariffs are external master data. No fictitious production catalog was seeded. |
| Backup/restore | WARNING | No automated backup/restore operational runbook is present in this backend repository. |
| TLS/network deployment | WARNING | TLS termination, LAN firewall rules, host hardening, and certificate management are deployment responsibilities outside this codebase. |

## DBR-001 Required Contract

To unblock refresh/logout revocation, the database needs persistent session/token support with at least:

- Session identifier and user/organization relation.
- Refresh token family or hashed refresh token storage.
- Expiration, rotation, revocation timestamp, and revocation reason.
- Device/IP/user-agent metadata for audit and incident response.
- Indexes for active session lookup and cleanup.

Until this exists, the API must remain access-token only and must not introduce stateless refresh tokens or in-memory revocation.

## External Pendings

- Official SVB procedure and tariff master data.
- Production declarant ID and organization configuration.
- Official invoice/PDF layout confirmation.
- SVB declaration CSV/TXT header and schema confirmation.
- Real SVB submission adapter and operational credential handling.
- Backup/restore and TLS deployment runbooks.
