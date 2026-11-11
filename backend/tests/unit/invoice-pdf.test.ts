import { createHash } from "node:crypto";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { Prisma } from "../../src/generated/prisma/client.js";
import {
  generateInvoicePdfBytes,
  signatureImageForPdf,
  INVOICE_PDF_LAYOUT,
  INVOICE_PDF_LAYOUT_SUFFIX,
} from "../../src/modules/documents/invoice-pdf.generator.js";

const decimal = (value: string) => new Prisma.Decimal(value);
const signature = {
  id: 4n,
  signerName: "José QA",
  signerRelationship: null,
  signatureType: "PATIENT",
  captureMethod: "MOUSE",
  signedAt: new Date("2026-10-31T00:00:00Z"),
  signatureHash: "a".repeat(64),
};
const item = {
  id: 3n,
  detailInvoiceNumber: "QA-000002-01",
  serviceDateSnapshot: new Date("2026-10-30Z"),
  procedureCodeSnapshot: "QA-PROC",
  procedureDescriptionSnapshot: "Frozen description",
  authorizationIdSnapshot: "QA-AUTH",
  quantity: decimal("2.00"),
  assistanceSnapshot: "J",
  policlinicSnapshot: "P",
  currencyCodeSnapshot: "ANG",
  amount: decimal("177.60"),
  additionalNote: "QA note",
  accidentFormNumberSnapshot: "QA-OMF",
  diagnosticCodeSnapshot: "QA-DX",
  referrerIdSnapshot: "QA-REF",
  providerIdSnapshot: "QA-PROVIDER",
};
async function fixture(count = 1) {
  const signatureImage = await sharp(
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="80"><rect width="320" height="80" fill="white"/><path d="M10 50 L80 10 L110 60 L200 20" fill="none" stroke="black" stroke-width="3"/></svg>',
    ),
  )
    .png()
    .toBuffer();
  return {
    invoice: { invoiceNumber: "QA-000002" },
    version: {
      patientNameSnapshot: "José QA",
      insuredIdSnapshot: "QA-CARD",
      invoiceDate: new Date("2026-10-30Z"),
      currencyCode: "ANG",
      totalAmount: decimal("177.60"),
      versionNumber: 1,
      items: Array.from({ length: count }, (_, i) => ({
        ...item,
        id: BigInt(i + 3),
        detailInvoiceNumber: `QA-000002-${i + 1}`,
      })),
    },
    signature,
    contentHash: "b".repeat(64),
    signatureImage,
  };
}
const pdfText = (bytes: Buffer) =>
  [...bytes.toString("latin1").matchAll(/\[([^\]]*)\]\s*TJ/g)]
    .map((operation) =>
      [...operation[1]!.matchAll(/<([a-f0-9]+)>/gi)]
        .map((match) => Buffer.from(match[1]!, "hex").toString("latin1"))
        .join(""),
    )
    .join("\n");

describe("SVB invoice form from frozen snapshots", () => {
  it.each(["PATIENT", "GUARDIAN"])(
    "places the saved %s trace above Paraaf on every page with a distinct layout key",
    async (signatureType) => {
      const input = await fixture(6);
      input.signature.signatureType = signatureType;
      const bytes = await generateInvoicePdfBytes(input);
      const raw = bytes.toString("latin1");
      const pageCount = raw.match(/\/Type \/Page\b/g)!.length;
      const images = [...raw.matchAll(/([\d.]+) 0 0 (-[\d.]+) ([\d.]+) ([\d.]+) cm\s*\/I\d+ Do/g)]
        .filter((image) => Math.abs(Number(image[2])) < 100);
      expect(pageCount).toBeGreaterThan(1);
      expect(images).toHaveLength(pageCount);
      for (const image of images) {
        const [width, negativeHeight, x, bottom] = image.slice(1).map(Number);
        expect(x).toBeGreaterThanOrEqual(402);
        expect(x! + width!).toBeLessThanOrEqual(572);
        expect(bottom! + negativeHeight!).toBeGreaterThanOrEqual(695);
        expect(bottom).toBeLessThanOrEqual(733);
      }
      expect(pdfText(bytes)).toContain("Paraaf:");
      expect(pdfText(bytes)).toContain(
        signatureType === "PATIENT" ? "Handtekening pati" : "Handtekening vertegenwoordiger",
      );
      expect(INVOICE_PDF_LAYOUT).toBe("svb_notaform_v2");
      expect(INVOICE_PDF_LAYOUT_SUFFIX).toBe("svb-nota-v2");
    },
  );
  it("uses letter-sized form, exact amounts/quantity, saved signature image and snapshot fields", async () => {
    const bytes = await generateInvoicePdfBytes(await fixture());
    const raw = bytes.toString("latin1");
    expect(raw).toContain("/MediaBox [0 0 612 792]");
    expect(raw.match(/\/Subtype \/Image/g)?.length).toBeGreaterThanOrEqual(2);
    const text = pdfText(bytes);
    for (const value of [
      "QA-CARD",
      "QA-PROC",
      "Frozen description",
      "2.00",
      "ANG 177.60",
      "QA-OMF",
      "QA-DX",
      "QA-REF",
      "QA-PROVIDER",
      "Handtekening",
    ])
      expect(text).toContain(value);
    expect(text).toContain("2026-10-30 20:00");
  });
  it("paginates long snapshots without discarding their ending or signature", async () => {
    const input = await fixture(6);
    input.version.items[0]!.procedureDescriptionSnapshot =
      "long snapshot ".repeat(90) + "END-OF-SNAPSHOT";
    const bytes = await generateInvoicePdfBytes(input);
    expect(
      bytes.toString("latin1").match(/\/Type \/Page\b/g)?.length,
    ).toBeGreaterThan(1);
    expect(pdfText(bytes)).toContain("END-OF-SNAPSHOT");
    expect(pdfText(bytes)).toContain("QA-000002-6");
  });
  it("keeps different diagnosis/referrer contexts on separate forms", async () => {
    const input = await fixture(2);
    input.version.items[1]!.diagnosticCodeSnapshot = "OTHER-DX";
    const bytes = await generateInvoicePdfBytes(input);
    expect(bytes.toString("latin1").match(/\/Type \/Page\b/g)).toHaveLength(2);
    expect(pdfText(bytes)).toContain("OTHER-DX");
  });
  it.each(["png", "jpeg", "webp"] as const)(
    "embeds readable %s signature evidence after verifying original bytes",
    async (format) => {
      const bytes = await sharp((await fixture()).signatureImage)
        .toFormat(format)
        .toBuffer();
      const normalized = await signatureImageForPdf(
        bytes,
        `image/${format}`,
        createHash("sha256").update(bytes).digest("hex"),
      );
      expect((await sharp(normalized).metadata()).format).toBe("png");
    },
  );
  it("rejects corrupt, mismatched MIME or tampered evidence instead of rendering an unsigned form", async () => {
    const bytes = (await fixture()).signatureImage;
    const hash = createHash("sha256").update(bytes).digest("hex");
    await expect(
      signatureImageForPdf(bytes, "image/png", "0".repeat(64)),
    ).rejects.toMatchObject({ code: "SIGNATURE_EVIDENCE_INVALID" });
    await expect(
      signatureImageForPdf(bytes, "image/webp", hash),
    ).rejects.toMatchObject({ code: "SIGNATURE_EVIDENCE_INVALID" });
    const invalid = Buffer.from("not an image");
    await expect(
      signatureImageForPdf(
        invalid,
        "image/png",
        createHash("sha256").update(invalid).digest("hex"),
      ),
    ).rejects.toMatchObject({ code: "SIGNATURE_EVIDENCE_INVALID" });
  });
});
