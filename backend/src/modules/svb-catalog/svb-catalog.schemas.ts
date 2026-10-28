import { z } from "zod";

const dateOnly = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/);

const booleanQuery = z.preprocess((value) => {
  if (value === "true" || value === true) {
    return true;
  }

  if (value === "false" || value === false) {
    return false;
  }

  return value;
}, z.boolean());

const currencyCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/);

export const listSvbProceduresQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),

  category: z.string().trim().max(120).optional(),

  requiresAuthorization: booleanQuery.optional(),

  requiresReferral: booleanQuery.optional(),

  isActive: booleanQuery.optional(),

  serviceDate: dateOnly.optional(),

  page: z.coerce.number().int().positive().default(1),

  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const listSvbTariffsQuerySchema = z.object({
  currencyCode: currencyCode.optional(),

  isActive: booleanQuery.optional(),

  serviceDate: dateOnly.optional(),

  page: z.coerce.number().int().positive().default(1),

  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const applicableTariffQuerySchema = z.object({
  serviceDate: dateOnly,

  currencyCode,
});

export type ListSvbProceduresQuery = z.infer<
  typeof listSvbProceduresQuerySchema
>;

export type ListSvbTariffsQuery = z.infer<typeof listSvbTariffsQuerySchema>;

export type ApplicableTariffQuery = z.infer<typeof applicableTariffQuerySchema>;

// Business dates remain strings until the service validates calendar dates.
export const createSvbProcedureSchema = z.strictObject({
  code: z.string().trim().min(1).max(50),
  description: z.string().trim().min(1).max(500),
  category: z.string().trim().max(120).nullable().optional(),
  unit: z.string().trim().max(50).nullable().optional(),
  requiresAuthorization: z.boolean().optional(),
  requiresReferral: z.boolean().optional(),
  isActive: z.boolean().optional(),
  validFrom: dateOnly.nullable().optional(),
  validTo: dateOnly.nullable().optional(),
});

export const updateSvbProcedureSchema = createSvbProcedureSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export const svbProcedureStatusSchema = z.strictObject({
  isActive: z.boolean(),
});

export const createSvbTariffSchema = z.strictObject({
  // Decimal(15,2): no exponent, sign, JS float, or excess precision.
  amount: z.string().regex(/^\d{1,13}(\.\d{1,2})?$/),
  currencyCode,
  validFrom: dateOnly,
  validTo: dateOnly.nullable().optional(),
  isActive: z.boolean().optional(),
});

export const updateSvbTariffSchema = createSvbTariffSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export type CreateSvbProcedureInput = z.infer<typeof createSvbProcedureSchema>;
export type UpdateSvbProcedureInput = z.infer<typeof updateSvbProcedureSchema>;
export type CreateSvbTariffInput = z.infer<typeof createSvbTariffSchema>;
export type UpdateSvbTariffInput = z.infer<typeof updateSvbTariffSchema>;
