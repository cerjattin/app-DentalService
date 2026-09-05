# F09 Administration Contract

## Users

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| GET | `/users` | `user.read` | Paginated list with `q`, `status`, `role`, `page`, and `pageSize` |
| GET | `/users/:id` | `user.read` | User detail and assigned roles |
| POST | `/users` | `user.create` | Create a user with one or more frozen role codes |
| PATCH | `/users/:id` | `user.update` | Update email or profile names |
| PATCH | `/users/:id/status` | `user.update` | Activate or deactivate an account with an optional reason |
| PUT | `/users/:id/roles` | `user.assign_roles` | Replace assigned system roles |

Create accepts `email`, `firstName`, `lastName`, `password`, and `roleCodes`. Role codes are `ADMIN`, `RECEPTION`, and `PROVIDER`. Status values are `ACTIVE`, `INACTIVE`, and `LOCKED`; the status mutation accepts only `ACTIVE` or `INACTIVE`.

## Roles And Permissions

`GET /roles` requires `role.read` and returns system roles with their effective permission catalogue. The mounted API does not expose role creation, editing, deletion, custom permission assignment, or user-specific permission overrides. Role metadata is displayed in English while codes remain unchanged.

## Providers

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| GET | `/providers` | `provider.read` | Paginated list with `q`, `isActive`, `page`, and `pageSize` |
| GET | `/providers/:id` | `provider.read` | Provider detail and linked user |
| POST | `/providers` | `provider.create` | Create a professional record |
| PATCH | `/providers/:id` | `provider.update` | Update profile, status, or `userId` relationship |

Provider status uses `isActive` on the standard update endpoint. The user relationship is nullable and authoritative; no separate link endpoint is mounted.

## Errors And Gaps

Mapped codes: `USER_NOT_FOUND`, `USER_EMAIL_ALREADY_EXISTS`, `INVALID_ROLE`, `SELF_DEACTIVATION_NOT_ALLOWED`, `SELF_ADMIN_ROLE_REMOVAL_NOT_ALLOWED`, `LAST_ADMIN_REQUIRED`, `USER_ALREADY_LINKED_TO_PROVIDER`, `PROVIDER_NOT_FOUND`, and `PROVIDER_SVB_ID_ALREADY_EXISTS`.

No user delete, password reset, Settings CRUD, provider-specific status endpoint, or mutable role/permission API is available.
