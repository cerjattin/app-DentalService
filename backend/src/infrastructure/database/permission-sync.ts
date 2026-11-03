import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import ts from "typescript";
import type { Client } from "pg";

const sha = (v: unknown) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");
export function readPermissionPolicy(file = "prisma/seed.ts") {
  // Parse literals; never import/eval the seed (which has operational writes).
  const text = readFileSync(file, "utf8"),
    source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const arrays = new Map<string, ts.ArrayLiteralExpression>();
  function visit(node: ts.Node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    ) {
      let init = node.initializer;
      if (ts.isAsExpression(init)) init = init.expression;
      if (ts.isArrayLiteralExpression(init)) arrays.set(node.name.text, init);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  const literal = (n: ts.Expression) => {
    if (!ts.isStringLiteral(n))
      throw new Error("Policy must use explicit literals");
    return n.text;
  };
  const permissions = arrays.get("permissions")?.elements.map((n) => {
    if (!ts.isArrayLiteralExpression(n) || n.elements.length !== 3)
      throw new Error("Invalid permission policy");
    const [code, name, description] = n.elements.map(literal);
    return { code: code!, name: name!, description: description! };
  });
  const grants = (name: string) => arrays.get(name)?.elements.map(literal);
  const reception = grants("receptionPermissions"),
    provider = grants("providerPermissions");
  if (
    !permissions?.length ||
    !reception?.length ||
    !provider?.length ||
    new Set(permissions.map((p) => p.code)).size !== permissions.length
  )
    throw new Error("Incomplete permission policy");
  if (
    [...reception, ...provider].some(
      (c) => !permissions.some((p) => p.code === c),
    )
  )
    throw new Error("Unknown policy grant");
  return {
    permissions,
    roles: {
      ADMIN: permissions.map((p) => p.code),
      RECEPTION: reception,
      PROVIDER: provider,
    },
    policyHash: sha(text),
  };
}

type Db = Pick<Client, "query">;
async function state(db: Db) {
  return {
    permissions: (
      await db.query<{
        id: string;
        code: string;
        name: string;
        description: string | null;
      }>(
        'SELECT id::text,code,name,description FROM permissions ORDER BY code COLLATE "C"',
      )
    ).rows,
    roles: (
      await db.query<{ id: string; code: string; is_active: boolean }>(
        "SELECT id::text,code,is_active FROM roles WHERE code IN ('ADMIN','RECEPTION','PROVIDER') ORDER BY code COLLATE \"C\"",
      )
    ).rows,
    grants: (
      await db.query<{
        role: string;
        code: string;
      }>(`SELECT r.code AS role,p.code FROM role_permissions rp JOIN roles r ON r.id=rp.role_id JOIN permissions p ON p.id=rp.permission_id
      WHERE r.code IN ('ADMIN','RECEPTION','PROVIDER') ORDER BY r.code COLLATE "C",p.code COLLATE "C"`)
    ).rows,
  };
}
async function plan(db: Db, policy: ReturnType<typeof readPermissionPolicy>) {
  const current = await state(db);
  const blocked = Object.keys(policy.roles)
    .filter((c) => !current.roles.some((r) => r.code === c && r.is_active))
    .map((c) => `ROLE_MISSING_OR_INACTIVE:${c}`);
  const collisions = (
    await db.query<{ code: string }>(
      `SELECT p.code FROM permissions p JOIN unnest($1::text[]) wanted(code)
    ON p.code=wanted.code COLLATE "odontho_ai_ci" WHERE p.code COLLATE "C"<>wanted.code COLLATE "C"`,
      [policy.permissions.map((p) => p.code)],
    )
  ).rows;
  if (collisions.length) blocked.push("PERMISSION_CODE_COLLATION_CONFLICT");
  const create = policy.permissions.filter(
    (p) => !current.permissions.some((c) => c.code === p.code),
  );
  const add: Array<{ role: string; code: string }> = [],
    remove: Array<{ role: string; code: string }> = [];
  for (const [role, codes] of Object.entries(policy.roles)) {
    const desired =
      role === "ADMIN"
        ? [...new Set([...codes, ...current.permissions.map((p) => p.code)])]
        : codes;
    for (const code of desired)
      if (!current.grants.some((g) => g.role === role && g.code === code))
        add.push({ role, code });
    for (const g of current.grants)
      if (g.role === role && !desired.includes(g.code)) remove.push(g);
  }
  const diff = {
    createPermissions: create.map((p) => p.code).sort(),
    addGrants: add,
    removeGrants: remove,
    blocked,
  };
  const diffHash = sha({ state: current, policy: policy.policyHash, diff });
  return {
    diffHash,
    policyHash: policy.policyHash,
    diff,
    changes: create.length + add.length + remove.length,
  };
}

export async function syncPermissions(
  db: Db,
  options: {
    apply?: boolean;
    expectedDiff?: string;
    actorId?: string;
    reason?: string;
  },
  policy = readPermissionPolicy(),
) {
  await db.query(
    options.apply
      ? "BEGIN ISOLATION LEVEL SERIALIZABLE"
      : "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY",
  );
  try {
    await db.query("SET LOCAL statement_timeout='15s'");
    if (options.apply)
      await db.query(
        "LOCK TABLE permissions,roles,role_permissions,user_roles IN SHARE ROW EXCLUSIVE MODE",
      );
    const before = await plan(db, policy);
    if (!options.apply) {
      await db.query("ROLLBACK");
      return { ...before, applied: false };
    }
    if (before.diff.blocked.length)
      throw new Error("Permission policy has unresolved preconditions");
    if (
      !/^[1-9]\d*$/.test(options.actorId ?? "") ||
      !options.reason?.trim() ||
      options.reason.length > 500
    )
      throw new Error("Actor/reason required");
    const actor = (
      await db.query<{ id: string; organization_id: string }>(
        `SELECT u.id::text,u.organization_id::text FROM users u WHERE u.id=$1
      AND u.status='ACTIVE' AND u.archived_at IS NULL AND EXISTS (SELECT 1 FROM user_roles ur JOIN role_permissions rp ON rp.role_id=ur.role_id
        JOIN roles r ON r.id=ur.role_id JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id=u.id AND r.is_active AND p.code='role.manage') FOR SHARE`,
        [options.actorId],
      )
    ).rows[0];
    if (!actor) throw new Error("Active authorized maintenance actor required");
    if (!options.expectedDiff || before.diffHash !== options.expectedDiff) {
      const previous =
        options.expectedDiff && !before.changes
          ? (
              await db.query<{
                metadata: { afterDiffHash?: string; policyHash?: string };
              }>(
                "SELECT metadata FROM audit_logs WHERE action='DEP12_PERMISSION_SYNC' AND entity_key=$1 ORDER BY id DESC LIMIT 1",
                [options.expectedDiff],
              )
            ).rows[0]
          : undefined;
      if (
        previous?.metadata?.afterDiffHash !== before.diffHash ||
        previous.metadata.policyHash !== policy.policyHash
      )
        throw new Error("Permission diff changed; run dry-run again");
      await db.query("COMMIT");
      return { ...before, applied: true, replayed: true };
    }
    if (!before.changes) {
      await db.query("COMMIT");
      return { ...before, applied: true };
    }
    for (const p of policy.permissions.filter((p) =>
      before.diff.createPermissions.includes(p.code),
    ))
      await db.query(
        "INSERT INTO permissions(code,name,description) VALUES($1,$2,$3)",
        [p.code, p.name, p.description],
      );
    for (const grant of before.diff.removeGrants)
      await db.query(
        `DELETE FROM role_permissions WHERE role_id=(SELECT id FROM roles WHERE code=$1) AND permission_id=(SELECT id FROM permissions WHERE code=$2)`,
        [grant.role, grant.code],
      );
    for (const grant of before.diff.addGrants)
      await db.query(
        `INSERT INTO role_permissions(role_id,permission_id) SELECT r.id,p.id FROM roles r CROSS JOIN permissions p WHERE r.code=$1 AND p.code=$2 ON CONFLICT DO NOTHING`,
        [grant.role, grant.code],
      );
    const after = await plan(db, policy);
    if (after.changes || after.diff.blocked.length)
      throw new Error("Permission postcondition failed");
    await db.query(
      `INSERT INTO audit_logs(organization_id,actor_user_id,action,entity_type,entity_key,reason,old_values,new_values,metadata)
      VALUES($1,$2,'DEP12_PERMISSION_SYNC','PERMISSION_POLICY',$3,$4,$5::jsonb,$6::jsonb,$7::jsonb)`,
      [
        actor.organization_id,
        actor.id,
        before.diffHash,
        options.reason,
        JSON.stringify({ diffHash: before.diffHash }),
        JSON.stringify(before.diff),
        JSON.stringify({
          policyHash: policy.policyHash,
          afterDiffHash: after.diffHash,
        }),
      ],
    );
    await db.query("COMMIT");
    return { ...before, applied: true, afterDiffHash: after.diffHash };
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }
}
