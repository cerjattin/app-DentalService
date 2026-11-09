import { z } from 'zod'
import { formatBusinessDateTimeInput } from '../../lib/timezone'
const identity = z.string().regex(/^[1-9]\d*$/, 'Select a record.')
const localTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Enter date and time.')
  .refine((v) => !Number.isNaN(Date.parse(v + ':00-04:00')) && formatBusinessDateTimeInput(v + ':00-04:00') === v, 'Enter a valid date and time.')
export const appointmentCreateSchema = z.object({
  patientId: identity, providerId: identity, clinicLocationId: identity,
  scheduledStart: localTime, scheduledEnd: localTime,
  reason: z.string().trim().max(255), notes: z.string().trim().max(65535),
}).refine((v) => v.scheduledEnd > v.scheduledStart, { path: ['scheduledEnd'], message: 'End time must be after start time.' })
export type Values = z.infer<typeof appointmentCreateSchema>
