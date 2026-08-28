import type { Prisma } from "../../generated/prisma/client.js";

import { prisma } from "../../infrastructure/database/prisma.js";

export const signatureSelect = {
  id: true,
  invoiceVersionId: true,
  patientId: true,
  signatureDocumentId: true,
  signatureType: true,
  signerName: true,
  signerRelationship: true,
  captureMethod: true,
  signedContentHash: true,
  signatureHash: true,
  status: true,
  signedAt: true,
  capturedByUserId: true,
  deviceIdentifier: true,
  ipAddress: true,
  userAgent: true,
  metadata: true,
  voidedAt: true,
  voidedByUserId: true,
  voidReason: true,
  createdAt: true,
  signatureDocument: {
    select: {
      id: true,
      documentType: true,
      originalFilename: true,
      mimeType: true,
      sizeBytes: true,
      sha256: true,
      createdAt: true,
    },
  },
} satisfies Prisma.SignatureSelect;

export type SignatureRecord = Prisma.SignatureGetPayload<{
  select: typeof signatureSelect;
}>;

export class SignatureRepository {
  findById(
    signatureId: bigint,
    invoiceVersionId: bigint,
    client: Prisma.TransactionClient | typeof prisma = prisma,
  ) {
    return client.signature.findFirst({
      where: {
        id: signatureId,
        invoiceVersionId,
      },
      select: signatureSelect,
    });
  }

  listByVersion(
    invoiceVersionId: bigint,
    client: Prisma.TransactionClient | typeof prisma = prisma,
  ) {
    return client.signature.findMany({
      where: {
        invoiceVersionId,
      },
      select: signatureSelect,
      orderBy: {
        createdAt: "asc",
      },
    });
  }
}

export const signatureRepository = new SignatureRepository();
