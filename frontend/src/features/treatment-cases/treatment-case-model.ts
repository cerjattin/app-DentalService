import { z } from 'zod'
export const treatmentCaseSchema = z.object({
  treatmentId: z.string().trim().min(1, 'An external treatment ID is required.').max(7, 'Use at most 7 characters.'),
  treatmentType: z.string().trim().max(100), description: z.string().trim().max(5000),
})
export type TreatmentCaseValues = z.infer<typeof treatmentCaseSchema>
