import pg from "pg";
import { randomUUID } from "node:crypto";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import {
  createNegFuncDbFixture,
  insertDbRow,
} from "../helpers/neg-func-db-fixture.js";

const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
beforeAll(() => db.connect());
afterAll(() => db.end());
beforeEach(() => db.query("BEGIN"));
afterEach(() => db.query("ROLLBACK"));

async function rejects(operation: () => Promise<unknown>, code: string) {
  await db.query("SAVEPOINT rejected_write");
  await expect(operation()).rejects.toMatchObject({ code });
  await db.query("ROLLBACK TO SAVEPOINT rejected_write");
}
async function account(organizationId: string, key = "external-account") {
  return insertDbRow(db, "dentalink_accounts", {
    organization_id: organizationId,
    external_account_id: key,
    label: "Synthetic account",
  });
}
async function identity(
  organizationId: string,
  accountId: string,
  externalId: string,
  patientId: string,
) {
  return insertDbRow(db, "dentalink_external_identities", {
    organization_id: organizationId,
    account_id: accountId,
    entity_type: "PATIENT",
    external_id: externalId,
    patient_id: patientId,
  });
}

describe("OPS-03 persistence integrity on synthetic PostgreSQL", () => {
  it("accepts only empty or complete billing blocks across all 64 combinations and preserves historical invoice content", async () => {
    const f = await createNegFuncDbFixture(db);
    const invoice = await f.invoice();
    const before = (
      await db.query(
        "SELECT to_jsonb(v)::text AS value FROM invoice_versions v WHERE id=$1",
        [invoice.versionId],
      )
    ).rows;
    const item = (
      await db.query("SELECT * FROM invoice_items WHERE id=$1", [
        invoice.itemId,
      ])
    ).rows[0]!;
    const procedureId = item.encounter_procedure_id;
    const columns = [
      "patient_insurance_id",
      "svb_tariff_id",
      "insured_id_snapshot",
      "unit_tariff_snapshot",
      "currency_code_snapshot",
      "amount",
    ];
    const values = [
      f.insuranceId,
      item.svb_tariff_id,
      "000000001",
      "12.30",
      "ANG",
      "12.30",
    ];
    for (let mask = 0; mask < 64; mask++) {
      const update = () =>
        db.query(
          "UPDATE encounter_procedures SET " +
            columns.map((name, i) => name + "=$" + (i + 2)).join(",") +
            " WHERE id=$1",
          [
            procedureId,
            ...values.map((value, i) => (mask & (1 << i) ? value : null)),
          ],
        );
      if (mask === 0 || mask === 63) await update();
      else await rejects(update, "23514");
    }
    await rejects(
      () =>
        db.query(
          "UPDATE encounter_procedures SET patient_insurance_id=9223372036854775807 WHERE id=$1",
          [procedureId],
        ),
      "23503",
    );
    expect(
      (
        await db.query(
          "SELECT to_jsonb(v)::text AS value FROM invoice_versions v WHERE id=$1",
          [invoice.versionId],
        )
      ).rows,
    ).toEqual(before);
    expect(
      (
        await db.query("SELECT * FROM invoice_items WHERE id=$1", [
          invoice.itemId,
        ])
      ).rows[0],
    ).toEqual(item);
  });

  it("enforces organization ownership and exactly one target for mappings and identities", async () => {
    const f = await createNegFuncDbFixture(db),
      other = await createNegFuncDbFixture(db);
    const a = await account(f.organizationId);
    await rejects(
      () =>
        insertDbRow(db, "dentalink_mappings", {
          organization_id: f.organizationId,
          account_id: a,
          kind: "PROVIDER",
          external_id: "P",
          provider_id: other.providerId,
        }),
      "23503",
    );
    await rejects(
      () =>
        insertDbRow(db, "dentalink_mappings", {
          organization_id: f.organizationId,
          account_id: a,
          kind: "LOCATION",
          external_id: "L",
          provider_id: f.providerId,
        }),
      "23514",
    );
    await insertDbRow(db, "dentalink_mappings", {
      organization_id: f.organizationId,
      account_id: a,
      kind: "PROVIDER",
      external_id: "P",
      provider_id: f.providerId,
    });
    await rejects(
      () => identity(f.organizationId, a, "1", other.patientId),
      "23503",
    );
    await rejects(
      () => identity(other.organizationId, a, "1", other.patientId),
      "23503",
    );
    await rejects(
      () =>
        insertDbRow(db, "dentalink_external_identities", {
          organization_id: f.organizationId,
          account_id: a,
          entity_type: "APPOINTMENT",
          external_id: "1",
          patient_id: f.patientId,
        }),
      "23514",
    );
    await identity(f.organizationId, a, "1", f.patientId);
    await rejects(
      () => db.query("DELETE FROM patients WHERE id=$1", [f.patientId]),
      "23503",
    );
  });

  it("keeps external IDs exact and scopes uniqueness to account and entity type", async () => {
    const f = await createNegFuncDbFixture(db);
    const a = await account(f.organizationId, "Case"),
      b = await account(f.organizationId, "case");
    const p2 = await insertDbRow(db, "patients", {
      organization_id: f.organizationId,
      patient_number: "LEGACY-000002",
      first_name: "Synthetic",
      last_name: "Second",
    });
    await identity(f.organizationId, a, "0001A", f.patientId);
    await identity(f.organizationId, a, "0001a", p2);
    await identity(f.organizationId, b, "0001A", f.patientId);
    await rejects(() => identity(f.organizationId, a, "0001A", p2), "23505");
    await rejects(
      () => identity(f.organizationId, a, "other", f.patientId),
      "23505",
    );
    expect(
      (
        await db.query("SELECT patient_number FROM patients WHERE id=$1", [
          f.patientId,
        ])
      ).rows[0].patient_number,
    ).toBe("DB-PATIENT");
  });

  it("requires complete preview and confirmation metadata and scoped item references", async () => {
    const f = await createNegFuncDbFixture(db),
      other = await createNegFuncDbFixture(db);
    const a = await account(f.organizationId),
      b = await account(other.organizationId);
    const runId = await insertDbRow(db, "dentalink_import_runs", {
      organization_id: f.organizationId,
      account_id: a,
      request_key: "request",
      created_by_user_id: f.userId,
    });
    await rejects(
      () =>
        insertDbRow(db, "dentalink_import_runs", {
          organization_id: f.organizationId,
          account_id: a,
          request_key: "request",
          created_by_user_id: f.userId,
        }),
      "23505",
    );
    await rejects(
      () =>
        db.query(
          "UPDATE dentalink_import_runs SET state='PREVIEW_READY' WHERE id=$1",
          [runId],
        ),
      "23514",
    );
    await db.query(
      "UPDATE dentalink_import_runs SET state='PREVIEW_READY',preview_hash=$2 WHERE id=$1",
      [runId, "a".repeat(64)],
    );
    await rejects(
      () =>
        db.query(
          "UPDATE dentalink_import_runs SET state='CONFIRMED',confirm_key='confirm' WHERE id=$1",
          [runId],
        ),
      "23514",
    );
    await db.query(
      "UPDATE dentalink_import_runs SET state='CONFIRMED',confirm_key='confirm',confirm_hash=$2,confirmed_at=now() WHERE id=$1",
      [runId, "b".repeat(64)],
    );
    const item = {
      organization_id: f.organizationId,
      account_id: a,
      run_id: runId,
      entity_type: "PATIENT",
      external_id: "external",
      payload_json: "{}",
      payload_hash: "a".repeat(64),
    };
    await rejects(
      () =>
        insertDbRow(db, "dentalink_import_items", {
          ...item,
          disposition: "IMPORTED",
        }),
      "23514",
    );
    await rejects(
      () =>
        insertDbRow(db, "dentalink_import_items", {
          ...item,
          organization_id: other.organizationId,
          account_id: b,
        }),
      "23503",
    );
    await rejects(
      () =>
        insertDbRow(db, "dentalink_import_items", {
          ...item,
          payload_json: "[]",
        }),
      "23514",
    );
    await insertDbRow(db, "dentalink_import_items", item);
  });

  it("has RLS on every private import table and grants the agreed built-in permissions", async () => {
    const f = await createNegFuncDbFixture(db);
    await account(f.organizationId);
    const tables = [
      "dentalink_accounts",
      "dentalink_mappings",
      "dentalink_import_runs",
      "dentalink_import_items",
      "dentalink_external_identities",
    ];
    const flags = (
      await db.query(
        "SELECT relname,relrowsecurity FROM pg_class WHERE relname=ANY($1::text[]) AND relnamespace='public'::regnamespace",
        [tables],
      )
    ).rows;
    expect(flags).toHaveLength(5);
    expect(flags.every((row) => row.relrowsecurity)).toBe(true);
    const role = "qa_ops03_" + randomUUID().replaceAll("-", "");
    await db.query('CREATE ROLE "' + role + '" NOLOGIN');
    await db.query('GRANT USAGE ON SCHEMA public TO "' + role + '"');
    await db.query(
      "GRANT SELECT ON " + tables.join(",") + ' TO "' + role + '"',
    );
    await db.query('SET LOCAL ROLE "' + role + '"');
    expect(
      (await db.query("SELECT count(*)::int AS rows FROM dentalink_accounts"))
        .rows[0].rows,
    ).toBe(0);
    await db.query("RESET ROLE");
    const permissions = (
      await db.query(
        "SELECT r.code,count(*)::int AS grants FROM roles r JOIN role_permissions rp ON rp.role_id=r.id JOIN permissions p ON p.id=rp.permission_id WHERE p.code LIKE 'dentalink.%' COLLATE \"C\" GROUP BY r.code ORDER BY r.code",
      )
    ).rows;
    expect(permissions).toEqual([
      { code: "ADMIN", grants: 3 },
      { code: "RECEPTION", grants: 2 },
    ]);
  });

  it("rolls back the local entity and number allocation when identity creation fails", async () => {
    const f = await createNegFuncDbFixture(db);
    const a = await account(f.organizationId);
    await identity(f.organizationId, a, "duplicate", f.patientId);
    await insertDbRow(db, "number_sequences", {
      organization_id: f.organizationId,
      sequence_type: "PATIENT",
      sequence_year: 0,
      prefix: "PAT-",
      current_value: "500",
    });
    await db.query("SAVEPOINT import_entity");
    const next = (
      await db.query(
        "UPDATE number_sequences SET current_value=current_value+1 WHERE organization_id=$1 AND sequence_type='PATIENT' RETURNING current_value::text",
        [f.organizationId],
      )
    ).rows[0].current_value;
    const patient = await insertDbRow(db, "patients", {
      organization_id: f.organizationId,
      patient_number: "PAT-" + next,
      first_name: "Synthetic",
      last_name: "Rollback",
    });
    await expect(
      identity(f.organizationId, a, "duplicate", patient),
    ).rejects.toMatchObject({ code: "23505" });
    await db.query("ROLLBACK TO SAVEPOINT import_entity");
    expect(
      (
        await db.query(
          "SELECT count(*)::int AS rows FROM patients WHERE id=$1",
          [patient],
        )
      ).rows[0].rows,
    ).toBe(0);
    expect(
      (
        await db.query(
          "SELECT current_value::text FROM number_sequences WHERE organization_id=$1 AND sequence_type='PATIENT'",
          [f.organizationId],
        )
      ).rows[0].current_value,
    ).toBe("500");
  });
});
