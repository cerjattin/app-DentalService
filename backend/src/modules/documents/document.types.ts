import type {
  DocumentRecord,
  InvoiceDocumentRecord,
} from "./document.repository.js";

export function toDocumentResponse(document: DocumentRecord) {
  return {
    id: document.id.toString(),
    organizationId: document.organizationId.toString(),
    documentType: document.documentType,
    storageProvider: document.storageProvider,
    originalFilename: document.originalFilename,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes.toString(),
    sha256: document.sha256,
    metadata: document.metadata,
    createdByUserId: document.createdByUserId?.toString() ?? null,
    createdAt: document.createdAt.toISOString(),
  };
}

export function toInvoiceDocumentResponse(row: InvoiceDocumentRecord) {
  return {
    id: row.id.toString(),
    invoiceVersionId: row.invoiceVersionId.toString(),
    documentId: row.documentId.toString(),
    documentRole: row.documentRole,
    createdAt: row.createdAt.toISOString(),
    document: toDocumentResponse(row.document),
  };
}
