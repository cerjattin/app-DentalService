# Backend Release Checklist

## OPS-01 — local candidate, 8 November 2026

The current attention, deferred pricing and prepared Dentalink import contract is [OPS_01_API](OPS_01_API.md). [Backend delivery and fresh evidence](../../docs/backend/OPS_01_ENTREGA.md) identify local checks and cross-area ownership. The real Dentalink HTTP reader remains unconfigured. Deployment, target schema/permissions, external storage and client acceptance require their actual target checks; local QA does not close those gates. SVB presentation remains deferred.

## NEG-DEP-10/12 — clinical first deployment, SVB deferred

- [x] Server enforces a single complete CLOSED invoice/version on new manual prepare/record; preserves existing evidence/replays and diagnosis of legacy partial preparations.
- [x] SVB_MANUAL_RECORDING_ENABLED defaults false; true is restricted to explicit local synthetic QA. Admin cannot bypass the API capability gate.
- [x] History, internal downloads, uncertainty/release and official results of recorded facts remain available.
- [x] Read-only document inventory/private transfer manifest and actual local runtime restart/download checks prepared.
- [ ] Real QA bucket/host/redeployment verified, protected migration/permission/fiscal changes accepted in target, artifact/URLs/owners/support/backup agreed.
- [ ] Clinical/browser/client acceptance complete. SVB sources/format/presentation are deferred, not a gate on independent clinical QA.

[Current contract and fresh checks](NEG_DEP_10_12.md) supersede the previous manual-enablement notes below. No deployment or clinic writes performed by this preparation.

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
- [ ] `ACCESS_TOKEN_SECRET` and database credentials are production-grade.
- [ ] CORS origins are restricted to deployed frontend origins.
- [ ] `DOCUMENT_STORAGE_PROVIDER` is appropriate; LOCAL uses durable `DOCUMENT_STORAGE_PATH` with proven backup/restore; Vercel uses a verified private external bucket.
- [ ] `DOCUMENT_MAX_UPLOAD_BYTES` is aligned with infrastructure limits.
- [ ] Logs contain correlation IDs and no sensitive payloads.

## Data And Master Dependencies

- [ ] Inventory actual target migrations/permissions/integrity, then apply reviewed pending migrations and permission changes in a controlled step. Never core seed/QA/cleanup on clinic data.
- [ ] Validate the Supabase/Postman flows; local PostgreSQL tests alone do not complete destination acceptance.
- [ ] Preserve manual CHECK constraints, collations, search/timestamp triggers and RLS in future migrations.

- [ ] Official SVB procedure/tariff master data import process is defined.
- [ ] Production organization declarant and policlinic codes are configured.
- [ ] Provider SVB IDs are loaded as real master data.
- [ ] DBR-001 is resolved before promising revocable refresh/logout.
- [ ] Field-by-field manual workflow is accepted with preparation, proof, uncertainty and results; no file or transport adapter is required. Automated transport remains disabled until separately contracted.

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

## NEG-FINAL-07/08/09 — 2026-11-03

- [x] Backend manual-entry routes, proof/result, immutable evidence, idempotency, counter and transaction rollback implemented and tested in dedicated synthetic QA.
- [x] Typecheck, build/preparation command and full QA regression passed; [fresh evidence and UAT limits](NEG_FINAL_09_BACKEND_VALIDATION.md).
- [x] Private persistent storage adapter and production/Vercel configuration guards implemented; provider contract tested with HTTP mocks.
- [ ] Actual target migrations, fiscal integrity and reviewed permission synchronization complete.
- [ ] Actual bucket/host downloads, old local-file transition, HTTPS/CORS and restart/update smoke accepted.
- [ ] Individual pilot users, backup/restore schedule/owner, support and suspension agreed.
- [ ] Clinical source rules, browser/devices and client round accepted. No deployment or real portal entry performed here.
