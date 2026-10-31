# Historical MySQL schema

This is an exact copy of the executable MySQL schema before the PostgreSQL conversion. Its generator path is historical; do not generate the active client from this archived schema. The original MySQL migration history remains at `../migrations/` and `database/001...006` at repository root.

The active model is `../schema.prisma`; its separate PostgreSQL migration history is `../postgresql/migrations/`. Do not mark the MySQL baseline as applied on PostgreSQL. See [the rollout guide](../../../docs/base-de-datos/MIGRACION_POSTGRESQL.md).
