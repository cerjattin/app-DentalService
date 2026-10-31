import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useAuth } from '../../auth/use-auth'
import { hasPermission } from '../../auth/permissions'
import { getApiErrorMessage } from '../../api'
import { FormField } from '../../components/forms/form-field'
import { Input } from '../../components/ui/input'
import { Select } from '../../components/ui/select'
import { Button } from '../../components/ui/button'
import { getTreatmentCase, listTreatmentCases, treatmentCaseKeys } from './treatment-case-api'

export function TreatmentCaseSelector(props: { patientId: string; value: string; onChange: (id: string) => void; disabled?: boolean; error?: string | undefined }) {
  return <PatientSelector key={props.patientId} {...props} />
}
function PatientSelector({ patientId, value, onChange, disabled, error }: { patientId: string; value: string; onChange: (id: string) => void; disabled?: boolean; error?: string | undefined }) {
  const { permissions } = useAuth()
  const canRead = hasPermission(permissions, 'treatment_case.read')
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const filters = { q, page, pageSize: 20 }
  const query = useQuery({ queryKey: treatmentCaseKeys.list(patientId, filters), queryFn: ({ signal }) => listTreatmentCases(patientId, filters, signal), enabled: canRead && Boolean(patientId) })
  const selected = useQuery({ queryKey: treatmentCaseKeys.detail(patientId, value), queryFn: ({ signal }) => getTreatmentCase(patientId, value, signal), enabled: canRead && Boolean(patientId && value) })
  const rows = (query.data?.data ?? []).filter((row) => row.patientId === patientId)
  const selectedRow = selected.data?.patientId === patientId && selected.data.id === value ? selected.data : null
  const options = selectedRow && !rows.some((row) => row.id === value) ? [selectedRow, ...rows] : rows
  if (!canRead) return <p className="text-sm text-slate-500">Selecting treatment cases requires treatment_case.read permission. The existing reference is retained.</p>
  return <div className="space-y-2 rounded-md border border-clinic-border p-3 sm:col-span-2">
    <div className="flex items-end gap-2"><FormField label="Find treatment cases" htmlFor="treatment-case-search"><Input id="treatment-case-search" maxLength={120} disabled={!patientId || disabled} value={search} onChange={(event) => setSearch(event.target.value)} /></FormField><Button type="button" variant="secondary" disabled={!patientId || disabled} onClick={() => { setQ(search.trim()); setPage(1) }}>Search cases</Button></div>
    <FormField label="Treatment case" htmlFor="appointment-treatment-case" error={error} hint="External treatment ID is shown below; the internal case key is selected automatically."><Select id="appointment-treatment-case" value={value} disabled={!patientId || disabled || query.isPending} onChange={(event) => onChange(event.target.value)}><option value="">{patientId ? 'No treatment case selected' : 'Select a patient first'}</option>{value && !selectedRow && !options.some((row) => row.id === value) ? <option value={value} disabled>Recorded treatment case (loading reference)</option> : null}{options.map((row) => <option key={row.id} value={row.id} disabled={!['PLANNED', 'ACTIVE'].includes(row.status)}>{row.treatmentId ?? 'External ID not recorded'} · {row.treatmentType ?? 'Treatment case'} · {row.status}</option>)}</Select></FormField>
    {selectedRow ? <p className="text-xs">External treatment ID: {selectedRow.treatmentId ?? 'Not recorded'}</p> : null}
    {query.isFetching && patientId ? <p role="status" className="text-xs">Loading treatment cases...</p> : null}
    {query.error || selected.error ? <div role="alert" className="text-sm text-clinic-danger">{getApiErrorMessage(query.error ?? selected.error)} <Button variant="secondary" onClick={() => { void query.refetch(); if (value) void selected.refetch() }}>Retry treatment cases</Button></div> : null}
    {patientId && query.isSuccess && !rows.length ? <p className="text-xs">No treatment cases match this search.</p> : null}
    <div className="flex items-center justify-end gap-2 text-xs"><Button type="button" variant="secondary" aria-label="Previous treatment cases" disabled={page <= 1 || query.isFetching || disabled} onClick={() => setPage(page - 1)}>Previous</Button><span>Page {page} of {Math.max(1, query.data?.meta?.totalPages ?? 1)}</span><Button type="button" variant="secondary" aria-label="Next treatment cases" disabled={page >= (query.data?.meta?.totalPages ?? 1) || query.isFetching || disabled} onClick={() => setPage(page + 1)}>Next</Button></div>
  </div>
}
