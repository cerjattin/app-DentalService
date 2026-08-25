import { z } from "zod";

const optionalText = (max: number) =>
  z.string().trim().max(max).nullable().optional();

const optionalBigIntId = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/)
  .nullable()
  .optional();

export const createProviderSchema = z.object({
  userId: optionalBigIntId,

  svbProviderId: optionalText(64),

  firstName: z.string().trim().min(1).max(120),

  lastName: z.string().trim().min(1).max(120),

  licenseNumber: optionalText(80),

  specialty: optionalText(150),

  email: z.string().trim().email().max(320).nullable().optional(),

  phone: optionalText(40),

  isActive: z.boolean().optional(),
});

export const updateProviderSchema = createProviderSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export const listProvidersQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),

  isActive: z.coerce.boolean().optional(),

  page: z.coerce.number().int().positive().default(1),

  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export type CreateProviderInput = z.infer<typeof createProviderSchema>;

export type UpdateProviderInput = z.infer<typeof updateProviderSchema>;

export type ListProvidersQuery = z.infer<typeof listProvidersQuerySchema>;
