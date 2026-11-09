import pg from "pg";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { requireLocalQaUrl } from "../../src/infrastructure/database/qa-recovery.js";
import { localMigrationInventory } from "../../src/infrastructure/database/pilot-db-inventory.js";
import {
  createNegFuncDbFixture,
  insertDbRow,
} from "../helpers/neg-func-db-fixture.js";

describe.skipIf(!process.env.UPGRADE_TEST_DATABASE_URL)(
  "OPS-03 forward migration with existing synthetic history",
  () => {
    it("updates the six-migration baseline without changing valued content, historical numbers or custom grants", async () => {
      const target = requireLocalQaUrl(process.env.UPGRADE_TEST_DATABASE_URL!);
      if (target.toString() === process.env.TEST_DATABASE_URL)
        throw Error("Separate empty upgrade database required");
      const db = new pg.Client({ connectionString: target.toString() });
      await db.connect();
      try {
        const objects = (
          await db.query(
            "SELECT count(*)::int AS rows FROM pg_class WHERE relnamespace='public'::regnamespace",
          )
        ).rows[0].rows;
        if (objects !== 0)
          throw Error("Upgrade test requires a new empty database");
        const migrations = localMigrationInventory();
        const before = migrations.filter(
          (m) => m.name < "20261106000000_service_attention",
        );
        expect(before).toHaveLength(6);
        for (const migration of before)
          await db.query(
            readFileSync(
              "prisma/postgresql/migrations/" +
                migration.name +
                "/migration.sql",
              "utf8",
            ),
          );
        const permissions = [
          "invoice.create",
          "invoice.prepare_signature",
          "invoice.sign",
          "signature.capture",
        ];
        for (const code of permissions)
          await insertDbRow(db, "permissions", {
            code,
            name: "Synthetic " + code,
          });
        for (const code of ["ADMIN", "PROVIDER", "RECEPTION", "CUSTOM"]) {
          const role = await insertDbRow(db, "roles", {
            code,
            name: "Synthetic " + code,
            is_system: code !== "CUSTOM",
          });
          await db.query(
            "INSERT INTO role_permissions(role_id,permission_id) SELECT $1,id FROM permissions",
            [role],
          );
        }
        const f = await createNegFuncDbFixture(db);
        const invoice = await f.invoice();
        await db.query(
          "UPDATE patients SET patient_number='PAT-008888' WHERE id=$1",
          [f.patientId],
        );
        await insertDbRow(db, "number_sequences", {
          organization_id: f.organizationId,
          sequence_type: "PATIENT",
          sequence_year: 0,
          prefix: "PAT-",
          current_value: "8888",
        });
        const snapshot = async () =>
          (
            await db.query(
              `
        SELECT (SELECT to_jsonb(v) FROM invoice_versions v WHERE id=$1) AS version,
          (SELECT to_jsonb(i) FROM invoice_items i WHERE id=$2) AS line,
          (SELECT to_jsonb(p) FROM encounter_procedures p JOIN invoice_items i ON i.encounter_procedure_id=p.id WHERE i.id=$2) AS performed,
          (SELECT patient_number FROM patients WHERE id=$3) AS number,
          (SELECT current_value::text FROM number_sequences WHERE organization_id=$4 AND sequence_type='PATIENT') AS counter
      `,
              [
                invoice.versionId,
                invoice.itemId,
                f.patientId,
                f.organizationId,
              ],
            )
          ).rows[0];
        const original = await snapshot();
        for (const migration of migrations.filter(
          (m) => m.name >= "20261106000000_service_attention",
        ))
          await db.query(
            readFileSync(
              "prisma/postgresql/migrations/" +
                migration.name +
                "/migration.sql",
              "utf8",
            ),
          );
        expect(await snapshot()).toEqual(original);
        const block = (
          await db.query(
            "SELECT convalidated FROM pg_constraint WHERE conname='ck_encounter_procedure_billing_context'",
          )
        ).rows[0];
        expect(block.convalidated).toBe(true);
        const custom = (
          await db.query(
            "SELECT count(*)::int AS rows FROM role_permissions rp JOIN roles r ON r.id=rp.role_id WHERE r.code='CUSTOM'",
          )
        ).rows[0];
        expect(custom.rows).toBe(4);
        const provider = (
          await db.query(
            "SELECT count(*)::int AS rows FROM role_permissions rp JOIN roles r ON r.id=rp.role_id WHERE r.code='PROVIDER'",
          )
        ).rows[0];
        expect(provider.rows).toBe(0);
        const added = (
          await db.query(
            "SELECT r.code,count(*)::int AS grants FROM role_permissions rp JOIN roles r ON r.id=rp.role_id JOIN permissions p ON p.id=rp.permission_id WHERE p.code LIKE 'dentalink.%' COLLATE \"C\" GROUP BY r.code ORDER BY r.code",
          )
        ).rows;
        expect(added).toEqual([
          { code: "ADMIN", grants: 3 },
          { code: "RECEPTION", grants: 2 },
        ]);
        const columns = (
          await db.query(
            "SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='encounter_procedures' AND column_name=ANY($1::text[])",
            [
              [
                "patient_insurance_id",
                "svb_tariff_id",
                "insured_id_snapshot",
                "unit_tariff_snapshot",
                "currency_code_snapshot",
                "amount",
              ],
            ],
          )
        ).rows;
        expect(columns).toHaveLength(6);
        expect(columns.every((c) => c.is_nullable === "YES")).toBe(true);
      } finally {
        await db.end();
      }
    }, 30000);
  },
);
