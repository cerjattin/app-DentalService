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
