import { NavLink } from 'react-router'
import { hasAnyPermission } from '../../auth/permissions'
import { cn } from '../../lib/cn'
import type { Permission } from '../../types/auth'
import { navigationGroups } from './navigation'

export function Sidebar({
  permissions,
  onNavigate,
}: {
  permissions: Permission[]
  onNavigate?: () => void
}) {
  const visibleGroups = navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          item.permissions.length === 0 ||
          hasAnyPermission(permissions, item.permissions),
      ),
    }))
    .filter((group) => group.items.length > 0)

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
      isActive
        ? 'bg-white/15 text-white'
        : 'text-white/65 hover:bg-white/10 hover:text-white',
    )

  return (
    <aside className="flex h-full w-60 flex-col bg-clinic-navy text-white">
      <div className="border-b border-white/10 px-4 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-clinic-blue text-sm font-bold">
            OS
          </div>
          <div>
            <div className="text-sm font-semibold">Odontho Services</div>
            <div className="font-mono text-[10px] uppercase tracking-wide text-white/40">
              SVB Billing
            </div>
          </div>
        </div>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {visibleGroups.map((group) => (
          <div key={group.label}>
            <div className="mb-1.5 px-3 font-mono text-[10px] uppercase tracking-wide text-white/30">
              {group.label}
            </div>
            <div className="space-y-1">
              {group.items.map((item) =>
                item.unavailable ? (
                  <div
                    key={item.path}
                    className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-white/30"
                    aria-disabled="true"
                    title="Settings backend CRUD is not available in the frozen contract."
                  >
                    <item.icon size={17} aria-hidden="true" />
                    <span>{item.label}</span>
                  </div>
                ) : (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={onNavigate}
                    className={navLinkClass}
                  >
                    <item.icon size={17} aria-hidden="true" />
                    <span>{item.label}</span>
                  </NavLink>
                ),
              )}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  )
}
