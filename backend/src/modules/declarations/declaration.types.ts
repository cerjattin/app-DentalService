import type { Prisma } from "../../generated/prisma/client.js";
import { formatDateOnly } from "../../shared/utils/date-only.js";
import { toDocumentResponse } from "../documents/document.types.js";

import type {
  DeclarationBatchRecord,
  DeclarationExportRecord,
  DeclarationItemRecord,
} from "./declaration.repository.js";

function decimalString(value: Prisma.Decimal) {
  return value.toFixed(2);
}

export function toDeclarationItemResponse(item: DeclarationItemRecord) {
  return {
    id: item.id.toString(),
    declarationBatchId: item.declarationBatchId.toString(),
    invoiceItemId: item.invoiceItemId.toString(),
    sequenceNumber: item.sequenceNumber,
    lineStatus: item.lineStatus,
    declarantIdSnapshot: item.declarantIdSnapshot,
    invoiceNumberSnapshot: item.invoiceNumberSnapshot,
    detailInvoiceNumberSnapshot: item.detailInvoiceNumberSnapshot,
    providerIdSnapshot: item.providerIdSnapshot,
    serviceDateSnapshot: formatDateOnly(item.serviceDateSnapshot),
    insuredIdSnapshot: item.insuredIdSnapshot,
    accidentFormNumberSnapshot: item.accidentFormNumberSnapshot,
    treatmentIdSnapshot: item.treatmentIdSnapshot,
    amountSnapshot: decimalString(item.amountSnapshot),
    authorizationIdSnapshot: item.authorizationIdSnapshot,
    numberOfTreatmentsSnapshot: item.numberOfTreatmentsSnapshot,
    assistanceSnapshot: item.assistanceSnapshot,
    referrerIdSnapshot: item.referrerIdSnapshot,
    diagnosticCodeSnapshot: item.diagnosticCodeSnapshot,
    policlinicSnapshot: item.policlinicSnapshot,
    additionalNoteSnapshot: item.additionalNoteSnapshot,
    responseCode: item.responseCode,
    responseMessage: item.responseMessage,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export function toDeclarationExportResponse(row: DeclarationExportRecord) {
  return {
    id: row.id.toString(),
    declarationBatchId: row.declarationBatchId.toString(),
    documentId: row.documentId.toString(),
    format: row.format,
    schemaVersion: row.schemaVersion,
    adapterVersion: row.adapterVersion,
    recordCount: row.recordCount,
    exportedByUserId: row.exportedByUserId.toString(),
    exportedAt: row.exportedAt.toISOString(),
    metadata: row.metadata,
    document: toDocumentResponse(row.document),
  };
}

export function toDeclarationBatchResponse(row: DeclarationBatchRecord) {
  return {
    id: row.id.toString(),
    organizationId: row.organizationId.toString(),
    payerId: row.payerId.toString(),
    declarationNumber: row.declarationNumber,
    status: row.status,
    periodStart: formatDateOnly(row.periodStart),
    periodEnd: formatDateOnly(row.periodEnd),
    declarantIdSnapshot: row.declarantIdSnapshot,
    submissionReference: row.submissionReference,
    notes: row.notes,
    createdByUserId: row.createdByUserId.toString(),
    readyAt: row.readyAt?.toISOString() ?? null,
    exportedAt: row.exportedAt?.toISOString() ?? null,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
    rejectedAt: row.rejectedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    payer: {
      id: row.payer.id.toString(),
      code: row.payer.code,
      name: row.payer.name,
      payerType: row.payer.payerType,
    },
    items: row.items.map(toDeclarationItemResponse),
    exports: row.exports.map(toDeclarationExportResponse),
  };
}
