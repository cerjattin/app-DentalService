import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { getApiErrorMessage } from '../../api'
import { FormField } from '../../components/forms/form-field'
import { Button } from '../../components/ui/button'
import { Dialog } from '../../components/ui/dialog'
import { Textarea } from '../../components/ui/textarea'
import type { AppointmentTransition } from './appointment-model'

const schema = z.object({
  reason: z
    .string()
    .trim()
    .max(500)
    .refine((value) => value === '' || value.length >= 3, {
      message: 'Enter at least 3 characters or leave the reason empty.',
    }),
})

type Values = z.infer<typeof schema>

export function AppointmentTransitionDialog({
  transition,
  onClose,
  onSubmit,
  isPending,
  error,
}: {
  transition?: AppointmentTransition
  onClose: () => void
  onSubmit: (reason?: string) => void
  isPending: boolean
  error?: unknown
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { reason: '' } })

  useEffect(() => {
    if (transition) reset({ reason: '' })
  }, [reset, transition])

  return (
    <Dialog
      open={Boolean(transition)}
      onOpenChange={(open) => { if (!open) onClose() }}
      title={transition?.label ?? 'Change appointment status'}
      description="This change is recorded by the backend and cannot be rewritten from this screen."
    >
      <form className="space-y-4" onSubmit={handleSubmit((values) => onSubmit(values.reason || undefined))}>
        <FormField label="Reason (optional)" htmlFor="statusReason" error={errors.reason?.message}>
          <Textarea id="statusReason" rows={3} autoFocus {...register('reason')} />
        </FormField>
        {error ? (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-clinic-danger">
            {getApiErrorMessage(error)}
          </p>
        ) : null}
        <div className="flex justify-end gap-2 border-t border-clinic-border pt-4">
          <Button variant="secondary" onClick={onClose} disabled={isPending}>Keep appointment</Button>
          <Button variant={transition?.status === 'CANCELLED' ? 'danger' : 'primary'} type="submit" disabled={isPending}>
            {isPending ? 'Updating...' : transition?.label}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
