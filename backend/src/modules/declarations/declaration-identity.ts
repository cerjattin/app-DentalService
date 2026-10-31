import { AppError } from "../../shared/errors/app-error.js";
import type { DeclarationBatchRecord, InvoiceItemForDeclarationRecord } from "./declaration.repository.js";

export function assertDeclarationIdentity(batch: DeclarationBatchRecord) {
  if ((batch.declarantIdSnapshot !== null && !/^\d{1,5}$/.test(batch.declarantIdSnapshot)) ||
    batch.items.some((item) => !/^\d{1,5}$/.test(item.declarantIdSnapshot) ||
      batch.declarantIdSnapshot === null || item.declarantIdSnapshot !== batch.declarantIdSnapshot ||
      item.declarantIdSnapshot !== item.invoiceItem.invoiceVersion.declarantIdSnapshot)) {
    throw new AppError(409, "DECLARATION_LEGACY_DATA_CONFLICT", "Draft identity snapshots are inconsistent; an explicit reconciliation is required");
  }
}

export function invoiceDeclarant(item: InvoiceItemForDeclarationRecord) {
  const value = item.invoiceVersion.declarantIdSnapshot;
  if (value === null || !/^\d{1,5}$/.test(value)) {
    throw new AppError(409, value === null || value.trim() === "" ? "DECLARATION_SVB_DATA_INCOMPLETE" : "DECLARATION_SVB_DATA_INVALID",
      "Invoice DeclarantId snapshot is missing or invalid");
  }
  return value;
}

export function declarationSnapshot(item: InvoiceItemForDeclarationRecord, declarantId: string) {
  return {
    declarantIdSnapshot: declarantId,
    invoiceNumberSnapshot: item.invoiceVersion.invoice.invoiceNumber ?? "",
    detailInvoiceNumberSnapshot: item.detailInvoiceNumber ?? "",
    providerIdSnapshot: item.providerIdSnapshot, serviceDateSnapshot: item.serviceDateSnapshot,
    insuredIdSnapshot: item.insuredIdSnapshot, accidentFormNumberSnapshot: item.accidentFormNumberSnapshot,
    treatmentIdSnapshot: item.treatmentIdSnapshot, amountSnapshot: item.amount,
    authorizationIdSnapshot: item.authorizationIdSnapshot, numberOfTreatmentsSnapshot: item.numberOfTreatmentsSnapshot,
    assistanceSnapshot: item.assistanceSnapshot, referrerIdSnapshot: item.referrerIdSnapshot,
    diagnosticCodeSnapshot: item.diagnosticCodeSnapshot, policlinicSnapshot: item.policlinicSnapshot,
    additionalNoteSnapshot: item.additionalNote,
  };
}
