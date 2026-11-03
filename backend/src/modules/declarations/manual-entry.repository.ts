import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../infrastructure/database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { documentSelect } from "../documents/document.repository.js";
import {
  declarationItemSelect,
  invoiceItemForDeclarationSelect,
} from "./declaration.repository.js";

export const manualEntrySelect = {
  id: true,
  organizationId: true,
  declarationBatchId: true,
  state: true,
  claimKey: true,
  contentHash: true,
  contentSnapshot: true,
  preparedByUserId: true,
  preparedAt: true,
  uncertaintyReason: true,
  releaseReason: true,
  releasedAt: true,
  resolutionDocumentId: true,
  recordKey: true,
  recordHash: true,
  submissionId: true,
  receiptDocumentId: true,
  receiptSha256: true,
  externalSubmittedAt: true,
  confirmedAt: true,
  result: true,
} satisfies Prisma.DeclarationManualEntrySelect;
export type ManualEntryRecord = Prisma.DeclarationManualEntryGetPayload<{
  select: typeof manualEntrySelect;
}>;

export const manualEntryRepository = {
  async lockInvoices(ids: bigint[], tx: Prisma.TransactionClient) {
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM invoices WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR SHARE`,
    );
  },
  find(
    id: bigint,
    batchId: bigint,
    organizationId: bigint,
    tx: Prisma.TransactionClient | typeof prisma = prisma,
  ) {
    return tx.declarationManualEntry.findFirst({
      where: { id, declarationBatchId: batchId, organizationId },
      select: manualEntrySelect,
    });
  },
  active(
    batchId: bigint,
    tx: Prisma.TransactionClient | typeof prisma = prisma,
  ) {
    return tx.declarationManualEntry.findFirst({
      where: {
        declarationBatchId: batchId,
        state: { in: ["PREPARED", "UNCERTAIN", "RECORDED"] },
      },
      select: manualEntrySelect,
    });
  },
  byClaimKey(
    organizationId: bigint,
    claimKey: string,
    tx: Prisma.TransactionClient,
  ) {
    return tx.declarationManualEntry.findUnique({
      where: { organizationId_claimKey: { organizationId, claimKey } },
      select: manualEntrySelect,
    });
  },
  byRecordKey(
    organizationId: bigint,
    recordKey: string,
    tx: Prisma.TransactionClient | typeof prisma = prisma,
  ) {
    return tx.declarationManualEntry.findUnique({
      where: { organizationId_recordKey: { organizationId, recordKey } },
      select: manualEntrySelect,
    });
  },
  sourceItems(batchId: bigint, tx: Prisma.TransactionClient) {
    return tx.declarationItem.findMany({
      where: { declarationBatchId: batchId },
      orderBy: [{ sequenceNumber: "asc" }, { id: "asc" }],
      select: {
        ...declarationItemSelect,
        invoiceItem: {
          select: {
            ...invoiceItemForDeclarationSelect,
            quantity: true,
            unitTariffSnapshot: true,
            invoiceVersion: {
              select: {
                ...invoiceItemForDeclarationSelect.invoiceVersion.select,
                contentHash: true,
              },
            },
          },
        },
      },
    });
  },
  completeInvoiceItemIds(versionId: bigint, tx: Prisma.TransactionClient) {
    return tx.invoiceItem.findMany({
      where: { invoiceVersionId: versionId },
      select: { id: true },
      orderBy: { id: "asc" },
    });
  },
  document(id: bigint, organizationId: bigint, tx: Prisma.TransactionClient) {
    return tx.document.findFirst({
      where: { id, organizationId },
      select: documentSelect,
    });
  },
};

export async function assertNoManualEntry(
  batchId: bigint,
  tx: Prisma.TransactionClient,
) {
  const entry = await manualEntryRepository.active(batchId, tx);
  if (entry)
    throw new AppError(
      409,
      entry.state === "UNCERTAIN"
        ? "MANUAL_ENTRY_UNCERTAIN"
        : "MANUAL_ENTRY_LOCKED",
      "Resolve the manual portal preparation before changing this declaration",
    );
}

export async function assertNoManualInvoicePresentation(
  invoiceId: bigint,
  tx: Prisma.TransactionClient,
) {
  const entry = await tx.declarationManualEntry.findFirst({
    where: {
      state: { in: ["PREPARED", "UNCERTAIN", "RECORDED"] },
      declarationBatch: {
        items: { some: { invoiceItem: { invoiceVersion: { invoiceId } } } },
      },
    },
    select: { id: true },
  });
  if (entry)
    throw new AppError(
      409,
      "INVOICE_MANUAL_PRESENTATION_LOCKED",
      "Resolve the manual portal presentation before correcting this invoice",
    );
}
