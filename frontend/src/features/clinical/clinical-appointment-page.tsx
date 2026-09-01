import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, ClipboardPlus, Play, Save } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError, getApiErrorMessage } from '../../api'
import { hasPermission } from '../../auth/permissions'
import { useAuth } from '../../auth/use-auth'
import { PageHeader } from '../../components/app-shell/page-header'
import { EmptyState } from '../../components/feedback/empty-state'
import { ErrorState } from '../../components/feedback/error-state'
import { LoadingState } from '../../components/feedback/loading-state'
import { StatusBadge } from '../../components/feedback/status-badge'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import { ConfirmDialog } from '../../components/ui/confirm-dialog'
import { Textarea } from '../../components/ui/textarea'
import { formatBusinessDate, formatBusinessDateTime } from '../../lib/timezone'
import type { ClinicalEncounter } from '../../types/clinical'
import { appointmentKeys, changeAppointmentStatus, getAppointment, receptionKeys } from '../appointments/appointment-api'
import { appointmentPatientName, appointmentProviderName, appointmentStatusLabel, appointmentStatusTone } from '../appointments/appointment-model'
import { listPatientInsurance, patientKeys } from '../patients/patient-api'
import { authorizationKeys, completeEncounter, createEncounter, diagnosisKeys, encounterKeys, getEncounterByAppointment, listAuthorizations, listEncounterDiagnoses, updateEncounter } from './clinical-api'
import { DiagnosisSection } from './diagnosis-section'
import { ProcedureSection } from './procedure-section'

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return <div><dt className="text-xs font-medium uppercase text-slate-500">{label}</dt><dd className="mt-1 text-sm text-slate-800">{value || 'Not provided'}</dd></div>
}

function encounterTone(status: ClinicalEncounter['status']) {
  if (status === 'OPEN') return 'info' as const
  if (status === 'COMPLETED') return 'success' as const
  return 'neutral' as const
}

function EncounterNotes({ encounter, appointmentId, onSaved }: { encounter: ClinicalEncounter; appointmentId: string; onSaved: () => void }) {
  const queryClient = useQueryClient()
  const { permissions } = useAuth()
  const [chiefComplaint, setChiefComplaint] = useState(encounter.chiefComplaint ?? '')
  const [clinicalNotes, setClinicalNotes] = useState(encounter.clinicalNotes ?? '')
  const canUpdate = encounter.status === 'OPEN' && hasPermission(permissions, 'encounter.update')
  const updateMutation = useMutation({
    mutationFn: () => updateEncounter(encounter.id, { chiefComplaint: chiefComplaint || null, clinicalNotes: clinicalNotes || null }),
    onSuccess: (updatedEncounter) => {
      queryClient.setQueryData(encounterKeys.byAppointment(appointmentId), updatedEncounter)
      queryClient.setQueryData(encounterKeys.detail(updatedEncounter.id), updatedEncounter)
      onSaved()
    },
  })

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-col gap-2 border-b border-clinic-border pb-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-semibold text-slate-900">Clinical notes</h3><p className="mt-0.5 text-sm text-slate-500">Encounter started {formatBusinessDateTime(encounter.startedAt)}</p></div>{encounter.completedAt ? <span className="text-sm text-slate-500">Completed {formatBusinessDateTime(encounter.completedAt)}</span> : null}</div>
      <div className="grid gap-4 lg:grid-cols-2"><div><label htmlFor="chiefComplaint" className="mb-1.5 block text-sm font-medium text-slate-700">Chief complaint</label><Textarea id="chiefComplaint" disabled={!canUpdate} value={chiefComplaint} onChange={(event) => setChiefComplaint(event.target.value)} /></div><div><label htmlFor="clinicalNotes" className="mb-1.5 block text-sm font-medium text-slate-700">Clinical notes</label><Textarea id="clinicalNotes" disabled={!canUpdate} value={clinicalNotes} onChange={(event) => setClinicalNotes(event.target.value)} /></div></div>
      {updateMutation.isError ? <p role="alert" className="mt-3 text-sm text-clinic-danger">{getApiErrorMessage(updateMutation.error)}</p> : null}
      {canUpdate ? <div className="mt-4 flex justify-end"><Button variant="secondary" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate()}><Save size={16} />{updateMutation.isPending ? 'Saving...' : 'Save notes'}</Button></div> : null}
    </Card>
  )
}

export function ClinicalAppointmentPage() {
  const { appointmentId = '' } = useParams()
  const { permissions } = useAuth()
  const queryClient = useQueryClient()
  const [chiefComplaint, setChiefComplaint] = useState('')
  const [clinicalNotes, setClinicalNotes] = useState('')
  const [completeOpen, setCompleteOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const canReadInsurance = hasPermission(permissions, 'insurance.read')
  const canReadDiagnoses = hasPermission(permissions, 'diagnosis.read')
  const canReadAuthorizations = hasPermission(permissions, 'authorization.read')

  const appointmentQuery = useQuery({ queryKey: appointmentKeys.detail(appointmentId), queryFn: ({ signal }) => getAppointment(appointmentId, signal), enabled: Boolean(appointmentId) })
  const encounterQuery = useQuery({
    queryKey: encounterKeys.byAppointment(appointmentId),
    queryFn: async ({ signal }) => {
      try {
        return await getEncounterByAppointment(appointmentId, signal)
      } catch (error) {
        if (error instanceof ApiError && error.code === 'CLINICAL_ENCOUNTER_NOT_FOUND') return null
        throw error
      }
    },
    enabled: Boolean(appointmentQuery.data),
    retry: false,
  })
  const patientId = appointmentQuery.data?.patientId ?? ''
  const serviceDate = appointmentQuery.data ? formatBusinessDate(appointmentQuery.data.scheduledStart) : ''
  const insuranceQuery = useQuery({ queryKey: patientKeys.insurance(patientId), queryFn: ({ signal }) => listPatientInsurance(patientId, signal), enabled: Boolean(patientId) && canReadInsurance })
  const encounterId = encounterQuery.data?.id ?? ''
  const diagnosesQuery = useQuery({ queryKey: diagnosisKeys.encounter(encounterId), queryFn: ({ signal }) => listEncounterDiagnoses(encounterId, signal), enabled: Boolean(encounterId) && canReadDiagnoses })
  const authorizationsQuery = useQuery({ queryKey: authorizationKeys.patient(patientId, serviceDate), queryFn: ({ signal }) => listAuthorizations(patientId, serviceDate, signal), enabled: Boolean(patientId && serviceDate) && canReadAuthorizations })

  const startMutation = useMutation({
    mutationFn: () => changeAppointmentStatus(appointmentId, { status: 'IN_PROGRESS' }),
    onSuccess: async (appointment) => {
      queryClient.setQueryData(appointmentKeys.detail(appointmentId), appointment)
      setNotice('Appointment started. The clinical encounter can now be opened.')
      await Promise.all([queryClient.invalidateQueries({ queryKey: appointmentKeys.lists() }), queryClient.invalidateQueries({ queryKey: receptionKeys.all })])
    },
  })
  const createMutation = useMutation({
    mutationFn: () => createEncounter(appointmentId, { chiefComplaint: chiefComplaint || null, clinicalNotes: clinicalNotes || null }),
    onSuccess: (encounter) => {
      queryClient.setQueryData(encounterKeys.byAppointment(appointmentId), encounter)
      queryClient.setQueryData(encounterKeys.detail(encounter.id), encounter)
      setNotice('Clinical encounter opened.')
    },
  })
  const completeMutation = useMutation({
    mutationFn: () => completeEncounter(encounterId),
    onSuccess: async (encounter) => {
      queryClient.setQueryData(encounterKeys.byAppointment(appointmentId), encounter)
      queryClient.setQueryData(encounterKeys.detail(encounter.id), encounter)
      setCompleteOpen(false)
      setNotice('Clinical encounter completed and is now read-only.')
      await queryClient.invalidateQueries({ queryKey: appointmentKeys.detail(appointmentId) })
    },
  })

  if (appointmentQuery.isPending) return <LoadingState label="Loading clinical appointment" />
  if (appointmentQuery.isError) return <ErrorState title="Unable to load appointment" description={getApiErrorMessage(appointmentQuery.error)} onRetry={() => void appointmentQuery.refetch()} />
  if (encounterQuery.isPending) return <LoadingState label="Loading clinical encounter" />
  if (encounterQuery.isError) return <ErrorState title="Unable to load clinical encounter" description={getApiErrorMessage(encounterQuery.error)} onRetry={() => void encounterQuery.refetch()} />

  const appointment = appointmentQuery.data
  const encounter = encounterQuery.data
  const editable = encounter?.status === 'OPEN'
  const primaryInsurance = insuranceQuery.data?.find((item) => item.isPrimary) ?? insuranceQuery.data?.[0]
  const canStart = appointment.status === 'CHECKED_IN' && hasPermission(permissions, 'appointment.start')
  const canCreate = appointment.status === 'IN_PROGRESS' && !encounter && hasPermission(permissions, 'encounter.create')
  const canComplete = editable && hasPermission(permissions, 'encounter.complete')

  return (
    <div className="mx-auto max-w-[1320px]">
      <div className="mb-3 text-sm"><Link to={`/appointments/${appointment.id}`} className="text-clinic-blue hover:underline">Appointment {appointment.appointmentNumber}</Link><span className="mx-2 text-slate-400">/</span><span className="text-slate-500">Clinical workspace</span></div>
      <PageHeader title={appointmentPatientName(appointment)} description={`${formatBusinessDateTime(appointment.scheduledStart)} · ${appointmentProviderName(appointment)} · ${appointment.location.name}`} actions={canComplete ? <Button onClick={() => setCompleteOpen(true)}><CheckCircle2 size={16} />Complete encounter</Button> : undefined} />
      {notice ? <div role="status" className="mb-4 flex items-center justify-between rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"><span className="flex items-center gap-2"><CheckCircle2 size={16} />{notice}</span><button type="button" className="font-medium hover:underline" onClick={() => setNotice(null)}>Dismiss</button></div> : null}

      <Card className="mb-5 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div className="flex flex-wrap items-center gap-2"><StatusBadge tone={appointmentStatusTone(appointment.status)}>{appointmentStatusLabel(appointment.status)}</StatusBadge>{encounter ? <StatusBadge tone={encounterTone(encounter.status)}>{`Encounter ${encounter.status.toLowerCase()}`}</StatusBadge> : <StatusBadge tone="neutral">No encounter</StatusBadge>}</div>{canStart ? <Button disabled={startMutation.isPending} onClick={() => startMutation.mutate()}><Play size={16} />{startMutation.isPending ? 'Starting...' : 'Start appointment'}</Button> : null}</div>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><Field label="Patient number" value={appointment.patient.patientNumber} /><Field label="Provider" value={appointmentProviderName(appointment)} /><Field label="Clinic location" value={`${appointment.location.name} (${appointment.location.code})`} /><Field label="Insurance" value={primaryInsurance ? `${primaryInsurance.payer.name} · ${primaryInsurance.insuredId}` : canReadInsurance && insuranceQuery.isPending ? 'Loading...' : null} /><Field label="Treatment case" value={appointment.treatmentCaseId ? 'Linked by Backend' : 'Not linked'} /></dl>
        {startMutation.isError ? <p role="alert" className="mt-4 text-sm text-clinic-danger">{getApiErrorMessage(startMutation.error)}</p> : null}
      </Card>

      {!encounter ? (
        <Card className="p-5">
          <div className="mb-5 flex items-start gap-3"><div className="rounded-md bg-clinic-blue-soft p-2 text-clinic-blue"><ClipboardPlus size={20} /></div><div><h3 className="font-semibold text-slate-900">Open clinical encounter</h3><p className="mt-1 text-sm text-slate-500">An encounter can be created only after the appointment is in progress.</p></div></div>
          {appointment.status !== 'IN_PROGRESS' ? <EmptyState title="Encounter not available yet" description={appointment.status === 'CHECKED_IN' ? 'Start the appointment before opening the encounter.' : `The appointment is ${appointmentStatusLabel(appointment.status).toLowerCase()}.`} /> : <div className="space-y-4"><div><label htmlFor="newChiefComplaint" className="mb-1.5 block text-sm font-medium text-slate-700">Chief complaint</label><Textarea id="newChiefComplaint" value={chiefComplaint} onChange={(event) => setChiefComplaint(event.target.value)} /></div><div><label htmlFor="newClinicalNotes" className="mb-1.5 block text-sm font-medium text-slate-700">Initial clinical notes</label><Textarea id="newClinicalNotes" value={clinicalNotes} onChange={(event) => setClinicalNotes(event.target.value)} /></div>{createMutation.isError ? <p role="alert" className="text-sm text-clinic-danger">{getApiErrorMessage(createMutation.error)}</p> : null}{canCreate ? <div className="flex justify-end"><Button disabled={createMutation.isPending} onClick={() => createMutation.mutate()}><ClipboardPlus size={16} />{createMutation.isPending ? 'Opening...' : 'Open encounter'}</Button></div> : <ErrorState title="Encounter creation unavailable" description="Encounter create permission is required." />}</div>}
        </Card>
      ) : (
        <div className="space-y-5">
          <EncounterNotes key={`${encounter.id}-${encounter.updatedAt}`} encounter={encounter} appointmentId={appointmentId} onSaved={() => setNotice('Clinical notes saved.')} />
          <Card className="p-5"><DiagnosisSection encounterId={encounter.id} editable={editable} /></Card>
          {canReadAuthorizations ? <Card className="p-5"><h3 className="font-semibold text-slate-900">Authorization context</h3><p className="mt-0.5 text-sm text-slate-500">Authoritative authorization records valid for the patient and service date.</p>{authorizationsQuery.isPending ? <div className="mt-4"><LoadingState label="Loading authorizations" /></div> : authorizationsQuery.isError ? <div className="mt-4"><ErrorState title="Unable to load authorizations" description={getApiErrorMessage(authorizationsQuery.error)} /></div> : (authorizationsQuery.data?.data.length ?? 0) === 0 ? <div className="mt-4"><EmptyState title="No authorization records found" /></div> : <div className="mt-4 grid gap-3 md:grid-cols-2">{authorizationsQuery.data?.data.map((authorization) => <div key={authorization.id} className="rounded-md border border-clinic-border p-3"><div className="flex items-center justify-between gap-2"><span className="font-mono text-sm font-semibold">{authorization.authorizationId}</span><StatusBadge tone={authorization.status === 'APPROVED' || authorization.status === 'PARTIALLY_USED' ? 'success' : authorization.status === 'PENDING' ? 'warning' : 'neutral'}>{authorization.status.replaceAll('_', ' ').toLowerCase()}</StatusBadge></div><p className="mt-2 text-xs text-slate-500">{authorization.patientInsurance.payer.name} · {authorization.items.length} item(s)</p></div>)}</div>}</Card> : null}
          <Card className="p-5"><ProcedureSection encounterId={encounter.id} patientId={appointment.patientId} serviceDate={serviceDate} insurance={insuranceQuery.data ?? []} diagnoses={diagnosesQuery.data ?? []} editable={editable} /></Card>
          {completeMutation.isError ? <ErrorState title="Unable to complete encounter" description={getApiErrorMessage(completeMutation.error)} /> : null}
        </div>
      )}
      <ConfirmDialog open={completeOpen} title="Complete clinical encounter" description="Completion makes the encounter and its clinical records read-only. It does not complete the appointment or create an invoice." confirmLabel={completeMutation.isPending ? 'Completing...' : 'Complete encounter'} onCancel={() => setCompleteOpen(false)} onConfirm={() => completeMutation.mutate()} />
    </div>
  )
}
