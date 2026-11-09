import pg from "pg";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createNegFuncDbFixture,
  insertDbRow,
} from "../helpers/neg-func-db-fixture.js";

describe("OPS-03 atomic external identity creation", () => {
  it("allows one concurrent winner and rolls back the other local patient", async () => {
    const db = new pg.Client({
      connectionString: process.env.TEST_DATABASE_URL,
    });
    const clients = [
      new pg.Client({ connectionString: process.env.TEST_DATABASE_URL }),
      new pg.Client({ connectionString: process.env.TEST_DATABASE_URL }),
    ];
    await db.connect();
    const f = await createNegFuncDbFixture(db);
    const account = await insertDbRow(db, "dentalink_accounts", {
      organization_id: f.organizationId,
      external_account_id: randomUUID(),
      label: "Synthetic concurrent identity",
    });
    const patients: string[] = [];
    try {
      await Promise.all(clients.map((c) => c.connect()));
      const results = await Promise.allSettled(
        clients.map(async (client, index) => {
          await client.query("BEGIN");
          try {
            const patient = await insertDbRow(client, "patients", {
              organization_id: f.organizationId,
              patient_number: "RACE-" + index,
              first_name: "Synthetic",
              last_name: "Concurrent",
            });
            patients.push(patient);
            await insertDbRow(client, "dentalink_external_identities", {
              organization_id: f.organizationId,
              account_id: account,
              entity_type: "PATIENT",
              external_id: "same-external",
              patient_id: patient,
            });
            await client.query("COMMIT");
            return patient;
          } catch (error) {
            await client.query("ROLLBACK");
            throw error;
          }
        }),
      );
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const failed = results.find((r) => r.status === "rejected");
      expect(failed?.status === "rejected" && failed.reason.code).toBe("23505");
      expect(
        (
          await db.query(
            "SELECT count(*)::int AS rows FROM patients WHERE id=ANY($1::bigint[])",
            [patients],
          )
        ).rows[0].rows,
      ).toBe(1);
      expect(
        (
          await db.query(
            "SELECT count(*)::int AS rows FROM dentalink_external_identities WHERE account_id=$1",
            [account],
          )
        ).rows[0].rows,
      ).toBe(1);
    } finally {
      await Promise.all(clients.map((c) => c.end()));
      await db.query(
        "DELETE FROM dentalink_external_identities WHERE account_id=$1",
        [account],
      );
      await db.query("DELETE FROM dentalink_accounts WHERE id=$1", [account]);
      await db.query("DELETE FROM patients WHERE id=ANY($1::bigint[])", [
        patients,
      ]);
      await f.cleanup();
      await db.end();
    }
  });
});
