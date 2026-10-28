import { DateTime } from "luxon";
import { z } from "zod";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../infrastructure/database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const dashboardQuerySchema = z.strictObject({
  from: day, to: day, providerId: z.string().regex(/^[1-9]\d*$/).optional(),
});
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
export function reportPeriod(query: DashboardQuery) {
  const from = DateTime.fromISO(query.from, { zone: "America/Curacao" }).startOf("day");
  const to = DateTime.fromISO(query.to, { zone: "America/Curacao" }).startOf("day");
  if (!from.isValid || !to.isValid || from.toISODate() !== query.from || to.toISODate() !== query.to || to < from || to.diff(from, "days").days > 365) {
    throw new AppError(400, "INVALID_REPORT_PERIOD", "Select an inclusive period of at most 366 days");
  }
  return { start: from.toJSDate(), end: to.plus({ days: 1 }).toJSDate() };
}
type ProductionRow = { date: string; providerId: bigint; providerName: string; currencyCode: string; amount: string };
type Money = { currencyCode: string; amount: string };
const total = (rows: Array<{ currencyCode: string; amount: string }>): Money[] => {
  const result = new Map<string, Prisma.Decimal>();
  for (const row of rows) result.set(row.currencyCode, (result.get(row.currencyCode) ?? new Prisma.Decimal(0)).add(row.amount));
  return [...result].sort(([a], [b]) => a.localeCompare(b)).map(([currencyCode, amount]) => ({ currencyCode, amount: amount.toFixed(2) }));
};
export function summarizeProduction(rows: ProductionRow[]) {
  const timeline = new Map<string, { date: string; currencyCode: string; amount: Prisma.Decimal }>();
  const providers = new Map<string, { providerId: string; providerName: string; currencyCode: string; amount: Prisma.Decimal }>();
  for (const row of rows) {
    const tKey = row.date + ":" + row.currencyCode;
    const pKey = row.providerId.toString() + ":" + row.currencyCode;
    const t = timeline.get(tKey) ?? { date: row.date, currencyCode: row.currencyCode, amount: new Prisma.Decimal(0) };
    const p = providers.get(pKey) ?? { providerId: row.providerId.toString(), providerName: row.providerName, currencyCode: row.currencyCode, amount: new Prisma.Decimal(0) };
    t.amount = t.amount.add(row.amount); p.amount = p.amount.add(row.amount);
    timeline.set(tKey, t); providers.set(pKey, p);
  }
  function serialize<T extends { currencyCode: string; amount: Prisma.Decimal }>(values: T[]) {
    const maxima = new Map<string, Prisma.Decimal>();
    for (const v of values) maxima.set(v.currencyCode, Prisma.Decimal.max(maxima.get(v.currencyCode) ?? 0, v.amount));
    return values.map((v) => ({ ...v, amount: v.amount.toFixed(2),
      // A display-only ratio. Authoritative financial values remain Decimal strings.
      chartPercent: maxima.get(v.currencyCode)!.isZero() ? 0 : v.amount.div(maxima.get(v.currencyCode)!).mul(100).toNumber() }));
  }
  return { production: total(rows), productionTimeline: serialize([...timeline.values()].sort((a,b) => a.date.localeCompare(b.date))), productionByProvider: serialize([...providers.values()].sort((a,b) => a.providerName.localeCompare(b.providerName))) };
}
export async function getDashboard(query: DashboardQuery, organizationId: bigint) {
  const { start, end } = reportPeriod(query);
  if (query.providerId && !await prisma.provider.findFirst({ where: { id: BigInt(query.providerId), organizationId }, select: { id: true } })) {
    throw new AppError(404, "PROVIDER_NOT_FOUND", "Provider not found");
  }
  const performed = query.providerId ? Prisma.sql`AND ep.performed_by_provider_id = ${BigInt(query.providerId)}` : Prisma.empty;
  const assigned = query.providerId ? Prisma.sql`AND a.provider_id = ${BigInt(query.providerId)}` : Prisma.empty;
  const seenProvider = query.providerId ? Prisma.sql`AND ce.provider_id = ${BigInt(query.providerId)}` : Prisma.empty;
  const serviceFrom = query.from, serviceTo = query.to;
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<ProductionRow[]>(Prisma.sql`
      SELECT DATE_FORMAT(CONVERT_TZ(COALESCE(ep.performed_at, ce.started_at), '+00:00', '-04:00'), '%Y-%m-%d') date,
        ep.performed_by_provider_id providerId, CONCAT(p.first_name, ' ', p.last_name) providerName,
        ep.currency_code_snapshot currencyCode, CAST(SUM(ep.amount) AS CHAR) amount
      FROM encounter_procedures ep JOIN clinical_encounters ce ON ce.id = ep.encounter_id
      JOIN appointments a ON a.id = ce.appointment_id JOIN providers p ON p.id = ep.performed_by_provider_id AND p.organization_id = a.organization_id
      WHERE a.organization_id = ${organizationId} AND ep.status IN ('PERFORMED','BILLED') AND ce.status <> 'VOID'
        AND COALESCE(ep.performed_at, ce.started_at) >= ${start} AND COALESCE(ep.performed_at, ce.started_at) < ${end} ${performed}
      GROUP BY date, ep.performed_by_provider_id, p.first_name, p.last_name, ep.currency_code_snapshot`);
    const billed = await tx.$queryRaw<Money[]>(Prisma.sql`
      SELECT ii.currency_code_snapshot currencyCode, CAST(SUM(ii.amount) AS CHAR) amount
      FROM invoice_items ii JOIN invoice_versions iv ON iv.id = ii.invoice_version_id
      JOIN invoices i ON i.id = iv.invoice_id JOIN patient_insurance pi ON pi.id = i.patient_insurance_id
      JOIN payers pay ON pay.id = pi.payer_id JOIN encounter_procedures ep ON ep.id = ii.encounter_procedure_id
      WHERE i.organization_id = ${organizationId} AND i.status <> 'CANCELLED' AND iv.status = 'CLOSED' AND pay.code = 'SVB'
        AND ii.service_date_snapshot >= ${serviceFrom} AND ii.service_date_snapshot <= ${serviceTo} ${performed}
      GROUP BY ii.currency_code_snapshot`);
    const seen = await tx.$queryRaw<Array<{ count: string }>>(Prisma.sql`
      SELECT CAST(COUNT(*) AS CHAR) count FROM (
        SELECT a.patient_id, DATE(CONVERT_TZ(ce.started_at, '+00:00', '-04:00')) day
        FROM clinical_encounters ce JOIN appointments a ON a.id = ce.appointment_id
        WHERE a.organization_id = ${organizationId} AND ce.status <> 'VOID' AND ce.started_at >= ${start} AND ce.started_at < ${end} ${seenProvider}
        GROUP BY a.patient_id, day
      ) patient_days`);
    const appointments = await tx.$queryRaw<Array<{ count: string }>>(Prisma.sql`
      SELECT CAST(COUNT(*) AS CHAR) count FROM appointments a
      WHERE a.organization_id = ${organizationId} AND a.scheduled_start_at >= ${start} AND a.scheduled_start_at < ${end} ${assigned}`);
    const invoiceCounts = await tx.$queryRaw<Array<{ pending: string; closed: string; toDeclare: string }>>(Prisma.sql`
      SELECT CAST(COUNT(DISTINCT CASE WHEN iv.status = 'PENDING_SIGNATURE' AND i.current_version_id = iv.id THEN i.id END) AS CHAR) pending,
        CAST(COUNT(DISTINCT CASE WHEN iv.status = 'CLOSED' THEN i.id END) AS CHAR) closed,
        CAST(COUNT(DISTINCT CASE WHEN i.status = 'CLOSED' AND iv.status = 'CLOSED' AND i.current_version_id = iv.id AND pay.code = 'SVB'
          AND NOT EXISTS (SELECT 1 FROM declaration_items di JOIN declaration_batches db ON db.id = di.declaration_batch_id
            WHERE di.invoice_item_id = ii.id AND db.status <> 'CANCELLED') THEN i.id END) AS CHAR) toDeclare
      FROM invoices i JOIN invoice_versions iv ON iv.invoice_id = i.id JOIN invoice_items ii ON ii.invoice_version_id = iv.id
      JOIN patient_insurance pi ON pi.id = i.patient_insurance_id JOIN payers pay ON pay.id = pi.payer_id
      JOIN encounter_procedures ep ON ep.id = ii.encounter_procedure_id
      WHERE i.organization_id = ${organizationId} AND i.status <> 'CANCELLED'
        AND ii.service_date_snapshot >= ${serviceFrom} AND ii.service_date_snapshot <= ${serviceTo} ${performed}`);
    const summary = summarizeProduction(rows);
    return { period: { from: query.from, to: query.to, timezone: "America/Curacao" }, providerId: query.providerId ?? null,
      kpis: { production: summary.production, svbBilled: total(billed), patientsSeen: Number(seen[0]?.count ?? 0),
        appointments: Number(appointments[0]?.count ?? 0), pendingSignatures: Number(invoiceCounts[0]?.pending ?? 0),
        closedInvoices: Number(invoiceCounts[0]?.closed ?? 0), toDeclare: Number(invoiceCounts[0]?.toDeclare ?? 0) },
      productionTimeline: summary.productionTimeline, productionByProvider: summary.productionByProvider };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 15000 });
}
