import type { SignatureRecord } from "./signature.repository.js";

export function toSignatureResponse(signature: SignatureRecord) {
  return {
    id: signature.id.toString(),
    invoiceVersionId: signature.invoiceVersionId.toString(),
    patientId: signature.patientId.toString(),
    signatureDocumentId: signature.signatureDocumentId.toString(),
    signatureType: signature.signatureType,
    signerName: signature.signerName,
    signerRelationship: signature.signerRelationship,
    captureMethod: signature.captureMethod,
    signedContentHash: signature.signedContentHash,
    signatureHash: signature.signatureHash,
    status: signature.status,
    signedAt: signature.signedAt.toISOString(),
    capturedByUserId: signature.capturedByUserId.toString(),
    deviceIdentifier: signature.deviceIdentifier,
    ipAddress: signature.ipAddress,
    userAgent: signature.userAgent,
    metadata: signature.metadata,
    voidedAt: signature.voidedAt?.toISOString() ?? null,
    voidedByUserId: signature.voidedByUserId?.toString() ?? null,
    voidReason: signature.voidReason,
    createdAt: signature.createdAt.toISOString(),
    document: {
      id: signature.signatureDocument.id.toString(),
      documentType: signature.signatureDocument.documentType,
      originalFilename: signature.signatureDocument.originalFilename,
      mimeType: signature.signatureDocument.mimeType,
      sizeBytes: signature.signatureDocument.sizeBytes.toString(),
      sha256: signature.signatureDocument.sha256,
      createdAt: signature.signatureDocument.createdAt.toISOString(),
    },
  };
}
