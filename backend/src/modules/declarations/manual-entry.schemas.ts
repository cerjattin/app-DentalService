import { z } from "zod";
const id = z.string().regex(/^[1-9]\d*$/);
const key = z.string().regex(/^[A-Za-z0-9._:-]{16,128}$/);
const reason = z.string().trim().min(1).max(500);
const reference = z.string().trim().min(1).max(120).nullable();
const timestamp = z.string().datetime({ offset: true });
export const prepareManualEntrySchema = z.strictObject({ idempotencyKey: key });
export const uncertainManualEntrySchema = z.strictObject({ reason });
export const releaseManualEntrySchema = z.strictObject({
  reason,
  confirmation: z.literal("NOT_PRESENTED_VERIFIED"),
  resolutionDocumentId: id.optional(),
});
export const recordManualSubmissionSchema = z
  .strictObject({
    manualEntryId: id,
    expectedContentHash: z.string().regex(/^[a-f0-9]{64}$/),
    externalReference: reference,
    submittedAt: timestamp,
    receiptDocumentId: id,
    idempotencyKey: key,
    confirmation: z.literal("ALREADY_ENTERED_IN_OFFICIAL_PORTAL"),
    reason: reason.optional(),
  })
  .refine((v) => v.externalReference !== null || v.reason !== undefined, {
    message: "A reason is required when the portal supplied no reference",
    path: ["reason"],
  });
export const recordManualResultSchema = z
  .strictObject({
    status: z.enum(["ACCEPTED", "PARTIALLY_REJECTED", "REJECTED"]),
    externalReference: reference,
    respondedAt: timestamp,
    resultDocumentId: id,
    idempotencyKey: key,
    reason: reason.optional(),
    lines: z
      .array(
        z.strictObject({
          declarationItemId: id,
          status: z.enum(["ACCEPTED", "REJECTED"]),
          responseCode: z.string().trim().min(1).max(80).nullable().optional(),
          responseMessage: z
            .string()
            .trim()
            .min(1)
            .max(1000)
            .nullable()
            .optional(),
        }),
      )
      .min(1)
      .max(10000),
  })
  .refine((v) => v.externalReference !== null || v.reason !== undefined, {
    message: "A reason is required when the response supplied no reference",
    path: ["reason"],
  });
export type PrepareManualEntryInput = z.infer<typeof prepareManualEntrySchema>;
export type ReleaseManualEntryInput = z.infer<typeof releaseManualEntrySchema>;
export type RecordManualSubmissionInput = z.infer<
  typeof recordManualSubmissionSchema
>;
export type RecordManualResultInput = z.infer<typeof recordManualResultSchema>;
