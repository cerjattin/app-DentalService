import type { SvbDeclarationRow } from "./declaration-row.mapper.js";

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}

export function renderXmlRows(input: {
  declarationNumber: string | null;
  rows: SvbDeclarationRow[];
}) {
  const rows = input.rows
    .map(
      (row) => `  <row>
    <DeclarantId>${escapeXml(row.declarantId)}</DeclarantId>
    <InvoiceNumber>${escapeXml(row.invoiceNumber)}</InvoiceNumber>
    <DetailInvoiceNumber>${escapeXml(row.detailInvoiceNumber)}</DetailInvoiceNumber>
    <ProviderId>${escapeXml(row.providerId)}</ProviderId>
    <Date>${escapeXml(row.date)}</Date>
    <InsuredId>${escapeXml(row.insuredId)}</InsuredId>
    <AccidentFormNumber>${escapeXml(row.accidentFormNumber)}</AccidentFormNumber>
    <TreatmentId>${escapeXml(row.treatmentId)}</TreatmentId>
    <Amount>${escapeXml(row.amount)}</Amount>
    <AuthorizationId>${escapeXml(row.authorizationId)}</AuthorizationId>
    <NumberOfTreatments>${escapeXml(row.numberOfTreatments)}</NumberOfTreatments>
    <Assistance>${escapeXml(row.assistance)}</Assistance>
    <ReferrerId>${escapeXml(row.referrerId)}</ReferrerId>
    <DiagnosticCode>${escapeXml(row.diagnosticCode)}</DiagnosticCode>
    <PoliClinic>${escapeXml(row.policlinic)}</PoliClinic>
    <AdditionalNote>${escapeXml(row.additionalNote)}</AdditionalNote>
  </row>`,
    )
    .join("\n");

  return Buffer.from(
    `<?xml version="1.0" encoding="UTF-8"?>
<SvbDeclaration schemaVersion="SVB_DECLARATION_ROW_V1" declarationNumber="${escapeXml(
      input.declarationNumber ?? "",
    )}">
${rows}
</SvbDeclaration>
`,
    "utf8",
  );
}
