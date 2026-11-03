import { createHash } from "node:crypto";
import type { Client } from "pg";
import { z } from "zod";
import {
  createSvbProcedureSchema,
  createSvbTariffSchema,
} from "../../modules/svb-catalog/svb-catalog.schemas.js";
import { parseDateOnly } from "../../shared/utils/date-only.js";

// Technical provenance envelope, not an SVB file layout or an approval authority.
export const svbMasterBatchSchema = z.strictObject({
  format: z.literal("odontho-svb-master-preflight-v1"),
  source: z
    .strictObject({
      documentReference: z.string().trim().min(1).max(500),
      version: z.string().trim().min(1).max(80),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
      clinicApprover: z.string().trim().min(1).max(200),
      approvedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .nullable(),
  procedures: z
    .array(
      z.strictObject({
        evidenceRow: z.string().trim().min(1).max(120),
        data: createSvbProcedureSchema.extend({
          requiresAuthorization: z.boolean(),
          requiresReferral: z.boolean(),
          isActive: z.boolean(),
        }),
      }),
    )
    .max(1000),
  tariffs: z
    .array(
      z.strictObject({
        evidenceRow: z.string().trim().min(1).max(120),
        procedureCode: z.string().trim().min(1).max(50),
        data: createSvbTariffSchema.extend({ isActive: z.boolean() }),
      }),
    )
    .max(1000),
});

export function parseSvbMasterBatch(input: unknown) {
  const batch = svbMasterBatchSchema.parse(input);
  if (batch.source) parseDateOnly(batch.source.approvedOn, "approvedOn");
  for (const row of [...batch.procedures, ...batch.tariffs]) {
    const from = row.data.validFrom
      ? parseDateOnly(row.data.validFrom, "validFrom")
      : null;
    const to = row.data.validTo
      ? parseDateOnly(row.data.validTo, "validTo")
      : null;
    if (from && to && to < from) throw new Error("INVALID_MASTER_PERIOD");
  }
  return batch;
}

const incoming = `WITH p AS (SELECT * FROM jsonb_to_recordset($1::jsonb)
  AS x(code text COLLATE "odontho_ai_ci")),
  t AS (SELECT * FROM jsonb_to_recordset($2::jsonb) AS x(code text COLLATE "odontho_ai_ci",
    currency text COLLATE "odontho_ai_ci", start date, finish date, active boolean))`;
export const masterConflictQueries = {
  BATCH_PROCEDURE_DUPLICATE: `SELECT code FROM p GROUP BY code HAVING count(*)>1`,
  PROCEDURE_ALREADY_EXISTS: `SELECT p.code FROM p JOIN svb_procedures s ON s.code=p.code`,
  TARIFF_PROCEDURE_MISSING: `SELECT t.code FROM t WHERE NOT EXISTS (SELECT 1 FROM p WHERE p.code=t.code)
    AND NOT EXISTS (SELECT 1 FROM svb_procedures s WHERE s.code=t.code)`,
  BATCH_TARIFF_DUPLICATE: `SELECT code,currency,start FROM t GROUP BY code,currency,start HAVING count(*)>1`,
  BATCH_TARIFF_OVERLAP: `SELECT a.code FROM t a JOIN t b ON a.code=b.code AND a.currency=b.currency
    AND a.start<b.start AND a.active AND b.active
    AND (a.finish IS NULL OR b.start<=a.finish) AND (b.finish IS NULL OR a.start<=b.finish)`,
  TARIFF_ALREADY_EXISTS: `SELECT t.code FROM t JOIN svb_procedures p ON p.code=t.code
    JOIN svb_tariffs s ON s.svb_procedure_id=p.id AND s.currency_code=t.currency AND s.valid_from=t.start`,
  TARIFF_OVERLAPS_EXISTING: `SELECT t.code FROM t JOIN svb_procedures p ON p.code=t.code
    JOIN svb_tariffs s ON s.svb_procedure_id=p.id AND s.currency_code=t.currency
    WHERE t.active AND s.is_active AND (t.finish IS NULL OR s.valid_from<=t.finish)
      AND (s.valid_to IS NULL OR t.start<=s.valid_to)`,
} as const;

/** Dry run only: even an asserted source and zero conflicts cannot authorize a load. */
export async function preflightSvbMasterBatch(
  db: Pick<Client, "query">,
  input: unknown,
) {
  const batch = parseSvbMasterBatch(input);
  const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const values = [
    JSON.stringify(batch.procedures.map((p) => ({ code: p.data.code }))),
    JSON.stringify(
      batch.tariffs.map((t) => ({
        code: t.procedureCode,
        currency: t.data.currencyCode,
        start: t.data.validFrom,
        finish: t.data.validTo ?? null,
        active: t.data.isActive,
      })),
    ),
  ];
  await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    await db.query("SET LOCAL statement_timeout = '10s'");
    const issues: Array<{ code: string; count: number }> = [];
    if (!batch.source)
      issues.push({ code: "AUTHORIZED_MASTER_SOURCE_MISSING", count: 1 });
    if (!batch.procedures.length && !batch.tariffs.length)
      issues.push({ code: "EMPTY_MASTER_BATCH", count: 1 });
    for (const [code, sql] of Object.entries(masterConflictQueries)) {
      const result = await db.query<{ count: number }>(
        `${incoming} SELECT count(*)::int AS count FROM (${sql}) affected`,
        values,
      );
      issues.push({ code, count: result.rows[0]!.count });
    }
    return {
      readOnly: true,
      canApply: false,
      sourceAuthenticityVerified: false,
      batchSha256: hash,
      technicalChecksPassed: !issues.some((i) => i.count > 0),
      procedures: batch.procedures.length,
      tariffs: batch.tariffs.length,
      issues,
    };
  } finally {
    await db.query("ROLLBACK");
  }
}
