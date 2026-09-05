import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { getApiErrorMessage } from '../../api'
import { FormField } from '../../components/forms/form-field'
import { Button } from '../../components/ui/button'
import { Checkbox } from '../../components/ui/checkbox'
import { Dialog } from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { Select } from '../../components/ui/select'
import { Textarea } from '../../components/ui/textarea'
import type { AdminProvider, AdminRole, AdminUser, ProviderWriteDto } from '../../types/administration'
import {
  createUserSchema,
  editUserSchema,
  providerSchema,
  userStatusSchema,
  type CreateUserValues,
  type EditUserValues,
  type ProviderValues,
  type UserStatusValues,
  roleDescription,
  roleLabel,
} from './administration-model'

function ErrorMessage({ error }: { error?: unknown }) {
  return error ? <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-clinic-danger">{getApiErrorMessage(error)}</p> : null
}

export function UserFormDialog({ open, user, roles, pending, error, onClose, onCreate, onUpdate }: { open: boolean; user?: AdminUser; roles: AdminRole[]; pending: boolean; error?: unknown; onClose: () => void; onCreate: (values: CreateUserValues) => void; onUpdate: (values: EditUserValues) => void }) {
  const createForm = useForm<CreateUserValues>({ resolver: zodResolver(createUserSchema), defaultValues: { email: '', firstName: '', lastName: '', password: '', roleCodes: [] } })
  const editForm = useForm<EditUserValues>({ resolver: zodResolver(editUserSchema), defaultValues: { email: '', firstName: '', lastName: '' } })
  const resetCreate = createForm.reset
  const resetEdit = editForm.reset
  useEffect(() => {
    if (!open) return
    resetCreate({ email: '', firstName: '', lastName: '', password: '', roleCodes: [] })
    if (user) resetEdit({ email: user.email, firstName: user.firstName, lastName: user.lastName })
  }, [open, user, resetCreate, resetEdit])
  const errors = user ? editForm.formState.errors : createForm.formState.errors
  return <Dialog open={open} onOpenChange={(next) => !next && onClose()} title={user ? 'Edit user' : 'Create user'} description={user ? 'Update the user profile. Roles and status are managed separately.' : 'Create an active user with at least one system role.'}>
    <form className="space-y-4" onSubmit={user ? editForm.handleSubmit(onUpdate) : createForm.handleSubmit(onCreate)}>
      <FormField label="Email" htmlFor="admin-user-email" error={errors.email?.message}><Input id="admin-user-email" type="email" autoComplete="off" {...(user ? editForm.register('email') : createForm.register('email'))} /></FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="First name" htmlFor="admin-user-first" error={errors.firstName?.message}><Input id="admin-user-first" {...(user ? editForm.register('firstName') : createForm.register('firstName'))} /></FormField>
        <FormField label="Last name" htmlFor="admin-user-last" error={errors.lastName?.message}><Input id="admin-user-last" {...(user ? editForm.register('lastName') : createForm.register('lastName'))} /></FormField>
      </div>
      {!user ? <>
        <FormField label="Temporary password" htmlFor="admin-user-password" error={createForm.formState.errors.password?.message} hint="At least 12 characters. The password is discarded after submission."><Input id="admin-user-password" type="password" autoComplete="new-password" {...createForm.register('password')} /></FormField>
        <fieldset><legend className="mb-2 text-sm font-medium text-slate-700">Roles</legend><div className="grid gap-2 sm:grid-cols-2">{roles.map((role) => <label key={role.id} className="flex items-start gap-2 rounded-md border border-clinic-border p-3 text-sm"><Checkbox value={role.code} {...createForm.register('roleCodes')} /><span><strong className="block text-slate-800">{roleLabel(role.code)}</strong><span className="text-xs text-slate-500">{roleDescription(role.code)}</span></span></label>)}</div>{createForm.formState.errors.roleCodes ? <p className="mt-1 text-xs text-clinic-danger">{createForm.formState.errors.roleCodes.message}</p> : null}</fieldset>
      </> : null}
      <ErrorMessage error={error} />
      <div className="flex justify-end gap-2"><Button variant="secondary" disabled={pending} onClick={onClose}>Cancel</Button><Button type="submit" disabled={pending}>{pending ? 'Saving...' : user ? 'Save changes' : 'Create user'}</Button></div>
    </form>
  </Dialog>
}

export function RoleAssignmentDialog({ open, user, roles, pending, error, onClose, onSubmit }: { open: boolean; user: AdminUser | null; roles: AdminRole[]; pending: boolean; error?: unknown; onClose: () => void; onSubmit: (roleCodes: AdminRole['code'][]) => void }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<{ roleCodes: AdminRole['code'][] }>({ resolver: zodResolver(createUserSchema.pick({ roleCodes: true })), defaultValues: { roleCodes: [] } })
  useEffect(() => { if (open && user) reset({ roleCodes: user.roles.map((role) => role.code as AdminRole['code']) }) }, [open, user, reset])
  return <Dialog open={open} onOpenChange={(next) => !next && onClose()} title="Assign roles" description={user ? `Replace all roles assigned to ${user.firstName} ${user.lastName}.` : undefined}>
    <form className="space-y-4" onSubmit={handleSubmit(({ roleCodes }) => onSubmit(roleCodes))}><div className="space-y-2">{roles.map((role) => <label key={role.id} className="flex items-center gap-2 rounded-md border border-clinic-border p-3 text-sm"><Checkbox value={role.code} {...register('roleCodes')} /><span>{roleLabel(role.code)}</span></label>)}</div>{errors.roleCodes ? <p className="text-xs text-clinic-danger">{errors.roleCodes.message}</p> : null}<ErrorMessage error={error} /><div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" disabled={pending}>{pending ? 'Saving...' : 'Save roles'}</Button></div></form>
  </Dialog>
}

export function UserStatusDialog({ open, user, pending, error, onClose, onSubmit }: { open: boolean; user: AdminUser | null; pending: boolean; error?: unknown; onClose: () => void; onSubmit: (values: UserStatusValues) => void }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<UserStatusValues>({ resolver: zodResolver(userStatusSchema), defaultValues: { reason: '' } })
  useEffect(() => { if (open) reset({ reason: '' }) }, [open, reset])
  const activating = user?.status !== 'ACTIVE'
  return <Dialog open={open} onOpenChange={(next) => !next && onClose()} title={activating ? 'Activate user' : 'Deactivate user'} description={user ? `${activating ? 'Activate' : 'Deactivate'} ${user.firstName} ${user.lastName}. This changes account access without deleting the user.` : undefined}>
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}><FormField label="Reason" htmlFor="user-status-reason" error={errors.reason?.message} hint="Optional; when provided, use at least 3 characters."><Textarea id="user-status-reason" maxLength={500} rows={3} {...register('reason')} /></FormField><ErrorMessage error={error} /><div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant={activating ? 'primary' : 'danger'} type="submit" disabled={pending}>{pending ? 'Updating...' : activating ? 'Activate user' : 'Deactivate user'}</Button></div></form>
  </Dialog>
}

function providerValues(provider?: AdminProvider): ProviderValues {
  return { userId: provider?.userId ?? '', svbProviderId: provider?.svbProviderId ?? '', firstName: provider?.firstName ?? '', lastName: provider?.lastName ?? '', licenseNumber: provider?.licenseNumber ?? '', specialty: provider?.specialty ?? '', email: provider?.email ?? '', phone: provider?.phone ?? '', isActive: provider?.isActive ?? true }
}
function nullable(value: string) { return value || null }
export function ProviderFormDialog({ open, provider, users, canLinkUser, pending, error, onClose, onSubmit }: { open: boolean; provider?: AdminProvider; users: AdminUser[]; canLinkUser: boolean; pending: boolean; error?: unknown; onClose: () => void; onSubmit: (values: ProviderWriteDto) => void }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProviderValues>({ resolver: zodResolver(providerSchema), defaultValues: providerValues(provider) })
  useEffect(() => { if (open) reset(providerValues(provider)) }, [open, provider, reset])
  return <Dialog open={open} onOpenChange={(next) => !next && onClose()} title={provider ? 'Edit provider' : 'Create provider'} description="Provider identity and its optional authoritative user association." size="wide">
    <form className="space-y-4" onSubmit={handleSubmit((values) => onSubmit({ userId: nullable(values.userId), svbProviderId: nullable(values.svbProviderId), firstName: values.firstName, lastName: values.lastName, licenseNumber: nullable(values.licenseNumber), specialty: nullable(values.specialty), email: nullable(values.email), phone: nullable(values.phone), isActive: values.isActive }))}>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="First name" htmlFor="provider-first" error={errors.firstName?.message}><Input id="provider-first" {...register('firstName')} /></FormField>
        <FormField label="Last name" htmlFor="provider-last" error={errors.lastName?.message}><Input id="provider-last" {...register('lastName')} /></FormField>
        <FormField label="SVB provider ID" htmlFor="provider-svb" error={errors.svbProviderId?.message}><Input id="provider-svb" {...register('svbProviderId')} /></FormField>
        <FormField label="License number" htmlFor="provider-license" error={errors.licenseNumber?.message}><Input id="provider-license" {...register('licenseNumber')} /></FormField>
        <FormField label="Specialty" htmlFor="provider-specialty" error={errors.specialty?.message}><Input id="provider-specialty" {...register('specialty')} /></FormField>
        <FormField label="Email" htmlFor="provider-email" error={errors.email?.message}><Input id="provider-email" type="email" {...register('email')} /></FormField>
        <FormField label="Phone" htmlFor="provider-phone" error={errors.phone?.message}><Input id="provider-phone" type="tel" {...register('phone')} /></FormField>
        <FormField label="Linked user" htmlFor="provider-user" error={errors.userId?.message} hint={canLinkUser ? 'A user may be linked to only one provider.' : 'User linking requires user.read permission.'}><Select id="provider-user" disabled={!canLinkUser} {...register('userId')}><option value="">No linked user</option>{users.map((user) => <option key={user.id} value={user.id}>{user.firstName} {user.lastName} - {user.email}</option>)}</Select></FormField>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700"><Checkbox {...register('isActive')} />Active provider</label>
      <ErrorMessage error={error} /><div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" disabled={pending}>{pending ? 'Saving...' : provider ? 'Save changes' : 'Create provider'}</Button></div>
    </form>
  </Dialog>
}
