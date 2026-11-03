import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { getApiErrorMessage } from '../../api'
import { useAuth } from '../../auth/use-auth'
import { hasAllPermissions } from '../../auth/permissions'
import { Dialog } from '../../components/ui/dialog'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { FormField } from '../../components/forms/form-field'
import { LoadingState } from '../../components/feedback/loading-state'
import { ErrorState } from '../../components/feedback/error-state'
import { StatusBadge } from '../../components/feedback/status-badge'
import type { CandidateFilters, Declaration } from '../../types/declaration'
import { listDeclarationCandidates, candidateKeys } from './declaration-api'
import { candidateFilterSchema, type AddItemValues } from './declaration-model'
import { SvbIssueList } from './svb-data-review'
import { SvbPilotNotice } from '../svb-readiness/svb-pilot-notice'

export function AddDeclarationItemDialog({ declaration, pending, error, onClose, onSubmit }: { declaration: Declaration; pending: boolean; error?: string | undefined; onClose: () => void; onSubmit: (values: AddItemValues) => void }) {
  const { permissions } = useAuth()
  const canRead = hasAllPermissions(permissions, ['declaration.read', 'invoice.read'])
  const canAdd = declaration.status === 'DRAFT' && hasAllPermissions(permissions, ['declaration.update'])
  const initial = { q: '', from: declaration.periodStart ?? '', to: declaration.periodEnd ?? '' }
  const [filters, setFilters] = useState<CandidateFilters>({ ...initial, page: 1, pageSize: 20 })
  const form = useForm({ resolver: zodResolver(candidateFilterSchema), defaultValues: initial })
  const query = useQuery({ queryKey: candidateKeys.list(declaration.id, filters), queryFn: ({ signal }) => listDeclarationCandidates(declaration.id, filters, signal), enabled: canRead && declaration.status === 'DRAFT' })
  return <Dialog open title="Add invoice item" description="Select an available item from a current closed invoice. Availability is rechecked when you add it." size="wide" onOpenChange={(next) => { if (!next && !pending) onClose() }}>
    <p className="mb-3 text-sm">Batch Declarant ID: {declaration.declarantIdSnapshot ?? 'Not assigned — set by the first invoice item'}</p>
    <SvbPilotNotice readiness={declaration.realPresentationReadiness} />
    <form className="mb-4 grid gap-3 sm:grid-cols-3" onSubmit={form.handleSubmit((v) => setFilters({ ...v, page: 1, pageSize: 20 }))}>
      <FormField label="Search invoice items" htmlFor="candidate-search" error={form.formState.errors.q?.message}><Input id="candidate-search" maxLength={120} {...form.register('q')} /></FormField>
      <FormField label="Service date from" htmlFor="candidate-from" error={form.formState.errors.from?.message}><Input id="candidate-from" type="date" {...form.register('from')} /></FormField>
      <FormField label="Service date to" htmlFor="candidate-to" error={form.formState.errors.to?.message}><Input id="candidate-to" type="date" {...form.register('to')} /></FormField>
      <Button type="submit" variant="secondary" disabled={pending}>Search candidates</Button>
      <Button variant="ghost" disabled={pending} onClick={() => { form.reset({ q: '', from: '', to: '' }); setFilters({ page: 1, pageSize: 20 }) }}>Clear candidate filters</Button>
    </form>
    {error ? <p role="alert" className="mb-3 text-sm text-clinic-danger">{error}</p> : null}
    {!canRead ? <p role="alert">Viewing candidates requires declaration.read and invoice.read permission.</p> : declaration.status !== 'DRAFT' ? <p role="alert">This declaration is no longer a Draft. Close this dialog to review its current state.</p> : query.isPending ? <LoadingState label="Loading available invoice items" /> : query.isError ? <ErrorState title="Unable to load invoice candidates" description={getApiErrorMessage(query.error)} onRetry={() => void query.refetch()} /> : <>
      {query.data.data.length === 0 ? <p className="py-6 text-sm text-slate-500">No available invoice items match these filters.</p> : <ul className="max-h-[45vh] space-y-3 overflow-y-auto">{query.data.data.map((item) => <li key={item.invoiceItemId} className="rounded-md border border-clinic-border p-3">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{item.invoiceNumber ?? item.invoiceId} · Version {item.versionNumber}</p><p className="text-sm">{item.procedureCode} — {item.procedureDescription}</p><p className="text-xs text-slate-500">{item.serviceDate} · {item.detailInvoiceNumber ?? 'No detail number'}</p><p className="text-xs">Insured ID: {item.insuredIdSnapshot} · Provider: {item.providerIdSnapshot}</p></div><p className="font-mono">{item.currencyCode} {item.amount}</p></div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><StatusBadge tone={item.svbReadiness === 'COMPLETE' ? 'success' : 'warning'}>{item.svbReadiness === 'COMPLETE' ? 'SVB data complete' : 'Incomplete SVB data'}</StatusBadge><Button disabled={!canAdd || pending || query.isFetching} aria-label={`Add item ${item.invoiceItemId}`} onClick={() => onSubmit({ invoiceItemId: item.invoiceItemId })}>{pending ? 'Adding...' : 'Add item'}</Button></div>
        <p className="mt-2 text-xs text-slate-600">{item.issues.length ? 'This item may be added to Draft. Validation is still required before READY.' : 'Technical checks passed. Pilot approval and portal acceptance still require confirmation.'}</p>
        <SvbIssueList issues={item.issues} />
        {/^[1-9]\d*$/.test(item.invoiceId) && /^[1-9]\d*$/.test(item.invoiceVersionId) ? <Link className="mt-2 inline-block text-xs text-clinic-blue underline" to={`/invoices/${item.invoiceId}?versionId=${item.invoiceVersionId}`}>Review source invoice version {item.versionNumber}</Link> : null}
      </li>)}</ul>}
      <div className="mt-3 flex items-center justify-end gap-3 text-sm"><Button variant="secondary" aria-label="Previous candidates" disabled={filters.page <= 1 || pending || query.isFetching} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>Previous</Button><span>Page {filters.page} of {Math.max(1, query.data.meta?.totalPages ?? 1)}</span><Button variant="secondary" aria-label="Next candidates" disabled={filters.page >= (query.data.meta?.totalPages ?? 1) || pending || query.isFetching} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>Next</Button></div>
    </>}
    <div className="mt-4 flex justify-end"><Button variant="secondary" disabled={pending} onClick={onClose}>Close candidates</Button></div>
  </Dialog>
}
