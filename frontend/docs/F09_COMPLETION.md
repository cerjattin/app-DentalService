# F09 Completion

Status: **SPRINT F09 — CLOSED**

Administration now provides permission-aware workspaces for users, roles, permissions, and providers. User and provider lists use Backend filtering and pagination. Supported create, update, status, role-assignment, and provider/user-link operations use exact Backend DTOs with targeted TanStack Query invalidation. `/admin/settings` remains explicitly unavailable.

## Live Validation

- Backend readiness: HTTP 200, application `ready`, database `ok`.
- Authentication, `/auth/me`, permission-aware navigation, Administration, Users, Providers, and local logout passed at `127.0.0.1:5173`.
- Created QA user `2350`, updated its profile, replaced its role with `PROVIDER`, and left it `INACTIVE`.
- Created QA provider `3190`, linked it authoritatively to user `2350`, updated its specialty, and left it `INACTIVE`.
- A duplicate provider link was rejected with `USER_ALREADY_LINKED_TO_PROVIDER` (HTTP 409).
- Primary QA administrator `2204` remained active and unchanged; its deactivation action was disabled in the UI.
- Browser console contained no warnings, React errors, CORS errors, or uncaught exceptions. Requests used the configured API on port 3000 with no duplicated `/api/v1` path.

## Validation

- `npm run lint`: passed
- `npm run build`: passed
- `npm test`: 201 tests passed (28 added for F09)
- Production JS: 657.49 kB (188.43 kB gzip); the existing Vite chunk advisory remains non-blocking.

## Contract Limits

The Backend exposes read-only system roles and permissions. It does not expose custom role editing, permission assignment, user deletion/password reset, a separate provider activation operation, or Settings CRUD. These capabilities were intentionally omitted.
