import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Pencil, Stethoscope } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { getApiErrorMessage } from '../../api'
import { hasPermission } from '../../auth/permissions'
import { useAuth } from '../../auth/use-auth'
import { PageHeader } from '../../components/app-shell/page-header'
import { ErrorState } from '../../components/feedback/error-state'
import { LoadingState } from '../../components/feedback/loading-state'
import { StatusBadge } from '../../components/feedback/status-badge'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import { formatBusinessDateTime } from '../../lib/timezone'
import { listPatientInsurance, patientKeys } from '../patients/patient-api'
import { formatDateOnly } from '../patients/patient-formatters'
import { AppointmentActions } from './appointment-actions'
import {
  appointmentKeys,
  getAppointment,
  listActiveProviders,
  receptionKeys,
  updateAppointment,
} from './appointment-api'
import {
  appointmentPatientName,
  appointmentProviderName,
  appointmentStatusLabel,
  appointmentStatusTone,
} from './appointment-model'
import { AppointmentUpdateDialog } from './appointment-update-dialog'
import { AppointmentBilling } from '../billing/appointment-billing'

function Field({ label, value }: { label: string; value: string | null }) {
  return <div><dt className="text-xs font-medium uppercase text-slate-500">{label}</dt><dd className="mt-1 text-sm text-slate-800">{value || 'Not provided'}</dd></div>
}

export function AppointmentDetailPage() {
  const { appointmentId = '' } = useParams()
  const { permissions } = useAuth()
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const canReadProviders = hasPermission(permissions, 'provider.read')
  const canReadInsurance = hasPermission(permissions, 'insurance.read')

  const appointmentQuery = useQuery({
    queryKey: appointmentKeys.detail(appointmentId),
    queryFn: ({ signal }) => getAppointment(appointmentId, signal),
    enabled: Boolean(appointmentId),
  })
  const providersQuery = useQuery({
    queryKey: appointmentKeys.providers(),
    queryFn: ({ signal }) => listActiveProviders(signal),
    enabled: canReadProviders,
    staleTime: 5 * 60_000,
  })
  const insuranceQuery = useQuery({
    queryKey: patientKeys.insurance(appointmentQuery.data?.patientId ?? ''),
    queryFn: ({ signal }) => listPatientInsurance(appointmentQuery.data?.patientId ?? '', signal),
    enabled: Boolean(appointmentQuery.data?.patientId) && canReadInsurance,
  })
  const updateMutation = useMutation({
    mutationFn: (values: Parameters<typeof updateAppointment>[1]) => updateAppointment(appointmentId, values),
    onSuccess: async (appointment) => {
      queryClient.setQueryData(appointmentKeys.detail(appointmentId), appointment)
      setEditOpen(false)
      setNotice('Appointment updated.')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: appointmentKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: receptionKeys.all }),
      ])
    },
  })

  if (appointmentQuery.isPending) return <LoadingState label="Loading appointment" />
  if (appointmentQuery.isError) return <ErrorState title="Unable to load appointment" description={getApiErrorMessage(appointmentQuery.error)} onRetry={() => void appointmentQuery.refetch()} />

  const appointment = appointmentQuery.data
  const primaryInsurance = insuranceQuery.data?.find((item) => item.isPrimary) ?? insuranceQuery.data?.[0]
  const canEnterClinical =
    ['CHECKED_IN', 'IN_PROGRESS', 'COMPLETED'].includes(appointment.status) &&
    hasPermission(permissions, 'encounter.read')

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="mb-3 text-sm"><Link to="/appointments" className="text-clinic-blue hover:underline">Appointments</Link><span className="mx-2 text-slate-400">/</span><span className="text-slate-500">{appointment.appointmentNumber}</span></div>
      <PageHeader
        title={`Appointment ${appointment.appointmentNumber}`}
        description={formatBusinessDateTime(appointment.scheduledStart)}
        actions={
          <div className="flex flex-wrap gap-2">
            {hasPermission(permissions, 'appointment.update') ? <Button variant="secondary" onClick={() => setEditOpen(true)}><Pencil size={16} />Edit appointment</Button> : null}
            {canEnterClinical ? <Link to={`/clinical/${appointment.id}`} className="inline-flex h-9 items-center gap-2 rounded-md bg-clinic-blue px-3 text-sm font-medium text-white hover:bg-blue-700"><Stethoscope size={16} />Open clinical workspace</Link> : null}
          </div>
        }
      />
      {notice ? <div role="status" className="mb-4 flex items-center justify-between rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"><span className="flex items-center gap-2"><CheckCircle2 size={16} />{notice}</span><button type="button" className="font-medium hover:underline" onClick={() => setNotice(null)}>Dismiss</button></div> : null}

      <AppointmentBilling appointment={appointment} />
      <Card className="mb-5 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <StatusBadge tone={appointmentStatusTone(appointment.status)}>{appointmentStatusLabel(appointment.status)}</StatusBadge>
            <h3 className="mt-3 text-lg font-semibold text-slate-900">{appointmentPatientName(appointment)}</h3>
            <p className="mt-1 font-mono text-xs text-slate-500">{appointment.patient.patientNumber}</p>
          </div>
          <AppointmentActions appointment={appointment} onSuccess={() => setNotice('Appointment status updated.')} />
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-4 border-b border-clinic-border pb-3 font-semibold text-slate-900">Appointment information</h3>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Scheduled start" value={formatBusinessDateTime(appointment.scheduledStart)} />
            <Field label="Scheduled end" value={formatBusinessDateTime(appointment.scheduledEnd)} />
            <Field label="Provider" value={appointmentProviderName(appointment)} />
            <Field label="Clinic location" value={`${appointment.location.name} (${appointment.location.code})`} />
            <Field label="Reason" value={appointment.reason} />
            <Field label="Notes" value={appointment.notes} />
          </dl>
        </Card>
        <Card className="p-5">
          <h3 className="mb-4 border-b border-clinic-border pb-3 font-semibold text-slate-900">Patient context</h3>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Patient" value={appointmentPatientName(appointment)} />
            <Field label="Document" value={appointment.patient.documentNumber ? `${appointment.patient.documentType ?? ''} ${appointment.patient.documentNumber}`.trim() : null} />
            <Field label="Insurance payer" value={primaryInsurance?.payer.name ?? (canReadInsurance && insuranceQuery.isPending ? 'Loading...' : null)} />
            <Field label="Insured ID" value={primaryInsurance?.insuredId ?? null} />
            <Field label="Insurance status" value={primaryInsurance?.status ? primaryInsurance.status.charAt(0) + primaryInsurance.status.slice(1).toLowerCase() : null} />
            <Field label="Coverage period" value={primaryInsurance ? `${formatDateOnly(primaryInsurance.validFrom)} - ${formatDateOnly(primaryInsurance.validTo)}` : null} />
          </dl>
          {hasPermission(permissions, 'patient.read') ? <Link to={`/patients/${appointment.patientId}`} className="mt-4 inline-block text-sm font-medium text-clinic-blue hover:underline">Open patient record</Link> : null}
        </Card>
      </div>

      <Card className="mt-5 p-5">
        <h3 className="mb-4 border-b border-clinic-border pb-3 font-semibold text-slate-900">Recorded status timestamps</h3>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Checked in" value={appointment.checkedInAt ? formatBusinessDateTime(appointment.checkedInAt) : null} />
          <Field label="Started" value={appointment.startedAt ? formatBusinessDateTime(appointment.startedAt) : null} />
          <Field label="Completed" value={appointment.completedAt ? formatBusinessDateTime(appointment.completedAt) : null} />
          <Field label="Cancelled" value={appointment.cancelledAt ? formatBusinessDateTime(appointment.cancelledAt) : null} />
        </dl>
        {appointment.cancellationReason ? <p className="mt-4 text-sm text-slate-600"><span className="font-medium">Cancellation reason:</span> {appointment.cancellationReason}</p> : null}
      </Card>

      <AppointmentUpdateDialog appointment={appointment} providers={providersQuery.data?.data ?? []} canReadProviders={canReadProviders} open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (!open) updateMutation.reset() }} onSubmit={(values) => updateMutation.mutate(values)} isPending={updateMutation.isPending} error={updateMutation.error} />
    </div>
  )
}
