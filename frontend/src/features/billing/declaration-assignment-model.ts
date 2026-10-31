import { z } from 'zod'
const id = z.string().regex(/^[1-9]\d*$/)
const detailsSchema = z.object({ assignments: z.array(z.object({ declarationId: id, declarationNumber: z.string().nullable(), status: z.enum(['DRAFT', 'READY', 'EXPORTED', 'SUBMITTED', 'ACCEPTED', 'PARTIALLY_REJECTED', 'REJECTED', 'CANCELLED']), items: z.array(z.object({ declarationItemId: id, invoiceItemId: id })) })) })
export function parseDeclarationAssignments(value: unknown) {
  const result = detailsSchema.safeParse(value)
  return result.success ? result.data.assignments : []
}
