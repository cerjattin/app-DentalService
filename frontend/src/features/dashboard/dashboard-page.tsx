import { Link } from 'react-router'
import { hasAnyPermission } from '../../auth/permissions'
import { PermissionGuard } from '../../auth/permission-guard'
import { useAuth } from '../../auth/use-auth'
import { PageHeader } from '../../components/app-shell/page-header'
import { Card } from '../../components/ui/card'
import { StatusBadge } from '../../components/feedback/status-badge'

const widgets = [
  {
    title: 'Reception Queue',
    description: 'Open the reception workspace prepared for intake and check-in.',
    path: '/reception',
    permissions: ['appointment.read', 'patient.read'],
  },
  {
    title: 'Patients',
    description: 'Open the patient records area.',
    path: '/patients',
    permissions: ['patient.read'],
  },
  {
    title: 'Clinical Work',
    description: 'Open appointment-driven clinical workspaces.',
    path: '/appointments',
    permissions: ['encounter.read', 'appointment.read'],
  },
  {
    title: 'SVB Billing',
    description: 'Open the invoice and signature foundation.',
    path: '/invoices',
    permissions: ['invoice.read'],
  },
  {
    title: 'Declarations',
    description: 'Open the SVB declaration foundation.',
    path: '/declarations',
    permissions: ['declaration.read'],
  },
  {
    title: 'Administration',
    description: 'Open user and provider administration.',
    path: '/admin',
    permissions: ['user.read', 'provider.read', 'role.read'],
  },
]

export function DashboardPage() {
  const { user, permissions } = useAuth()
  const visibleWidgetCount = widgets.filter((widget) =>
    hasAnyPermission(permissions, widget.permissions),
  ).length
  const displayName = user ? `${user.firstName} ${user.lastName}` : 'User'

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Your authenticated workspace is composed from backend permissions."
      />
      <Card className="mb-4 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">{displayName}</p>
            <p className="mt-1 text-sm text-slate-500">
              {user?.email} · Organization {user?.organizationId}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {user?.roles.map((role) => (
              <StatusBadge key={role} tone="neutral">
                {role}
              </StatusBadge>
            ))}
            <StatusBadge tone="info">{`${visibleWidgetCount} areas available`}</StatusBadge>
          </div>
        </div>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {widgets.map((widget) => (
          <PermissionGuard key={widget.title} anyOf={widget.permissions}>
            <Link to={widget.path}>
              <Card className="h-full p-4 transition-colors hover:border-clinic-blue">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">{widget.title}</h3>
                  <StatusBadge tone="info">Ready</StatusBadge>
                </div>
                <p className="text-sm text-slate-500">{widget.description}</p>
              </Card>
            </Link>
          </PermissionGuard>
        ))}
      </div>
    </div>
  )
}
