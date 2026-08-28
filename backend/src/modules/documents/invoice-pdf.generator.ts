import PDFDocument from "pdfkit";

import type {
  InvoiceRecord,
  InvoiceVersionRecord,
} from "../invoices/invoice.repository.js";

interface SignatureForPdf {
  id: bigint;
  signerName: string;
  signerRelationship: string | null;
  signatureType: string;
  captureMethod: string;
  signedAt: Date;
  signatureHash: string;
}

function dateOnly(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? "";
}

function text(value: string | number | null | undefined) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "?");
}

function wrap(line: string, limit = 92) {
  const words = text(line).split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current.length === 0 ? word : `${current} ${word}`;
    if (next.length > limit && current.length > 0) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current.length > 0) {
    lines.push(current);
  }

  return lines;
}

function amount(value: { toFixed(scale: number): string }) {
  return value.toFixed(2);
}

function buildLines(input: {
  invoice: InvoiceRecord;
  version: InvoiceVersionRecord;
  contentHash: string;
  signature: SignatureForPdf;
}) {
  const { invoice, version, contentHash, signature } = input;
  const lines = [
    "ODONTHO SERVICES B.V. - SVB INVOICE DOCUMENT",
    "Technical invoice PDF generated from closed immutable snapshots.",
    "",
    `Invoice number: ${invoice.invoiceNumber ?? ""}`,
    `Invoice date: ${dateOnly(version.invoiceDate)}`,
    `Invoice status: ${invoice.status}`,
    `Version: ${version.versionNumber} (${version.versionType})`,
    `Version status: ${version.status}`,
    `Content hash: ${contentHash}`,
    "",
    "Patient snapshot",
    `Name: ${version.patientNameSnapshot}`,
    `Document: ${version.patientDocumentTypeSnapshot ?? ""} ${version.patientDocumentNumberSnapshot ?? ""}`,
    `Insured ID: ${version.insuredIdSnapshot}`,
    `Declarant ID: ${version.declarantIdSnapshot ?? ""}`,
    "",
    "Lines",
  ];

  for (const item of version.items) {
    lines.push(
      `${item.lineNumber}. ${dateOnly(item.serviceDateSnapshot)} ${item.procedureCodeSnapshot} ${item.procedureDescriptionSnapshot}`,
      `   Provider: ${item.providerIdSnapshot} | Insured: ${item.insuredIdSnapshot}`,
      `   Tariff: ${amount(item.unitTariffSnapshot)} ${item.currencyCodeSnapshot} | Qty: ${amount(item.quantity)} | Amount: ${amount(item.amount)}`,
    );

    if (item.authorizationIdSnapshot !== null) {
      lines.push(`   Authorization: ${item.authorizationIdSnapshot}`);
    }

    if (item.diagnosticCodeSnapshot !== null) {
      lines.push(`   Diagnosis: ${item.diagnosticCodeSnapshot}`);
    }

    if (item.additionalNote !== null) {
      lines.push(`   Note: ${item.additionalNote}`);
    }
  }

  lines.push(
    "",
    `Total: ${amount(version.totalAmount)} ${version.currencyCode}`,
    "",
    "Signature",
    `Signature ID: ${signature.id.toString()}`,
    `Signer: ${signature.signerName}`,
    `Relationship: ${signature.signerRelationship ?? ""}`,
    `Type: ${signature.signatureType}`,
    `Capture method: ${signature.captureMethod}`,
    `Signed at: ${signature.signedAt.toISOString()}`,
    `Signature evidence hash: ${signature.signatureHash}`,
  );

  return lines.flatMap((line) => (line.length > 92 ? wrap(line) : [line]));
}

function writeInvoicePdf(doc: PDFKit.PDFDocument, lines: string[]) {
  doc.font("Helvetica-Bold").fontSize(13).text(lines[0] ?? "", {
    lineGap: 2,
  });
  doc.moveDown(0.35);
  doc.font("Helvetica").fontSize(9);

  for (const line of lines.slice(1)) {
    if (doc.y > doc.page.height - doc.page.margins.bottom - 12) {
      doc.addPage();
      doc.font("Helvetica").fontSize(9);
    }

    if (line.length === 0) {
      doc.moveDown(0.45);
      continue;
    }

    if (
      [
        "Patient snapshot",
        "Lines",
        "Signature",
      ].includes(line)
    ) {
      doc.font("Helvetica-Bold").text(line, { lineGap: 2 });
      doc.font("Helvetica");
      continue;
    }

    doc.text(line, { lineGap: 2 });
  }
}

export function generateInvoicePdfBytes(input: {
  invoice: InvoiceRecord;
  version: InvoiceVersionRecord;
  contentHash: string;
  signature: SignatureForPdf;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let settled = false;

    const fail = (error: Error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    };

    const doc = new PDFDocument({
      autoFirstPage: true,
      bufferPages: false,
      compress: false,
      margin: 50,
      pdfVersion: "1.4",
      size: "A4",
      info: {
        Title: "ODONTHO SERVICES B.V. SVB Invoice Document",
        Author: "ODONTHO SERVICES B.V.",
        Subject: "Technical invoice PDF",
      },
    });

    doc.on("data", (chunk: Buffer | Uint8Array) => {
      chunks.push(Buffer.from(chunk));
    });
    doc.on("error", fail);
    doc.on("end", () => {
      if (!settled) {
        settled = true;
        resolve(Buffer.concat(chunks));
      }
    });

    try {
      writeInvoicePdf(doc, buildLines(input));
      doc.end();
    } catch (error) {
      fail(error instanceof Error ? error : new Error(String(error)));
    }
  });
}
