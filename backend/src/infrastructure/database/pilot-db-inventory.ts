import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { Client } from "pg";

export function localMigrationInventory(root = "prisma/postgresql/migrations") {
  return readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => ({
      name: d.name,
      checksum: createHash("sha256")
        .update(readFileSync(path.join(root, d.name, "migration.sql")))
        .digest("hex"),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** No names/emails, document paths, connection details, or migration logs in output. */
export async function inspectPilotDatabase(
  db: Pick<Client, "query">,
  expected = localMigrationInventory(),
) {
  await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    await db.query("SET LOCAL statement_timeout = '10s'");
    const identity = (
      await db.query<{ version: string; database: string }>(
        "SELECT current_setting('server_version') AS version,current_database() AS database",
      )
    ).rows[0]!;
    const hasHistory = (
      await db.query(
        "SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS present",
      )
    ).rows[0].present;
    const history = hasHistory
      ? (
          await db.query<{
            migration_name: string;
            checksum: string;
            finished: boolean;
            rolled_back: boolean;
          }>(
            `SELECT migration_name,checksum,finished_at IS NOT NULL AS finished,rolled_back_at IS NOT NULL AS rolled_back
       FROM _prisma_migrations ORDER BY migration_name`,
          )
        ).rows
      : [];
    const migrations = expected.map((e) => {
      const rows = history.filter(
        (h) => h.migration_name === e.name && !h.rolled_back,
      );
      return {
        name: e.name,
        status: rows.some((h) => h.finished && h.checksum === e.checksum)
          ? "MATCH"
          : rows.some((h) => h.finished)
            ? "CHECKSUM_MISMATCH"
            : rows.length
              ? "FAILED_OR_RUNNING"
              : "PENDING",
      };
    });
    const unknown = history
      .filter(
        (h) =>
          h.finished &&
          !h.rolled_back &&
          !expected.some((e) => e.name === h.migration_name),
      )
      .map((h) => h.migration_name);
    const failed = history.filter((h) => !h.finished && !h.rolled_back).length;
    const tables = (
      await db.query<{
        table_name: string;
        rls: boolean;
      }>(`SELECT c.relname AS table_name,c.relrowsecurity AS rls
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind='r' AND c.relname<>'_prisma_migrations' ORDER BY c.relname`)
    ).rows;
    const checks = (
      await db.query<{
        count: number;
      }>(`SELECT count(*)::int AS count FROM pg_constraint c
      JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' AND c.contype='c' AND c.convalidated`)
    ).rows[0]!.count;
    const hasPermissions =
      tables.some((t) => t.table_name === "permissions") &&
      tables.some((t) => t.table_name === "role_permissions");
    const roles = hasPermissions
      ? (
          await db.query<{
            code: string;
            grants: number;
            missing_treatment_read: boolean;
            missing_treatment_manage: boolean;
            missing_configured_permissions: number;
          }>(`
      SELECT r.code,count(rp.permission_id)::int AS grants,
        NOT EXISTS (SELECT 1 FROM role_permissions x JOIN permissions p ON p.id=x.permission_id WHERE x.role_id=r.id AND p.code='treatment_case.read') AS missing_treatment_read,
        NOT EXISTS (SELECT 1 FROM role_permissions x JOIN permissions p ON p.id=x.permission_id WHERE x.role_id=r.id AND p.code='treatment_case.manage') AS missing_treatment_manage,
        (SELECT count(*)::int FROM permissions p WHERE NOT EXISTS(SELECT 1 FROM role_permissions x WHERE x.role_id=r.id AND x.permission_id=p.id)) AS missing_configured_permissions
      FROM roles r LEFT JOIN role_permissions rp ON rp.role_id=r.id
      WHERE r.code IN ('ADMIN','RECEPTION','PROVIDER') GROUP BY r.id ORDER BY r.code`)
        ).rows
      : [];
    const missingRoleCodes = ["ADMIN", "RECEPTION", "PROVIDER"].filter(
      (code) => !roles.some((r) => r.code === code),
    );
    const expectedPermissions = [
      ...new Set(
        [
          ...readFileSync("prisma/seed.ts", "utf8").matchAll(
            /\[\s*"([a-z_]+\.[a-z_]+)"\s*,/g,
          ),
        ].map((m) => m[1]!),
      ),
    ];
    const actualPermissions = hasPermissions
      ? (
          await db.query<{ code: string }>("SELECT code FROM permissions")
        ).rows.map((r) => r.code)
      : [];
    const missingPermissionCodes = expectedPermissions.filter(
      (c) => !actualPermissions.includes(c),
    );
    const permissionIssues = roles.flatMap((r) =>
      r.code === "ADMIN" && r.missing_configured_permissions > 0
        ? ["ADMIN_MISSING_CONFIGURED_PERMISSIONS"]
        : r.code === "PROVIDER" &&
            (r.missing_treatment_read || r.missing_treatment_manage)
          ? ["PROVIDER_TREATMENT_GRANTS_MISSING"]
          : r.code === "RECEPTION" &&
              (r.missing_treatment_read || !r.missing_treatment_manage)
            ? ["RECEPTION_TREATMENT_MATRIX_MISMATCH"]
            : [],
    );
    const localBaseline = readFileSync(
      "prisma/postgresql/migrations/20261030000000_init/migration.sql",
      "utf8",
    );
    const expectedChecks = [
      ...localBaseline.matchAll(/ADD CONSTRAINT "([^"]+)" CHECK/g),
    ].map((m) => m[1]!);
    const actualChecks = (
      await db.query<{
        conname: string;
      }>(`SELECT c.conname FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace
      WHERE n.nspname='public' AND c.contype='c' AND c.convalidated`)
    ).rows.map((r) => r.conname);
    const missingChecks = expectedChecks.filter(
      (c) => !actualChecks.includes(c),
    );
    const triggers = (
      await db.query<{
        name: string;
        table_name: string;
      }>(`SELECT t.tgname AS name,c.relname AS table_name
      FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND NOT t.tgisinternal AND t.tgenabled<>'D'`)
    ).rows;
    const missingTriggers = [
      ...localBaseline.matchAll(/CREATE TRIGGER (\w+) [^;]+? ON "([^"]+)"/g),
    ]
      .map((m) => ({ name: m[1]!, table_name: m[2]! }))
      .filter(
        (e) =>
          !triggers.some(
            (t) => t.name === e.name && t.table_name === e.table_name,
          ),
      );
    const migrationSql = localMigrationInventory()
      .map((m) =>
        readFileSync(
          `prisma/postgresql/migrations/${m.name}/migration.sql`,
          "utf8",
        ),
      )
      .join("\n");
    const expectedMigrationChecks = [
      ...migrationSql.matchAll(/ADD CONSTRAINT\s+"?([a-zA-Z_0-9]+)"?\s+CHECK/g),
    ].map((m) => m[1]!);
    const missingMigrationChecks = [...new Set(expectedMigrationChecks)].filter(
      (c) => !actualChecks.includes(c),
    );
    const expectedMigrationTriggers = [
      ...migrationSql.matchAll(
        /CREATE TRIGGER (\w+) [^;]+? ON (?:public\.)?"?(\w+)"?/g,
      ),
    ].map((m) => ({ name: m[1]!, table_name: m[2]! }));
    const missingMigrationTriggers = expectedMigrationTriggers.filter(
      (e) =>
        !triggers.some(
          (t) => t.name === e.name && t.table_name === e.table_name,
        ),
    );
    const collation =
      (
        await db.query(`SELECT collprovider='i' AND NOT collisdeterministic AS valid
      FROM pg_collation WHERE oid=to_regcollation('public.odontho_ai_ci')`)
      ).rows[0]?.valid === true;
    const extension =
      (
        await db.query(
          "SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname='unaccent') AS present",
        )
      ).rows[0].present === true;
    const blocked =
      migrations.some((m) => m.status !== "MATCH") ||
      unknown.length > 0 ||
      failed > 0 ||
      !tables.length ||
      tables.some((t) => !t.rls) ||
      missingChecks.length > 0 ||
      missingTriggers.length > 0 ||
      missingMigrationChecks.length > 0 ||
      missingMigrationTriggers.length > 0 ||
      !collation ||
      !extension ||
      missingRoleCodes.length > 0 ||
      missingPermissionCodes.length > 0 ||
      permissionIssues.length > 0;
    return {
      readOnly: true,
      version: identity.version,
      targetFingerprint: createHash("sha256")
        .update(identity.database)
        .digest("hex"),
      migrations,
      unknownMigrations: unknown,
      failedOrRunningMigrations: failed,
      applicationTables: tables.length,
      tablesWithoutRls: tables.filter((t) => !t.rls).map((t) => t.table_name),
      validatedChecks: checks,
      missingBaselineChecks: missingChecks,
      missingBaselineTriggers: missingTriggers,
      missingMigrationChecks,
      missingMigrationTriggers,
      collationValid: collation,
      unaccentPresent: extension,
      roles,
      missingRoleCodes,
      missingPermissionCodes,
      permissionIssues,
      blocked,
    };
  } finally {
    await db.query("ROLLBACK");
  }
}
