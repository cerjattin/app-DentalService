import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { getApiErrorMessage } from '../../../api'
import { PermissionGuard } from '../../../auth/permission-guard'
import { hasPermission } from '../../../auth/permissions'
import { useAuth } from '../../../auth/use-auth'
import { PageHeader } from '../../../components/app-shell/page-header'
import { DataTable } from '../../../components/data-table/data-table'
import { EmptyState } from '../../../components/feedback/empty-state'
import { ErrorState } from '../../../components/feedback/error-state'
import { LoadingState } from '../../../components/feedback/loading-state'
import { Button } from '../../../components/ui/button'
import { Card } from '../../../components/ui/card'
import { Dialog } from '../../../components/ui/dialog'
import { Input } from '../../../components/ui/input'
import type { ServiceWriteDto, SvbProcedure, SvbTariff, TariffWriteDto } from '../../../types/svb-catalog'
import { AccessDeniedPage } from '../../auth/access-denied-page'
import { createTariff, getApplicableTariff, getService, invalidateService, invalidateTariffs, listTariffs, setServiceStatus, svbServiceKeys, updateService, updateTariff } from '../../svb-catalog/svb-catalog-api'
import { MutationError, ServiceFormDialog, TariffFormDialog } from './service-dialogs'
import { historyNote } from './service-model'
import { ActiveBadge, Pagination } from './service-ui'

export function ServiceDetailPage() {
  const { permissions } = useAuth()
  const { serviceId = '' } = useParams()
  return hasPermission(permissions, 'svb_procedure.read') ? <ServiceDetail id={serviceId} /> : <AccessDeniedPage />
}
function ServiceDetail({ id }: { id: string }) {
  const client = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const service = useQuery({ queryKey: svbServiceKeys.detail(id), queryFn: ({ signal }) => getService(id, signal) })
  const edit = useMutation({ mutationFn: (body: ServiceWriteDto) => updateService(id, body), onSuccess: async () => { setEditOpen(false); await invalidateService(client, id) } })
  const status = useMutation({ mutationFn: (active: boolean) => setServiceStatus(id, active), onSuccess: async () => { setStatusOpen(false); await invalidateService(client, id) } })
  if (service.isPending) return <LoadingState label="Loading service" />
  if (service.isError) return <ErrorState title="Unable to load service" description={getApiErrorMessage(service.error)} onRetry={() => void service.refetch()} />
  const s = service.data
  return <div className="mx-auto max-w-[1500px] space-y-5">
    <Link to="/admin/services" className="inline-flex items-center gap-1 text-sm text-clinic-blue hover:underline"><ArrowLeft size={16} />Services</Link>
    <PageHeader title={s.code} description={s.description} actions={<PermissionGuard allOf={['svb_procedure.manage']}><div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => { edit.reset(); setEditOpen(true) }}>Edit service</Button><Button variant={s.isActive ? 'danger' : 'primary'} onClick={() => { status.reset(); setStatusOpen(true) }}>{s.isActive ? 'Deactivate service' : 'Activate service'}</Button></div></PermissionGuard>} />
    <Card className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-4">
      <Field label="Service ID">{s.id}</Field><Field label="Status"><ActiveBadge active={s.isActive} /></Field><Field label="Category">{s.category ?? 'Not provided'}</Field><Field label="Unit">{s.unit ?? 'Not provided'}</Field>
      <Field label="Authorization">{s.requiresAuthorization ? 'Required' : 'Not required'}</Field><Field label="Referral">{s.requiresReferral ? 'Required' : 'Not required'}</Field><Field label="Valid from">{s.validFrom ?? 'Open'}</Field><Field label="Valid to">{s.validTo ?? 'Open'}</Field>
    </Card>
    <TariffHistory service={s} />
    <p className="text-xs text-slate-500">{historyNote}</p>
    <ServiceFormDialog open={editOpen} service={s} pending={edit.isPending} error={edit.error} onClose={() => { if (!edit.isPending) { setEditOpen(false); edit.reset() } }} onSubmit={(body) => edit.mutate(body)} />
    <Dialog open={statusOpen} onOpenChange={(next) => { if (!next && !status.isPending) setStatusOpen(false) }} title={s.isActive ? 'Deactivate service' : 'Activate service'} description={`${s.isActive ? 'Deactivate' : 'Activate'} ${s.code}? Existing clinical and billing records remain unchanged.`}>
      <p className="text-sm text-slate-600">{s.isActive ? 'This service will no longer be available for new clinical selections.' : 'This service will be available for new clinical selections within its validity period.'}</p>
      <div className="mt-4"><MutationError error={status.error} /></div>
      <div className="mt-5 flex justify-end gap-2"><Button variant="secondary" disabled={status.isPending} onClick={() => setStatusOpen(false)}>Cancel</Button><Button variant={s.isActive ? 'danger' : 'primary'} disabled={status.isPending} onClick={() => status.mutate(!s.isActive)}>{status.isPending ? 'Updating...' : 'Confirm'}</Button></div>
    </Dialog>
  </div>
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0"><p className="text-xs font-medium text-slate-500">{label}</p><div className="mt-1 break-words text-sm text-slate-900">{children}</div></div>
}
function TariffHistory({ service }: { service: SvbProcedure }) {
  const { permissions } = useAuth()
  const client = useQueryClient()
  const canRead = hasPermission(permissions, 'svb_tariff.read')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<SvbTariff | undefined>()
  const filters = { page, pageSize: 20 }
  const tariffs = useQuery({ queryKey: svbServiceKeys.tariffs(service.id, filters), queryFn: ({ signal }) => listTariffs(service.id, filters, signal), enabled: canRead })
  const save = useMutation({ mutationFn: (body: TariffWriteDto) => selected ? updateTariff(service.id, selected.id, body) : createTariff(service.id, body), onSuccess: async () => { setOpen(false); await invalidateTariffs(client, service.id) } })
  return <section className="space-y-4" aria-label="Tariff history">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-slate-900">Tariff history</h2><p className="text-sm text-slate-500">All validity periods, including inactive tariffs.</p></div><PermissionGuard allOf={['svb_tariff.manage']}><Button onClick={() => { save.reset(); setSelected(undefined); setOpen(true) }}><Plus size={16} />Add tariff</Button></PermissionGuard></div>
    {!canRead ? <p className="text-sm text-slate-500">You do not have permission to view tariffs.</p> : tariffs.isPending ? <LoadingState label="Loading tariffs" /> : tariffs.isError ? <ErrorState title="Unable to load tariffs" description={getApiErrorMessage(tariffs.error)} onRetry={() => void tariffs.refetch()} /> : tariffs.data.data.length === 0 ? <EmptyState title="No tariffs found" description="No tariffs have been recorded for this service." /> : <DataTable rows={tariffs.data.data} getRowKey={(t) => t.id} columns={[
      { key: 'amount', header: 'Amount', render: (t) => <span className="font-mono tabular-nums">{t.amount}</span> },
      { key: 'currency', header: 'Currency', render: (t) => t.currencyCode },
      { key: 'from', header: 'Valid from', render: (t) => <span className="whitespace-nowrap">{t.validFrom ?? 'Open'}</span> },
      { key: 'to', header: 'Valid to', render: (t) => <span className="whitespace-nowrap">{t.validTo ?? 'Open'}</span> },
      { key: 'status', header: 'Status', render: (t) => <ActiveBadge active={t.isActive} /> },
      { key: 'actions', header: 'Actions', render: (t) => <PermissionGuard allOf={['svb_tariff.manage']}><Button variant="secondary" onClick={() => { save.reset(); setSelected(t); setOpen(true) }}>Edit tariff</Button></PermissionGuard> },
    ]} />}
    {canRead && tariffs.data ? <Pagination page={page} totalPages={tariffs.data.meta?.totalPages ?? 1} busy={tariffs.isFetching} onChange={setPage} /> : null}
    {canRead ? <ApplicableTariff serviceId={service.id} /> : null}
    <TariffFormDialog open={open} tariff={selected} pending={save.isPending} error={save.error} onClose={() => { if (!save.isPending) { setOpen(false); save.reset() } }} onSubmit={(body) => save.mutate(body)} />
  </section>
}
function ApplicableTariff({ serviceId }: { serviceId: string }) {
  const [selection, setSelection] = useState<{ date: string; currency: string } | null>(null)
  const current = useQuery({ queryKey: svbServiceKeys.applicableTariff(serviceId, selection?.date ?? '', selection?.currency ?? ''), queryFn: ({ signal }) => getApplicableTariff(serviceId, selection!.date, selection!.currency, signal), enabled: selection !== null, retry: false })
  return <Card className="space-y-3 p-4"><h3 className="text-sm font-semibold text-slate-900">Applicable tariff lookup</h3><form className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); setSelection({ date: String(data.get('date')), currency: String(data.get('currency')).trim().toUpperCase() }) }}>
    <label className="text-sm">Service date<Input className="mt-1" name="date" type="date" required /></label><label className="text-sm">Currency code<Input className="mt-1" name="currency" required pattern="[A-Za-z]{3}" maxLength={3} placeholder="e.g. ANG" /></label><Button variant="secondary" type="submit">Look up tariff</Button>
  </form>{selection ? current.isPending ? <LoadingState label="Looking up tariff" /> : current.isError ? <p role="alert" className="text-sm text-clinic-danger">{getApiErrorMessage(current.error)}</p> : current.data ? <p className="text-sm">Applicable tariff: <strong>{current.data.tariff.currencyCode} {current.data.tariff.amount}</strong> on {current.data.serviceDate}</p> : null : null}</Card>
}
