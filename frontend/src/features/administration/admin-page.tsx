import { useQuery } from '@tanstack/react-query'
import { Settings, Stethoscope, Users } from 'lucide-react'
import { Link } from 'react-router'
import { getApiErrorMessage } from '../../api'
import { hasPermission } from '../../auth/permissions'
import { useAuth } from '../../auth/use-auth'
import { PageHeader } from '../../components/app-shell/page-header'
import { ErrorState } from '../../components/feedback/error-state'
import { LoadingState } from '../../components/feedback/loading-state'
import { StatusBadge } from '../../components/feedback/status-badge'
import { Card } from '../../components/ui/card'
import { listRoles, roleKeys } from './administration-api'
import { roleDescription, roleLabel } from './administration-model'

export function AdminPage() {
  const { permissions } = useAuth()
  const canReadRoles = hasPermission(permissions, 'role.read')
  const roles = useQuery({ queryKey: roleKeys.all, queryFn: ({ signal }) => listRoles(signal), enabled: canReadRoles })
  const areas = [
    { title: 'Users', description: 'Profiles, account status and system role assignments.', path: '/admin/users', permission: 'user.read', icon: Users, available: true },
    { title: 'Providers', description: 'Professional records and linked user accounts.', path: '/admin/providers', permission: 'provider.read', icon: Stethoscope, available: true },
    { title: 'Settings', description: 'Settings management is not available in the current Backend contract.', path: '/admin/settings', permission: '', icon: Settings, available: false },
  ]
  return <div className="mx-auto max-w-[1500px]"><PageHeader title="Administration" description="Manage authorized users, roles and clinical providers." />
    <div className="mb-6 grid gap-4 md:grid-cols-3">{areas.filter((area) => !area.permission || hasPermission(permissions, area.permission)).map((area) => { const Icon = area.icon; const content = <Card className="h-full p-4"><div className="mb-3 flex items-center justify-between"><Icon size={20} className="text-clinic-blue" /><StatusBadge tone={area.available ? 'success' : 'neutral'}>{area.available ? 'Available' : 'Unavailable'}</StatusBadge></div><h2 className="font-semibold text-slate-900">{area.title}</h2><p className="mt-1 text-sm text-slate-500">{area.description}</p></Card>; return area.available ? <Link key={area.title} to={area.path}>{content}</Link> : <div key={area.title}>{content}</div> })}</div>
    {canReadRoles ? <section><h2 className="mb-3 font-semibold text-slate-900">System roles and permissions</h2>{roles.isPending ? <LoadingState label="Loading roles" /> : roles.isError ? <ErrorState title="Unable to load roles" description={getApiErrorMessage(roles.error)} onRetry={() => void roles.refetch()} /> : <div className="grid gap-4 lg:grid-cols-3">{roles.data.map((role) => <Card key={role.id} className="p-4"><div className="flex items-center justify-between gap-2"><h3 className="font-semibold text-slate-900">{roleLabel(role.code)}</h3><StatusBadge>{`${role.permissions.length} permissions`}</StatusBadge></div><p className="mt-1 text-sm text-slate-500">{roleDescription(role.code)}</p><ul className="mt-3 max-h-44 space-y-1 overflow-y-auto text-xs text-slate-600">{role.permissions.map((permission) => <li key={permission.code} className="font-mono text-slate-800">{permission.code}</li>)}</ul></Card>)}</div>}</section> : null}
  </div>
}
