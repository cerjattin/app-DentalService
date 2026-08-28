import type { Prisma } from "../../generated/prisma/client.js";

import { prisma } from "../../infrastructure/database/prisma.js";
import { documentSelect } from "../documents/document.repository.js";

export const declarationItemSelect = {
  id: true,
  declarationBatchId: true,
  invoiceItemId: true,
  sequenceNumber: true,
  lineStatus: true,
  declarantIdSnapshot: true,
  invoiceNumberSnapshot: true,
  detailInvoiceNumberSnapshot: true,
  providerIdSnapshot: true,
  serviceDateSnapshot: true,
  insuredIdSnapshot: true,
  accidentFormNumberSnapshot: true,
  treatmentIdSnapshot: true,
  amountSnapshot: true,
  authorizationIdSnapshot: true,
  numberOfTreatmentsSnapshot: true,
  assistanceSnapshot: true,
  referrerIdSnapshot: true,
  diagnosticCodeSnapshot: true,
  policlinicSnapshot: true,
  additionalNoteSnapshot: true,
  responseCode: true,
  responseMessage: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DeclarationItemSelect;

export const declarationExportSelect = {
  id: true,
  declarationBatchId: true,
  documentId: true,
  format: true,
  schemaVersion: true,
  adapterVersion: true,
  recordCount: true,
  exportedByUserId: true,
  exportedAt: true,
  metadata: true,
  document: {
    select: documentSelect,
  },
} satisfies Prisma.DeclarationExportSelect;

export const declarationBatchSelect = {
  id: true,
  organizationId: true,
  payerId: true,
  declarationNumber: true,
  status: true,
  periodStart: true,
  periodEnd: true,
  declarantIdSnapshot: true,
  submissionReference: true,
  notes: true,
  createdByUserId: true,
  readyAt: true,
  exportedAt: true,
  submittedAt: true,
  acceptedAt: true,
  rejectedAt: true,
  createdAt: true,
  updatedAt: true,
  payer: {
    select: {
      id: true,
      code: true,
      name: true,
      payerType: true,
    },
  },
  items: {
    select: declarationItemSelect,
    orderBy: {
      sequenceNumber: "asc",
    },
  },
  exports: {
    select: declarationExportSelect,
    orderBy: {
      exportedAt: "desc",
    },
  },
} satisfies Prisma.DeclarationBatchSelect;

export const invoiceItemForDeclarationSelect = {
  id: true,
  invoiceVersionId: true,
  lineNumber: true,
  detailInvoiceNumber: true,
  encounterProcedureId: true,
  sourceInvoiceItemId: true,
  serviceDateSnapshot: true,
  procedureCodeSnapshot: true,
  providerIdSnapshot: true,
  insuredIdSnapshot: true,
  amount: true,
  authorizationIdSnapshot: true,
  diagnosticCodeSnapshot: true,
  treatmentIdSnapshot: true,
  accidentFormNumberSnapshot: true,
  numberOfTreatmentsSnapshot: true,
  assistanceSnapshot: true,
  referrerIdSnapshot: true,
  policlinicSnapshot: true,
  additionalNote: true,
  invoiceVersion: {
    select: {
      id: true,
      status: true,
      versionType: true,
      invoiceId: true,
      declarantIdSnapshot: true,
      invoice: {
        select: {
          id: true,
          organizationId: true,
          patientInsuranceId: true,
          invoiceNumber: true,
          status: true,
          currentVersionId: true,
          patientInsurance: {
            select: {
              id: true,
              payerId: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.InvoiceItemSelect;

export type DeclarationBatchRecord = Prisma.DeclarationBatchGetPayload<{
  select: typeof declarationBatchSelect;
}>;

export type DeclarationItemRecord = Prisma.DeclarationItemGetPayload<{
  select: typeof declarationItemSelect;
}>;

export type DeclarationExportRecord = Prisma.DeclarationExportGetPayload<{
  select: typeof declarationExportSelect;
}>;

export type InvoiceItemForDeclarationRecord = Prisma.InvoiceItemGetPayload<{
  select: typeof invoiceItemForDeclarationSelect;
}>;

export class DeclarationRepository {
  findById(
    declarationId: bigint,
    organizationId: bigint,
    client: Prisma.TransactionClient | typeof prisma = prisma,
  ) {
    return client.declarationBatch.findFirst({
      where: {
        id: declarationId,
        organizationId,
      },
      select: declarationBatchSelect,
    });
  }

  findItemByInvoiceItem(
    declarationBatchId: bigint,
    invoiceItemId: bigint,
    client: Prisma.TransactionClient | typeof prisma = prisma,
  ) {
    return client.declarationItem.findFirst({
      where: {
        declarationBatchId,
        invoiceItemId,
      },
      select: declarationItemSelect,
    });
  }

  findInvoiceItemForDeclaration(
    invoiceItemId: bigint,
    client: Prisma.TransactionClient | typeof prisma = prisma,
  ) {
    return client.invoiceItem.findUnique({
      where: {
        id: invoiceItemId,
      },
      select: invoiceItemForDeclarationSelect,
    });
  }
}

export const declarationRepository = new DeclarationRepository();
