import pg from "pg";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  createNegFuncDbFixture,
  insertDbRow,
} from "../helpers/neg-func-db-fixture.js";
import {
  diagnoseFinal06Database,
  final06PreflightSql,
} from "../../src/infrastructure/database/svb-final06-preflight.js";
import { preflightSvbMasterBatch } from "../../src/infrastructure/database/svb-master-preflight.js";
import { prisma } from "../../src/infrastructure/database/prisma.js";
import { svbCatalogService } from "../../src/modules/svb-catalog/svb-catalog.service.js";
import { auditService } from "../../src/modules/audit/audit.service.js";

const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
beforeAll(() => db.connect());
afterAll(async () => {
  await prisma.$disconnect();
  await db.end();
});
const metadata = { correlationId: randomUUID() };
const source = {
  documentReference: "SYNTHETIC-NOT-A-CLINIC-SOURCE",
  version: "QA-1",
  sha256: "b".repeat(64),
  clinicApprover: "Synthetic fixture",
  approvedOn: "2026-11-02",
};
const batch = (code: string) => ({
  format: "odontho-svb-master-preflight-v1",
  source: null as typeof source | null,
  procedures: [
    {
      evidenceRow: "QA-1",
      data: {
        code,
        description: "Synthetic preflight only",
        requiresAuthorization: false,
        requiresReferral: false,
        isActive: false,
      },
    },
  ],
  tariffs: [
    {
      evidenceRow: "QA-2",
      procedureCode: code,
      data: {
        amount: "1234567890123.45",
        currencyCode: "ANG",
        validFrom: "2026-11-01",
        validTo: null as string | null,
        isActive: true,
      },
    },
  ],
});
const count = (
  report: Awaited<ReturnType<typeof preflightSvbMasterBatch>>,
  code: string,
) => report.issues.find((i) => i.code === code)!.count;

describe("NEG-FINAL-06 technical acceptance on dedicated PostgreSQL", () => {
  it("preserves existing nullable snapshots, Decimal storage, RLS and location uniqueness without assuming P/K semantics", async () => {
    const f = await createNegFuncDbFixture(db);
    try {
      const columns =
        await db.query(`SELECT table_name,column_name,column_default,is_nullable
        FROM information_schema.columns WHERE table_schema='public'
        AND table_name IN ('encounter_procedures','invoice_items','declaration_items')
        AND column_name IN ('number_of_treatments_snapshot','assistance_snapshot')`);
      expect(columns.rows).toHaveLength(6);
      expect(
        columns.rows.every(
          (r) => r.column_default === null && r.is_nullable === "YES",
        ),
      ).toBe(true);
      const money =
        await db.query(`SELECT numeric_precision,numeric_scale FROM information_schema.columns
        WHERE table_schema='public' AND table_name='svb_tariffs' AND column_name='amount'`);
      expect(money.rows[0]).toEqual({
        numeric_precision: 15,
        numeric_scale: 2,
      });
      const rls =
        await db.query(`SELECT relrowsecurity FROM pg_class WHERE oid IN
        ('clinic_locations'::regclass,'referrers'::regclass,'accident_cases'::regclass,'svb_procedures'::regclass,'svb_tariffs'::regclass)`);
      expect(rls.rows).toHaveLength(5);
      expect(rls.rows.every((r) => r.relrowsecurity)).toBe(true);
      await db.query(
        "UPDATE clinic_locations SET policlinic_code='P' WHERE id=$1",
        [f.clinicLocationId],
      );
      await expect(
        insertDbRow(db, "clinic_locations", {
          organization_id: f.organizationId,
          code: "other-synthetic",
          name: "Synthetic",
          policlinic_code: "P",
        }),
      ).rejects.toMatchObject({ code: "23505" });
    } finally {
      await f.cleanup();
    }
  });
  it("diagnoses frozen fields through the existing mapper and never approves real submission", async () => {
    const f = await createNegFuncDbFixture(db);
    try {
      const invoice = await f.invoice();
      await f.historyItem(await f.batch("00123"), invoice.itemId, 1);
      const before = (
        await db.query(
          "SELECT content_hash FROM invoice_versions WHERE id=$1",
          [invoice.versionId],
        )
      ).rows;
      const report = await diagnoseFinal06Database(db);
      expect(report.realSubmissionApproved).toBe(false);
      expect(report.pilot.unresolvedFields).toContain("Assistance");
      expect(report.pilot.enabledServiceCodes).toEqual([]);
      for (const source of ["invoice", "declaration"]) {
        const snapshot = report.snapshots.find((s) => s.source === source)!;
        expect(snapshot.scanned).toBeGreaterThan(0);
        for (const field of [
          "NumberOfTreatments",
          "Assistance",
          "PoliClinic",
          "TreatmentId",
        ])
          expect(
            snapshot.issues.find(
              (issue) =>
                issue.field === field &&
                issue.code === "DECLARATION_SVB_DATA_INCOMPLETE",
            )?.count,
          ).toBeGreaterThanOrEqual(1);
      }
      const text = JSON.stringify(report);
      expect(text).not.toContain(invoice.invoiceNumber);
      expect(text).not.toContain("000000001");
      expect(
        (
          await db.query(
            "SELECT content_hash FROM invoice_versions WHERE id=$1",
            [invoice.versionId],
          )
        ).rows,
      ).toEqual(before);
      const sql = await db.query(final06PreflightSql());
      expect(
        (sql as unknown as Array<pg.QueryResult>).flatMap((r) => r.rows).length,
      ).toBe(11);
    } finally {
      await f.cleanup();
    }
  });

  it("detects cross-patient insurance, foreign referrer and foreign location without repairing them", async () => {
    const f = await createNegFuncDbFixture(db),
      foreign = await createNegFuncDbFixture(db);
    let accident: string | undefined, referrer: string | undefined;
    try {
      const invoice = await f.invoice();
      accident = await insertDbRow(db, "accident_cases", {
        patient_id: f.patientId,
        patient_insurance_id: foreign.insuranceId,
        accident_form_number: "0000000001",
        created_by_user_id: foreign.userId,
      });
      referrer = await insertDbRow(db, "referrers", {
        organization_id: foreign.organizationId,
        referrer_identifier: "00001",
      });
      await db.query(
        "UPDATE appointments SET accident_case_id=$1,clinic_location_id=$2 WHERE id=$3",
        [accident, foreign.clinicLocationId, invoice.appointmentId],
      );
      await db.query(
        "UPDATE encounter_procedures SET referrer_id=$1 WHERE encounter_id=$2",
        [referrer, invoice.encounterId],
      );
      const report = await diagnoseFinal06Database(db);
      for (const code of [
        "ACCIDENT_INSURANCE_PATIENT_MISMATCH",
        "ACCIDENT_CREATOR_ORGANIZATION_MISMATCH",
        "APPOINTMENT_ACCIDENT_CONTEXT_MISMATCH",
        "APPOINTMENT_LOCATION_ORGANIZATION_MISMATCH",
        "PROCEDURE_REFERRER_ORGANIZATION_MISMATCH",
      ])
        expect(
          report.issues.find((i) => i.code === code)!.count,
        ).toBeGreaterThan(0);
      expect(report.integrityBlocked).toBe(true);
      expect(
        (
          await db.query(
            "SELECT accident_form_number FROM accident_cases WHERE id=$1",
            [accident],
          )
        ).rows[0].accident_form_number,
      ).toBe("0000000001");
    } finally {
      await db.query(
        "UPDATE appointments SET accident_case_id=NULL,clinic_location_id=$1 WHERE organization_id=$2",
        [f.clinicLocationId, f.organizationId],
      );
      await db.query(
        "UPDATE encounter_procedures SET referrer_id=NULL WHERE referrer_id=$1",
        [referrer ?? null],
      );
      if (accident)
        await db.query("DELETE FROM accident_cases WHERE id=$1", [accident]);
      if (referrer)
        await db.query("DELETE FROM referrers WHERE id=$1", [referrer]);
      await f.cleanup();
      await foreign.cleanup();
    }
  });

  it("detects legacy active tariff overlap and distinguishes validity from technical field readiness", async () => {
    const f = await createNegFuncDbFixture(db);
    let extra: string | undefined;
    try {
      const invoice = await f.invoice();
      const item = (
        await db.query(
          "SELECT svb_procedure_id FROM invoice_items WHERE id=$1",
          [invoice.itemId],
        )
      ).rows[0];
      extra = await insertDbRow(db, "svb_tariffs", {
        svb_procedure_id: item.svb_procedure_id,
        amount: "0.10",
        currency_code: "ANG",
        valid_from: "2026-06-01",
      });
      const report = await diagnoseFinal06Database(db);
      expect(
        report.issues.find((i) => i.code === "TARIFF_ACTIVE_OVERLAP")!.count,
      ).toBe(2);
      expect(report.realSubmissionApproved).toBe(false);
    } finally {
      if (extra) await db.query("DELETE FROM svb_tariffs WHERE id=$1", [extra]);
      await f.cleanup();
    }
  });

  it("preflights duplicates using PostgreSQL accent/case equality, bounds and separate currencies without writes", async () => {
    const code = `QA-${randomUUID()}`;
    const input = batch(code);
    input.source = source;
    const before = (await db.query("SELECT count(*) FROM svb_procedures")).rows;
    expect(
      (await preflightSvbMasterBatch(db, input)).technicalChecksPassed,
    ).toBe(true);
    expect((await preflightSvbMasterBatch(db, input)).canApply).toBe(false);
    const missing = batch(code);
    expect(
      count(
        await preflightSvbMasterBatch(db, missing),
        "AUTHORIZED_MASTER_SOURCE_MISSING",
      ),
    ).toBe(1);
    input.procedures.push({
      ...input.procedures[0]!,
      data: { ...input.procedures[0]!.data, code: code.toLowerCase() },
    });
    expect(
      count(
        await preflightSvbMasterBatch(db, input),
        "BATCH_PROCEDURE_DUPLICATE",
      ),
    ).toBe(1);
    input.procedures.pop();
    input.procedures[0]!.data.code = "José";
    input.tariffs[0]!.procedureCode = "JOSE";
    input.procedures.push({
      ...input.procedures[0]!,
      data: { ...input.procedures[0]!.data, code: "JOSE" },
    });
    expect(
      count(
        await preflightSvbMasterBatch(db, input),
        "BATCH_PROCEDURE_DUPLICATE",
      ),
    ).toBe(1);
    input.procedures.pop();
    input.tariffs.push({
      ...input.tariffs[0]!,
      data: { ...input.tariffs[0]!.data, validFrom: "2026-11-30" },
    });
    expect(
      count(await preflightSvbMasterBatch(db, input), "BATCH_TARIFF_OVERLAP"),
    ).toBe(1);
    input.tariffs[0]!.data.validTo = "2026-11-30";
    expect(
      count(await preflightSvbMasterBatch(db, input), "BATCH_TARIFF_OVERLAP"),
    ).toBe(1);
    input.tariffs[0]!.data.validTo = "2026-11-29";
    expect(
      count(await preflightSvbMasterBatch(db, input), "BATCH_TARIFF_OVERLAP"),
    ).toBe(0);
    input.tariffs[1]!.data.currencyCode = "USD";
    input.tariffs[0]!.data.validTo = null;
    expect(
      count(await preflightSvbMasterBatch(db, input), "BATCH_TARIFF_OVERLAP"),
    ).toBe(0);
    input.tariffs[1]!.procedureCode = "missing-" + code;
    expect(
      count(
        await preflightSvbMasterBatch(db, input),
        "TARIFF_PROCEDURE_MISSING",
      ),
    ).toBe(1);
    expect(
      (await db.query("SELECT count(*) FROM svb_procedures")).rows,
    ).toEqual(before);
  });

  it("detects existing catalogue collisions and overlapping tariffs including shared boundary days", async () => {
    const f = await createNegFuncDbFixture(db);
    try {
      const invoice = await f.invoice();
      const row = (
        await db.query(
          "SELECT code FROM svb_procedures WHERE id=(SELECT svb_procedure_id FROM invoice_items WHERE id=$1)",
          [invoice.itemId],
        )
      ).rows[0];
      const input = batch(row.code);
      input.source = source;
      const report = await preflightSvbMasterBatch(db, input);
      expect(count(report, "PROCEDURE_ALREADY_EXISTS")).toBe(1);
      expect(count(report, "TARIFF_OVERLAPS_EXISTING")).toBe(1);
      input.tariffs[0]!.data.validFrom = "2026-01-01";
      expect(
        count(
          await preflightSvbMasterBatch(db, input),
          "TARIFF_ALREADY_EXISTS",
        ),
      ).toBe(1);
    } finally {
      await f.cleanup();
    }
  });

  it("master updates are audited and leave historical procedure/invoice/declaration fields and hashes intact", async () => {
    const f = await createNegFuncDbFixture(db);
    try {
      const invoice = await f.invoice();
      await f.historyItem(await f.batch("00123"), invoice.itemId, 1);
      const frozen = async () =>
        (
          await db.query(
            `SELECT to_jsonb(ep) AS procedure,to_jsonb(ii) AS item,to_jsonb(v) AS version,to_jsonb(di) AS declaration
        FROM invoice_items ii JOIN invoice_versions v ON v.id=ii.invoice_version_id
        JOIN encounter_procedures ep ON ep.id=ii.encounter_procedure_id
        JOIN declaration_items di ON di.invoice_item_id=ii.id WHERE ii.id=$1`,
            [invoice.itemId],
          )
        ).rows;
      const before = await frozen();
      const ids = (
        await db.query(
          "SELECT svb_procedure_id,svb_tariff_id FROM invoice_items WHERE id=$1",
          [invoice.itemId],
        )
      ).rows[0];
      await svbCatalogService.updateProcedure(
        BigInt(ids.svb_procedure_id),
        { description: "Changed synthetic master", requiresReferral: true },
        f.actor,
        metadata,
      );
      await svbCatalogService.updateTariff(
        BigInt(ids.svb_procedure_id),
        BigInt(ids.svb_tariff_id),
        { amount: "99.99" },
        f.actor,
        metadata,
      );
      await db.query(
        "UPDATE clinic_locations SET policlinic_code='K' WHERE id=$1",
        [f.clinicLocationId],
      );
      await db.query(
        "UPDATE providers SET svb_provider_id='00002' WHERE id=$1",
        [f.providerId],
      );
      expect(await frozen()).toEqual(before);
      expect(
        (
          await db.query(
            "SELECT action FROM audit_logs WHERE organization_id=$1 AND action IN ('SVB_PROCEDURE_UPDATE','SVB_TARIFF_UPDATE')",
            [f.organizationId],
          )
        ).rows.length,
      ).toBe(2);
      const failure = vi
        .spyOn(auditService, "writeWithinTransaction")
        .mockRejectedValueOnce(new Error("Synthetic audit failure"));
      try {
        await expect(
          svbCatalogService.updateTariff(
            BigInt(ids.svb_procedure_id),
            BigInt(ids.svb_tariff_id),
            { amount: "1.01" },
            f.actor,
            metadata,
          ),
        ).rejects.toThrow("Synthetic audit failure");
      } finally {
        failure.mockRestore();
      }
      expect(
        (
          await db.query(
            "SELECT amount::text AS amount FROM svb_tariffs WHERE id=$1",
            [ids.svb_tariff_id],
          )
        ).rows[0].amount,
      ).toBe("99.99");
      expect(await frozen()).toEqual(before);
    } finally {
      await f.cleanup();
    }
  });
});
