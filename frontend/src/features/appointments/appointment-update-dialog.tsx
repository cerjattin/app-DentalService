import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { ApiError, getApiErrorMessage } from '../../api'
import { useAuth } from '../../auth/use-auth'
import { hasPermission } from '../../auth/permissions'
import { TreatmentCaseSelector } from '../treatment-cases/treatment-case-selector'
import { UnsavedChanges } from '../../components/forms/unsaved-changes'
import { ConfirmDialog } from '../../components/ui/confirm-dialog'
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
    treatmentCaseId: z.string().regex(/^$|^[1-9]\d*$/),
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
    treatmentCaseId: appointment.treatmentCaseId ?? '',
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
  const { permissions } = useAuth()
  const [discard, setDiscard] = useState(false)
  const initialized = useRef('')
  const contextLocked = error instanceof ApiError && error.code === 'APPOINTMENT_CLINICAL_CONTEXT_LOCKED'
  const close = () => { if (!isPending) { if (isDirty) setDiscard(true); else onOpenChange(false) } }
  const {
    register,
    control,
    setValue,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: defaults(appointment),
  })

  useEffect(() => {
    if (open && initialized.current !== appointment.id) {
      initialized.current = appointment.id
      reset(defaults(appointment))
    }
    if (!open) initialized.current = ''
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
    <><UnsavedChanges active={open && isDirty && !isPending} /><Dialog
      open={open}
      onOpenChange={(next) => { if (!next) close() }}
      title="Edit appointment"
      description="Update the schedule and appointment notes."
      size="wide"
    >
      <form
        className="space-y-4"
        onSubmit={handleSubmit((values) =>
          onSubmit({
            providerId: values.providerId,
            ...(hasPermission(permissions, 'treatment_case.read') && values.treatmentCaseId !== (appointment.treatmentCaseId ?? '') ? { treatmentCaseId: values.treatmentCaseId || null } : {}),
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
          <FormField label="Clinic location" htmlFor="appointmentLocation" hint="The existing clinic location is retained when editing this appointment.">
            <Input id="appointmentLocation" value={appointment.location.name} disabled readOnly />
          </FormField>
          <FormField label="Scheduled start" htmlFor="scheduledStart" error={errors.scheduledStart?.message}>
            <Input id="scheduledStart" type="datetime-local" {...register('scheduledStart')} />
          </FormField>
          <FormField label="Scheduled end" htmlFor="scheduledEnd" error={errors.scheduledEnd?.message}>
            <Input id="scheduledEnd" type="datetime-local" {...register('scheduledEnd')} />
          </FormField>
        </div>
        <Controller control={control} name="treatmentCaseId" render={({ field }) => <TreatmentCaseSelector patientId={appointment.patientId} value={field.value} onChange={field.onChange} disabled={isPending || contextLocked} error={errors.treatmentCaseId?.message} />} />
        {contextLocked ? <Button variant="secondary" onClick={() => setValue('treatmentCaseId', appointment.treatmentCaseId ?? '', { shouldDirty: true })}>Keep recorded treatment case</Button> : null}
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
          <Button variant="secondary" onClick={close} disabled={isPending}>Cancel</Button>
          <Button type="submit" disabled={isPending}>{isPending ? 'Saving...' : 'Save changes'}</Button>
        </div>
      </form>
    </Dialog><ConfirmDialog open={discard} title="Discard appointment changes?" description="Your changes have not been saved." confirmLabel="Discard changes" cancelLabel="Keep editing" onCancel={() => setDiscard(false)} onConfirm={() => { setDiscard(false); onOpenChange(false) }} /></>
  )
}
