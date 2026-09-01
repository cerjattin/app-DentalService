import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { getApiErrorMessage } from '../../api'
import { FormField } from '../../components/forms/form-field'
import { Button } from '../../components/ui/button'
import { Dialog } from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { Select } from '../../components/ui/select'
import { Textarea } from '../../components/ui/textarea'
import {
  businessDateTimeInputToIso,
  formatBusinessDateTimeInput,
} from '../../lib/timezone'
import type {
  Appointment,
  AppointmentUpdateDto,
  Provider,
} from '../../types/appointment'

const schema = z
  .object({
    providerId: z.string().regex(/^[1-9]\d*$/),
    scheduledStart: z.string().min(1, 'Start date and time are required.'),
    scheduledEnd: z.string().min(1, 'End date and time are required.'),
    reason: z.string().trim().max(255),
    notes: z.string().trim().max(65_535),
  })
  .refine((values) => values.scheduledEnd > values.scheduledStart, {
    path: ['scheduledEnd'],
    message: 'End time must be after start time.',
  })

type Values = z.infer<typeof schema>

function defaults(appointment: Appointment): Values {
  return {
    providerId: appointment.providerId,
    scheduledStart: formatBusinessDateTimeInput(appointment.scheduledStart),
    scheduledEnd: formatBusinessDateTimeInput(appointment.scheduledEnd),
    reason: appointment.reason ?? '',
    notes: appointment.notes ?? '',
  }
}

export function AppointmentUpdateDialog({
  appointment,
  providers,
  canReadProviders,
  open,
  onOpenChange,
  onSubmit,
  isPending,
  error,
}: {
  appointment: Appointment
  providers: Provider[]
  canReadProviders: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (values: AppointmentUpdateDto) => void
  isPending: boolean
  error?: unknown
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: defaults(appointment),
  })

  useEffect(() => {
    if (open) reset(defaults(appointment))
  }, [appointment, open, reset])

  const providerOptions = providers.some((provider) => provider.id === appointment.providerId)
    ? providers
    : [
        {
          id: appointment.provider.id,
          organizationId: appointment.organizationId,
          userId: null,
          svbProviderId: appointment.provider.svbProviderId,
          firstName: appointment.provider.firstName,
          lastName: appointment.provider.lastName,
          licenseNumber: null,
          specialty: null,
          email: null,
          phone: null,
          isActive: appointment.provider.isActive,
          archivedAt: null,
          createdAt: appointment.createdAt,
          updatedAt: appointment.updatedAt,
        },
        ...providers,
      ]

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit appointment"
      description="Update the schedule and appointment notes."
      size="wide"
    >
      <form
        className="space-y-4"
        onSubmit={handleSubmit((values) =>
          onSubmit({
            providerId: values.providerId,
            scheduledStart: businessDateTimeInputToIso(values.scheduledStart),
            scheduledEnd: businessDateTimeInputToIso(values.scheduledEnd),
            reason: values.reason || null,
            notes: values.notes || null,
          }),
        )}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Provider"
            htmlFor="appointmentProvider"
            error={errors.providerId?.message}
            hint={canReadProviders ? undefined : 'Provider lookup permission is required to change this field.'}
          >
            <Select id="appointmentProvider" disabled={!canReadProviders} {...register('providerId')}>
              {providerOptions.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.firstName} {provider.lastName}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Clinic location" htmlFor="appointmentLocation" hint="Location lookup is unavailable in the frozen backend.">
            <Input id="appointmentLocation" value={appointment.location.name} disabled readOnly />
          </FormField>
          <FormField label="Scheduled start" htmlFor="scheduledStart" error={errors.scheduledStart?.message}>
            <Input id="scheduledStart" type="datetime-local" {...register('scheduledStart')} />
          </FormField>
          <FormField label="Scheduled end" htmlFor="scheduledEnd" error={errors.scheduledEnd?.message}>
            <Input id="scheduledEnd" type="datetime-local" {...register('scheduledEnd')} />
          </FormField>
        </div>
        <FormField label="Reason" htmlFor="appointmentReason" error={errors.reason?.message}>
          <Input id="appointmentReason" {...register('reason')} />
        </FormField>
        <FormField label="Notes" htmlFor="appointmentNotes" error={errors.notes?.message}>
          <Textarea id="appointmentNotes" rows={4} {...register('notes')} />
        </FormField>
        {error ? (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-clinic-danger">
            {getApiErrorMessage(error)}
          </p>
        ) : null}
        <div className="flex justify-end gap-2 border-t border-clinic-border pt-4">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isPending}>Cancel</Button>
          <Button type="submit" disabled={isPending}>{isPending ? 'Saving...' : 'Save changes'}</Button>
        </div>
      </form>
    </Dialog>
  )
}
