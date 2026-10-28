import { z } from 'zod'

const date = z.string().refine((value) => !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value), 'Enter a valid date.')
export const serviceSchema = z.object({
  code: z.string().trim().min(1, 'Enter a service code.').max(50),
  description: z.string().trim().min(1, 'Enter a description.').max(500),
  category: z.string().trim().max(120),
  unit: z.string().trim().max(50),
  requiresAuthorization: z.boolean(),
  requiresReferral: z.boolean(),
  isActive: z.boolean(),
  validFrom: date,
  validTo: date,
}).refine((v) => !v.validFrom || !v.validTo || v.validTo >= v.validFrom, { path: ['validTo'], message: 'Valid to must be on or after valid from.' })
export const tariffSchema = z.object({
  amount: z.string().regex(/^\d{1,13}(\.\d{1,2})?$/, 'Enter a nonnegative amount with up to 13 integer digits and 2 decimal places.'),
  currencyCode: z.string().trim().regex(/^[A-Za-z]{3}$/, 'Enter a three-letter currency code.'),
  validFrom: date.refine(Boolean, 'Enter a valid from date.'),
  validTo: date,
  isActive: z.boolean(),
}).refine((v) => !v.validTo || v.validTo >= v.validFrom, { path: ['validTo'], message: 'Valid to must be on or after valid from.' })
export type ServiceValues = z.infer<typeof serviceSchema>
export type TariffValues = z.infer<typeof tariffSchema>
export const historyNote = 'Changes to service master data do not alter previously recorded clinical or billing history.'
