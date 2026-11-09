import { z } from "zod";

const bigintId = z.string().trim().regex(/^[1-9]\d*$/);

const decimalQuantity = z
  .string()
  .trim()
  .regex(/^(0|[1-9]\d*)(\.\d{1,2})?$/);

const optionalText = (max: number) =>
  z.string().trim().max(max).nullable().optional();

export const createEncounterProcedureSchema = z.strictObject({
  patientInsuranceId: bigintId,

  svbProcedureId: bigintId,

  authorizationItemId: bigintId.nullable().optional(),

  diagnosisId: bigintId.nullable().optional(),

  quantity: decimalQuantity.default("1.00"),

  additionalNote: optionalText(65_535),
});

export const updateEncounterProcedureSchema = z
  .strictObject({
    diagnosisId: bigintId.nullable().optional(),

    additionalNote: optionalText(65_535),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export type CreateEncounterProcedureInput = z.infer<
  typeof createEncounterProcedureSchema
>;
export const recordPerformedServiceSchema = z.strictObject({
  svbProcedureId: bigintId,
  quantity: z.string().trim().regex(/^(0|[1-9]\d{0,7})(\.\d{1,2})?$/).default("1.00"),
});
export type RecordPerformedServiceInput = z.infer<typeof recordPerformedServiceSchema>;

export const captureEncounterProcedureSchema = z.union([
  createEncounterProcedureSchema,
  recordPerformedServiceSchema,
]);

export type UpdateEncounterProcedureInput = z.infer<
  typeof updateEncounterProcedureSchema
>;
