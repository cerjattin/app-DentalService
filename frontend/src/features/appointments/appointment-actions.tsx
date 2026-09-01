import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { getApiErrorMessage } from '../../api'
import { hasPermission } from '../../auth/permissions'
import { useAuth } from '../../auth/use-auth'
import { Button } from '../../components/ui/button'
import type { Appointment } from '../../types/appointment'
import { appointmentKeys, changeAppointmentStatus, receptionKeys } from './appointment-api'
import { availableTransitions, type AppointmentTransition } from './appointment-model'
import { AppointmentTransitionDialog } from './appointment-transition-dialog'

export function AppointmentActions({
  appointment,
  compact = false,
  onSuccess,
}: {
  appointment: Appointment
  compact?: boolean
  onSuccess?: (appointment: Appointment) => void
}) {
  const { permissions } = useAuth()
  const queryClient = useQueryClient()
  const [dialogTransition, setDialogTransition] = useState<AppointmentTransition>()
  const mutation = useMutation({
    mutationFn: ({ transition, reason }: { transition: AppointmentTransition; reason?: string }) =>
      changeAppointmentStatus(appointment.id, {
        status: transition.status,
        ...(reason ? { reason } : {}),
      }),
    onSuccess: async (updated) => {
      queryClient.setQueryData(appointmentKeys.detail(updated.id), updated)
      setDialogTransition(undefined)
      onSuccess?.(updated)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: appointmentKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: receptionKeys.all }),
      ])
    },
  })
  const transitions = availableTransitions(appointment.status).filter((transition) =>
    hasPermission(permissions, transition.permission),
  )

  if (transitions.length === 0) return null

  function run(transition: AppointmentTransition) {
    mutation.reset()
    if (transition.requiresDialog) setDialogTransition(transition)
    else mutation.mutate({ transition })
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {transitions.map((transition) => (
          <Button
            key={transition.status}
            variant={transition.tone}
            className={compact ? 'h-8 px-2.5 text-xs' : undefined}
            disabled={mutation.isPending}
            onClick={() => run(transition)}
          >
            {mutation.isPending && mutation.variables?.transition.status === transition.status
              ? 'Updating...'
              : transition.label}
          </Button>
        ))}
      </div>
      {mutation.isError && !dialogTransition ? (
        <p role="alert" className="mt-2 text-sm text-clinic-danger">{getApiErrorMessage(mutation.error)}</p>
      ) : null}
      <AppointmentTransitionDialog
        transition={dialogTransition}
        onClose={() => { setDialogTransition(undefined); mutation.reset() }}
        onSubmit={(reason) => {
          if (dialogTransition) mutation.mutate({ transition: dialogTransition, reason })
        }}
        isPending={mutation.isPending}
        error={mutation.error}
      />
    </>
  )
}
