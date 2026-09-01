import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Plus, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { getApiErrorMessage } from '../../api'
import { hasPermission } from '../../auth/permissions'
import { useAuth } from '../../auth/use-auth'
import { PageHeader } from '../../components/app-shell/page-header'
import { DataTable, type DataTableColumn } from '../../components/data-table/data-table'
import { EmptyState } from '../../components/feedback/empty-state'
import { ErrorState } from '../../components/feedback/error-state'
import { LoadingState } from '../../components/feedback/loading-state'
import { StatusBadge } from '../../components/feedback/status-badge'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Select } from '../../components/ui/select'
import { formatBusinessDate, formatBusinessTime } from '../../lib/timezone'
import type { Appointment, AppointmentListFilters, AppointmentStatus } from '../../types/appointment'
import { AppointmentActions } from './appointment-actions'
import { appointmentKeys, listActiveProviders, listAppointments } from './appointment-api'
import {
  appointmentPatientName,
  appointmentProviderName,
  appointmentStatusLabel,
  appointmentStatusTone,
  appointmentStatuses,
} from './appointment-model'

const PAGE_SIZE = 20

export function AppointmentsPage() {
  const { permissions } = useAuth()
  const canReadProviders = hasPermission(permissions, 'provider.read')
  const canReadPatients = hasPermission(permissions, 'patient.read')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [date, setDate] = useState('')
  const [status, setStatus] = useState<AppointmentStatus | ''>('')
  const [providerId, setProviderId] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [searchInput])

  const filters: AppointmentListFilters = {
    page,
    pageSize: PAGE_SIZE,
    ...(search ? { q: search } : {}),
    ...(date ? { date } : {}),
    ...(status ? { status } : {}),
    ...(providerId ? { providerId } : {}),
  }
  const appointmentsQuery = useQuery({
    queryKey: appointmentKeys.list(filters),
    queryFn: ({ signal }) => listAppointments(filters, signal),
    placeholderData: keepPreviousData,
  })
  const providersQuery = useQuery({
    queryKey: appointmentKeys.providers(),
    queryFn: ({ signal }) => listActiveProviders(signal),
    enabled: canReadProviders,
    staleTime: 5 * 60_000,
  })

  const columns = useMemo<DataTableColumn<Appointment>[]>(() => [
    {
      key: 'schedule',
      header: 'Schedule',
      render: (appointment) => (
        <div className="min-w-28">
          <div className="font-mono text-sm font-semibold text-slate-800">{formatBusinessTime(appointment.scheduledStart)}</div>
          <div className="mt-0.5 text-xs text-slate-500">{formatBusinessDate(appointment.scheduledStart)}</div>
        </div>
      ),
    },
    {
      key: 'patient',
      header: 'Patient',
      render: (appointment) => (
        <div className="min-w-44">
          {canReadPatients ? (
            <Link to={`/patients/${appointment.patient.id}`} className="font-semibold text-clinic-blue hover:underline">{appointmentPatientName(appointment)}</Link>
          ) : <span className="font-semibold text-slate-800">{appointmentPatientName(appointment)}</span>}
          <div className="mt-0.5 font-mono text-xs text-slate-500">{appointment.patient.patientNumber}</div>
        </div>
      ),
    },
    {
      key: 'provider',
      header: 'Provider',
      render: (appointment) => <div><div>{appointmentProviderName(appointment)}</div><div className="text-xs text-slate-500">{appointment.location.name}</div></div>,
    },
    { key: 'reason', header: 'Reason', render: (appointment) => appointment.reason ?? 'Not provided' },
    {
      key: 'status',
      header: 'Status',
      render: (appointment) => <StatusBadge tone={appointmentStatusTone(appointment.status)}>{appointmentStatusLabel(appointment.status)}</StatusBadge>,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (appointment) => (
        <div className="flex min-w-max items-center gap-2">
          <Link to={`/appointments/${appointment.id}`} className="inline-flex h-8 items-center rounded-md border border-clinic-border-strong bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50">View</Link>
          <AppointmentActions appointment={appointment} compact />
        </div>
      ),
    },
  ], [canReadPatients])

  const rows = appointmentsQuery.data?.data ?? []
  const pagination = appointmentsQuery.data?.meta
  const hasFilters = Boolean(search || date || status || providerId)

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader
        title="Appointments"
        description="Search the appointment schedule and manage front-desk status changes."
        actions={hasPermission(permissions, 'appointment.create') ? (
          <Button disabled title="Appointment creation requires a clinic-location lookup endpoint that is not available in the frozen backend."><Plus size={16} />Create appointment</Button>
        ) : undefined}
      />
      <div className="mb-4 grid gap-3 rounded-lg border border-clinic-border bg-white p-4 md:grid-cols-2 xl:grid-cols-[minmax(280px,1fr)_170px_170px_220px]">
        <div>
          <label htmlFor="appointmentSearch" className="mb-1.5 block text-sm font-medium text-slate-700">Search appointments</label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <Input id="appointmentSearch" className="pl-9 pr-9" placeholder="Appointment number, patient name, number, or document" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
            {searchInput ? <button type="button" aria-label="Clear search" className="absolute right-2 top-1.5 rounded p-1 text-slate-500 hover:bg-slate-100" onClick={() => setSearchInput('')}><X size={16} /></button> : null}
          </div>
        </div>
        <div>
          <label htmlFor="appointmentDate" className="mb-1.5 block text-sm font-medium text-slate-700">Date</label>
          <Input id="appointmentDate" type="date" value={date} onChange={(event) => { setDate(event.target.value); setPage(1) }} />
        </div>
        <div>
          <label htmlFor="appointmentStatus" className="mb-1.5 block text-sm font-medium text-slate-700">Status</label>
          <Select id="appointmentStatus" value={status} onChange={(event) => { setStatus(event.target.value as AppointmentStatus | ''); setPage(1) }}>
            <option value="">All statuses</option>
            {appointmentStatuses.map((value) => <option key={value} value={value}>{appointmentStatusLabel(value)}</option>)}
          </Select>
        </div>
        <div>
          <label htmlFor="appointmentProviderFilter" className="mb-1.5 block text-sm font-medium text-slate-700">Provider</label>
          <Select id="appointmentProviderFilter" value={providerId} disabled={!canReadProviders || providersQuery.isPending} onChange={(event) => { setProviderId(event.target.value); setPage(1) }}>
            <option value="">All providers</option>
            {(providersQuery.data?.data ?? []).map((provider) => <option key={provider.id} value={provider.id}>{provider.firstName} {provider.lastName}</option>)}
          </Select>
        </div>
      </div>

      {appointmentsQuery.isPending ? <LoadingState label="Loading appointments" /> : appointmentsQuery.isError ? (
        <ErrorState title="Unable to load appointments" description={getApiErrorMessage(appointmentsQuery.error)} onRetry={() => void appointmentsQuery.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title={hasFilters ? 'No appointments found' : 'No appointments yet'} description={hasFilters ? 'Try different search or filter values.' : 'No appointment records are available.'} action={hasFilters ? <Button variant="secondary" onClick={() => { setSearchInput(''); setDate(''); setStatus(''); setProviderId('') }}>Clear filters</Button> : undefined} />
      ) : (
        <>
          <DataTable columns={columns} rows={rows} getRowKey={(appointment) => appointment.id} />
          <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
            <span>{pagination?.total ?? rows.length} appointments</span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" className="h-8 w-8 px-0" aria-label="Previous page" disabled={page <= 1 || appointmentsQuery.isFetching} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={16} /></Button>
              <span>Page {pagination?.page ?? page} of {pagination?.totalPages ?? 1}</span>
              <Button variant="secondary" className="h-8 w-8 px-0" aria-label="Next page" disabled={page >= (pagination?.totalPages ?? 1) || appointmentsQuery.isFetching} onClick={() => setPage((value) => value + 1)}><ChevronRight size={16} /></Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
