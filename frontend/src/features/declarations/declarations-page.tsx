import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { getApiErrorMessage } from '../../api'
import { PermissionGuard } from '../../auth/permission-guard'
import { PageHeader } from '../../components/app-shell/page-header'
import { DataTable } from '../../components/data-table/data-table'
import { ErrorState } from '../../components/feedback/error-state'
import { LoadingState } from '../../components/feedback/loading-state'
import { StatusBadge } from '../../components/feedback/status-badge'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Select } from '../../components/ui/select'
import { formatBusinessDateTime } from '../../lib/timezone'
import type { DeclarationStatus } from '../../types/declaration'
import { AccessDeniedPage } from '../auth/access-denied-page'
import { listPayers, patientKeys } from '../patients/patient-api'
import { createDeclaration, declarationKeys, listDeclarations } from './declaration-api'
import { CreateDeclarationDialog } from './declaration-dialogs'
import { createDeclarationSchema, declarationLabel, declarationTone, type CreateDeclarationValues } from './declaration-model'

const statuses: DeclarationStatus[] = ['DRAFT', 'READY', 'EXPORTED', 'SUBMITTED', 'ACCEPTED', 'PARTIALLY_REJECTED', 'REJECTED', 'CANCELLED']

export function DeclarationsPage() {
  return <PermissionGuard allOf={['declaration.read']} fallback={<AccessDeniedPage />}><DeclarationList /></PermissionGuard>
}

function DeclarationList() {
  const navigate = useNavigate()
  const client = useQueryClient()
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<DeclarationStatus | ''>('')
  const [payerId, setPayerId] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const filters = { page, pageSize: 20, ...(q ? { q } : {}), ...(status ? { status } : {}), ...(payerId ? { payerId } : {}), ...(periodStart ? { periodStart } : {}), ...(periodEnd ? { periodEnd } : {}) }
  const query = useQuery({ queryKey: declarationKeys.list(filters), queryFn: ({ signal }) => listDeclarations(filters, signal) })
  const payers = useQuery({ queryKey: patientKeys.payers(), queryFn: ({ signal }) => listPayers(signal) })
  const create = useMutation({
    mutationFn: (values: CreateDeclarationValues) => {
      const parsed = createDeclarationSchema.parse(values)
      return createDeclaration({ payerId: parsed.payerId, ...(parsed.periodStart ? { periodStart: parsed.periodStart } : {}), ...(parsed.periodEnd ? { periodEnd: parsed.periodEnd } : {}), ...(parsed.declarantIdSnapshot ? { declarantIdSnapshot: parsed.declarantIdSnapshot } : {}), ...(parsed.notes ? { notes: parsed.notes } : {}) })
    },
    onSuccess: async (row) => { await client.invalidateQueries({ queryKey: declarationKeys.lists() }); navigate(`/declarations/${row.id}`) },
  })
  return <div className="mx-auto max-w-350">
    <PageHeader title="Declarations" description="SVB declaration batches, exports and submission history" actions={<PermissionGuard allOf={['declaration.create', 'insurance.read']}><Button onClick={() => setCreateOpen(true)}><Plus size={16} />Create declaration</Button></PermissionGuard>} />
    <form className="mb-5 grid gap-3 sm:grid-cols-2 sm:items-end xl:grid-cols-[minmax(14rem,1fr)_auto_auto_auto_auto_auto]" onSubmit={(event) => { event.preventDefault(); setQ(search.trim()); setPage(1) }}>
      <label className="min-w-0 flex-1 text-sm">Search declarations<Input className="mt-1" value={search} maxLength={120} placeholder="Declaration number or reference" onChange={(event) => setSearch(event.target.value)} /></label>
      <label className="min-w-0 text-sm">Status<Select className="mt-1" value={status} onChange={(event) => { setStatus(event.target.value as DeclarationStatus | ''); setPage(1) }}><option value="">All statuses</option>{statuses.map((value) => <option key={value} value={value}>{declarationLabel(value)}</option>)}</Select></label>
      <label className="min-w-0 text-sm">Payer<Select className="mt-1" value={payerId} disabled={payers.isPending || payers.isError} onChange={(event) => { setPayerId(event.target.value); setPage(1) }}><option value="">All payers</option>{payers.data?.map((payer) => <option key={payer.id} value={payer.id}>{payer.code} - {payer.name}</option>)}</Select></label>
      <label className="text-sm">Period start<Input className="mt-1" type="date" value={periodStart} onChange={(event) => { setPeriodStart(event.target.value); setPage(1) }} /></label>
      <label className="text-sm">Period end<Input className="mt-1" type="date" value={periodEnd} onChange={(event) => { setPeriodEnd(event.target.value); setPage(1) }} /></label>
      <Button type="submit" variant="secondary"><Search size={16} />Search</Button>
      {q || status || payerId || periodStart || periodEnd ? <Button variant="ghost" onClick={() => { setSearch(''); setQ(''); setStatus(''); setPayerId(''); setPeriodStart(''); setPeriodEnd(''); setPage(1) }}>Clear filters</Button> : null}
    </form>
    {query.isPending ? <LoadingState label="Loading declarations" /> : query.isError ? <ErrorState title="Unable to load declarations" description={getApiErrorMessage(query.error)} onRetry={() => void query.refetch()} /> : <>
      <DataTable rows={query.data.data} getRowKey={(row) => row.id} emptyMessage="No declarations found" columns={[
        { key: 'number', header: 'Declaration', render: (row) => <Link className="font-medium text-clinic-blue hover:underline" to={`/declarations/${row.id}`}>{row.declarationNumber ?? row.id}</Link> },
        { key: 'payer', header: 'Payer', render: (row) => <div><span className="font-medium">{row.payer.name}</span><p className="text-xs text-slate-500">{row.payer.code}</p></div> },
        { key: 'period', header: 'Period', render: (row) => row.periodStart || row.periodEnd ? `${row.periodStart ?? 'Open'} - ${row.periodEnd ?? 'Open'}` : 'Not specified' },
        { key: 'items', header: 'Items', render: (row) => row.items.length },
        { key: 'status', header: 'Status', render: (row) => <StatusBadge tone={declarationTone(row.status)}>{declarationLabel(row.status)}</StatusBadge> },
        { key: 'created', header: 'Created', render: (row) => formatBusinessDateTime(row.createdAt) },
      ]} />
      <div className="mt-4 flex items-center justify-end gap-3 text-sm"><Button variant="secondary" aria-label="Previous page" disabled={page <= 1 || query.isFetching} onClick={() => setPage(page - 1)}><ChevronLeft size={16} /></Button><span>Page {page} of {Math.max(1, query.data.meta?.totalPages ?? 1)}</span><Button variant="secondary" aria-label="Next page" disabled={page >= (query.data.meta?.totalPages ?? 1) || query.isFetching} onClick={() => setPage(page + 1)}><ChevronRight size={16} /></Button></div>
    </>}
    <CreateDeclarationDialog open={createOpen} pending={create.isPending} error={create.error ? getApiErrorMessage(create.error) : undefined} onClose={() => { setCreateOpen(false); create.reset() }} onSubmit={(values) => create.mutate(values)} />
  </div>
}
