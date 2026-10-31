import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { getApiErrorMessage } from '../../api'
import { useAuth } from '../../auth/use-auth'
import { hasPermission } from '../../auth/permissions'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import { Dialog } from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { Select } from '../../components/ui/select'
import { formatBusinessDateTime } from '../../lib/timezone'
import type { TreatmentCaseStatus } from '../../types/treatment-case'
import { getTreatmentCase, listTreatmentCases, treatmentCaseKeys } from './treatment-case-api'
import { TreatmentCaseForm } from './treatment-case-form'

export function TreatmentCasesSection({ patientId, active }: { patientId: string; active: boolean }) {
  const { permissions } = useAuth()
  const canRead = hasPermission(permissions, 'treatment_case.read')
  const canManage = hasPermission(permissions, 'treatment_case.manage')
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<TreatmentCaseStatus | ''>('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState('')
  const [form, setForm] = useState<'create' | 'edit' | null>(null)
  const filters = { q, ...(status ? { status } : {}), page, pageSize: 20 }
  const query = useQuery({ queryKey: treatmentCaseKeys.list(patientId, filters), queryFn: ({ signal }) => listTreatmentCases(patientId, filters, signal), enabled: canRead })
  const detail = useQuery({ queryKey: treatmentCaseKeys.detail(patientId, selected), queryFn: ({ signal }) => getTreatmentCase(patientId, selected, signal), enabled: canRead && Boolean(selected) })
  const record = detail.data?.patientId === patientId ? detail.data : undefined
  return <section className="mt-5 space-y-3"><div className="flex items-center justify-between gap-2"><div><h3 className="font-semibold">Treatment cases</h3><p className="text-sm text-slate-500">External references for this patient. Performed procedures retain their historical snapshots.</p></div>{canRead && canManage ? <Button disabled={!active} onClick={() => setForm('create')}>Create treatment case</Button> : null}</div>
    {!canRead ? <p className="text-sm">You don't have permission to view treatment cases.</p> : <>
      <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => { event.preventDefault(); setQ(search.trim()); setPage(1) }}><label className="text-sm">Search treatment cases<Input maxLength={120} value={search} onChange={(event) => setSearch(event.target.value)} /></label><label className="text-sm">Case status<Select value={status} onChange={(event) => { setStatus(event.target.value as TreatmentCaseStatus | ''); setPage(1) }}><option value="">All statuses</option>{['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED'].map((s) => <option key={s}>{s}</option>)}</Select></label><Button type="submit" variant="secondary">Search treatment cases</Button></form>
      {query.isPending ? <p role="status">Loading treatment cases...</p> : query.error ? <div role="alert">{getApiErrorMessage(query.error)} <Button variant="secondary" onClick={() => void query.refetch()}>Retry cases</Button></div> : !query.data?.data.length ? <p>No treatment cases recorded for these filters.</p> : <div className="grid gap-3 sm:grid-cols-2">{query.data.data.map((row) => <Card key={row.id} className="p-4"><p className="font-semibold">External treatment ID: {row.treatmentId ?? 'Not recorded'}</p><p className="text-sm">{row.treatmentType ?? 'Treatment case'} · {row.status}</p><Button variant="secondary" onClick={() => setSelected(row.id)}>View case {row.treatmentId ?? row.id}</Button></Card>)}</div>}
      <div className="flex justify-end gap-2 text-sm"><Button variant="secondary" disabled={page <= 1 || query.isFetching} onClick={() => setPage(page - 1)}>Previous cases</Button><span>Page {page} of {Math.max(1, query.data?.meta?.totalPages ?? 1)}</span><Button variant="secondary" disabled={page >= (query.data?.meta?.totalPages ?? 1) || query.isFetching} onClick={() => setPage(page + 1)}>Next cases</Button></div>
    </>}
    <Dialog open={Boolean(selected) && !form} onOpenChange={(next) => { if (!next) setSelected('') }} title="Treatment case details">{detail.isPending ? <p role="status">Loading treatment case...</p> : detail.error ? <div role="alert">{getApiErrorMessage(detail.error)}<Button variant="secondary" onClick={() => void detail.refetch()}>Retry case</Button></div> : record ? <div className="space-y-3"><p>External treatment ID: {record.treatmentId ?? 'Not recorded'}</p><p className="text-xs text-slate-500">Internal case reference: {record.id}</p><p>Status: {record.status}</p><p>Type: {record.treatmentType ?? 'Not recorded'}</p><p className="whitespace-pre-wrap">{record.description ?? 'No description recorded.'}</p><p className="text-sm">Created: {formatBusinessDateTime(record.createdAt)}</p>{record.startedAt ? <p>Started: {formatBusinessDateTime(record.startedAt)}</p> : null}{record.completedAt ? <p>Completed: {formatBusinessDateTime(record.completedAt)}</p> : null}{!record.isEditable ? <p className="text-sm">This case is read only. Linked or historical cases cannot be edited.</p> : canManage ? <Button onClick={() => setForm('edit')}>Edit treatment case</Button> : <p className="text-sm">You have read-only access.</p>}</div> : null}</Dialog>
    {form && canRead && canManage && (form === 'create' || record?.isEditable) ? <TreatmentCaseForm patientId={patientId} record={form === 'edit' ? record : undefined} onClose={() => setForm(null)} /> : null}
  </section>
}
