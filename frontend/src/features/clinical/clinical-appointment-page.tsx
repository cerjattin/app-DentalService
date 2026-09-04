import { zodResolver } from '@hookform/resolvers/zod'
import { AppointmentBilling } from '../billing/appointment-billing'
import {
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useParams } from 'react-router'
import { CheckCircle2, Play, Save, Stethoscope } from 'lucide-react'
import { z } from 'zod'
import { PermissionGuard } from '../../auth/permission-guard'
import { hasPermission } from '../../auth/permissions'
import { useAuth } from '../../auth/use-auth'
import { PageHeader } from '../../components/app-shell/page-header'
import { LoadingState } from '../../components/feedback/loading-state'
import { StatusBadge } from '../../components/feedback/status-badge'
import { FormField } from '../../components/forms/form-field'
import { Button } from '../../components/ui/button'
import { Textarea } from '../../components/ui/textarea'
import { formatBusinessDate, formatBusinessDateTime } from '../../lib/timezone'
import type { ClinicalEncounter, EncounterWriteDto } from '../../types/clinical'
import { AccessDeniedPage } from '../auth/access-denied-page'
import {
  appointmentKeys,
  changeAppointmentStatus,
  getAppointment,
  receptionKeys,
} from '../appointments/appointment-api'
import {
  appointmentPatientName,
  appointmentProviderName,
  appointmentStatusLabel,
  appointmentStatusTone,
} from '../appointments/appointment-model'
import { listPatientInsurance, patientKeys } from '../patients/patient-api'
import { formatDateOnly } from '../patients/patient-formatters'
import {
  completeEncounter,
  createEncounter,
  encounterKeys,
  getEncounter,
  updateEncounter,
} from './clinical-api'
import { ClinicalConfirm, ClinicalSection, MutationError } from './clinical-ui'
import { clinicalLabel, notesSchema } from './clinical-model'
import { DiagnosisSection } from './diagnosis-section'
import { ProcedureSection } from './procedure-section'
import { AuthorizationSection } from './authorization-section'

export function ClinicalAppointmentPage() {
  const { appointmentId = '' } = useParams()
  return (
    <PermissionGuard
      allOf={['encounter.read', 'appointment.read']}
      fallback={<AccessDeniedPage />}
    >
      {/^[1-9]\d*$/.test(appointmentId) ? (
        <ClinicalWorkspace key={appointmentId} appointmentId={appointmentId} />
      ) : (
        <>
          <PageHeader
            title="Clinical workspace"
            description="Select an appointment to open its clinical record."
          />
          <Link to="/appointments" className="text-clinic-blue hover:underline">
            Open appointments
          </Link>
        </>
      )}
    </PermissionGuard>
  )
}
function ClinicalWorkspace({ appointmentId }: { appointmentId: string }) {
  const { permissions } = useAuth()
  const client = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [notice, setNotice] = useState('')
  const pendingMutations = useIsMutating()
  const appointment = useQuery({
    queryKey: appointmentKeys.detail(appointmentId),
    queryFn: ({ signal }) => getAppointment(appointmentId, signal),
  })
  const encounter = useQuery({
    queryKey: encounterKeys.appointment(appointmentId),
    queryFn: ({ signal }) => getEncounter(appointmentId, signal),
    enabled: appointment.isSuccess,
  })
  const insurance = useQuery({
    queryKey: patientKeys.insurance(appointment.data?.patientId ?? ''),
    queryFn: ({ signal }) =>
      listPatientInsurance(appointment.data!.patientId, signal),
    enabled:
      Boolean(appointment.data) && hasPermission(permissions, 'insurance.read'),
  })
  const refreshAppointment = async () => {
    await Promise.all([
      client.invalidateQueries({
        queryKey: appointmentKeys.detail(appointmentId),
      }),
      client.invalidateQueries({ queryKey: appointmentKeys.lists() }),
      client.invalidateQueries({ queryKey: receptionKeys.all }),
    ])
  }
  const start = useMutation({
    mutationFn: () =>
      changeAppointmentStatus(appointmentId, { status: 'IN_PROGRESS' }),
    onSuccess: async (data) => {
      client.setQueryData(appointmentKeys.detail(appointmentId), data)
      setNotice('Appointment started. You can now open the encounter.')
      await refreshAppointment()
    },
  })
  const open = useMutation({
    mutationFn: () => createEncounter(appointmentId, {}),
    onSuccess: async (data) => {
      client.setQueryData(encounterKeys.appointment(appointmentId), data)
      setNotice('Encounter opened.')
      await refreshAppointment()
    },
    onError: () => {
      void client.invalidateQueries({
        queryKey: encounterKeys.appointment(appointmentId),
      })
    },
  })
  const complete = useMutation({
    mutationFn: () => completeEncounter(encounter.data!.id),
    onSuccess: async (data) => {
      client.setQueryData(encounterKeys.appointment(appointmentId), data)
      setConfirming(false)
      setNotice('Encounter completed. Clinical history is read only.')
      await refreshAppointment()
    },
  })
  const saveNotes = async (values: EncounterWriteDto) => {
    const saved = await updateEncounter(encounter.data!.id, values)
    client.setQueryData(encounterKeys.appointment(appointmentId), saved)
    setNotice('Clinical notes saved.')
    return saved
  }
  if (appointment.isPending)
    return <LoadingState label="Loading clinical appointment" />
  if (appointment.isError)
    return (
      <>
        <PageHeader title="Clinical workspace" />
        <MutationError error={appointment.error} />
        <Button onClick={() => void appointment.refetch()}>
          Retry appointment
        </Button>
      </>
    )
  const record = appointment.data
  const current = encounter.data
  const serviceDate = formatBusinessDate(record.scheduledStart)
  return (
    <div className="mx-auto max-w-[1280px]">
      <PageHeader
        title="Clinical workspace"
        description={record.appointmentNumber}
        actions={
          <Link
            className="text-sm text-clinic-blue hover:underline"
            to={`/appointments/${appointmentId}`}
          >
            Appointment details
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4 border-y border-clinic-border bg-white py-4">
        <div className="min-w-0">
          <h2 className="break-words text-lg font-semibold">
            {appointmentPatientName(record)}
          </h2>
          <p className="text-xs font-mono text-slate-500">
            {record.patient.patientNumber} ·{' '}
            {record.patient.documentNumber ?? 'Document not provided'}
          </p>
          <PermissionGuard allOf={['patient.read']}>
            <Link
              className="text-sm text-clinic-blue"
              to={`/patients/${record.patientId}`}
            >
              Patient record
            </Link>
          </PermissionGuard>
        </div>
        <div className="text-sm">
          <p>{appointmentProviderName(record)}</p>
          <p className="text-slate-500">{record.location.name}</p>
          <p>{formatBusinessDateTime(record.scheduledStart)}</p>
        </div>
        <StatusBadge tone={appointmentStatusTone(record.status)}>
          {appointmentStatusLabel(record.status)}
        </StatusBadge>
      </div>
      {notice ? (
        <p
          role="status"
          className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-800"
        >
          {notice}
        </p>
      ) : null}
      {current?.status === 'COMPLETED' ? <AppointmentBilling appointment={record} /> : null}
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0">
          <ClinicalSection title="Encounter">
            {encounter.isPending ? (
              <LoadingState label="Loading encounter" />
            ) : encounter.isError ? (
              <>
                <MutationError error={encounter.error} />
                <Button onClick={() => void encounter.refetch()}>
                  Retry encounter
                </Button>
              </>
            ) : !current ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  No clinical encounter recorded.
                </p>
                {record.status === 'CHECKED_IN' ? (
                  <PermissionGuard
                    allOf={['appointment.start']}
                    fallback={
                      <p className="text-sm text-amber-700">
                        A professional with appointment start permission must
                        start this appointment.
                      </p>
                    }
                  >
                    <Button
                      disabled={start.isPending}
                      onClick={() => start.mutate()}
                    >
                      <Play size={16} />
                      {start.isPending ? 'Starting...' : 'Start appointment'}
                    </Button>
                  </PermissionGuard>
                ) : record.status === 'IN_PROGRESS' ? (
                  <PermissionGuard allOf={['encounter.create']}>
                    <Button
                      disabled={open.isPending}
                      onClick={() => open.mutate()}
                    >
                      <Stethoscope size={16} />
                      {open.isPending ? 'Opening...' : 'Open encounter'}
                    </Button>
                  </PermissionGuard>
                ) : (
                  <p className="text-sm text-amber-700">
                    The appointment must be in progress before an encounter can
                    be opened.
                  </p>
                )}
                <MutationError error={start.error ?? open.error} />
              </div>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <StatusBadge
                    tone={
                      current.status === 'COMPLETED'
                        ? 'success'
                        : current.status === 'OPEN'
                          ? 'info'
                          : 'neutral'
                    }
                  >
                    {clinicalLabel(current.status)}
                  </StatusBadge>
                  <span className="text-xs text-slate-500">
                    Started {formatBusinessDateTime(current.startedAt)}
                  </span>
                  {current.completedAt ? (
                    <span className="text-xs text-slate-500">
                      Completed {formatBusinessDateTime(current.completedAt)}
                    </span>
                  ) : null}
                </div>
                {current.status !== 'OPEN' ? (
                  <p className="mb-4 text-sm text-slate-500">
                    This encounter is read only.
                  </p>
                ) : null}
                <EncounterNotes
                  key={`${current.id}-${current.status}`}
                  encounter={current}
                  onSave={saveNotes}
                  onDirty={setDirty}
                />
              </>
            )}
          </ClinicalSection>
          {current ? (
            <>
              <PermissionGuard
                allOf={['diagnosis.read']}
                fallback={
                  <ClinicalSection title="Diagnoses">
                    <p className="text-sm text-slate-500">
                      Diagnosis access is not permitted.
                    </p>
                  </ClinicalSection>
                }
              >
                <DiagnosisSection
                  encounter={current}
                  serviceDate={serviceDate}
                />
              </PermissionGuard>
              <ClinicalSection title="Treatment context">
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-slate-500">Treatment case reference</dt>
                    <dd className="font-mono">
                      {record.treatmentCaseId ?? 'Not recorded'}
                    </dd>
                  </div>
                </dl>
              </ClinicalSection>
              <PermissionGuard
                allOf={['procedure.read']}
                fallback={
                  <ClinicalSection title="Performed procedures">
                    <p className="text-sm text-slate-500">
                      Procedure access is not permitted.
                    </p>
                  </ClinicalSection>
                }
              >
                <ProcedureSection
                  encounter={current}
                  serviceDate={serviceDate}
                  insurance={insurance.data ?? []}
                />
              </PermissionGuard>
              <PermissionGuard allOf={['authorization.read']}>
                <AuthorizationSection
                  encounterId={current.id}
                  patientId={record.patientId}
                  insurance={insurance.data ?? []}
                  serviceDate={serviceDate}
                  readOnly={current.status !== 'OPEN'}
                />
              </PermissionGuard>
            </>
          ) : null}
        </div>
        <aside className="min-w-0 xl:sticky xl:top-4 xl:self-start">
          <ClinicalSection title="Insurance">
            <PermissionGuard
              allOf={['insurance.read']}
              fallback={
                <p className="text-sm text-slate-500">
                  Insurance access is not permitted.
                </p>
              }
            >
              {insurance.isPending ? (
                <LoadingState label="Loading insurance" />
              ) : insurance.isError ? (
                <>
                  <MutationError error={insurance.error} />
                  <Button onClick={() => void insurance.refetch()}>
                    Retry insurance
                  </Button>
                </>
              ) : insurance.data?.length ? (
                insurance.data.map((row) => (
                  <div key={row.id} className="mb-4 space-y-1 text-sm">
                    <p className="font-medium">{row.payer.name}</p>
                    <p className="font-mono">{row.insuredId}</p>
                    <StatusBadge>{clinicalLabel(row.status)}</StatusBadge>
                    <p className="text-xs text-slate-500">
                      {formatDateOnly(row.validFrom)} -{' '}
                      {formatDateOnly(row.validTo)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No insurance recorded.</p>
              )}
            </PermissionGuard>
          </ClinicalSection>
          {current?.status === 'OPEN' ? (
            <PermissionGuard allOf={['encounter.complete']}>
              <ClinicalSection title="Completion">
                {dirty ? (
                  <p className="mb-3 text-sm text-amber-700">
                    Save clinical notes before completion.
                  </p>
                ) : null}
                <Button
                  className="min-h-11 w-full"
                  disabled={dirty || pendingMutations > 0}
                  onClick={() => {
                    complete.reset()
                    setConfirming(true)
                  }}
                >
                  <CheckCircle2 size={16} />
                  Complete encounter
                </Button>
              </ClinicalSection>
            </PermissionGuard>
          ) : null}
        </aside>
      </div>
      {confirming && current?.status === 'OPEN' ? (
        <ClinicalConfirm
          title="Complete encounter?"
          description="Clinical notes, diagnoses and procedures will become read only. The appointment status is managed separately."
          pending={complete.isPending}
          error={complete.error}
          onClose={() => setConfirming(false)}
          onConfirm={() => complete.mutate()}
        />
      ) : null}
    </div>
  )
}
const notesFormSchema = z.object({
  chiefComplaint: notesSchema,
  clinicalNotes: notesSchema,
})
function EncounterNotes({
  encounter,
  onSave,
  onDirty,
}: {
  encounter: ClinicalEncounter
  onSave: (values: EncounterWriteDto) => Promise<ClinicalEncounter>
  onDirty: (dirty: boolean) => void
}) {
  const { permissions } = useAuth()
  const form = useForm<z.infer<typeof notesFormSchema>>({
    resolver: zodResolver(notesFormSchema),
    defaultValues: {
      chiefComplaint: encounter.chiefComplaint ?? '',
      clinicalNotes: encounter.clinicalNotes ?? '',
    },
  })
  useEffect(() => {
    onDirty(form.formState.isDirty)
    return () => onDirty(false)
  }, [form.formState.isDirty, onDirty])
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof notesFormSchema>) =>
      onSave({
        chiefComplaint: values.chiefComplaint || null,
        clinicalNotes: values.clinicalNotes || null,
      }),
    onSuccess: (saved) =>
      form.reset({
        chiefComplaint: saved.chiefComplaint ?? '',
        clinicalNotes: saved.clinicalNotes ?? '',
      }),
  })
  if (
    encounter.status !== 'OPEN' ||
    !hasPermission(permissions, 'encounter.update')
  )
    return (
      <dl className="space-y-4 text-sm">
        <div>
          <dt className="font-medium">Chief complaint</dt>
          <dd className="whitespace-pre-wrap break-words text-slate-600">
            {encounter.chiefComplaint ?? 'Not recorded'}
          </dd>
        </div>
        <div>
          <dt className="font-medium">Clinical notes</dt>
          <dd className="whitespace-pre-wrap break-words text-slate-600">
            {encounter.clinicalNotes ?? 'Not recorded'}
          </dd>
        </div>
      </dl>
    )
  return (
    <form
      className="space-y-4"
      onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
    >
      <FormField
        label="Chief complaint"
        htmlFor="chief-complaint"
        error={form.formState.errors.chiefComplaint?.message}
      >
        <Textarea
          id="chief-complaint"
          rows={2}
          {...form.register('chiefComplaint')}
        />
      </FormField>
      <FormField
        label="Clinical notes"
        htmlFor="clinical-notes"
        error={form.formState.errors.clinicalNotes?.message}
      >
        <Textarea
          id="clinical-notes"
          rows={4}
          {...form.register('clinicalNotes')}
        />
      </FormField>
      <MutationError error={mutation.error} />
      <PermissionGuard allOf={['encounter.update']}>
        <Button
          variant="secondary"
          type="submit"
          disabled={mutation.isPending || !form.formState.isDirty}
        >
          <Save size={16} />
          {mutation.isPending ? 'Saving...' : 'Save notes'}
        </Button>
      </PermissionGuard>
    </form>
  )
}
