import { z } from "zod";
const fields = {
  treatmentId: z.string().trim().min(1).max(7),
  treatmentType: z.string().trim().max(100).nullable().optional(),
  description: z.string().trim().max(5000).nullable().optional(),
};
export const createTreatmentCaseSchema = z.strictObject(fields);
export const updateTreatmentCaseSchema = z.strictObject(fields).partial().refine((v) => Object.keys(v).length > 0, { message: "At least one field must be provided" });
export const listTreatmentCasesSchema = z.strictObject({
  q: z.string().trim().max(120).optional(),
  status: z.enum(["PLANNED", "ACTIVE", "COMPLETED", "CANCELLED"]).optional(),
  page: z.coerce.number().int().positive().default(1), pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type CreateTreatmentCaseInput = z.infer<typeof createTreatmentCaseSchema>;
export type UpdateTreatmentCaseInput = z.infer<typeof updateTreatmentCaseSchema>;
export type ListTreatmentCasesQuery = z.infer<typeof listTreatmentCasesSchema>;
