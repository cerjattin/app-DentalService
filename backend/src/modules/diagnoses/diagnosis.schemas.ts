import { z } from "zod";

const bigintId = z.string().trim().regex(/^[1-9]\d*$/);

const optionalText = (max: number) =>
  z.string().trim().max(max).nullable().optional();

export const listDiagnosisCodesQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),

  codeSystem: z.string().trim().max(50).optional(),

  isActive: z.coerce.boolean().optional(),

  page: z.coerce.number().int().positive().default(1),

  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const createEncounterDiagnosisSchema = z.object({
  diagnosisCodeId: bigintId,

  isPrimary: z.boolean().default(false),

  notes: optionalText(65_535),
});

export const updateEncounterDiagnosisSchema = z
  .object({
    isPrimary: z.boolean().optional(),

    notes: optionalText(65_535),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export type ListDiagnosisCodesQuery = z.infer<
  typeof listDiagnosisCodesQuerySchema
>;

export type CreateEncounterDiagnosisInput = z.infer<
  typeof createEncounterDiagnosisSchema
>;

export type UpdateEncounterDiagnosisInput = z.infer<
  typeof updateEncounterDiagnosisSchema
>;
