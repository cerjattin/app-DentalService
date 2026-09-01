import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Plus, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { getApiErrorMessage } from '../../api'
import { PermissionGuard } from '../../auth/permission-guard'
import { PageHeader } from '../../components/app-shell/page-header'
import { DataTable, type DataTableColumn } from '../../components/data-table/data-table'
import { EmptyState } from '../../components/feedback/empty-state'
import { ErrorState } from '../../components/feedback/error-state'
import { LoadingState } from '../../components/feedback/loading-state'
import { StatusBadge } from '../../components/feedback/status-badge'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Select } from '../../components/ui/select'
import type { Patient, PatientListFilters, PatientStatus } from '../../types/patient'
import { createPatient, listPatients, patientKeys } from './patient-api'
import { PatientFormDialog } from './patient-form-dialog'
import { formatDateOnly, patientFullName } from './patient-formatters'

const PAGE_SIZE = 20

function patientTone(status: PatientStatus) {
  if (status === 'ACTIVE') return 'success' as const
  if (status === 'ARCHIVED') return 'danger' as const
  return 'neutral' as const
}

export function PatientsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<PatientStatus | ''>('')
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [searchInput])

  const filters: PatientListFilters = {
    page,
    pageSize: PAGE_SIZE,
    ...(search ? { q: search } : {}),
    ...(status ? { status } : {}),
  }

  const patientsQuery = useQuery({
    queryKey: patientKeys.list(filters),
    queryFn: ({ signal }) => listPatients(filters, signal),
    placeholderData: keepPreviousData,
  })

  const createMutation = useMutation({
    mutationFn: createPatient,
    onSuccess: async (patient) => {
      setCreateOpen(false)
      queryClient.setQueryData(patientKeys.detail(patient.id), patient)
      await queryClient.invalidateQueries({ queryKey: patientKeys.lists() })
      navigate(`/patients/${patient.id}`, { state: { notice: 'Patient created.' } })
    },
  })

  const columns = useMemo<DataTableColumn<Patient>[]>(
    () => [
      {
        key: 'patient',
        header: 'Patient',
        render: (patient) => (
          <div className="min-w-48">
            <Link className="font-semibold text-clinic-blue hover:underline" to={`/patients/${patient.id}`}>
              {patientFullName(patient)}
            </Link>
            <div className="mt-0.5 font-mono text-xs text-slate-500">{patient.patientNumber}</div>
          </div>
        ),
      },
      {
        key: 'document',
        header: 'Document',
        render: (patient) => patient.documentNumber ? (
          <div>
            <div>{patient.documentNumber}</div>
            <div className="text-xs text-slate-500">{patient.documentType ?? 'Type not provided'}</div>
          </div>
        ) : <span className="text-slate-400">Not provided</span>,
      },
      { key: 'birthDate', header: 'Birth date', render: (patient) => formatDateOnly(patient.dateOfBirth) },
      { key: 'contact', header: 'Contact', render: (patient) => patient.mobilePhone ?? patient.phone ?? patient.email ?? 'Not provided' },
      {
        key: 'insurance',
        header: 'Insurance',
        render: (patient) => {
          const coverage = patient.insuranceCoverages.find((item) => item.isPrimary) ?? patient.insuranceCoverages[0]
          return coverage ? (
            <div>
              <div className="font-medium">{coverage.payer.name}</div>
              <div className="font-mono text-xs text-slate-500">{coverage.insuredId}</div>
            </div>
          ) : <span className="text-slate-400">None recorded</span>
        },
      },
      {
        key: 'status',
        header: 'Status',
        render: (patient) => (
          <StatusBadge tone={patientTone(patient.status)}>
            {patient.status.charAt(0) + patient.status.slice(1).toLowerCase()}
          </StatusBadge>
        ),
      },
    ],
    [],
  )

  const rows = patientsQuery.data?.data ?? []
  const pagination = patientsQuery.data?.meta
  const hasFilters = Boolean(search || status)

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader
        title="Patients"
        description="Find patient records and review SVB insurance information."
        actions={
          <PermissionGuard anyOf={['patient.create']}>
            <Button onClick={() => setCreateOpen(true)}><Plus size={16} aria-hidden="true" />Create patient</Button>
          </PermissionGuard>
        }
      />
      <div className="mb-4 flex flex-col gap-3 rounded-lg border border-clinic-border bg-white p-4 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor="patientSearch" className="mb-1.5 block text-sm font-medium text-slate-700">Search patients</label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} aria-hidden="true" />
            <Input id="patientSearch" className="pl-9 pr-9" placeholder="Search by name, patient number, document, phone, or insured ID" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
            {searchInput ? (
              <button type="button" className="absolute right-2 top-1.5 rounded p-1 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinic-blue" aria-label="Clear search" onClick={() => setSearchInput('')}>
                <X size={16} />
              </button>
            ) : null}
          </div>
        </div>
        <div className="w-full sm:w-48">
          <label htmlFor="patientStatus" className="mb-1.5 block text-sm font-medium text-slate-700">Status</label>
          <Select id="patientStatus" value={status} onChange={(event) => { setStatus(event.target.value as PatientStatus | ''); setPage(1) }}>
            <option value="">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="ARCHIVED">Archived</option>
          </Select>
        </div>
      </div>

      {patientsQuery.isPending ? <LoadingState label="Loading patients" /> : patientsQuery.isError ? (
        <ErrorState title="Unable to load patients" description={getApiErrorMessage(patientsQuery.error)} onRetry={() => void patientsQuery.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'No patients found' : 'No patients yet'}
          description={hasFilters ? 'Try a different search or status filter.' : 'Create the first patient record when you are ready.'}
          action={hasFilters ? <Button variant="secondary" onClick={() => { setSearchInput(''); setStatus('') }}>Clear filters</Button> : undefined}
        />
      ) : (
        <>
          <DataTable columns={columns} rows={rows} getRowKey={(patient) => patient.id} />
          <div className="mt-3 flex flex-col gap-2 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>{pagination ? `${pagination.total} patient${pagination.total === 1 ? '' : 's'}` : `${rows.length} patients`}</span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" className="h-8 w-8 px-0" aria-label="Previous page" disabled={page <= 1 || patientsQuery.isFetching} onClick={() => setPage((current) => current - 1)}><ChevronLeft size={16} /></Button>
              <span>Page {pagination?.page ?? page} of {pagination?.totalPages ?? 1}</span>
              <Button variant="secondary" className="h-8 w-8 px-0" aria-label="Next page" disabled={page >= (pagination?.totalPages ?? 1) || patientsQuery.isFetching} onClick={() => setPage((current) => current + 1)}><ChevronRight size={16} /></Button>
            </div>
          </div>
        </>
      )}

      <PatientFormDialog
        open={createOpen}
        onOpenChange={(open) => { setCreateOpen(open); if (!open) createMutation.reset() }}
        onSubmit={(values) => createMutation.mutate(values)}
        isPending={createMutation.isPending}
        error={createMutation.error}
      />
    </div>
  )
}
