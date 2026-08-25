import { z } from "zod";

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();

export const createInsuranceSchema = z.object({
  payerId: z.string().trim().regex(/^[1-9]\d*$/),

  insuredId: z.string().trim().min(1).max(80),

  validFrom: dateOnlySchema.optional(),

  validTo: dateOnlySchema.optional(),

  status: z
    .enum(["ACTIVE", "INACTIVE", "EXPIRED", "SUSPENDED"])
    .optional(),

  isPrimary: z.boolean().optional(),
});

export const updateInsuranceSchema = createInsuranceSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export const verifyInsuranceSchema = z.object({
  verificationSource: z.string().trim().min(1).max(80),
});

export type CreateInsuranceInput = z.infer<typeof createInsuranceSchema>;

export type UpdateInsuranceInput = z.infer<typeof updateInsuranceSchema>;

export type VerifyInsuranceInput = z.infer<typeof verifyInsuranceSchema>;
