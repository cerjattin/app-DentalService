import { randomUUID } from "node:crypto";
import type { Client } from "pg";
import type { AuthenticatedRequestContext } from "../../src/modules/auth/auth.types.js";

export type DbSession = Pick<Client, "query">;
export async function insertDbRow(
  db: DbSession,
  table: string,
  values: Record<string, unknown>,
): Promise<string> {
  const columns = Object.keys(values);
  if (![table, ...columns].every((value) => /^[a-z_][a-z_0-9]*$/.test(value)))
    throw new Error("Unexpected fixture identifier");
  const result = await db.query<{ id: string }>(
    `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(",")})
    VALUES (${columns.map((_, i) => `$${i + 1}`).join(",")}) RETURNING id::text AS id`,
    Object.values(values),
  );
  return result.rows[0]!.id;
}

/** All rows are synthetic and may only be created in the guarded dedicated test database. */
export async function createNegFuncDbFixture(db: DbSession) {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 8);
  const organizationId = await insertDbRow(db, "organizations", {
    legal_name: `TEST-DB-FUNC-${suffix}`,
  });
  const userId = await insertDbRow(db, "users", {
    organization_id: organizationId,
    email: `db-func-${suffix}@local.invalid`,
    password_hash: "synthetic-not-a-login-password",
    first_name: "Synthetic",
    last_name: "Database QA",
  });
  const patientId = await insertDbRow(db, "patients", {
    organization_id: organizationId,
    patient_number: "DB-PATIENT",
    first_name: "Synthetic",
    last_name: "Database QA",
  });
  const providerId = await insertDbRow(db, "providers", {
    organization_id: organizationId,
    first_name: "Synthetic",
    last_name: "Provider",
  });
  const clinicLocationId = await insertDbRow(db, "clinic_locations", {
    organization_id: organizationId,
    code: "DB",
    name: "Database QA",
  });
  const payerId = await insertDbRow(db, "payers", {
    code: `DB-${suffix}`,
    name: "Synthetic payer",
    payer_type: "STATE_INSURANCE",
  });
  const insuranceId = await insertDbRow(db, "patient_insurance", {
    patient_id: patientId,
    payer_id: payerId,
    insured_id: "000000001",
    valid_from: "2026-01-01",
    status: "ACTIVE",
  });
  const procedureId = await insertDbRow(db, "svb_procedures", {
    code: `DB-${suffix}`,
    description: "Synthetic database integrity fixture",
  });
  const tariffId = await insertDbRow(db, "svb_tariffs", {
    svb_procedure_id: procedureId,
    amount: "12.30",
    currency_code: "ANG",
    valid_from: "2026-01-01",
  });
  const year = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Curacao",
      year: "numeric",
    }).format(new Date()),
  );
  for (const type of ["APPOINTMENT", "DECLARATION"]) {
    await insertDbRow(db, "number_sequences", {
      organization_id: organizationId,
      sequence_type: type,
      sequence_year: year,
      prefix: "DB-",
    });
  }
  const actor: AuthenticatedRequestContext = {
    userId: BigInt(userId),
    organizationId: BigInt(organizationId),
    email: `db-func-${suffix}@local.invalid`,
    firstName: "Synthetic",
    lastName: "Database QA",
    roles: [],
    permissions: [
      "organization.read",
      "organization.update",
      "declaration.read",
      "declaration.create",
      "declaration.update",
      "invoice.read",
      "invoice.apply_correction",
      "encounter.update",
      "procedure.update",
      "appointment.create",
      "appointment.update",
      "treatment_case.read",
      "treatment_case.manage",
    ],
  };
  let number = 0;
  const invoice = async (declarantId = "00123", twoItems = false) => {
    const n = ++number;
    const start = new Date(Date.UTC(2026, 8, 1 + n, 13));
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    const appointmentId = await insertDbRow(db, "appointments", {
      organization_id: organizationId,
      appointment_number: `DB-${suffix}-${n}`,
      patient_id: patientId,
      provider_id: providerId,
      clinic_location_id: clinicLocationId,
      scheduled_start_at: start,
      scheduled_end_at: end,
      status: "COMPLETED",
      completed_at: end,
      created_by_user_id: userId,
    });
    const encounterId = await insertDbRow(db, "clinical_encounters", {
      appointment_id: appointmentId,
      provider_id: providerId,
      status: "COMPLETED",
      started_at: start,
      completed_at: end,
      created_by_user_id: userId,
    });
    const performedId = await insertDbRow(db, "encounter_procedures", {
      encounter_id: encounterId,
      patient_insurance_id: insuranceId,
      svb_procedure_id: procedureId,
      svb_tariff_id: tariffId,
      performed_by_provider_id: providerId,
      procedure_code_snapshot: "DB-QA",
      procedure_description_snapshot: "Synthetic QA",
      provider_id_snapshot: "12345",
      insured_id_snapshot: "000000001",
      unit_tariff_snapshot: "12.30",
      currency_code_snapshot: "ANG",
      quantity: "1.00",
      amount: "12.30",
      performed_at: start,
      created_by_user_id: userId,
    });
    const invoiceNumber = `DB-${suffix}-${n}`;
    const invoiceId = await insertDbRow(db, "invoices", {
      organization_id: organizationId,
      appointment_id: appointmentId,
      patient_id: patientId,
      patient_insurance_id: insuranceId,
      invoice_number: invoiceNumber,
      status: "CLOSED",
      created_by_user_id: userId,
    });
    const versionId = await insertDbRow(db, "invoice_versions", {
      invoice_id: invoiceId,
      version_number: 1,
      status: "CLOSED",
      currency_code: "ANG",
      total_amount: "12.30",
      declarant_id_snapshot: declarantId,
      patient_name_snapshot: "Synthetic QA",
      insured_id_snapshot: "000000001",
      prepared_by_user_id: userId,
      content_hash: "a".repeat(64),
      closed_at: end,
    });
    await db.query(
      "UPDATE invoices SET current_version_id = $1 WHERE id = $2",
      [versionId, invoiceId],
    );
    const itemId = await insertDbRow(db, "invoice_items", {
      invoice_version_id: versionId,
      line_number: 1,
      encounter_procedure_id: performedId,
      svb_procedure_id: procedureId,
      svb_tariff_id: tariffId,
      service_date_snapshot: "2026-09-01",
      procedure_code_snapshot: "DB-QA",
      procedure_description_snapshot: "Synthetic QA",
      provider_id_snapshot: "12345",
      insured_id_snapshot: "000000001",
      unit_tariff_snapshot: "12.30",
      currency_code_snapshot: "ANG",
      quantity: "1.00",
      amount: "12.30",
    });
    const itemIds = [itemId];
    if (twoItems) {
      const { id: _performed, ...performedData } = (
        await db.query<{ id: string; [key: string]: unknown }>(
          "SELECT * FROM encounter_procedures WHERE id=$1",
          [performedId],
        )
      ).rows[0]!;
      const secondPerformedId = await insertDbRow(
        db,
        "encounter_procedures",
        performedData,
      );
      const { id: _item, ...itemData } = (
        await db.query<{ id: string; [key: string]: unknown }>(
          "SELECT * FROM invoice_items WHERE id=$1",
          [itemId],
        )
      ).rows[0]!;
      itemIds.push(
        await insertDbRow(db, "invoice_items", {
          ...itemData,
          line_number: 2,
          encounter_procedure_id: secondPerformedId,
        }),
      );
      await db.query(
        "UPDATE invoice_versions SET total_amount='24.60' WHERE id=$1",
        [versionId],
      );
    }
    return {
      invoiceId,
      versionId,
      itemId,
      itemIds,
      appointmentId,
      encounterId,
      invoiceNumber,
      declarantId,
    };
  };
  const batch = (declarantId: string | null = null, status = "DRAFT") =>
    insertDbRow(db, "declaration_batches", {
      organization_id: organizationId,
      payer_id: payerId,
      created_by_user_id: userId,
      status,
      declaration_number: `DB-${suffix}-B${++number}`,
      declarant_id_snapshot: declarantId,
    });
  const historyItem = (
    batchId: string,
    itemId: string,
    sequence: number,
    declarantId = "00123",
  ) =>
    insertDbRow(db, "declaration_items", {
      declaration_batch_id: batchId,
      invoice_item_id: itemId,
      sequence_number: sequence,
      declarant_id_snapshot: declarantId,
      invoice_number_snapshot: "DB-SYNTHETIC",
      detail_invoice_number_snapshot: "DB-1",
      provider_id_snapshot: "12345",
      service_date_snapshot: "2026-09-01",
      insured_id_snapshot: "000000001",
      amount_snapshot: "12.30",
    });
  const cleanup = async () => {
    // Only IDs created by this fixture are used; no prefix-based operational cleanup.
    await db.query(
      "UPDATE invoices SET current_version_id = NULL WHERE organization_id=$1",
      [organizationId],
    );
    await db.query(
      "DELETE FROM declaration_items WHERE declaration_batch_id IN (SELECT id FROM declaration_batches WHERE organization_id=$1)",
      [organizationId],
    );
    await db.query(
      "DELETE FROM declaration_batch_status_history WHERE declaration_batch_id IN (SELECT id FROM declaration_batches WHERE organization_id=$1)",
      [organizationId],
    );
    await db.query("DELETE FROM declaration_batches WHERE organization_id=$1", [
      organizationId,
    ]);
    await db.query(
      "DELETE FROM invoice_corrections WHERE invoice_id IN (SELECT id FROM invoices WHERE organization_id=$1)",
      [organizationId],
    );
    await db.query(
      "DELETE FROM invoice_status_history WHERE invoice_id IN (SELECT id FROM invoices WHERE organization_id=$1)",
      [organizationId],
    );
    await db.query(
      "DELETE FROM invoice_items WHERE invoice_version_id IN (SELECT v.id FROM invoice_versions v JOIN invoices i ON i.id=v.invoice_id WHERE i.organization_id=$1)",
      [organizationId],
    );
    await db.query(
      "UPDATE invoice_versions SET supersedes_version_id=NULL WHERE invoice_id IN (SELECT id FROM invoices WHERE organization_id=$1)",
      [organizationId],
    );
    await db.query(
      "DELETE FROM invoice_versions WHERE invoice_id IN (SELECT id FROM invoices WHERE organization_id=$1)",
      [organizationId],
    );
    await db.query("DELETE FROM invoices WHERE organization_id=$1", [
      organizationId,
    ]);
    await db.query(
      "DELETE FROM encounter_procedures WHERE encounter_id IN (SELECT ce.id FROM clinical_encounters ce JOIN appointments a ON a.id=ce.appointment_id WHERE a.organization_id=$1)",
      [organizationId],
    );
    await db.query(
      "DELETE FROM clinical_encounters WHERE appointment_id IN (SELECT id FROM appointments WHERE organization_id=$1)",
      [organizationId],
    );
    await db.query(
      "DELETE FROM appointment_status_history WHERE appointment_id IN (SELECT id FROM appointments WHERE organization_id=$1)",
      [organizationId],
    );
    await db.query("DELETE FROM appointments WHERE organization_id=$1", [
      organizationId,
    ]);
    await db.query("DELETE FROM treatment_cases WHERE organization_id=$1", [
      organizationId,
    ]);
    await db.query("DELETE FROM patient_insurance WHERE patient_id=$1", [
      patientId,
    ]);
    await db.query("DELETE FROM patients WHERE id=$1", [patientId]);
    await db.query("DELETE FROM providers WHERE id=$1", [providerId]);
    await db.query("DELETE FROM clinic_locations WHERE id=$1", [
      clinicLocationId,
    ]);
    await db.query("DELETE FROM svb_tariffs WHERE id=$1", [tariffId]);
    await db.query("DELETE FROM svb_procedures WHERE id=$1", [procedureId]);
    await db.query("DELETE FROM payers WHERE id=$1", [payerId]);
    await db.query("DELETE FROM audit_logs WHERE organization_id=$1", [
      organizationId,
    ]);
    await db.query("DELETE FROM user_roles WHERE user_id=$1", [userId]);
    await db.query("DELETE FROM users WHERE id=$1", [userId]);
    await db.query("DELETE FROM number_sequences WHERE organization_id=$1", [
      organizationId,
    ]);
    await db.query("DELETE FROM organizations WHERE id=$1", [organizationId]);
  };
  return {
    organizationId,
    userId,
    patientId,
    providerId,
    clinicLocationId,
    payerId,
    insuranceId,
    actor,
    invoice,
    batch,
    historyItem,
    cleanup,
  };
}
