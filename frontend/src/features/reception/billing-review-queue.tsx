import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { getApiErrorMessage } from '../../api'
import { DataTable } from '../../components/data-table/data-table'
import { ErrorState } from '../../components/feedback/error-state'
import { LoadingState } from '../../components/feedback/loading-state'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { formatBusinessDateTime } from '../../lib/timezone'
import { listAppointments, receptionKeys } from '../appointments/appointment-api'
import { appointmentPatientName, appointmentProviderName } from '../appointments/appointment-model'

const PAGE_SIZE = 20

export function BillingReviewQueue() {
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [date, setDate] = useState('')
  const [page, setPage] = useState(1)
  useEffect(() => {
    const nextSearch = searchInput.trim()
    if (nextSearch === search) return
    const timeout = window.setTimeout(() => { setSearch(nextSearch); setPage(1) }, 300)
    return () => window.clearTimeout(timeout)
  }, [searchInput, search])
  const filters = { status: 'COMPLETED' as const, page, pageSize: PAGE_SIZE, ...(search ? { q: search } : {}), ...(date ? { date } : {}) }
  const query = useQuery({
    queryKey: [...receptionKeys.all, 'billing-review', filters],
    queryFn: ({ signal }) => listAppointments(filters, signal),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: true,
  })
  const pages = query.data?.meta?.totalPages ?? 0
  return <section aria-label="Completed appointments for billing" className="space-y-4">
    <p className="text-sm text-slate-600">Completed appointments from all dates. Open an appointment to review its invoice or resolve billing details. This list includes appointments already invoiced.</p>
    <div className="flex flex-wrap items-end gap-3">
      <label className="min-w-52 flex-1 text-sm" htmlFor="billing-queue-search">Search completed appointments<Input id="billing-queue-search" maxLength={120} value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /></label>
      <label className="text-sm" htmlFor="billing-queue-date">Service date (optional)<Input id="billing-queue-date" type="date" value={date} onChange={(event) => { setDate(event.target.value); setPage(1) }} /></label>
      <Button variant="secondary" disabled={query.isFetching} onClick={() => void query.refetch()}>Refresh billing review</Button>
    </div>
    {query.isFetching ? <p role="status" className="text-sm text-slate-500">Updating completed appointments…</p> : null}
    {query.isPending ? <LoadingState label="Loading completed appointments" /> : query.isError ? <ErrorState title="Unable to load completed appointments" description={getApiErrorMessage(query.error)} onRetry={() => void query.refetch()} /> : <>
      <DataTable rows={query.data.data} getRowKey={(row) => row.id} emptyMessage="No completed appointments match this search." columns={[
        { key: 'date', header: 'Appointment', render: (row) => <><p className="font-mono text-xs">{row.appointmentNumber}</p><p>{formatBusinessDateTime(row.scheduledStart)}</p></> },
        { key: 'patient', header: 'Patient', render: (row) => <><p>{appointmentPatientName(row)}</p><p className="font-mono text-xs text-slate-500">{row.patient.patientNumber}</p></> },
        { key: 'provider', header: 'Provider / location', render: (row) => <><p>{appointmentProviderName(row)}</p><p className="text-xs text-slate-500">{row.location.name}</p></> },
        { key: 'action', header: 'Billing review', render: (row) => <Link to={`/appointments/${row.id}`} className="font-medium text-clinic-blue hover:underline">Review billing</Link> },
      ]} />
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
        <span>{query.data.meta?.total ?? query.data.data.length} completed appointments</span>
        <div className="flex items-center gap-2"><Button variant="secondary" disabled={page <= 1 || query.isFetching} onClick={() => setPage((previous) => previous - 1)}>Previous completed page</Button><span>Page {page} of {Math.max(pages, 1)}</span><Button variant="secondary" disabled={page >= pages || query.isFetching || query.isPlaceholderData} onClick={() => setPage((previous) => previous + 1)}>Next completed page</Button></div>
      </div>
    </>}
  </section>
}
