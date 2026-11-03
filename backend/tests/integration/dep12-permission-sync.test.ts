import pg from "pg";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { createNegFuncDbFixture } from "../helpers/neg-func-db-fixture.js";
import { syncPermissions } from "../../src/infrastructure/database/permission-sync.js";
const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
let f: Awaited<ReturnType<typeof createNegFuncDbFixture>>;
const roles = () =>
  db.query<{ role: string; code: string }>(
    `SELECT r.code AS role,p.code FROM role_permissions rp JOIN roles r ON r.id=rp.role_id JOIN permissions p ON p.id=rp.permission_id ORDER BY r.code,p.code`,
  );
beforeAll(async () => {
  await db.connect();
  f = await createNegFuncDbFixture(db);
  await db.query(
    "INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE code='ADMIN'",
    [f.userId],
  );
});
afterAll(async () => {
  if (f) await f.cleanup();
  await db.end();
});
const apply = async () => {
  const plan = await syncPermissions(db, {});
  return syncPermissions(db, {
    apply: true,
    expectedDiff: plan.diffHash,
    actorId: f.userId,
    reason: "Synthetic DEP12 permission maintenance",
  });
};
describe("DEP12 permissions-only maintenance on isolated synthetic PostgreSQL", () => {
  it("dry-run is read-only and restores exactly missing treatment permissions/assignments with one audit event", async () => {
    await db.query(
      "DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE code IN ('treatment_case.read','treatment_case.manage'))",
    );
    await db.query(
      "DELETE FROM permissions WHERE code IN ('treatment_case.read','treatment_case.manage')",
    );
    const before = (await roles()).rows;
    const plan = await syncPermissions(db, {});
    expect(plan.applied).toBe(false);
    expect(plan.diff.createPermissions).toHaveLength(2);
    expect(plan.diff.addGrants).toHaveLength(5);
    expect(plan.diff.removeGrants).toEqual([]);
    expect((await roles()).rows).toEqual(before);
    const applied = await apply();
    expect(applied.applied).toBe(true);
    const sameCommand = await syncPermissions(db, {
      apply: true,
      expectedDiff: plan.diffHash,
      actorId: f.userId,
      reason: "Retry same approved plan",
    });
    expect("replayed" in sameCommand && sameCommand.replayed).toBe(true);
    expect((await syncPermissions(db, {})).changes).toBe(0);
    const events = (
      await db.query(
        "SELECT new_values FROM audit_logs WHERE action='DEP12_PERMISSION_SYNC' AND organization_id=$1",
        [f.organizationId],
      )
    ).rows;
    expect(events).toHaveLength(1);
    expect(events[0].new_values.createPermissions).toHaveLength(2);
    const replay = await apply();
    expect(replay.changes).toBe(0);
    expect(
      (
        await db.query(
          "SELECT count(*)::int AS count FROM audit_logs WHERE action='DEP12_PERMISSION_SYNC' AND organization_id=$1",
          [f.organizationId],
        )
      ).rows[0].count,
    ).toBe(1);
  });
  it("rejects stale diffs and inactive actors without granting privileges", async () => {
    const old = await syncPermissions(db, {});
    const original = (
      await db.query(
        "SELECT description FROM permissions WHERE code='treatment_case.read'",
      )
    ).rows[0].description;
    try {
      await db.query(
        "UPDATE permissions SET description='Synthetic concurrent change' WHERE code='treatment_case.read'",
      );
      await expect(
        syncPermissions(db, {
          apply: true,
          expectedDiff: old.diffHash,
          actorId: f.userId,
          reason: "QA",
        }),
      ).rejects.toThrow("diff changed");
    } finally {
      await db.query(
        "UPDATE permissions SET description=$1 WHERE code='treatment_case.read'",
        [original],
      );
    }
    await db.query("UPDATE users SET status='INACTIVE' WHERE id=$1", [
      f.userId,
    ]);
    try {
      await expect(apply()).rejects.toThrow("authorized");
    } finally {
      await db.query("UPDATE users SET status='ACTIVE' WHERE id=$1", [
        f.userId,
      ]);
    }
  });
  it("revokes an unintended Reception grant and leaves user membership untouched", async () => {
    const membership = (
      await db.query(
        "SELECT user_id::text,role_id::text FROM user_roles WHERE user_id=$1",
        [f.userId],
      )
    ).rows;
    await db.query(
      "INSERT INTO role_permissions(role_id,permission_id) SELECT r.id,p.id FROM roles r CROSS JOIN permissions p WHERE r.code='RECEPTION' AND p.code='role.manage'",
    );
    const plan = await syncPermissions(db, {});
    expect(plan.diff.removeGrants).toContainEqual({
      role: "RECEPTION",
      code: "role.manage",
    });
    await apply();
    expect((await roles()).rows).not.toContainEqual({
      role: "RECEPTION",
      code: "role.manage",
    });
    expect(
      (
        await db.query(
          "SELECT user_id::text,role_id::text FROM user_roles WHERE user_id=$1",
          [f.userId],
        )
      ).rows,
    ).toEqual(membership);
  });
  it("rolls back grants when audit insertion fails", async () => {
    await db.query(
      "DELETE FROM role_permissions WHERE role_id=(SELECT id FROM roles WHERE code='PROVIDER') AND permission_id=(SELECT id FROM permissions WHERE code='treatment_case.manage')",
    );
    await db.query(`CREATE FUNCTION qa_dep12_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.action='DEP12_PERMISSION_SYNC' THEN RAISE EXCEPTION 'Synthetic audit failure'; END IF; RETURN NEW; END $$`);
    await db.query(
      "CREATE TRIGGER qa_dep12_audit_failure BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION qa_dep12_audit_failure()",
    );
    try {
      await expect(apply()).rejects.toThrow("Synthetic audit failure");
      expect((await roles()).rows).not.toContainEqual({
        role: "PROVIDER",
        code: "treatment_case.manage",
      });
    } finally {
      await db.query("DROP TRIGGER qa_dep12_audit_failure ON audit_logs");
      await db.query("DROP FUNCTION qa_dep12_audit_failure()");
    }
    await apply();
    expect((await syncPermissions(db, {})).changes).toBe(0);
  });
});
