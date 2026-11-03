import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../infrastructure/database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { parseDateOnly } from "../../shared/utils/date-only.js";
import type { AuthenticatedRequestContext } from "../auth/auth.types.js";
import { assertDeclarationIdentity, declarationSnapshot } from "./declaration-identity.js";
import { declarationRepository } from "./declaration.repository.js";
import type { DeclarationCandidatesQuery } from "./declaration.schemas.js";
import { declarationItemToSvbRow, diagnoseSvbDeclarationRow } from "./export/declaration-row.mapper.js";
import { realSvbPresentationReadiness } from "../svb-readiness/svb-readiness.service.js";

export async function listDeclarationCandidates(id: bigint, query: DeclarationCandidatesQuery, actor: AuthenticatedRequestContext) {
  const from = query.from === undefined ? undefined : parseDateOnly(query.from, "from");
  const to = query.to === undefined ? undefined : parseDateOnly(query.to, "to");
  if (from && to && to < from) throw new AppError(400, "INVALID_DECLARATION_PERIOD", "to must be on or after from");
  return prisma.$transaction(async (tx) => {
    const batch = await declarationRepository.findById(id, actor.organizationId, tx);
    if (!batch) throw new AppError(404, "DECLARATION_NOT_FOUND", "Declaration not found");
    if (batch.status !== "DRAFT") throw new AppError(409, "DECLARATION_NOT_EDITABLE", "Declaration is not editable");
    assertDeclarationIdentity(batch);
    const filter = Prisma.sql`i.organization_id = ${actor.organizationId} AND pi.payer_id = ${batch.payerId}
      AND i.status = 'CLOSED' AND iv.status = 'CLOSED'
      AND iv.declarant_id_snapshot COLLATE "C" ~ '^[0-9]{1,5}$'
      AND (${batch.declarantIdSnapshot}::text IS NULL OR iv.declarant_id_snapshot = ${batch.declarantIdSnapshot})
      AND NOT EXISTS (SELECT 1 FROM declaration_items di JOIN declaration_batches db ON db.id = di.declaration_batch_id
        WHERE di.invoice_item_id = ii.id AND db.status <> 'CANCELLED')
      ${from ? Prisma.sql`AND ii.service_date_snapshot >= ${from}` : Prisma.empty}
      ${to ? Prisma.sql`AND ii.service_date_snapshot <= ${to}` : Prisma.empty}
      ${query.q ? Prisma.sql`AND strpos(public.odontho_fold_search(concat_ws(' ', i.invoice_number,
        ii.procedure_code_snapshot, ii.procedure_description_snapshot)) COLLATE "C", public.odontho_fold_search(${query.q}::text) COLLATE "C") > 0` : Prisma.empty}`;
    const { total, items } = await declarationRepository.candidatePage(tx, filter, query.page, query.pageSize);
    const candidates = items.map((item) => {
      const issues = diagnoseSvbDeclarationRow(declarationItemToSvbRow(declarationSnapshot(item, item.invoiceVersion.declarantIdSnapshot!)));
      return { invoiceId: item.invoiceVersion.invoice.id.toString(), invoiceVersionId: item.invoiceVersionId.toString(),
        invoiceItemId: item.id.toString(), invoiceNumber: item.invoiceVersion.invoice.invoiceNumber,
        versionNumber: item.invoiceVersion.versionNumber, detailInvoiceNumber: item.detailInvoiceNumber,
        serviceDate: item.serviceDateSnapshot.toISOString().slice(0, 10), procedureCode: item.procedureCodeSnapshot,
        procedureDescription: item.procedureDescriptionSnapshot, providerIdSnapshot: item.providerIdSnapshot,
        insuredIdSnapshot: item.insuredIdSnapshot, amount: item.amount.toFixed(2), currencyCode: item.currencyCodeSnapshot,
        svbReadiness: issues.length ? "INCOMPLETE" as const : "COMPLETE" as const, issues,
        realPresentationReadiness: realSvbPresentationReadiness() };
    });
    return { candidates, pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) } };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
