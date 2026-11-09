import { z } from "zod";
import { createPatientSchema } from "../patients/patient.schemas.js";
export const localId = z.string().regex(/^[1-9]\d*$/);
export const externalId = z
  .string()
  .min(1)
  .max(255)
  .refine(
    (s) => s === s.trim() && !/[\u0000-\u001f\u007f]/.test(s),
    "Use an exact external identifier without control characters",
  );
const key = z.string().regex(/^[A-Za-z0-9._:-]{16,120}$/);
export const offsetTime = z.string().datetime({ offset: true });
export const accountSchema = z.strictObject({
  externalAccountId: externalId,
  label: z.string().trim().min(1).max(120),
});
export const accountUpdateSchema = z.strictObject({ enabled: z.boolean() });
export const mappingSchema = z.strictObject({
  kind: z.enum(["PROVIDER", "LOCATION"]),
  externalId,
  localId,
});
export const previewSchema = z
  .strictObject({
    idempotencyKey: key,
    from: offsetTime.optional(),
    to: offsetTime.optional(),
  })
  .refine((v) => (v.from === undefined) === (v.to === undefined), {
    message: "Supply both from and to",
  })
  .refine((v) => !v.from || !v.to || new Date(v.from) < new Date(v.to), {
    message: "to must follow from",
  });
export const confirmSchema = z.strictObject({
  idempotencyKey: key,
  expectedContentHash: z.string().regex(/^[a-f0-9]{64}$/),
});
export const listImportQuery = z.strictObject({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export const normalizedPatientSchema = createPatientSchema.strict();
export const normalizedAppointmentSchema = z
  .strictObject({
    patientExternalId: externalId,
    providerExternalId: externalId,
    locationExternalId: externalId,
    start: offsetTime,
    end: offsetTime,
    eligibility: z.enum(["NEW_APPOINTMENT", "UNSUPPORTED"]),
  })
  .refine((v) => new Date(v.end) > new Date(v.start), {
    message: "Appointment end must follow start",
  });
export const normalizedPageSchema = z.strictObject({
  externalAccountId: externalId,
  complete: z.boolean(),
  nextCursor: z.string().min(1).max(1024).nullable(),
  items: z
    .array(
      z.strictObject({
        entityType: z.enum(["PATIENT", "APPOINTMENT"]),
        externalId,
        payload: z.unknown(),
      }),
    )
    .max(200),
});
export type PreviewInput = z.infer<typeof previewSchema>;
export type PatientPayload = z.infer<typeof normalizedPatientSchema>;
export type AppointmentPayload = z.infer<typeof normalizedAppointmentSchema>;
export type ImportPage = z.infer<typeof normalizedPageSchema>;
