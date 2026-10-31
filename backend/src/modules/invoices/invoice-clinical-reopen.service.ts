import { isTransactionConflict } from "../../infrastructure/database/transaction-conflict.js";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../infrastructure/database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { auditService, auditTechnicalFields } from "../audit/audit.service.js";
import type { AuthenticatedRequestContext, RequestSecurityMetadata } from "../auth/auth.types.js";
import { invoiceRepository } from "./invoice.repository.js";
import type { ReopenInvoiceEncounterInput } from "./invoice.schemas.js";
import { toInvoiceResponse } from "./invoice.types.js";

export const CLINICAL_REOPEN_REASON = "CLINICAL_REOPEN";

// This is an explicit, audited exception to completed clinical history. The
// invoice's original items, signature and documents are never rewritten.
export async function reopenInvoiceEncounter(
  invoiceId: bigint,
  input: ReopenInvoiceEncounterInput,
  actor: AuthenticatedRequestContext,
  metadata: RequestSecurityMetadata,
) {
  for (const permission of ["invoice.apply_correction", "encounter.update", "procedure.update"]) {
    if (!actor.permissions.includes(permission)) {
      throw new AppError(403, "PERMISSION_DENIED", "Permission denied");
    }
  }
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${invoiceId} AND organization_id = ${actor.organizationId} FOR UPDATE`;
        const invoice = await invoiceRepository.findById(invoiceId, actor.organizationId, tx);
        if (!invoice) throw new AppError(404, "INVOICE_NOT_FOUND", "Invoice not found");
        const source = invoice.currentVersion;
        if (!source || source.id !== BigInt(input.expectedVersionId)) {
          throw new AppError(409, "INVOICE_VERSION_CONFLICT", "Reload the current invoice version");
        }
        if (!["DRAFT", "PENDING_SIGNATURE", "SIGNED", "CLOSED"].includes(invoice.status) ||
            source.status !== invoice.status) {
          throw new AppError(409, "INVOICE_ENCOUNTER_NOT_REOPENABLE", "Invoice cannot return to clinical care in its current state");
        }
        const active = await tx.invoiceCorrection.findFirst({
          where: { invoiceId, status: { in: ["REQUESTED", "APPROVED"] } }, select: { id: true },
        });
        if (active) throw new AppError(409, "INVOICE_CORRECTION_ALREADY_ACTIVE", "Invoice already has an active correction");
        const assigned = await tx.declarationItem.findFirst({
          where: { invoiceItem: { invoiceVersion: { invoiceId } }, declarationBatch: { status: { not: "CANCELLED" } } },
          select: { id: true },
        });
        if (assigned) {
          let details: unknown = null;
          if (actor.permissions.includes("declaration.read")) {
            const batches = await tx.declarationBatch.findMany({
              where: { organizationId: actor.organizationId, status: { not: "CANCELLED" },
                items: { some: { invoiceItem: { invoiceVersion: { invoiceId } } } } },
              select: { id: true, declarationNumber: true, status: true,
                items: { where: { invoiceItem: { invoiceVersion: { invoiceId } } }, select: { id: true, invoiceItemId: true } } },
              orderBy: { id: "asc" },
            });
            details = { assignments: batches.map((batch) => ({ declarationId: batch.id.toString(),
              declarationNumber: batch.declarationNumber, status: batch.status,
              items: batch.items.map((item) => ({ declarationItemId: item.id.toString(), invoiceItemId: item.invoiceItemId.toString() })) })) };
          }
          throw new AppError(409, "INVOICE_DECLARATION_ASSIGNED", "Resolve the active declaration before returning to clinical care", details);
        }
        const encounter = await tx.clinicalEncounter.findFirst({
          where: { appointmentId: invoice.appointmentId, appointment: { organizationId: actor.organizationId } },
          select: { id: true, status: true, completedAt: true },
        });
        if (!encounter || encounter.status !== "COMPLETED" || invoice.appointment.status !== "COMPLETED") {
          throw new AppError(409, "INVOICE_ENCOUNTER_NOT_REOPENABLE", "A completed appointment and encounter are required");
        }
        // Empty until the clinician completes care and explicitly rebuilds the
        // invoice. This prevents signing stale copies of the previous services.
        const replacement = await tx.invoiceVersion.create({
          data: {
            invoiceId, versionNumber: source.versionNumber + 1, versionType: "CORRECTION",
            supersedesVersionId: source.id, status: "DRAFT", invoiceDate: source.invoiceDate,
            currencyCode: source.currencyCode, totalAmount: new Prisma.Decimal("0.00"),
            declarantIdSnapshot: source.declarantIdSnapshot, patientNameSnapshot: source.patientNameSnapshot,
            patientDocumentTypeSnapshot: source.patientDocumentTypeSnapshot,
            patientDocumentNumberSnapshot: source.patientDocumentNumberSnapshot,
            insuredIdSnapshot: source.insuredIdSnapshot, preparedByUserId: actor.userId,
          }, select: { id: true },
        });
        await tx.invoiceCorrection.create({
          data: {
            invoiceId, sourceVersionId: source.id, replacementVersionId: replacement.id,
            reasonCode: CLINICAL_REOPEN_REASON, reasonText: input.reason, status: "APPROVED",
            requestedByUserId: actor.userId, approvedByUserId: actor.userId, approvedAt: new Date(),
            metadata: { workflow: "clinical_reopen", encounterId: encounter.id.toString() },
          },
        });
        await tx.clinicalEncounter.update({ where: { id: encounter.id }, data: { status: "OPEN", completedAt: null } });
        await tx.invoice.update({ where: { id: invoiceId }, data: { status: "CORRECTION_REQUIRED", currentVersionId: replacement.id } });
        await tx.invoiceStatusHistory.create({
          data: { invoiceId, invoiceVersionId: replacement.id, oldStatus: invoice.status,
            newStatus: "CORRECTION_REQUIRED", reason: input.reason, changedByUserId: actor.userId,
            metadata: { source: "invoice.reopen_encounter", sourceVersionId: source.id.toString() } },
        });
        await auditService.writeWithinTransaction(tx, {
          organizationId: actor.organizationId, actorUserId: actor.userId,
          action: "INVOICE_ENCOUNTER_REOPEN", entityType: "INVOICE", entityId: invoiceId,
          entityKey: invoice.invoiceNumber ?? invoiceId.toString(), reason: input.reason,
          oldValues: { status: invoice.status, currentVersionId: source.id.toString(),
            encounterStatus: encounter.status, completedAt: encounter.completedAt?.toISOString() ?? null },
          newValues: { status: "CORRECTION_REQUIRED", currentVersionId: replacement.id.toString(),
            encounterId: encounter.id.toString(), encounterStatus: "OPEN" },
          ...auditTechnicalFields(metadata),
        });
        const updated = await invoiceRepository.findById(invoiceId, actor.organizationId, tx);
        if (!updated) throw new AppError(500, "INTERNAL_SERVER_ERROR", "Invoice could not be read after reopening");
        return toInvoiceResponse(updated);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 10_000 });
    } catch (error) {
      if (isTransactionConflict(error) && attempt < 2) continue;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new AppError(409, "INVOICE_VERSION_CONFLICT", "The invoice version changed; reload before returning to care");
      }
      throw error;
    }
  }
}

export async function findClinicalRebillingCorrection(tx: Prisma.TransactionClient, invoiceId: bigint, versionId: bigint) {
  return tx.invoiceCorrection.findFirst({
    where: { invoiceId, replacementVersionId: versionId, status: "APPROVED", reasonCode: CLINICAL_REOPEN_REASON,
      metadata: { path: ["workflow"], equals: "clinical_reopen" } },
    select: { id: true, sourceVersionId: true },
  });
}

export async function assertProcedureBillingEditable(tx: Prisma.TransactionClient, procedureId: bigint, organizationId: bigint) {
  const invoices = await tx.invoice.findMany({
    where: { versions: { some: { items: { some: { encounterProcedureId: procedureId } } } } },
    select: { id: true, organizationId: true, status: true, currentVersion: { select: { id: true, status: true, contentHash: true } } },
  });
  for (const invoice of invoices) {
    if (invoice.organizationId !== organizationId || invoice.status !== "CORRECTION_REQUIRED" ||
        invoice.currentVersion?.status !== "DRAFT" || invoice.currentVersion.contentHash !== null ||
        !await findClinicalRebillingCorrection(tx, invoice.id, invoice.currentVersion.id)) {
      throw new AppError(409, "ENCOUNTER_PROCEDURE_ALREADY_BILLED", "Return the invoice to clinical care before changing billed procedures");
    }
  }
}
