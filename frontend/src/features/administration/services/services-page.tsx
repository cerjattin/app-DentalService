import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
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
import { Input } from '../../../components/ui/input'
import { Select } from '../../../components/ui/select'
import type { ServiceFilters, ServiceWriteDto } from '../../../types/svb-catalog'
import { AccessDeniedPage } from '../../auth/access-denied-page'
import { createService, invalidateService, listServices, svbServiceKeys } from '../../svb-catalog/svb-catalog-api'
import { ServiceFormDialog } from './service-dialogs'
import { historyNote } from './service-model'
import { ActiveBadge, Pagination } from './service-ui'

export function ServicesPage() {
  const { permissions } = useAuth()
  return hasPermission(permissions, 'svb_procedure.read') ? <ServicesWorkspace /> : <AccessDeniedPage />
}
function ServicesWorkspace() {
  const client = useQueryClient()
  const navigate = useNavigate()
  const [filters, setFilters] = useState<ServiceFilters>({ page: 1, pageSize: 20 })
  const [open, setOpen] = useState(false)
  const services = useQuery({ queryKey: svbServiceKeys.list(filters), queryFn: ({ signal }) => listServices(filters, signal) })
  const create = useMutation({ mutationFn: (body: ServiceWriteDto) => createService(body), onSuccess: async (service) => { await invalidateService(client); setOpen(false); navigate(`/admin/services/${service.id}`) } })
  return <div className="mx-auto max-w-[1500px]">
    <PageHeader title="Services" description="Manage SVB services, validity and tariff history." actions={<PermissionGuard allOf={['svb_procedure.manage']}><Button onClick={() => { create.reset(); setOpen(true) }}><Plus size={16} />Create service</Button></PermissionGuard>} />
    <form className="mb-4 grid gap-3 rounded-lg border border-clinic-border bg-white p-4 sm:grid-cols-2 xl:grid-cols-4" onSubmit={(event) => {
      event.preventDefault()
      const data = new FormData(event.currentTarget)
      const next: ServiceFilters = { page: 1, pageSize: 20 }
      for (const key of ['q', 'category', 'serviceDate'] as const) { const value = String(data.get(key) ?? '').trim(); if (value) next[key] = value }
      for (const key of ['isActive', 'requiresAuthorization', 'requiresReferral'] as const) { const value = data.get(key); if (value === 'true' || value === 'false') next[key] = value === 'true' }
      setFilters(next)
    }}>
      <label className="text-sm">Search services<Input className="mt-1" name="q" maxLength={120} placeholder="Code or description" /></label>
      <label className="text-sm">Status<Select className="mt-1" name="isActive"><option value="">All services</option><option value="true">Active</option><option value="false">Inactive</option></Select></label>
      <label className="text-sm">Category<Input className="mt-1" name="category" maxLength={120} /></label>
      <label className="text-sm">Valid on<Input className="mt-1" name="serviceDate" type="date" /></label>
      <label className="text-sm">Authorization<Select className="mt-1" name="requiresAuthorization"><option value="">All requirements</option><option value="true">Required</option><option value="false">Not required</option></Select></label>
      <label className="text-sm">Referral<Select className="mt-1" name="requiresReferral"><option value="">All requirements</option><option value="true">Required</option><option value="false">Not required</option></Select></label>
      <div className="flex items-end"><Button type="submit" variant="secondary"><Search size={16} />Search</Button></div>
    </form>
    {services.isPending ? <LoadingState label="Loading services" /> : services.isError ? <ErrorState title="Unable to load services" description={getApiErrorMessage(services.error)} onRetry={() => void services.refetch()} /> : services.data.data.length === 0 ? <EmptyState title="No services found" description="Try different search or filter values." /> : <DataTable rows={services.data.data} getRowKey={(s) => s.id} columns={[
      { key: 'code', header: 'Code / SKU', render: (s) => <Link className="font-semibold text-clinic-blue hover:underline" to={`/admin/services/${s.id}`}>{s.code}</Link> },
      { key: 'description', header: 'Description', render: (s) => <div className="min-w-48 max-w-sm whitespace-normal break-words">{s.description}</div> },
      { key: 'category', header: 'Category', render: (s) => s.category ?? '—' },
      { key: 'authorization', header: 'Authorization', render: (s) => s.requiresAuthorization ? 'Required' : 'Not required' },
      { key: 'referral', header: 'Referral', render: (s) => s.requiresReferral ? 'Required' : 'Not required' },
      { key: 'validity', header: 'Validity', render: (s) => <span className="whitespace-nowrap">{s.validFrom ?? 'Open'} → {s.validTo ?? 'Open'}</span> },
      { key: 'status', header: 'Status', render: (s) => <ActiveBadge active={s.isActive} /> },
      { key: 'actions', header: 'Actions', render: (s) => <Link className="text-clinic-blue hover:underline" to={`/admin/services/${s.id}`}>View details</Link> },
    ]} />}
    {services.data ? <Pagination page={filters.page} totalPages={services.data.meta?.totalPages ?? 1} busy={services.isFetching} onChange={(page) => setFilters({ ...filters, page })} /> : null}
    <p className="mt-4 text-xs text-slate-500">{historyNote}</p>
    <ServiceFormDialog open={open} pending={create.isPending} error={create.error} onClose={() => { if (!create.isPending) { setOpen(false); create.reset() } }} onSubmit={(body) => create.mutate(body)} />
  </div>
}
