import { z } from "zod";

const bigintId = z.string().trim().regex(/^[1-9]\d*$/);

const dateOnly = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/);

const decimalQuantity = z
  .string()
  .trim()
  .regex(/^(0|[1-9]\d*)(\.\d{1,2})?$/);

const optionalText = (max: number) =>
  z.string().trim().max(max).nullable().optional();

const adminAuthorizationStatus = z.enum([
  "PENDING",
  "APPROVED",
  "EXPIRED",
  "CANCELLED",
]);

const metadataValue = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const metadata = z.record(z.string(), metadataValue).nullable().optional();

export const listAuthorizationsQuerySchema = z.object({
  patientId: bigintId.optional(),

  patientInsuranceId: bigintId.optional(),

  status: z
    .enum([
      "PENDING",
      "APPROVED",
      "PARTIALLY_USED",
      "EXHAUSTED",
      "EXPIRED",
      "CANCELLED",
    ])
    .optional(),

  q: z.string().trim().max(120).optional(),

  serviceDate: dateOnly.optional(),

  page: z.coerce.number().int().positive().default(1),

  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const createAuthorizationSchema = z.object({
  patientId: bigintId,

  patientInsuranceId: bigintId,

  authorizationId: z.string().trim().min(1).max(80),

  status: adminAuthorizationStatus.default("PENDING"),

  validFrom: dateOnly.nullable().optional(),

  validTo: dateOnly.nullable().optional(),

  issuedAt: z.string().datetime({ offset: true }).nullable().optional(),

  notes: optionalText(65_535),

  metadata,
});

export const updateAuthorizationSchema = z
  .object({
    status: adminAuthorizationStatus.optional(),

    validFrom: dateOnly.nullable().optional(),

    validTo: dateOnly.nullable().optional(),

    issuedAt: z.string().datetime({ offset: true }).nullable().optional(),

    notes: optionalText(65_535),

    metadata,
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export const createAuthorizationItemSchema = z.object({
  svbProcedureId: bigintId.nullable().optional(),

  authorizedQuantity: decimalQuantity.nullable().optional(),

  validFrom: dateOnly.nullable().optional(),

  validTo: dateOnly.nullable().optional(),

  notes: optionalText(65_535),
});

export const updateAuthorizationItemSchema = z
  .object({
    svbProcedureId: bigintId.nullable().optional(),

    authorizedQuantity: decimalQuantity.nullable().optional(),

    validFrom: dateOnly.nullable().optional(),

    validTo: dateOnly.nullable().optional(),

    notes: optionalText(65_535),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export type ListAuthorizationsQuery = z.infer<
  typeof listAuthorizationsQuerySchema
>;

export type CreateAuthorizationInput = z.infer<
  typeof createAuthorizationSchema
>;

export type UpdateAuthorizationInput = z.infer<
  typeof updateAuthorizationSchema
>;

export type CreateAuthorizationItemInput = z.infer<
  typeof createAuthorizationItemSchema
>;

export type UpdateAuthorizationItemInput = z.infer<
  typeof updateAuthorizationItemSchema
>;
