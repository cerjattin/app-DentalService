import { z } from "zod";

const optionalText = (max: number) =>
  z.string().trim().max(max).nullable().optional();

const bigintId = z.string().trim().regex(/^[1-9]\d*$/);

const timestampWithTimezone = z
  .string()
  .trim()
  .refine(
    (value) =>
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
        value,
      ) && !Number.isNaN(new Date(value).getTime()),
    {
      message: "Expected an ISO timestamp with timezone offset",
    },
  );

export const clinicalEncounterStatusSchema = z.enum([
  "OPEN",
  "COMPLETED",
  "VOID",
]);

export const createClinicalEncounterSchema = z.object({
  chiefComplaint: optionalText(65_535),

  clinicalNotes: optionalText(65_535),
});

export const updateClinicalEncounterSchema = createClinicalEncounterSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export const listClinicalEncountersQuerySchema = z.object({
  status: clinicalEncounterStatusSchema.optional(),

  providerId: bigintId.optional(),

  patientId: bigintId.optional(),

  appointmentId: bigintId.optional(),

  date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),

  from: timestampWithTimezone.optional(),

  to: timestampWithTimezone.optional(),

  q: z.string().trim().max(120).optional(),

  page: z.coerce.number().int().positive().default(1),

  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export type CreateClinicalEncounterInput = z.infer<
  typeof createClinicalEncounterSchema
>;

export type UpdateClinicalEncounterInput = z.infer<
  typeof updateClinicalEncounterSchema
>;

export type ListClinicalEncountersQuery = z.infer<
  typeof listClinicalEncountersQuerySchema
>;
