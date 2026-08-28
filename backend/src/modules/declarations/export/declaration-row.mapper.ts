import type { Prisma } from "../../../generated/prisma/client.js";
import { AppError } from "../../../shared/errors/app-error.js";
import { formatDateOnly } from "../../../shared/utils/date-only.js";
import type { DeclarationItemRecord } from "../declaration.repository.js";

export interface SvbDeclarationRow {
  declarantId: string;
  invoiceNumber: string;
  detailInvoiceNumber: string;
  providerId: string;
  date: string;
  insuredId: string;
  accidentFormNumber: string;
  treatmentId: string;
  amount: string;
  authorizationId: string;
  numberOfTreatments: string;
  assistance: string;
  referrerId: string;
  diagnosticCode: string;
  policlinic: string;
  additionalNote: string;
}

function amountString(value: Prisma.Decimal) {
  return value.toFixed(2);
}

function ddmmyyyy(value: Date) {
  const iso = formatDateOnly(value);

  if (iso === null) {
    return "";
  }

  const [year, month, day] = iso.split("-");
  return `${day}-${month}-${year}`;
}

function optional(value: string | null) {
  return value ?? "";
}

function failIncomplete(field: string): never {
  throw new AppError(
    409,
    "DECLARATION_SVB_DATA_INCOMPLETE",
    `Declaration item is missing required SVB field ${field}`,
  );
}

function failInvalid(field: string): never {
  throw new AppError(
    409,
    "DECLARATION_SVB_DATA_INVALID",
    `Declaration item has invalid SVB field ${field}`,
  );
}

function requireValue(value: string | null | undefined, field: string) {
  if (value === undefined || value === null || value.trim() === "") {
    failIncomplete(field);
  }

  return value.trim();
}

export function mapDeclarationItemToSvbRow(
  item: DeclarationItemRecord,
): SvbDeclarationRow {
  const row = {
    declarantId: item.declarantIdSnapshot.trim(),
    invoiceNumber: item.invoiceNumberSnapshot.trim(),
    detailInvoiceNumber: item.detailInvoiceNumberSnapshot.trim(),
    providerId: item.providerIdSnapshot.trim(),
    date: ddmmyyyy(item.serviceDateSnapshot),
    insuredId: item.insuredIdSnapshot.trim(),
    accidentFormNumber: optional(item.accidentFormNumberSnapshot).trim(),
    treatmentId: optional(item.treatmentIdSnapshot).trim(),
    amount: amountString(item.amountSnapshot),
    authorizationId: optional(item.authorizationIdSnapshot).trim(),
    numberOfTreatments:
      item.numberOfTreatmentsSnapshot === null
        ? ""
        : item.numberOfTreatmentsSnapshot.toString(),
    assistance: optional(item.assistanceSnapshot).trim(),
    referrerId: optional(item.referrerIdSnapshot).trim(),
    diagnosticCode: optional(item.diagnosticCodeSnapshot).trim(),
    policlinic: optional(item.policlinicSnapshot).trim(),
    additionalNote: optional(item.additionalNoteSnapshot).trim(),
  } satisfies SvbDeclarationRow;

  validateSvbDeclarationRow(row);

  return row;
}

export function validateSvbDeclarationRow(row: SvbDeclarationRow) {
  requireValue(row.declarantId, "DeclarantId");
  requireValue(row.invoiceNumber, "InvoiceNumber");
  requireValue(row.providerId, "ProviderId");
  requireValue(row.date, "Date");
  requireValue(row.insuredId, "InsuredId");
  requireValue(row.treatmentId, "TreatmentId");
  requireValue(row.amount, "Amount");
  requireValue(row.numberOfTreatments, "NumberOfTreatments");
  requireValue(row.assistance, "Assistance");
  requireValue(row.policlinic, "PoliClinic");

  if (!/^\d{1,5}$/.test(row.declarantId)) {
    failInvalid("DeclarantId");
  }

  if (row.invoiceNumber.length > 18) {
    failInvalid("InvoiceNumber");
  }

  if (row.detailInvoiceNumber.length > 18) {
    failInvalid("DetailInvoiceNumber");
  }

  if (!/^\d{5}$/.test(row.providerId)) {
    failInvalid("ProviderId");
  }

  if (!/^\d{2}-\d{2}-\d{4}$/.test(row.date)) {
    failInvalid("Date");
  }

  if (!/^\d{9}$/.test(row.insuredId)) {
    failInvalid("InsuredId");
  }

  if (row.accidentFormNumber !== "" && !/^\d{1,10}$/.test(row.accidentFormNumber)) {
    failInvalid("AccidentFormNumber");
  }

  if (row.treatmentId.length > 7) {
    failInvalid("TreatmentId");
  }

  if (!/^\d+(\.\d{2})$/.test(row.amount)) {
    failInvalid("Amount");
  }

  if (!/^\d+$/.test(row.numberOfTreatments)) {
    failInvalid("NumberOfTreatments");
  }

  if (row.assistance !== "Y" && row.assistance !== "N") {
    failInvalid("Assistance");
  }

  if (row.referrerId !== "" && !/^\d{5}$/.test(row.referrerId)) {
    failInvalid("ReferrerId");
  }

  if (row.policlinic !== "P" && row.policlinic !== "K") {
    failInvalid("PoliClinic");
  }

  if (row.additionalNote.length > 100) {
    failInvalid("AdditionalNote");
  }
}
