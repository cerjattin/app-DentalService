import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { CalendarDays, Plus, Search, X } from 'lucide-react'
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
import { AppointmentActions } from '../appointments/appointment-actions'
import { listAppointments, receptionKeys } from '../appointments/appointment-api'
import {
  appointmentPatientName,
  appointmentProviderName,
  appointmentStatusLabel,
  appointmentStatusTone,
  appointmentStatuses,
} from '../appointments/appointment-model'

const TODAY_PAGE_SIZE = 100

export function ReceptionPage() {
  const { permissions } = useAuth()
  const canReadPatients = hasPermission(permissions, 'patient.read')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<AppointmentStatus | ''>('')
  const today = formatBusinessDate(new Date())

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => window.clearTimeout(timeout)
  }, [searchInput])

  const filters: AppointmentListFilters = {
    date: today,
    page: 1,
    pageSize: TODAY_PAGE_SIZE,
    ...(search ? { q: search } : {}),
    ...(status ? { status } : {}),
  }
  const worklistQuery = useQuery({
    queryKey: receptionKeys.worklist(today, status || undefined, search),
    queryFn: ({ signal }) => listAppointments(filters, signal),
    placeholderData: keepPreviousData,
  })

  const columns = useMemo<DataTableColumn<Appointment>[]>(() => [
    {
      key: 'time',
      header: 'Time',
      render: (appointment) => <span className="font-mono text-sm font-semibold text-slate-800">{formatBusinessTime(appointment.scheduledStart)}</span>,
    },
    {
      key: 'patient',
      header: 'Patient',
      render: (appointment) => (
        <div className="min-w-44">
          {canReadPatients ? <Link to={`/patients/${appointment.patientId}`} className="font-semibold text-clinic-blue hover:underline">{appointmentPatientName(appointment)}</Link> : <span className="font-semibold">{appointmentPatientName(appointment)}</span>}
          <div className="mt-0.5 font-mono text-xs text-slate-500">{appointment.patient.patientNumber}</div>
        </div>
      ),
    },
    { key: 'provider', header: 'Provider', render: (appointment) => <div><div>{appointmentProviderName(appointment)}</div><div className="text-xs text-slate-500">{appointment.location.name}</div></div> },
    { key: 'reason', header: 'Reason', render: (appointment) => appointment.reason ?? 'Not provided' },
    { key: 'status', header: 'Status', render: (appointment) => <StatusBadge tone={appointmentStatusTone(appointment.status)}>{appointmentStatusLabel(appointment.status)}</StatusBadge> },
    {
      key: 'action',
      header: 'Reception action',
      render: (appointment) => (
        <div className="flex min-w-max items-center gap-2">
          <AppointmentActions appointment={appointment} compact />
          <Link to={`/appointments/${appointment.id}`} className="inline-flex h-8 items-center rounded-md border border-clinic-border-strong bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Details</Link>
        </div>
      ),
    },
  ], [canReadPatients])

  const rows = worklistQuery.data?.data ?? []
  const total = worklistQuery.data?.meta?.total ?? rows.length

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader
        title="Reception"
        description={`Today's front-desk appointment worklist for ${today}.`}
        actions={
          <div className="flex gap-2">
            <Link to="/appointments" className="inline-flex h-9 items-center gap-2 rounded-md border border-clinic-border-strong bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"><CalendarDays size={16} />All appointments</Link>
            {hasPermission(permissions, 'appointment.create') ? <Button disabled title="Appointment creation requires a clinic-location lookup endpoint that is not available in the frozen backend."><Plus size={16} />Create appointment</Button> : null}
          </div>
        }
      />
      <div className="mb-4 flex flex-col gap-3 rounded-lg border border-clinic-border bg-white p-4 md:flex-row md:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor="receptionSearch" className="mb-1.5 block text-sm font-medium text-slate-700">Search today's appointments</label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <Input id="receptionSearch" className="pl-9 pr-9" placeholder="Appointment number, patient name, number, or document" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
            {searchInput ? <button type="button" aria-label="Clear search" className="absolute right-2 top-1.5 rounded p-1 text-slate-500 hover:bg-slate-100" onClick={() => setSearchInput('')}><X size={16} /></button> : null}
          </div>
        </div>
        <div className="w-full md:w-52">
          <label htmlFor="receptionStatus" className="mb-1.5 block text-sm font-medium text-slate-700">Status</label>
          <Select id="receptionStatus" value={status} onChange={(event) => setStatus(event.target.value as AppointmentStatus | '')}>
            <option value="">All statuses</option>
            {appointmentStatuses.map((value) => <option key={value} value={value}>{appointmentStatusLabel(value)}</option>)}
          </Select>
        </div>
      </div>

      {worklistQuery.isPending ? <LoadingState label="Loading reception worklist" /> : worklistQuery.isError ? (
        <ErrorState title="Unable to load reception worklist" description={getApiErrorMessage(worklistQuery.error)} onRetry={() => void worklistQuery.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title={search || status ? 'No matching appointments' : 'No appointments today'} description={search || status ? 'Try a different search or status.' : 'There are no appointments scheduled for today.'} />
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between text-sm text-slate-500"><span>Today</span><span>{total} appointment{total === 1 ? '' : 's'}</span></div>
          <DataTable columns={columns} rows={rows} getRowKey={(appointment) => appointment.id} />
          {total > TODAY_PAGE_SIZE ? <p className="mt-3 text-sm text-clinic-warning">Showing the first {TODAY_PAGE_SIZE} appointments. Use the appointment list for pagination.</p> : null}
        </>
      )}
    </div>
  )
}
