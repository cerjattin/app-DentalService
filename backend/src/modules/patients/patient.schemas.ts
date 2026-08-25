import { z } from "zod";

const optionalText = (max: number) =>
  z.string().trim().max(max).nullable().optional();

export const createPatientSchema = z.object({
  firstName: z.string().trim().min(1).max(120),

  middleName: optionalText(120),

  lastName: z.string().trim().min(1).max(120),

  secondLastName: optionalText(120),

  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),

  sex: z.enum(["FEMALE", "MALE", "OTHER", "UNKNOWN"]).nullable().optional(),

  documentType: optionalText(50),

  documentNumber: optionalText(80),

  email: z.string().trim().email().max(320).nullable().optional(),

  phone: optionalText(40),

  mobilePhone: optionalText(40),

  addressLine1: optionalText(255),

  addressLine2: optionalText(255),

  city: optionalText(120),

  countryCode: z
    .string()
    .trim()
    .length(2)
    .transform((value) => value.toUpperCase())
    .nullable()
    .optional(),
});

export const updatePatientSchema = createPatientSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export const listPatientsQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),

  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).optional(),

  page: z.coerce.number().int().positive().default(1),

  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const archivePatientSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;

export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;

export type ListPatientsQuery = z.infer<typeof listPatientsQuerySchema>;

export type ArchivePatientInput = z.infer<typeof archivePatientSchema>;
