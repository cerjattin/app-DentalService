import { z } from "zod";

const bigintId = z.string().trim().regex(/^[1-9]\d*$/);
const hash = z.string().trim().regex(/^[a-f0-9]{64}$/);
const metadataValue = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const metadata = z.record(z.string(), metadataValue).nullable().optional();

export const captureSignatureSchema = z
  .object({
    signatureDocumentId: bigintId,
    signatureType: z.enum([
      "PATIENT",
      "LEGAL_REPRESENTATIVE",
      "GUARDIAN",
      "OTHER",
    ]),
    captureMethod: z.enum([
      "SIGNATURE_PAD",
      "TOUCHSCREEN",
      "MOUSE",
      "UPLOADED",
      "OTHER",
    ]),
    expectedContentHash: hash,
    signerName: z.string().trim().min(1).max(255).optional(),
    signerRelationship: z.string().trim().min(1).max(120).optional(),
    deviceIdentifier: z.string().trim().min(1).max(255).optional(),
    metadata,
  })
  .superRefine((value, ctx) => {
    if (
      value.signatureType !== "PATIENT" &&
      value.signerName === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["signerName"],
        message: "signerName is required for non-patient signatures",
      });
    }

    if (
      ["LEGAL_REPRESENTATIVE", "GUARDIAN"].includes(value.signatureType) &&
      value.signerRelationship === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["signerRelationship"],
        message:
          "signerRelationship is required for legal representative or guardian signatures",
      });
    }
  });

export const voidSignatureSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

export type CaptureSignatureInput = z.infer<typeof captureSignatureSchema>;
export type VoidSignatureInput = z.infer<typeof voidSignatureSchema>;
