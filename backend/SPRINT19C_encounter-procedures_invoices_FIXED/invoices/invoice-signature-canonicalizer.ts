import { createHash } from "node:crypto";

import type { Prisma } from "../../generated/prisma/client.js";

export const INVOICE_SIGNATURE_SCHEMA = "odontho.invoice-signature.v1";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface InvoiceSignatureItemInput {
  lineNumber: number;
  detailInvoiceNumber: string | null;
  serviceDateSnapshot: Date;
  procedureCodeSnapshot: string;
  procedureDescriptionSnapshot: string;
  providerIdSnapshot: string;
  insuredIdSnapshot: string;
  unitTariffSnapshot: Prisma.Decimal;
  currencyCodeSnapshot: string;
  quantity: Prisma.Decimal;
  amount: Prisma.Decimal;
  authorizationIdSnapshot: string | null;
  diagnosticCodeSnapshot: string | null;
  treatmentIdSnapshot: string | null;
  accidentFormNumberSnapshot: string | null;
  numberOfTreatmentsSnapshot: number | null;
  assistanceSnapshot: string | null;
  referrerIdSnapshot: string | null;
  policlinicSnapshot: string | null;
  additionalNote: string | null;
}

export interface InvoiceSignatureVersionInput {
  versionNumber: number;
  versionType: string;
  invoiceDate: Date | null;
  currencyCode: string;
  totalAmount: Prisma.Decimal;
  declarantIdSnapshot: string | null;
  patientNameSnapshot: string;
  patientDocumentTypeSnapshot: string | null;
  patientDocumentNumberSnapshot: string | null;
  insuredIdSnapshot: string;
  items: InvoiceSignatureItemInput[];
}

export interface InvoiceSignatureCanonicalInput {
  invoiceNumber: string;
  version: InvoiceSignatureVersionInput;
}

function decimalString(value: Prisma.Decimal) {
  return value.toFixed(2);
}

function dateOnly(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? null;
}

function stableStringify(value: JsonValue): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value).sort(([left], [right]) =>
    left.localeCompare(right),
  );

  return `{${entries
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(",")}}`;
}

export function buildInvoiceSignatureCanonicalContent(
  input: InvoiceSignatureCanonicalInput,
) {
  return {
    schema: INVOICE_SIGNATURE_SCHEMA,
    invoice: {
      invoiceNumber: input.invoiceNumber,
      versionNumber: input.version.versionNumber,
      versionType: input.version.versionType,
      invoiceDate: dateOnly(input.version.invoiceDate),
      currencyCode: input.version.currencyCode,
      totalAmount: decimalString(input.version.totalAmount),
      declarantId: input.version.declarantIdSnapshot,
      patientName: input.version.patientNameSnapshot,
      patientDocumentType: input.version.patientDocumentTypeSnapshot,
      patientDocumentNumber: input.version.patientDocumentNumberSnapshot,
      insuredId: input.version.insuredIdSnapshot,
    },
    items: [...input.version.items]
      .sort((left, right) => left.lineNumber - right.lineNumber)
      .map((item) => ({
        lineNumber: item.lineNumber,
        detailInvoiceNumber: item.detailInvoiceNumber,
        serviceDate: dateOnly(item.serviceDateSnapshot),
        procedureCode: item.procedureCodeSnapshot,
        procedureDescription: item.procedureDescriptionSnapshot,
        providerId: item.providerIdSnapshot,
        insuredId: item.insuredIdSnapshot,
        unitTariff: decimalString(item.unitTariffSnapshot),
        currencyCode: item.currencyCodeSnapshot,
        quantity: decimalString(item.quantity),
        amount: decimalString(item.amount),
        authorizationId: item.authorizationIdSnapshot,
        diagnosticCode: item.diagnosticCodeSnapshot,
        treatmentId: item.treatmentIdSnapshot,
        accidentFormNumber: item.accidentFormNumberSnapshot,
        numberOfTreatments: item.numberOfTreatmentsSnapshot,
        assistance: item.assistanceSnapshot,
        referrerId: item.referrerIdSnapshot,
        policlinic: item.policlinicSnapshot,
        additionalNote: item.additionalNote,
      })),
  } satisfies JsonValue;
}

export function serializeInvoiceSignatureCanonicalContent(value: JsonValue) {
  return stableStringify(value);
}

export function computeInvoiceContentHash(
  input: InvoiceSignatureCanonicalInput,
) {
  const content = buildInvoiceSignatureCanonicalContent(input);

  return createHash("sha256")
    .update(serializeInvoiceSignatureCanonicalContent(content), "utf8")
    .digest("hex");
}
