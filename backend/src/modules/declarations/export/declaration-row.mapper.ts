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

export function declarationItemToSvbRow(
  item: Pick<DeclarationItemRecord, "declarantIdSnapshot" | "invoiceNumberSnapshot" | "detailInvoiceNumberSnapshot" | "providerIdSnapshot" | "serviceDateSnapshot" | "insuredIdSnapshot" | "accidentFormNumberSnapshot" | "treatmentIdSnapshot" | "amountSnapshot" | "authorizationIdSnapshot" | "numberOfTreatmentsSnapshot" | "assistanceSnapshot" | "referrerIdSnapshot" | "diagnosticCodeSnapshot" | "policlinicSnapshot" | "additionalNoteSnapshot">,
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

  return row;
}

export const svbIssueFields = ["DeclarantId", "InvoiceNumber", "DetailInvoiceNumber", "ProviderId", "Date", "InsuredId", "AccidentFormNumber", "TreatmentId", "Amount", "NumberOfTreatments", "Assistance", "ReferrerId", "PoliClinic", "AdditionalNote"] as const;
export const svbIssueCodes = ["DECLARATION_SVB_DATA_INCOMPLETE", "DECLARATION_SVB_DATA_INVALID"] as const;
export type SvbIssue = { field: typeof svbIssueFields[number]; code: typeof svbIssueCodes[number] };

export function diagnoseSvbDeclarationRow(row: SvbDeclarationRow): SvbIssue[] {
  const issues: SvbIssue[] = [];
  const required = [
    ["DeclarantId", row.declarantId], ["InvoiceNumber", row.invoiceNumber], ["ProviderId", row.providerId],
    ["Date", row.date], ["InsuredId", row.insuredId], ["TreatmentId", row.treatmentId], ["Amount", row.amount],
    ["NumberOfTreatments", row.numberOfTreatments], ["Assistance", row.assistance], ["PoliClinic", row.policlinic],
  ] as const;
  for (const [field, value] of required) {
    if (!value.trim()) issues.push({ field, code: "DECLARATION_SVB_DATA_INCOMPLETE" });
  }
  const rules = [
    ["DeclarantId", /^\d{1,5}$/.test(row.declarantId)],
    ["InvoiceNumber", row.invoiceNumber.length <= 18], ["DetailInvoiceNumber", row.detailInvoiceNumber.length <= 18],
    ["ProviderId", /^\d{5}$/.test(row.providerId)], ["Date", /^\d{2}-\d{2}-\d{4}$/.test(row.date)],
    ["InsuredId", /^\d{9}$/.test(row.insuredId)],
    ["AccidentFormNumber", row.accidentFormNumber === "" || /^\d{1,10}$/.test(row.accidentFormNumber)],
    ["TreatmentId", row.treatmentId.length <= 7], ["Amount", /^\d+(\.\d{2})$/.test(row.amount)],
    ["NumberOfTreatments", /^\d+$/.test(row.numberOfTreatments)], ["Assistance", ["Y", "N"].includes(row.assistance)],
    ["ReferrerId", row.referrerId === "" || /^\d{5}$/.test(row.referrerId)],
    ["PoliClinic", ["P", "K"].includes(row.policlinic)], ["AdditionalNote", row.additionalNote.length <= 100],
  ] as const;
  for (const [field, valid] of rules) {
    if (!valid && !issues.some((issue) => issue.field === field)) issues.push({ field, code: "DECLARATION_SVB_DATA_INVALID" });
  }
  return issues;
}

export function validateSvbDeclarationRow(row: SvbDeclarationRow) {
  const issue = diagnoseSvbDeclarationRow(row)[0];
  if (issue) throw new AppError(409, issue.code, issue.code === "DECLARATION_SVB_DATA_INCOMPLETE"
    ? `Declaration item is missing required SVB field ${issue.field}` : `Declaration item has invalid SVB field ${issue.field}`);
}
export function mapDeclarationItemToSvbRow(item: DeclarationItemRecord): SvbDeclarationRow {
  const row = declarationItemToSvbRow(item);
  validateSvbDeclarationRow(row);
  return row;
}
