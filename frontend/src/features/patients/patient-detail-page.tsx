import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Pencil, Plus, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { getApiErrorMessage } from '../../api'
import { PermissionGuard } from '../../auth/permission-guard'
import { hasPermission } from '../../auth/permissions'
import { useAuth } from '../../auth/use-auth'
import { PageHeader } from '../../components/app-shell/page-header'
import { EmptyState } from '../../components/feedback/empty-state'
import { ErrorState } from '../../components/feedback/error-state'
import { LoadingState } from '../../components/feedback/loading-state'
import { StatusBadge } from '../../components/feedback/status-badge'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import { formatBusinessDateTime } from '../../lib/timezone'
import type { InsuranceWriteDto, PatientInsurance } from '../../types/patient'
import { InsuranceFormDialog } from './insurance-form-dialog'
import {
  createInsurance,
  getPatient,
  listPatientInsurance,
  listPayers,
  patientKeys,
  updateInsurance,
  updatePatient,
  verifyInsurance,
} from './patient-api'
import { PatientFormDialog } from './patient-form-dialog'
import { formatDateOnly, patientFullName } from './patient-formatters'
import { VerifyInsuranceDialog } from './verify-insurance-dialog'

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-800">{value || 'Not provided'}</dd>
    </div>
  )
}

function insuranceTone(status: PatientInsurance['status']) {
  if (status === 'ACTIVE') return 'success' as const
  if (status === 'SUSPENDED') return 'warning' as const
  if (status === 'EXPIRED') return 'danger' as const
  return 'neutral' as const
}

function displayStatus(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase()
}

export function PatientDetailPage() {
  const { patientId = '' } = useParams()
  const location = useLocation()
  const { permissions } = useAuth()
  const queryClient = useQueryClient()
  const canReadInsurance = hasPermission(permissions, 'insurance.read')
  const [editPatientOpen, setEditPatientOpen] = useState(false)
  const [insuranceFormOpen, setInsuranceFormOpen] = useState(false)
  const [selectedInsurance, setSelectedInsurance] = useState<PatientInsurance>()
  const [verifyTarget, setVerifyTarget] = useState<PatientInsurance>()
  const [notice, setNotice] = useState<string | null>(
    (location.state as { notice?: string } | null)?.notice ?? null,
  )

  const patientQuery = useQuery({
    queryKey: patientKeys.detail(patientId),
    queryFn: ({ signal }) => getPatient(patientId, signal),
    enabled: Boolean(patientId),
  })
  const insuranceQuery = useQuery({
    queryKey: patientKeys.insurance(patientId),
    queryFn: ({ signal }) => listPatientInsurance(patientId, signal),
    enabled: Boolean(patientId) && canReadInsurance,
  })
  const payerQuery = useQuery({
    queryKey: patientKeys.payers(),
    queryFn: ({ signal }) => listPayers(signal),
    enabled: Boolean(patientId) && canReadInsurance,
    staleTime: 5 * 60_000,
  })

  async function refreshPatient() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: patientKeys.detail(patientId) }),
      queryClient.invalidateQueries({ queryKey: patientKeys.insurance(patientId) }),
      queryClient.invalidateQueries({ queryKey: patientKeys.lists() }),
    ])
  }

  const patientMutation = useMutation({
    mutationFn: (values: Parameters<typeof updatePatient>[1]) => updatePatient(patientId, values),
    onSuccess: async (patient) => {
      queryClient.setQueryData(patientKeys.detail(patientId), patient)
      setEditPatientOpen(false)
      setNotice('Patient information updated.')
      await queryClient.invalidateQueries({ queryKey: patientKeys.lists() })
    },
  })
  const insuranceMutation = useMutation({
    mutationFn: (values: InsuranceWriteDto) =>
      selectedInsurance
        ? updateInsurance(patientId, selectedInsurance.id, values)
        : createInsurance(patientId, values),
    onSuccess: async () => {
      setInsuranceFormOpen(false)
      setSelectedInsurance(undefined)
      setNotice('Insurance information saved.')
      await refreshPatient()
    },
  })
  const verifyMutation = useMutation({
    mutationFn: (source: string) => {
      if (!verifyTarget) throw new Error('No insurance selected')
      return verifyInsurance(patientId, verifyTarget.id, source)
    },
    onSuccess: async () => {
      setVerifyTarget(undefined)
      setNotice('Insurance verification recorded.')
      await refreshPatient()
    },
  })

  if (patientQuery.isPending) return <LoadingState label="Loading patient" />
  if (patientQuery.isError) {
    return <ErrorState title="Unable to load patient" description={getApiErrorMessage(patientQuery.error)} onRetry={() => void patientQuery.refetch()} />
  }

  const patient = patientQuery.data
  const address = [patient.addressLine1, patient.addressLine2, patient.city, patient.countryCode].filter(Boolean).join(', ')

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="mb-3 text-sm"><Link to="/patients" className="text-clinic-blue hover:underline">Patients</Link><span className="mx-2 text-slate-400">/</span><span className="text-slate-500">{patient.patientNumber}</span></div>
      <PageHeader
        title={patientFullName(patient)}
        description={`Patient ${patient.patientNumber}`}
        actions={
          <PermissionGuard anyOf={['patient.update']}>
            <Button variant="secondary" onClick={() => setEditPatientOpen(true)}><Pencil size={16} />Edit patient</Button>
          </PermissionGuard>
        }
      />

      {notice ? (
        <div role="status" className="mb-4 flex items-center justify-between rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <span className="flex items-center gap-2"><CheckCircle2 size={16} />{notice}</span>
          <button type="button" className="font-medium hover:underline" onClick={() => setNotice(null)}>Dismiss</button>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between border-b border-clinic-border pb-3">
            <h3 className="font-semibold text-slate-900">Patient information</h3>
            <StatusBadge tone={patient.status === 'ACTIVE' ? 'success' : patient.status === 'ARCHIVED' ? 'danger' : 'neutral'}>{displayStatus(patient.status)}</StatusBadge>
          </div>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" value={patient.firstName} />
            <Field label="Middle name" value={patient.middleName} />
            <Field label="Last name" value={patient.lastName} />
            <Field label="Second last name" value={patient.secondLastName} />
            <Field label="Birth date" value={formatDateOnly(patient.dateOfBirth)} />
            <Field label="Sex" value={patient.sex ? displayStatus(patient.sex) : null} />
            <Field label="Document type" value={patient.documentType} />
            <Field label="Document number" value={patient.documentNumber} />
          </dl>
        </Card>
        <Card className="p-5">
          <h3 className="mb-4 border-b border-clinic-border pb-3 font-semibold text-slate-900">Contact information</h3>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Email" value={patient.email} />
            <Field label="Phone" value={patient.phone} />
            <Field label="Mobile phone" value={patient.mobilePhone} />
            <Field label="Address" value={address || null} />
          </dl>
        </Card>
      </div>

      <section className="mt-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-900">Insurance</h3>
            <p className="mt-0.5 text-sm text-slate-500">Backend-recorded coverage and verification information.</p>
          </div>
          <PermissionGuard allOf={['insurance.read', 'insurance.create']}>
            <Button disabled={!canReadInsurance || payerQuery.isPending} onClick={() => { setSelectedInsurance(undefined); setInsuranceFormOpen(true) }}><Plus size={16} />Add insurance</Button>
          </PermissionGuard>
        </div>

        {!canReadInsurance ? (
          <ErrorState title="Insurance access unavailable" description="You don't have permission to view insurance information." />
        ) : insuranceQuery.isPending ? <LoadingState label="Loading insurance" /> : insuranceQuery.isError ? (
          <ErrorState title="Unable to load insurance" description={getApiErrorMessage(insuranceQuery.error)} onRetry={() => void insuranceQuery.refetch()} />
        ) : insuranceQuery.data.length === 0 ? (
          <EmptyState title="No insurance recorded" description="No coverage records are attached to this patient." />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {insuranceQuery.data.map((insurance) => (
              <Card key={insurance.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-semibold text-slate-900">{insurance.payer.name}</h4>
                      {insurance.isPrimary ? <StatusBadge tone="info">Primary</StatusBadge> : null}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{insurance.payer.code} - {displayStatus(insurance.payer.payerType)}</p>
                  </div>
                  <StatusBadge tone={insuranceTone(insurance.status)}>{displayStatus(insurance.status)}</StatusBadge>
                </div>
                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Field label="Insured ID" value={insurance.insuredId} />
                  <Field label="Coverage period" value={`${formatDateOnly(insurance.validFrom)} - ${formatDateOnly(insurance.validTo)}`} />
                  <Field label="Last verified" value={insurance.verifiedAt ? formatBusinessDateTime(insurance.verifiedAt) : null} />
                  <Field label="Verification source" value={insurance.verificationSource} />
                </dl>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-clinic-border pt-3">
                  <PermissionGuard anyOf={['insurance.update']}>
                    <Button variant="secondary" onClick={() => { setSelectedInsurance(insurance); setInsuranceFormOpen(true) }}><Pencil size={15} />Edit</Button>
                  </PermissionGuard>
                  <PermissionGuard anyOf={['insurance.verify']}>
                    <Button variant="secondary" onClick={() => setVerifyTarget(insurance)}><ShieldCheck size={15} />Verify</Button>
                  </PermissionGuard>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <PatientFormDialog open={editPatientOpen} onOpenChange={(open) => { setEditPatientOpen(open); if (!open) patientMutation.reset() }} patient={patient} onSubmit={(values) => patientMutation.mutate(values)} isPending={patientMutation.isPending} error={patientMutation.error} />
      <InsuranceFormDialog open={insuranceFormOpen} onOpenChange={(open) => { setInsuranceFormOpen(open); if (!open) { setSelectedInsurance(undefined); insuranceMutation.reset() } }} insurance={selectedInsurance} payers={payerQuery.data ?? []} onSubmit={(values) => insuranceMutation.mutate(values)} isPending={insuranceMutation.isPending} error={insuranceMutation.error} />
      <VerifyInsuranceDialog open={Boolean(verifyTarget)} onOpenChange={(open) => { if (!open) { setVerifyTarget(undefined); verifyMutation.reset() } }} onSubmit={(source) => verifyMutation.mutate(source)} isPending={verifyMutation.isPending} error={verifyMutation.error} />
    </div>
  )
}
