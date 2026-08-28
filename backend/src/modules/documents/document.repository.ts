import type { Prisma } from "../../generated/prisma/client.js";

import { prisma } from "../../infrastructure/database/prisma.js";

export const documentSelect = {
  id: true,
  organizationId: true,
  documentType: true,
  storageProvider: true,
  storageUri: true,
  originalFilename: true,
  mimeType: true,
  sizeBytes: true,
  sha256: true,
  metadata: true,
  createdByUserId: true,
  createdAt: true,
} satisfies Prisma.DocumentSelect;

export const invoiceDocumentSelect = {
  id: true,
  invoiceVersionId: true,
  documentId: true,
  documentRole: true,
  createdAt: true,
  document: {
    select: documentSelect,
  },
} satisfies Prisma.InvoiceDocumentSelect;

export type DocumentRecord = Prisma.DocumentGetPayload<{
  select: typeof documentSelect;
}>;

export type InvoiceDocumentRecord = Prisma.InvoiceDocumentGetPayload<{
  select: typeof invoiceDocumentSelect;
}>;

export class DocumentRepository {
  findById(
    documentId: bigint,
    organizationId: bigint,
    client: Prisma.TransactionClient | typeof prisma = prisma,
  ) {
    return client.document.findFirst({
      where: {
        id: documentId,
        organizationId,
      },
      select: documentSelect,
    });
  }

  findInvoiceDocumentsByInvoiceId(
    invoiceId: bigint,
    organizationId: bigint,
    client: Prisma.TransactionClient | typeof prisma = prisma,
  ) {
    return client.invoiceDocument.findMany({
      where: {
        invoiceVersion: {
          invoiceId,
          invoice: {
            organizationId,
          },
        },
      },
      select: invoiceDocumentSelect,
      orderBy: {
        createdAt: "asc",
      },
    });
  }
}

export const documentRepository = new DocumentRepository();
