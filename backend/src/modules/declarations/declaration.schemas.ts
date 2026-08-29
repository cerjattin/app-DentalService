import { z } from "zod";

const dateOnly = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/);

const bigintId = z.string().trim().regex(/^[1-9]\d*$/);

const booleanQuery = z.preprocess((value) => {
  if (value === "true" || value === true) {
    return true;
  }

  if (value === "false" || value === false) {
    return false;
  }

  return value;
}, z.boolean());

export const listDeclarationsQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  payerId: bigintId.optional(),
  status: z
    .enum([
      "DRAFT",
      "READY",
      "EXPORTED",
      "SUBMITTED",
      "ACCEPTED",
      "PARTIALLY_REJECTED",
      "REJECTED",
      "CANCELLED",
    ])
    .optional(),
  periodStart: dateOnly.optional(),
  periodEnd: dateOnly.optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const createDeclarationSchema = z.object({
  payerId: bigintId,
  periodStart: dateOnly.nullable().optional(),
  periodEnd: dateOnly.nullable().optional(),
  declarantIdSnapshot: z.string().trim().max(64).nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
});

export const addDeclarationItemSchema = z.object({
  invoiceItemId: bigintId,
});

export const createDeclarationExportSchema = z.object({
  format: z
    .string()
    .trim()
    .toUpperCase()
    .pipe(z.enum(["CSV", "TXT", "JSON", "XML", "XLSX", "API_PAYLOAD"])),
});

export const declarationSubmissionResultSchema = z.object({
  status: z.enum(["ACCEPTED", "PARTIALLY_REJECTED", "REJECTED"]),
  externalReference: z.string().trim().max(120).nullable().optional(),
  responseMetadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export type ListDeclarationsQuery = z.infer<typeof listDeclarationsQuerySchema>;
export type CreateDeclarationInput = z.infer<typeof createDeclarationSchema>;
export type AddDeclarationItemInput = z.infer<typeof addDeclarationItemSchema>;
export type CreateDeclarationExportInput = z.infer<
  typeof createDeclarationExportSchema
>;
export type DeclarationSubmissionResultInput = z.infer<
  typeof declarationSubmissionResultSchema
>;

export { booleanQuery };
