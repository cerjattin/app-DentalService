# Backend Release Checklist

Use this checklist before handing a build to Frontend, QA, staging, or production.

## Code Freeze

- [ ] No pending schema, migration, or DB contract changes.
- [ ] No new feature work after API freeze approval.
- [ ] `docs/API_FREEZE_BACKEND.md` matches current route files.
- [ ] `docs/FRONTEND_HANDOFF.md` reflects tested flows.
- [ ] Postman collection and environment are current.
- [ ] QA seed/cleanup scripts are idempotent and fixture-scoped.

## Validation

- [ ] `npm run typecheck` passes.
- [ ] `npm test` or `vitest run` passes.
- [ ] Postman E2E collection passes with QA dataset.
- [ ] Upload/download and PDF generation are manually smoke-tested.
- [ ] No `as any`, `@ts-ignore`, or `@ts-expect-error` introduced without documented reason.

## Security And Config

- [ ] Production `.env` values are set outside source control.
- [ ] `JWT_SECRET` and database credentials are production-grade.
- [ ] CORS origins are restricted to deployed frontend origins.
- [ ] `DOCUMENT_STORAGE_ROOT` points to durable storage.
- [ ] `DOCUMENT_MAX_UPLOAD_BYTES` is aligned with infrastructure limits.
- [ ] Logs contain correlation IDs and no sensitive payloads.

## Data And Master Dependencies

- [ ] Official SVB procedure/tariff master data import process is defined.
- [ ] Production organization declarant and policlinic codes are configured.
- [ ] Provider SVB IDs are loaded as real master data.
- [ ] DBR-001 is resolved before promising revocable refresh/logout.
- [ ] Real declaration submission adapter is configured before enabling live submit.

## Frontend Handoff

- [ ] Frontend has API base URL and environment strategy.
- [ ] Frontend uses permissions from `/auth/me`.
- [ ] Frontend treats BigInt and Decimal values as strings.
- [ ] Frontend implements envelope/error handling with `error.code`.
- [ ] Frontend handles binary upload/download without path assumptions.
- [ ] Frontend implements signature -> close -> PDF and correction flows according to handoff.

## Release Decision

- [ ] Backend is approved for Frontend integration.
- [ ] Production blockers are documented and assigned.
- [ ] Deployment owner and rollback procedure are identified.
