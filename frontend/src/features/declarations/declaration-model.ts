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
const optionalDate = z.string().refine((value) => !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value), 'Enter a valid date.')
export const candidateFilterSchema = z.object({ q: z.string().trim().max(120), from: optionalDate, to: optionalDate })
  .refine((v) => !v.from || !v.to || v.to >= v.from, { path: ['to'], message: 'End date must be on or after start date.' })
export const declarationReasonSchema = z.object({ reason: z.string().trim().min(1, 'A reason is required.').max(500) })
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
