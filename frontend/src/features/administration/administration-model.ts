import { z } from 'zod'

const optionalText = (max: number) => z.string().trim().max(max)
const optionalEmail = z.string().trim().max(320).refine((value) => !value || z.email().safeParse(value).success, 'Enter a valid email address.')
export const createUserSchema = z.object({
  email: z.email('Enter a valid email address.').max(320),
  firstName: z.string().trim().min(1, 'First name is required.').max(120),
  lastName: z.string().trim().min(1, 'Last name is required.').max(120),
  password: z.string().min(12, 'Password must contain at least 12 characters.').max(256),
  roleCodes: z.array(z.enum(['ADMIN', 'RECEPTION', 'PROVIDER'])).min(1, 'Select at least one role.'),
})
export const editUserSchema = createUserSchema.omit({ password: true, roleCodes: true })
export const userStatusSchema = z.object({ reason: z.string().trim().max(500).refine((value) => !value || value.length >= 3, 'Enter at least 3 characters.') })
export const providerSchema = z.object({
  userId: z.string().trim().refine((value) => !value || /^[1-9]\d*$/.test(value), 'Select a valid user.'),
  svbProviderId: optionalText(64),
  firstName: z.string().trim().min(1, 'First name is required.').max(120),
  lastName: z.string().trim().min(1, 'Last name is required.').max(120),
  licenseNumber: optionalText(80),
  specialty: optionalText(150),
  email: optionalEmail,
  phone: optionalText(40),
  isActive: z.boolean(),
})
export type CreateUserValues = z.infer<typeof createUserSchema>
export type EditUserValues = z.infer<typeof editUserSchema>
export type UserStatusValues = z.infer<typeof userStatusSchema>
export type ProviderValues = z.infer<typeof providerSchema>
export function adminLabel(value: string) { return value.toLowerCase().replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase()) }
export function roleLabel(code: string) { return code === 'ADMIN' ? 'Administrator' : adminLabel(code) }
export function roleDescription(code: string) {
  if (code === 'ADMIN') return 'Complete system administration.'
  if (code === 'PROVIDER') return 'Clinical care, procedures and clinical billing review.'
  if (code === 'RECEPTION') return 'Patient registration, insurance, appointments and front-desk billing.'
  return 'Backend-defined system role.'
}
export function userStatusTone(value: string) { return value === 'ACTIVE' ? 'success' as const : value === 'LOCKED' ? 'warning' as const : 'danger' as const }
