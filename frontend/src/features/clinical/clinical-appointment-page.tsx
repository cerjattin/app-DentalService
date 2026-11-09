import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { PermissionGuard } from '../../auth/permission-guard'
import { PageHeader } from '../../components/app-shell/page-header'
import { LoadingState } from '../../components/feedback/loading-state'
import { StatusBadge } from '../../components/feedback/status-badge'
import { Button } from '../../components/ui/button'
import { formatBusinessDate, formatBusinessDateTime } from '../../lib/timezone'
import { AccessDeniedPage } from '../auth/access-denied-page'
import { appointmentKeys, getAppointment } from '../appointments/appointment-api'
import { refreshAppointmentWorkflow } from '../appointments/appointment-workflow-cache'
import { appointmentPatientName, appointmentProviderName } from '../appointments/appointment-model'
import { encounterKeys, finishServiceAttention, getEncounter, startServiceAttention } from './clinical-api'
import { ClinicalConfirm, ClinicalSection, MutationError } from './clinical-ui'
import { ProcedureSection } from './procedure-section'

export function ClinicalAppointmentPage() {
  const { appointmentId = '' } = useParams()
  return (
    <PermissionGuard allOf={['encounter.read', 'appointment.read']} fallback={<AccessDeniedPage />}>
      {/^[1-9]\d*$/.test(appointmentId)
        ? <ServiceAttention key={appointmentId} appointmentId={appointmentId} />
        : <Link to="/appointments">Open appointments</Link>}
    </PermissionGuard>
  )
}

function ServiceAttention({ appointmentId }: { appointmentId: string }) {
  const client = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const appointment = useQuery({
    queryKey: appointmentKeys.detail(appointmentId),
    queryFn: ({ signal }) => getAppointment(appointmentId, signal),
  })
  const encounter = useQuery({
    queryKey: encounterKeys.appointment(appointmentId),
    queryFn: ({ signal }) => getEncounter(appointmentId, signal),
    enabled: appointment.isSuccess,
  })
  const current = encounter.data
  const editingServices = useIsMutating({ mutationKey: encounterKeys.procedures(current?.id ?? '') }) > 0
  const refresh = async (record: Awaited<ReturnType<typeof startServiceAttention>>) => {
    client.setQueryData(encounterKeys.appointment(appointmentId), record)
    client.setQueryData(appointmentKeys.detail(appointmentId), (previous: typeof appointment.data) =>
      previous ? { ...previous, status: record.appointment.status } : previous)
    await refreshAppointmentWorkflow(client, appointmentId, record.id)
  }
  const reconcile = () => refreshAppointmentWorkflow(client, appointmentId, current?.id)
  const start = useMutation({ mutationFn: () => startServiceAttention(appointmentId), onSuccess: refresh, onError: reconcile })
  const finish = useMutation({
    mutationFn: (encounterId: string) => finishServiceAttention(encounterId),
    onSuccess: async (record) => {
      setConfirming(false)
      await refresh(record)
    },
    onError: reconcile,
  })

  if (appointment.isPending) return <LoadingState label="Loading appointment" />
  if (appointment.isError) return <><MutationError error={appointment.error} /><Button variant="secondary" onClick={() => void appointment.refetch()}>Retry appointment</Button></>
  const record = appointment.data
  const canStart = ['CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'].includes(record.status)
  const ready = current?.status === 'COMPLETED' && current.appointment.status === 'COMPLETED'

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader title="Service attention" description={record.appointmentNumber}
        actions={<div className="flex flex-wrap items-center gap-3"><Button variant="secondary" disabled={start.isPending || finish.isPending || editingServices || appointment.isFetching || encounter.isFetching} onClick={() => void reconcile()}>Refresh attention</Button><Link className="text-sm text-clinic-blue hover:underline" to={`/appointments/${appointmentId}`}>Appointment details</Link></div>} />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-clinic-border bg-white p-4">
        <div>
          <h2 className="font-semibold">{appointmentPatientName(record)}</h2>
          <p className="text-sm text-slate-600">{appointmentProviderName(record)} · {record.location.name} · {formatBusinessDateTime(record.scheduledStart)}</p>
        </div>
        {current ? <StatusBadge>{ready ? 'Ready for billing' : current.status === 'OPEN' ? 'In attention' : 'Attention completed'}</StatusBadge> : null}
      </div>
      {encounter.isPending ? <LoadingState label="Loading service attention" /> : encounter.isError ? (
        <ClinicalSection title="Service attention">
          <MutationError error={encounter.error} />
          <Button variant="secondary" onClick={() => void encounter.refetch()}>Retry</Button>
        </ClinicalSection>
      ) : current ? (
        <>
          <ProcedureSection encounter={current} serviceDate={formatBusinessDate(record.scheduledStart)} disabled={finish.isPending || confirming} />
          {ready ? <p role="status" className="mt-4 text-sm font-medium text-green-800">Reception can now create the invoice and collect the patient signature.</p> : null}
          {(current.status === 'OPEN' || (current.status === 'COMPLETED' && record.status === 'IN_PROGRESS')) ? (
            <PermissionGuard allOf={['encounter.complete', 'appointment.complete']}>
              <Button className="mt-4" disabled={editingServices || finish.isPending} onClick={() => { finish.reset(); setConfirming(true) }}>
                Complete attention
              </Button>
              {confirming ? <ClinicalConfirm
                title="Complete attention?"
                description="Finish recording services and send this appointment to reception for billing."
                pending={finish.isPending}
                error={finish.error}
                onClose={() => setConfirming(false)}
                onConfirm={() => finish.mutate(current.id)}
              /> : null}
            </PermissionGuard>
          ) : null}
        </>
      ) : (
        <ClinicalSection title="Service attention">
          <p className="mb-3 text-sm text-slate-600">{canStart ? 'Open attention to record the services provided.' : 'Confirm the appointment before starting attention.'}</p>
          {canStart ? (
            <PermissionGuard allOf={['appointment.start', 'encounter.create']}>
              <MutationError error={start.error} />
              <Button disabled={start.isPending} onClick={() => start.mutate()}>{start.isPending ? 'Starting…' : 'Start attention'}</Button>
            </PermissionGuard>
          ) : null}
        </ClinicalSection>
      )}
    </div>
  )
}
