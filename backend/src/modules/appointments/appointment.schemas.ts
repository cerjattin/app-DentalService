import { z } from "zod";

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

const optionalText = (max: number) =>
  z.string().trim().max(max).nullable().optional();

const optionalBigIntId = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/)
  .nullable()
  .optional();

export const appointmentStatusSchema = z.enum([
  "SCHEDULED",
  "CONFIRMED",
  "CHECKED_IN",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
]);

export const createAppointmentSchema = z.object({
  clinicLocationId: z.string().trim().regex(/^[1-9]\d*$/),

  patientId: z.string().trim().regex(/^[1-9]\d*$/),

  providerId: z.string().trim().regex(/^[1-9]\d*$/),

  treatmentCaseId: optionalBigIntId,

  accidentCaseId: optionalBigIntId,

  scheduledStart: timestampWithTimezone,

  scheduledEnd: timestampWithTimezone,

  reason: optionalText(255),

  notes: optionalText(65_535),
});

export const updateAppointmentSchema = createAppointmentSchema
  .pick({
    clinicLocationId: true,
    providerId: true,
    treatmentCaseId: true,
    accidentCaseId: true,
    scheduledStart: true,
    scheduledEnd: true,
    reason: true,
    notes: true,
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export const updateAppointmentStatusSchema = z.object({
  status: appointmentStatusSchema,

  reason: z.string().trim().min(3).max(500).optional(),
});

export const listAppointmentsQuerySchema = z.object({
  date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),

  from: timestampWithTimezone.optional(),

  to: timestampWithTimezone.optional(),

  patientId: z.string().trim().regex(/^[1-9]\d*$/).optional(),

  providerId: z.string().trim().regex(/^[1-9]\d*$/).optional(),

  clinicLocationId: z.string().trim().regex(/^[1-9]\d*$/).optional(),

  status: appointmentStatusSchema.optional(),

  q: z.string().trim().max(120).optional(),

  page: z.coerce.number().int().positive().default(1),

  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;

export type UpdateAppointmentStatusInput = z.infer<
  typeof updateAppointmentStatusSchema
>;

export type ListAppointmentsQuery = z.infer<typeof listAppointmentsQuerySchema>;
