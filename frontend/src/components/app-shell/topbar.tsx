import { Menu, Search } from 'lucide-react'
import { useNavigate } from 'react-router'
import { Button } from '../ui/button'
import { useAuth } from '../../auth/use-auth'
import { formatBusinessTime } from '../../lib/timezone'

export function Topbar({
  title,
  subtitle,
  onMenuClick,
}: {
  title: string
  subtitle?: string
  onMenuClick: () => void
}) {
  const { user, clearSession } = useAuth()
  const navigate = useNavigate()
  const displayName = user ? `${user.firstName} ${user.lastName}` : 'Signed out'
  const roleLabel = user?.roles.length ? user.roles.join(', ') : 'Authenticated user'
  const initials = user
    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
    : 'OS'

  return (
    <header className="flex min-h-16 items-center gap-4 border-b border-clinic-border bg-white px-4 lg:px-6">
      <Button
        className="h-9 w-9 px-0 lg:hidden"
        variant="ghost"
        onClick={onMenuClick}
        aria-label="Open navigation"
      >
        <Menu size={18} />
      </Button>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold text-slate-900">{title}</h1>
        {subtitle ? <p className="truncate text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      <div className="relative hidden md:block">
        <Search
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
          size={15}
          aria-hidden="true"
        />
        <input
          aria-label="Global search"
          className="h-9 w-72 rounded-md border border-clinic-border bg-slate-50 pl-8 pr-3 text-sm placeholder:text-slate-400 focus:border-clinic-blue focus:outline-none focus:ring-2 focus:ring-clinic-blue/20"
          placeholder="Search patients, invoices, or appointments"
        />
      </div>
      <div className="hidden text-xs font-mono text-slate-400 xl:block">
        {formatBusinessTime(new Date())}
      </div>
      <div className="hidden min-w-0 text-right sm:block">
        <div className="truncate text-xs font-medium text-slate-700">
          {displayName}
        </div>
        <div className="truncate text-[11px] text-slate-400">{roleLabel}</div>
      </div>
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-clinic-blue text-xs font-semibold text-white">
        {initials}
      </div>
      <Button
        variant="secondary"
        onClick={() => {
          clearSession()
          navigate('/login', { replace: true })
        }}
      >
        Sign out
      </Button>
    </header>
  )
}
