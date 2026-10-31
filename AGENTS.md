# ODONTHO SERVICES — Shared project instructions

Scope: repository root and descendants. Follow more specific instructions such as `frontend/AGENTS.md` when working in those directories.

## Shared context

- Read `docs/CONTEXTO_PROYECTO.md`, `docs/PLAN_MVP.md`, and the relevant area guide under `docs/`.
- Six areas: architecture, backend, frontend, business logic, design, database. These are responsibilities within one repository, not separate services.
- MVP development runs locally in `C:\workspace\app-DentalService`. Supabase PostgreSQL is the database target; Vercel is the final deployment target. Current code still uses MySQL. Never describe a planned migration as completed.
- Preserve existing local changes. Do not reset, apply stashes, commit, push, merge, tag, or deploy unless subsequently requested by the user.

## Boundaries

- HTTP routes/controllers validate and transport; services enforce business rules and transactions; repositories implement persistence. Keep business logic in backend services, not a second independent application.
- Frontend consumes the backend API, never database credentials or privileged Supabase access. Keep the shared SVB catalogue API/cache used by Clinical and Services.
- Read `backend/docs/API_FREEZE_BACKEND.md`, `backend/docs/FRONTEND_HANDOFF.md`, and `backend/docs/BACKEND_RELEASE_CHECKLIST.md` before integration changes. Inspect mounted routes: some older prose and chat completion reports are stale.
- User-authorized changes within an area may proceed. For changes spanning areas, document the affected API/model/rules and update their contracts together within the requested scope.
- Keep auth/RBAC in the existing backend during the initial PostgreSQL migration. Supabase Auth, Realtime, and new session behavior are separate decisions.

## Domain invariants

- Entity IDs and monetary Decimal values are strings at API boundaries. Do not convert IDs or financial calculations to JS floating point.
- Business timezone is `America/Curacao`, independent of the developer's workstation timezone.
- Service/SKU = `SvbProcedure`; performed procedure = `EncounterProcedure`; tariff history = `SvbTariff`.
- One appointment has one logical invoice with multiple items and explicit versions. Signed/closed/superseded history and signed content snapshots are immutable.
- Permissions and organization isolation are enforced by the backend. Do not use role names as authorization shortcuts.
- Keep number allocation transactional; never use `MAX(...) + 1`.
- Do not invent SVB catalogues, tariff values, submission behavior, or unresolved `NumberOfTreatments`/`Assistance` semantics.
- Production UI text is English; project discussions/documentation may be Spanish.

## Verification and handoff

- For implementation work, run the checks relevant to changed code. Frontend: lint, build, tests. Backend: typecheck, build, unit tests; integration tests require a dedicated test database.
- Do not run migrations, seeds, cleanup, or integration tests against clinic data. Keep secrets out of outputs and documentation.
- Documentation-only work needs link/path and diff checks; do not claim historical test counts as a fresh validation.
- Report actual changed files, checks, blockers, and cross-area impact. Each area updates its own guide; shared context/plan edits are coordinated through Architecture.
- Multiple local chats share the working directory. Initial area onboarding is read-only; avoid simultaneous edits to the same files or concurrent migration/seed operations.
