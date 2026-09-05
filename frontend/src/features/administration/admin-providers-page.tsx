import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { getApiErrorMessage } from '../../api'
import { hasPermission } from '../../auth/permissions'
import { useAuth } from '../../auth/use-auth'
import { PageHeader } from '../../components/app-shell/page-header'
import { DataTable } from '../../components/data-table/data-table'
import { EmptyState } from '../../components/feedback/empty-state'
import { ErrorState } from '../../components/feedback/error-state'
import { LoadingState } from '../../components/feedback/loading-state'
import { StatusBadge } from '../../components/feedback/status-badge'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import { ConfirmDialog } from '../../components/ui/confirm-dialog'
import { Dialog } from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { Select } from '../../components/ui/select'
import type { AdminProvider, ProviderWriteDto } from '../../types/administration'
import { AccessDeniedPage } from '../auth/access-denied-page'
import { appointmentKeys } from '../appointments/appointment-api'
import { ProviderFormDialog } from './administration-dialogs'
import { createProvider, getProvider, listProviders, listUsers, providerKeys, updateProvider, userKeys } from './administration-api'

export function AdminProvidersPage() {
  const { permissions } = useAuth()
  return hasPermission(permissions, 'provider.read') ? <ProvidersWorkspace /> : <AccessDeniedPage />
}
function ProvidersWorkspace() {
  const { permissions } = useAuth()
  const client = useQueryClient()
  const canReadUsers = hasPermission(permissions, 'user.read')
  const [searchInput, setSearchInput] = useState('')
  const [q, setQ] = useState('')
  const [active, setActive] = useState('')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState('')
  const [editProvider, setEditProvider] = useState<AdminProvider | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [statusProvider, setStatusProvider] = useState<AdminProvider | null>(null)
  useEffect(() => { const timeout = window.setTimeout(() => { setQ(searchInput.trim()); setPage(1) }, 300); return () => window.clearTimeout(timeout) }, [searchInput])
  const filters = { page, pageSize: 20, ...(q ? { q } : {}), ...(active ? { isActive: active === 'true' } : {}) }
  const providers = useQuery({ queryKey: providerKeys.list(filters), queryFn: ({ signal }) => listProviders(filters, signal), placeholderData: keepPreviousData })
  const detail = useQuery({ queryKey: providerKeys.detail(selectedId), queryFn: ({ signal }) => getProvider(selectedId, signal), enabled: Boolean(selectedId) })
  const users = useQuery({ queryKey: userKeys.list({ page: 1, pageSize: 100, status: 'ACTIVE' }), queryFn: ({ signal }) => listUsers({ page: 1, pageSize: 100, status: 'ACTIVE' }, signal), enabled: canReadUsers, staleTime: 60_000 })
  const refresh = async (id?: string) => { await Promise.all([client.invalidateQueries({ queryKey: providerKeys.lists() }), client.invalidateQueries({ queryKey: appointmentKeys.providers() })]); if (id) await client.invalidateQueries({ queryKey: providerKeys.detail(id) }) }
  const create = useMutation({ mutationFn: (values: ProviderWriteDto) => createProvider(values), onSuccess: async () => { setCreateOpen(false); await refresh() } })
  const edit = useMutation({ mutationFn: (values: ProviderWriteDto) => updateProvider(editProvider?.id ?? '', values), onSuccess: async (updated) => { setEditProvider(null); await refresh(updated.id) } })
  const statusMutation = useMutation({ mutationFn: () => updateProvider(statusProvider?.id ?? '', { isActive: !statusProvider?.isActive }), onSuccess: async (updated) => { setStatusProvider(null); await refresh(updated.id) } })
  const rows = providers.data?.data ?? []
  return <div className="mx-auto max-w-[1500px]">
    <PageHeader title="Providers" description="Manage professional records and authoritative user associations." actions={hasPermission(permissions, 'provider.create') ? <Button onClick={() => setCreateOpen(true)}><Plus size={16} />Create provider</Button> : undefined} />
    <div className="mb-4 grid gap-3 rounded-lg border border-clinic-border bg-white p-4 md:grid-cols-[1fr_220px]">
      <label className="text-sm">Search providers<div className="relative mt-1"><Search className="absolute left-3 top-2.5 text-slate-400" size={16} /><Input className="pl-9" placeholder="Name, SVB ID, license, specialty or contact" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /></div></label>
      <label className="text-sm">Status<Select className="mt-1" value={active} onChange={(event) => { setActive(event.target.value); setPage(1) }}><option value="">All providers</option><option value="true">Active</option><option value="false">Inactive</option></Select></label>
    </div>
    {providers.isPending ? <LoadingState label="Loading providers" /> : providers.isError ? <ErrorState title="Unable to load providers" description={getApiErrorMessage(providers.error)} onRetry={() => void providers.refetch()} /> : rows.length === 0 ? <EmptyState title="No providers found" description="Try different search or filter values." /> : <><DataTable rows={rows} getRowKey={(item) => item.id} columns={[
      { key: 'provider', header: 'Provider', render: (item) => <div><button className="font-semibold text-clinic-blue hover:underline" onClick={() => setSelectedId(item.id)}>{item.firstName} {item.lastName}</button><p className="text-xs text-slate-500">{item.specialty ?? 'No specialty recorded'}</p></div> },
      { key: 'svb', header: 'SVB / license', render: (item) => <div><span>{item.svbProviderId ?? 'No SVB ID'}</span><p className="text-xs text-slate-500">{item.licenseNumber ?? 'No license recorded'}</p></div> },
      { key: 'user', header: 'Linked user', render: (item) => item.user ? <div><span>{item.user.firstName} {item.user.lastName}</span><p className="text-xs text-slate-500">{item.user.email}</p></div> : 'Not linked' },
      { key: 'status', header: 'Status', render: (item) => <StatusBadge tone={item.isActive ? 'success' : 'danger'}>{item.isActive ? 'Active' : 'Inactive'}</StatusBadge> },
      { key: 'actions', header: 'Actions', render: (item) => <div className="flex gap-2"><Button className="h-8" variant="secondary" onClick={() => setSelectedId(item.id)}>View</Button>{hasPermission(permissions, 'provider.update') ? <><Button className="h-8" variant="secondary" onClick={() => setEditProvider(item)}>Edit</Button><Button className="h-8" variant={item.isActive ? 'danger' : 'secondary'} onClick={() => setStatusProvider(item)}>{item.isActive ? 'Deactivate' : 'Activate'}</Button></> : null}</div> },
    ]} /><div className="mt-3 flex items-center justify-end gap-2 text-sm"><Button className="h-8 w-8 px-0" variant="secondary" aria-label="Previous page" disabled={page <= 1 || providers.isFetching} onClick={() => setPage(page - 1)}><ChevronLeft size={16} /></Button><span>Page {page} of {Math.max(1, providers.data?.meta?.totalPages ?? 1)}</span><Button className="h-8 w-8 px-0" variant="secondary" aria-label="Next page" disabled={page >= (providers.data?.meta?.totalPages ?? 1) || providers.isFetching} onClick={() => setPage(page + 1)}><ChevronRight size={16} /></Button></div></>}
    <ProviderFormDialog open={createOpen} users={users.data?.data ?? []} canLinkUser={canReadUsers} pending={create.isPending} error={create.error} onClose={() => { setCreateOpen(false); create.reset() }} onSubmit={(values) => create.mutate(values)} />
    <ProviderFormDialog open={Boolean(editProvider)} provider={editProvider ?? undefined} users={users.data?.data ?? []} canLinkUser={canReadUsers} pending={edit.isPending} error={edit.error} onClose={() => { setEditProvider(null); edit.reset() }} onSubmit={(values) => edit.mutate(values)} />
    <ProviderDetailDialog open={Boolean(selectedId)} provider={detail.data} loading={detail.isPending} error={detail.error} onClose={() => setSelectedId('')} />
    <ConfirmDialog open={Boolean(statusProvider)} title={statusProvider?.isActive ? 'Deactivate provider' : 'Activate provider'} description={`${statusProvider?.isActive ? 'Deactivate' : 'Activate'} ${statusProvider?.firstName ?? ''} ${statusProvider?.lastName ?? ''}. Existing appointment and clinical records remain unchanged.`} confirmLabel={statusMutation.isPending ? 'Updating...' : statusProvider?.isActive ? 'Deactivate provider' : 'Activate provider'} pending={statusMutation.isPending} onCancel={() => { setStatusProvider(null); statusMutation.reset() }} onConfirm={() => statusMutation.mutate()} />
  </div>
}
function ProviderDetailDialog({ open, provider, loading, error, onClose }: { open: boolean; provider?: AdminProvider; loading: boolean; error: unknown; onClose: () => void }) {
  return <Dialog open={open} onOpenChange={(next) => !next && onClose()} title="Provider details" description="Professional identity and linked user record.">{loading ? <LoadingState label="Loading provider" /> : error ? <ErrorState title="Unable to load provider" description={getApiErrorMessage(error)} /> : provider ? <Card className="grid gap-4 p-4 sm:grid-cols-2"><Field label="Name">{provider.firstName} {provider.lastName}</Field><Field label="Status"><StatusBadge tone={provider.isActive ? 'success' : 'danger'}>{provider.isActive ? 'Active' : 'Inactive'}</StatusBadge></Field><Field label="SVB provider ID">{provider.svbProviderId ?? 'Not provided'}</Field><Field label="License">{provider.licenseNumber ?? 'Not provided'}</Field><Field label="Specialty">{provider.specialty ?? 'Not provided'}</Field><Field label="Provider ID">{provider.id}</Field><Field label="Linked user">{provider.user ? `${provider.user.firstName} ${provider.user.lastName} (${provider.user.email})` : 'Not linked'}</Field><Field label="Contact">{provider.email ?? provider.phone ?? 'Not provided'}</Field></Card> : null}</Dialog>
}
function Field({ label, children }: { label: string; children: ReactNode }) { return <div><p className="text-xs font-medium text-slate-500">{label}</p><div className="mt-1 break-words text-sm text-slate-900">{children}</div></div> }
