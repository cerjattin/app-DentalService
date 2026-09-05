import { z } from 'zod'
import type { DeclarationStatus } from '../../types/declaration'

const entityId = z.string().trim().regex(/^[1-9]\d*$/, 'Enter a valid identifier.')
const optionalText = (max: number) =>
  z.string().trim().max(max)

export const createDeclarationSchema = z
  .object({
    payerId: entityId,
    periodStart: z.string(),
    periodEnd: z.string(),
    declarantIdSnapshot: optionalText(64),
    notes: optionalText(5000),
  })
  .refine(
    (value) =>
      !value.periodStart ||
      !value.periodEnd ||
      value.periodEnd >= value.periodStart,
    { path: ['periodEnd'], message: 'End date must be on or after start date.' },
  )
export const addItemSchema = z.object({ invoiceItemId: entityId })
export const submissionResultSchema = z.object({
  status: z.enum(['ACCEPTED', 'PARTIALLY_REJECTED', 'REJECTED']),
  externalReference: optionalText(120),
})

export type CreateDeclarationValues = z.input<typeof createDeclarationSchema>
export type AddItemValues = z.input<typeof addItemSchema>
export type SubmissionResultValues = z.input<typeof submissionResultSchema>

export function declarationLabel(value: string) {
  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^./, (letter) => letter.toUpperCase())
}
export function declarationTone(status: DeclarationStatus | string) {
  if (['ACCEPTED', 'READY'].includes(status)) return 'success' as const
  if (['DRAFT', 'SUBMITTED'].includes(status)) return 'warning' as const
  if (['REJECTED', 'PARTIALLY_REJECTED', 'CANCELLED'].includes(status))
    return 'danger' as const
  if (status === 'EXPORTED') return 'info' as const
  return 'neutral' as const
}
