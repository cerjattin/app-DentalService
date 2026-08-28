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

export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>;
export type CancelInvoiceInput = z.infer<typeof cancelInvoiceSchema>;
