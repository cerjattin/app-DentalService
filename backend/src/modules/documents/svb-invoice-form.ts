import PDFDocument from "pdfkit";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { DateTime } from "luxon";
import { AppError } from "../../shared/errors/app-error.js";
import type {
  InvoiceRecord,
  InvoiceVersionRecord,
} from "../invoices/invoice.repository.js";

export const INVOICE_PDF_LAYOUT = "svb_notaform_v1";
export const INVOICE_PDF_LAYOUT_SUFFIX = "svb-nota-v1";
interface SignatureForPdf {
  id: bigint;
  signerName: string;
  signerRelationship: string | null;
  signatureType: string;
  captureMethod: string;
  signedAt: Date;
  signatureHash: string;
}
interface InvoicePdfInput {
  invoice: Pick<InvoiceRecord, "invoiceNumber">;
  version: Pick<
    InvoiceVersionRecord,
    | "patientNameSnapshot"
    | "insuredIdSnapshot"
    | "invoiceDate"
    | "currencyCode"
    | "totalAmount"
    | "versionNumber"
  > & { items: Item[] };
  contentHash: string;
  signature: SignatureForPdf;
  signatureImage: Buffer;
}
type Item = Pick<
  InvoiceVersionRecord["items"][number],
  | "id"
  | "detailInvoiceNumber"
  | "serviceDateSnapshot"
  | "procedureCodeSnapshot"
  | "procedureDescriptionSnapshot"
  | "authorizationIdSnapshot"
  | "quantity"
  | "assistanceSnapshot"
  | "policlinicSnapshot"
  | "currencyCodeSnapshot"
  | "amount"
  | "additionalNote"
  | "accidentFormNumberSnapshot"
  | "diagnosticCodeSnapshot"
  | "referrerIdSnapshot"
  | "providerIdSnapshot"
>;
type FormRow = { item: Item; cells: string[][] };
const COLUMNS = [
  31.68, 76.82, 148.82, 261.29, 310.85, 355.87, 396.31, 445.87, 490.9, 575.86,
];
const ROW_TOP = 286.01;
const ROW_HEIGHT = 24.72;
const ROWS_PER_PAGE = 14;
const FONT_SIZE = 7;
const dateOnly = (value: Date | null) =>
  value?.toISOString().slice(0, 10) ?? "";
const text = (value: string | null | undefined) =>
  (value ?? "").normalize("NFC").replace(/[\u0000-\u001f]/g, " ");
const distinct = (values: Array<string | null>) => [
  ...new Set(values.filter((value): value is string => Boolean(value))),
];

/** PDFKit embeds PNG/JPEG; preserve support for all three accepted capture formats. */
export async function signatureImageForPdf(
  bytes: Buffer,
  mimeType: string,
  expectedHash: string,
): Promise<Buffer> {
  try {
    if (createHash("sha256").update(bytes).digest("hex") !== expectedHash)
      throw new Error("Signature hash mismatch");
    const image = sharp(bytes);
    const metadata = await image.metadata();
    const formats: Record<string, string> = {
      png: "image/png",
      jpeg: "image/jpeg",
      webp: "image/webp",
    };
    if (formats[metadata.format ?? ""] !== mimeType)
      throw new Error("Unsupported signature image");
    return await image.autoOrient().png().toBuffer();
  } catch {
    throw new AppError(
      409,
      "SIGNATURE_EVIDENCE_INVALID",
      "Signature evidence is not a readable image",
    );
  }
}

function wrapCell(doc: PDFKit.PDFDocument, value: string, width: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text(value).split(/\s+/).filter(Boolean)) {
    if (line && doc.widthOfString(`${line} ${word}`) <= width) {
      line += ` ${word}`;
      continue;
    }
    if (line) lines.push(line);
    line = "";
    for (const character of word) {
      if (line && doc.widthOfString(line + character) > width) {
        lines.push(line);
        line = "";
      }
      line += character;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function itemRows(doc: PDFKit.PDFDocument, item: Item): FormRow[] {
  const values = [
    dateOnly(item.serviceDateSnapshot),
    item.procedureCodeSnapshot,
    item.procedureDescriptionSnapshot,
    item.authorizationIdSnapshot ?? "",
    item.quantity.toFixed(2),
    item.assistanceSnapshot ?? "",
    item.policlinicSnapshot ?? "",
    `${item.currencyCodeSnapshot} ${item.amount.toFixed(2)}`,
    [item.detailInvoiceNumber, item.additionalNote].filter(Boolean).join(" / "),
  ];
  const lines = values.map((value, column) =>
    wrapCell(doc, value, COLUMNS[column + 1]! - COLUMNS[column]! - 6),
  );
  const count = Math.max(1, ...lines.map((cell) => Math.ceil(cell.length / 2)));
  return Array.from({ length: count }, (_, row) => ({
    item,
    cells: lines.map((cell) => cell.slice(row * 2, row * 2 + 2)),
  }));
}
const contextKey = (item: Item) =>
  JSON.stringify([
    item.accidentFormNumberSnapshot,
    item.diagnosticCodeSnapshot,
    item.referrerIdSnapshot,
  ]);

function paginate(doc: PDFKit.PDFDocument, items: Item[]) {
  const pages: FormRow[][] = [];
  let rows: FormRow[] = [];
  for (const item of items) {
    const chunks = itemRows(doc, item);
    // Preserve the header context and keep its detail numbers readable on two lines.
    if (
      rows.length &&
      (contextKey(rows[0]!.item) !== contextKey(item) ||
        distinct(rows.map((row) => row.item.id.toString())).length >= 4 ||
        rows.length + chunks.length > ROWS_PER_PAGE)
    ) {
      pages.push(rows);
      rows = [];
    }
    for (const row of chunks) {
      if (rows.length === ROWS_PER_PAGE) {
        pages.push(rows);
        rows = [];
      }
      rows.push(row);
    }
  }
  if (rows.length) pages.push(rows);
  return pages.length ? pages : [[]];
}

function field(
  doc: PDFKit.PDFDocument,
  value: string,
  x: number,
  y: number,
  width: number,
  size = 11,
  height = 18,
) {
  if (!value) return;
  doc.save().rect(x, y, width, height).fill("white").restore();
  doc.font("Helvetica").fillColor("#10243b").fontSize(size);
  let fontSize = size;
  while (
    doc.heightOfString(value, { width: width - 3, lineGap: 0 }) > height &&
    fontSize > 6
  )
    doc.fontSize(--fontSize);
  doc.text(text(value), x + 1, y + 1, { width: width - 3, height, lineGap: 0 });
}

function writeForm(
  doc: PDFKit.PDFDocument,
  input: InvoicePdfInput,
  rows: FormRow[],
  page: number,
  pageCount: number,
) {
  const { invoice, version, signature } = input;
  doc.image(path.resolve("assets/invoice/svb-notaform-v1.png"), 0, 0, {
    width: 612,
    height: 792,
  });
  const first = rows[0]?.item;
  field(doc, version.patientNameSnapshot, 186, 72, 224);
  field(doc, version.insuredIdSnapshot, 186, 96, 224);
  field(
    doc,
    distinct(rows.map((row) => row.item.detailInvoiceNumber)).join(", "),
    186,
    120,
    224,
    9,
    22,
  );
  field(doc, first?.accidentFormNumberSnapshot ?? "", 186, 145, 224);
  field(doc, first?.diagnosticCodeSnapshot ?? "", 186, 169, 224);
  field(doc, first?.referrerIdSnapshot ?? "", 219, 193, 191);
  doc.font("Helvetica").fontSize(FONT_SIZE).fillColor("#10243b");
  rows.forEach((row, index) =>
    row.cells.forEach((lines, column) =>
      lines.forEach((line, offset) => {
        doc.text(
          line,
          COLUMNS[column]! + 3,
          ROW_TOP + index * ROW_HEIGHT + 4 + offset * 9,
          {
            width: COLUMNS[column + 1]! - COLUMNS[column]! - 6,
            lineBreak: false,
          },
        );
      }),
    ),
  );
  field(
    doc,
    `${version.currencyCode} ${version.totalAmount.toFixed(2)}`,
    400,
    655,
    174,
    12,
  );
  // No professional/referrer name is frozen in the model; never substitute live master data.
  field(
    doc,
    distinct(rows.map((row) => row.item.providerIdSnapshot)).join(", "),
    400,
    675,
    174,
    9,
  );
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor("#10243b")
    .text(
      signature.signatureType === "PATIENT"
        ? "Handtekening patiënt"
        : "Handtekening vertegenwoordiger",
      32,
      650,
      { width: 180 },
    );
  doc.image(input.signatureImage, 32, 663, {
    fit: [175, 43],
    valign: "center",
  });
  doc
    .font("Helvetica")
    .fontSize(7)
    .text(text(signature.signerName), 32, 709, { width: 180 });
  const signedAt = DateTime.fromJSDate(signature.signedAt, {
    zone: "America/Curacao",
  }).toFormat("yyyy-MM-dd HH:mm");
  doc
    .fontSize(6)
    .text(`${signedAt} (America/Curacao)`, 32, 721, { width: 210 });
  doc
    .fontSize(7)
    .text(
      `Factuur ${invoice.invoiceNumber ?? ""} | v${version.versionNumber} | ${dateOnly(version.invoiceDate)} | Pagina ${page}/${pageCount}`,
      32,
      747,
      { width: 544 },
    );
}

export function generateInvoicePdfBytes(
  input: InvoicePdfInput,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      autoFirstPage: false,
      compress: false,
      margin: 0,
      pdfVersion: "1.4",
      size: "LETTER",
      info: {
        Title: `${input.invoice.invoiceNumber ?? ""} - SVB Notaformulier`,
        Author: "ODONTHO SERVICES B.V.",
        Subject: "Invoice from immutable signed snapshots",
        Keywords: `${INVOICE_PDF_LAYOUT}; contentHash=${input.contentHash}; signatureHash=${input.signature.signatureHash}`,
      },
    });
    doc.on("data", (chunk: Buffer | Uint8Array) =>
      chunks.push(Buffer.from(chunk)),
    );
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    try {
      doc.font("Helvetica").fontSize(FONT_SIZE);
      const pages = paginate(doc, input.version.items);
      pages.forEach((rows, index) => {
        doc.addPage();
        writeForm(doc, input, rows, index + 1, pages.length);
      });
      doc.end();
    } catch (error) {
      reject(error);
      doc.destroy();
    }
  });
}
