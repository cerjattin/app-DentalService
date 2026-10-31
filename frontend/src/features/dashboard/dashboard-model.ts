import { z } from 'zod'

const date = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const timestamp = Date.parse(`${value}T00:00:00Z`)
  return !Number.isNaN(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value
}, 'Enter a valid date.')

export const dashboardFilterSchema = z.object({
  from: date,
  to: date,
  providerId: z.union([z.literal(''), z.string().regex(/^[1-9]\d*$/, 'Select a provider.')]).optional(),
}).refine((values) => values.to >= values.from, {
  path: ['to'], message: 'The end date must be on or after the start date.',
}).refine((values) => {
  // Date-only arithmetic in UTC counts calendar days without workstation timezone offsets.
  const days = (Date.parse(`${values.to}T00:00:00Z`) - Date.parse(`${values.from}T00:00:00Z`)) / 86_400_000
  return days <= 365
}, { path: ['to'], message: 'Choose an inclusive period of at most 366 days.' })
