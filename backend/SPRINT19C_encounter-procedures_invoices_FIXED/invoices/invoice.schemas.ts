import { z } from "zod";

const bigintId = z.string().trim().regex(/^[1-9]\d*$/);

export const listInvoicesQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z
    .enum([
      "DRAFT",
      "PENDING_SIGNATURE",
      "SIGNED",
      "CLOSED",
      "DECLARED",
      "CORRECTION_REQUIRED",
      "CANCELLED",
    ])
    .optional(),
  patientId: bigintId.optional(),
  appointmentId: bigintId.optional(),
  patientInsuranceId: bigintId.optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const cancelInvoiceSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

export const requestInvoiceCorrectionSchema = z.object({
  reasonCode: z.string().trim().min(1).max(50),
  reasonText: z.string().trim().min(1).max(2_000),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const resolveInvoiceCorrectionSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
});

const nullableString = z.string().trim().min(1).max(500).nullable();
const decimalString = z.string().trim().regex(/^\d{1,13}(\.\d{1,2})?$/);

export const updateCorrectionInvoiceItemSchema = z
  .object({
    detailInvoiceNumber: z.string().trim().min(1).max(100).optional(),
    serviceDateSnapshot: z.string().date().optional(),
    procedureCodeSnapshot: z.string().trim().min(1).max(50).optional(),
    procedureDescriptionSnapshot: z.string().trim().min(1).max(500).optional(),
    providerIdSnapshot: z.string().trim().min(1).max(64).optional(),
    insuredIdSnapshot: z.string().trim().min(1).max(80).optional(),
    unitTariffSnapshot: decimalString.optional(),
    currencyCodeSnapshot: z.string().trim().length(3).toUpperCase().optional(),
    quantity: decimalString.optional(),
    authorizationIdSnapshot: z.string().trim().min(1).max(80).nullable().optional(),
    diagnosticCodeSnapshot: z.string().trim().min(1).max(50).nullable().optional(),
    treatmentIdSnapshot: z.string().trim().min(1).max(80).nullable().optional(),
    accidentFormNumberSnapshot: z.string().trim().min(1).max(80).nullable().optional(),
    numberOfTreatmentsSnapshot: z.coerce.number().int().positive().nullable().optional(),
    assistanceSnapshot: z.string().trim().min(1).max(100).nullable().optional(),
    referrerIdSnapshot: z.string().trim().min(1).max(64).nullable().optional(),
    policlinicSnapshot: z.string().trim().min(1).max(64).nullable().optional(),
    additionalNote: nullableString.optional(),
  })
  .strict();

export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>;
export type CancelInvoiceInput = z.infer<typeof cancelInvoiceSchema>;
export type RequestInvoiceCorrectionInput = z.infer<
  typeof requestInvoiceCorrectionSchema
>;
export type ResolveInvoiceCorrectionInput = z.infer<
  typeof resolveInvoiceCorrectionSchema
>;
export type UpdateCorrectionInvoiceItemInput = z.infer<
  typeof updateCorrectionInvoiceItemSchema
>;
