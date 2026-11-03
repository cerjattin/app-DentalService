import { isTransactionConflict } from "../../infrastructure/database/transaction-conflict.js";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../infrastructure/database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { auditService, auditTechnicalFields } from "../audit/audit.service.js";
import type { AuthenticatedRequestContext, RequestSecurityMetadata } from "../auth/auth.types.js";
import { declarationRepository, declarationBatchSelect, type DeclarationBatchRecord } from "./declaration.repository.js";
import { toDeclarationBatchResponse, toDeclarationItemResponse } from "./declaration.types.js";
import { assertNoManualEntry } from "./manual-entry.repository.js";

function assertDraft(batch: DeclarationBatchRecord | null): asserts batch is DeclarationBatchRecord {
  if (!batch) throw new AppError(404, "DECLARATION_NOT_FOUND", "Declaration not found");
  if (batch.status !== "DRAFT") throw new AppError(409, "DECLARATION_NOT_EDITABLE", "Declaration is not editable");
  if (batch.exports.length || batch.submissions.length) throw new AppError(409, "DECLARATION_HAS_EXPORTS_OR_SUBMISSIONS", "Declaration has export or submission evidence");
}
export async function changeDraftDeclaration(id: bigint, itemId: bigint | null, reason: string,
  actor: AuthenticatedRequestContext, metadata: RequestSecurityMetadata) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const batch = await declarationRepository.lockBatch(tx, id, actor.organizationId);
        assertDraft(batch);
        await assertNoManualEntry(id,tx);
        const item = itemId === null ? null : batch.items.find((v) => v.id === itemId);
        if (itemId !== null && !item) throw new AppError(404, "DECLARATION_ITEM_NOT_FOUND", "Declaration item not found");
        if (item) {
          // Database FK removes only current ownership; the snapshot is retained in audit.
          await tx.declarationItem.delete({ where: { id: item.id } });
        } else {
          await tx.declarationBatch.update({ where: { id }, data: { status: "CANCELLED" } });
          await tx.declarationBatchStatusHistory.create({ data: { declarationBatchId: id,
            oldStatus: "DRAFT", newStatus: "CANCELLED", reason, changedByUserId: actor.userId } });
        }
        await auditService.writeWithinTransaction(tx, {
          organizationId: actor.organizationId, actorUserId: actor.userId,
          action: item ? "DECLARATION_ITEM_REMOVE" : "DECLARATION_CANCEL",
          entityType: item ? "DECLARATION_ITEM" : "DECLARATION_BATCH", entityId: item?.id ?? id,
          reason, oldValues: item ? { ...toDeclarationItemResponse(item), declarationBatchId: id.toString() }
            : { status: batch.status, declarantIdSnapshot: batch.declarantIdSnapshot },
          newValues: { status: item ? "DRAFT" : "CANCELLED", declarantIdSnapshot: batch.declarantIdSnapshot },
          ...auditTechnicalFields(metadata),
        });
        const updated = await tx.declarationBatch.findUniqueOrThrow({ where: { id }, select: declarationBatchSelect });
        return toDeclarationBatchResponse(updated);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (isTransactionConflict(error)) {
        if (attempt < 2) continue;
        throw new AppError(409, "DECLARATION_NOT_EDITABLE", "Declaration changed concurrently; reload before retrying");
      }
      throw error;
    }
  }
}
