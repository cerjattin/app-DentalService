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
import { Dialog } from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { Select } from '../../components/ui/select'
import { formatBusinessDateTime } from '../../lib/timezone'
import type { AdminRole, AdminUser, UserStatus } from '../../types/administration'
import { AccessDeniedPage } from '../auth/access-denied-page'
import { RoleAssignmentDialog, UserFormDialog, UserStatusDialog } from './administration-dialogs'
import { createUser, getUser, listRoles, listUsers, replaceUserRoles, roleKeys, updateUser, updateUserStatus, userKeys } from './administration-api'
import { adminLabel, roleLabel, type CreateUserValues, type EditUserValues, type UserStatusValues, userStatusTone } from './administration-model'

export function AdminUsersPage() {
  const { permissions } = useAuth()
  return hasPermission(permissions, 'user.read') ? <UsersWorkspace /> : <AccessDeniedPage />
}
function UsersWorkspace() {
  const { user: currentUser, permissions } = useAuth()
  const client = useQueryClient()
  const [searchInput, setSearchInput] = useState('')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<UserStatus | ''>('')
  const [role, setRole] = useState<AdminRole['code'] | ''>('')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState<AdminUser | null>(null)
  const [rolesOpen, setRolesOpen] = useState(false)
  const [statusUser, setStatusUser] = useState<AdminUser | null>(null)
  useEffect(() => { const timeout = window.setTimeout(() => { setQ(searchInput.trim()); setPage(1) }, 300); return () => window.clearTimeout(timeout) }, [searchInput])
  const filters = { page, pageSize: 20, ...(q ? { q } : {}), ...(status ? { status } : {}), ...(role ? { role } : {}) }
  const users = useQuery({ queryKey: userKeys.list(filters), queryFn: ({ signal }) => listUsers(filters, signal), placeholderData: keepPreviousData })
  const roles = useQuery({ queryKey: roleKeys.all, queryFn: ({ signal }) => listRoles(signal), enabled: hasPermission(permissions, 'role.read') })
  const detail = useQuery({ queryKey: userKeys.detail(selectedId), queryFn: ({ signal }) => getUser(selectedId, signal), enabled: Boolean(selectedId) })
  const refresh = async (id?: string) => { await client.invalidateQueries({ queryKey: userKeys.lists() }); if (id) await client.invalidateQueries({ queryKey: userKeys.detail(id) }) }
  const create = useMutation({ mutationFn: (values: CreateUserValues) => createUser(values), onSuccess: async () => { setCreateOpen(false); await refresh() } })
  const edit = useMutation({ mutationFn: (values: EditUserValues) => updateUser(editUser?.id ?? '', values), onSuccess: async (updated) => { setEditUser(null); await refresh(updated.id) } })
  const assign = useMutation({ mutationFn: (roleCodes: AdminRole['code'][]) => replaceUserRoles(selectedId, roleCodes), onSuccess: async () => { setRolesOpen(false); await refresh(selectedId) } })
  const changeStatus = useMutation({ mutationFn: (values: UserStatusValues) => updateUserStatus(statusUser?.id ?? '', { status: statusUser?.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE', ...(values.reason ? { reason: values.reason } : {}) }), onSuccess: async (updated) => { setStatusUser(null); await refresh(updated.id) } })
  const roleOptions = roles.data ?? []
  return <div className="mx-auto max-w-[1500px]">
    <PageHeader title="Users" description="Manage user profiles, account status and system role assignments." actions={hasPermission(permissions, 'user.create') && hasPermission(permissions, 'role.read') ? <Button onClick={() => setCreateOpen(true)}><Plus size={16} />Create user</Button> : undefined} />
    <div className="mb-4 grid gap-3 rounded-lg border border-clinic-border bg-white p-4 md:grid-cols-3">
      <label className="text-sm">Search users<div className="relative mt-1"><Search className="absolute left-3 top-2.5 text-slate-400" size={16} /><Input className="pl-9" placeholder="Name or email" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /></div></label>
      <label className="text-sm">Status<Select className="mt-1" value={status} onChange={(event) => { setStatus(event.target.value as UserStatus | ''); setPage(1) }}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="LOCKED">Locked</option></Select></label>
      <label className="text-sm">Role<Select className="mt-1" value={role} onChange={(event) => { setRole(event.target.value as AdminRole['code'] | ''); setPage(1) }}><option value="">All roles</option>{roleOptions.map((item) => <option key={item.id} value={item.code}>{roleLabel(item.code)}</option>)}</Select></label>
    </div>
    {users.isPending ? <LoadingState label="Loading users" /> : users.isError ? <ErrorState title="Unable to load users" description={getApiErrorMessage(users.error)} onRetry={() => void users.refetch()} /> : users.data.data.length === 0 ? <EmptyState title="No users found" description="Try different search or filter values." /> : <><DataTable rows={users.data.data} getRowKey={(item) => item.id} columns={[
      { key: 'user', header: 'User', render: (item) => <div><button className="font-semibold text-clinic-blue hover:underline" onClick={() => setSelectedId(item.id)}>{item.firstName} {item.lastName}</button><p className="text-xs text-slate-500">{item.email}</p></div> },
      { key: 'roles', header: 'Roles', render: (item) => <div className="flex flex-wrap gap-1">{item.roles.map((assigned) => <StatusBadge key={assigned.id}>{roleLabel(assigned.code)}</StatusBadge>)}</div> },
      { key: 'status', header: 'Status', render: (item) => <StatusBadge tone={userStatusTone(item.status)}>{adminLabel(item.status)}</StatusBadge> },
      { key: 'login', header: 'Last login', render: (item) => item.lastLoginAt ? formatBusinessDateTime(item.lastLoginAt) : 'Never' },
      { key: 'actions', header: 'Actions', render: (item) => <div className="flex gap-2"><Button className="h-8" variant="secondary" onClick={() => setSelectedId(item.id)}>View</Button>{hasPermission(permissions, 'user.update') ? <Button className="h-8" variant="secondary" onClick={() => setEditUser(item)}>Edit</Button> : null}{hasPermission(permissions, 'user.update') ? <Button className="h-8" variant={item.status === 'ACTIVE' ? 'danger' : 'secondary'} disabled={item.id === currentUser?.id} title={item.id === currentUser?.id ? 'You cannot deactivate your current account.' : undefined} onClick={() => setStatusUser(item)}>{item.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</Button> : null}</div> },
    ]} /><Pagination page={page} totalPages={users.data.meta?.totalPages ?? 1} disabled={users.isFetching} onPage={setPage} /></>}
    <UserFormDialog open={createOpen} roles={roleOptions} pending={create.isPending} error={create.error} onClose={() => { setCreateOpen(false); create.reset() }} onCreate={(values) => create.mutate(values)} onUpdate={() => undefined} />
    <UserFormDialog open={Boolean(editUser)} user={editUser ?? undefined} roles={roleOptions} pending={edit.isPending} error={edit.error} onClose={() => { setEditUser(null); edit.reset() }} onCreate={() => undefined} onUpdate={(values) => edit.mutate(values)} />
    <UserDetailDialog open={Boolean(selectedId) && !rolesOpen} user={detail.data} loading={detail.isPending} error={detail.error} canAssign={hasPermission(permissions, 'user.assign_roles') && hasPermission(permissions, 'role.read')} onClose={() => setSelectedId('')} onAssign={() => setRolesOpen(true)} />
    <RoleAssignmentDialog open={rolesOpen} user={detail.data ?? null} roles={roleOptions} pending={assign.isPending} error={assign.error} onClose={() => { setRolesOpen(false); assign.reset() }} onSubmit={(codes) => assign.mutate(codes)} />
    <UserStatusDialog open={Boolean(statusUser)} user={statusUser} pending={changeStatus.isPending} error={changeStatus.error} onClose={() => { setStatusUser(null); changeStatus.reset() }} onSubmit={(values) => changeStatus.mutate(values)} />
  </div>
}

function UserDetailDialog({ open, user, loading, error, canAssign, onClose, onAssign }: { open: boolean; user?: AdminUser; loading: boolean; error: unknown; canAssign: boolean; onClose: () => void; onAssign: () => void }) {
  return <Dialog open={open} onOpenChange={(next) => !next && onClose()} title="User details" description="Account metadata and assigned system roles.">{loading ? <LoadingState label="Loading user" /> : error ? <ErrorState title="Unable to load user" description={getApiErrorMessage(error)} /> : user ? <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><Field label="Name">{user.firstName} {user.lastName}</Field><Field label="Email">{user.email}</Field><Field label="Status"><StatusBadge tone={userStatusTone(user.status)}>{adminLabel(user.status)}</StatusBadge></Field><Field label="Failed login attempts">{user.failedLoginAttempts}</Field><Field label="Last login">{user.lastLoginAt ? formatBusinessDateTime(user.lastLoginAt) : 'Never'}</Field><Field label="User ID">{user.id}</Field></div><div><p className="mb-2 text-xs font-medium text-slate-500">Roles</p><div className="flex flex-wrap gap-2">{user.roles.map((role) => <StatusBadge key={role.id}>{roleLabel(role.code)}</StatusBadge>)}</div></div>{canAssign ? <div className="flex justify-end"><Button variant="secondary" onClick={onAssign}>Assign roles</Button></div> : null}</div> : null}</Dialog>
}
function Field({ label, children }: { label: string; children: ReactNode }) { return <div><p className="text-xs font-medium text-slate-500">{label}</p><div className="mt-1 break-words text-sm text-slate-900">{children}</div></div> }
function Pagination({ page, totalPages, disabled, onPage }: { page: number; totalPages: number; disabled: boolean; onPage: (page: number) => void }) { return <div className="mt-3 flex items-center justify-end gap-2 text-sm"><Button className="h-8 w-8 px-0" variant="secondary" aria-label="Previous page" disabled={page <= 1 || disabled} onClick={() => onPage(page - 1)}><ChevronLeft size={16} /></Button><span>Page {page} of {Math.max(1, totalPages)}</span><Button className="h-8 w-8 px-0" variant="secondary" aria-label="Next page" disabled={page >= totalPages || disabled} onClick={() => onPage(page + 1)}><ChevronRight size={16} /></Button></div> }
