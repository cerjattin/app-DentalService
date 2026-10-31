import { z } from "zod";

export const updateOrganizationSchema = z.strictObject({
  expectedRevision: z.string().regex(/^[a-f0-9]{64}$/),
  reason: z.string().trim().min(1).max(500),
  legalName: z.string().trim().min(1).max(200).optional(),
  tradeName: z.string().trim().max(200).nullable().optional(),
  declarantId: z.string().regex(/^\d{1,5}$/).nullable().optional(),
  email: z.string().trim().max(320).email().nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
}).refine((v) => [v.legalName, v.tradeName, v.declarantId, v.email, v.phone].some((x) => x !== undefined), {
  message: "At least one configuration field must be provided",
});
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
