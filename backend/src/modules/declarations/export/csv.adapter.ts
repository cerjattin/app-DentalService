import type { SvbDeclarationRow } from "./declaration-row.mapper.js";

const ROW_FIELDS = [
  "declarantId",
  "invoiceNumber",
  "detailInvoiceNumber",
  "providerId",
  "date",
  "insuredId",
  "accidentFormNumber",
  "treatmentId",
  "amount",
  "authorizationId",
  "numberOfTreatments",
  "assistance",
  "referrerId",
  "diagnosticCode",
  "policlinic",
  "additionalNote",
] as const;

function escapeCsv(value: string) {
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replaceAll("\"", "\"\"")}"`;
  }

  return value;
}

export function renderCsvRows(rows: SvbDeclarationRow[]) {
  const content = rows
    .map((row) => ROW_FIELDS.map((field) => escapeCsv(row[field])).join(","))
    .join("\n");

  return Buffer.from(`${content}\n`, "utf8");
}
