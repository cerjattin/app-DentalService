import { useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import { useAuth } from '../../auth/use-auth'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'

const pageTitles: Record<string, { title: string; subtitle?: string }> = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Operational overview' },
  '/reception': { title: 'Reception', subtitle: 'Front desk workspace' },
  '/patients': { title: 'Patients', subtitle: 'Patient records foundation' },
  '/appointments': { title: 'Appointments', subtitle: 'Scheduling foundation' },
  '/invoices': { title: 'Invoices', subtitle: 'SVB billing foundation' },
  '/declarations': { title: 'Declarations', subtitle: 'SVB declarations foundation' },
  '/admin': { title: 'Administration', subtitle: 'System administration' },
  '/admin/users': { title: 'Users', subtitle: 'Access management foundation' },
  '/admin/providers': { title: 'Providers', subtitle: 'Provider management foundation' },
  '/admin/settings': { title: 'Settings', subtitle: 'Application configuration foundation' },
}

function titleForPath(pathname: string) {
  if (pageTitles[pathname]) {
    return pageTitles[pathname]
  }

  if (pathname.startsWith('/patients/')) {
    return { title: 'Patient Profile', subtitle: 'Patient detail foundation' }
  }

  if (pathname.startsWith('/appointments/')) {
    return { title: 'Appointment Detail', subtitle: 'Appointment detail foundation' }
  }

  if (pathname.startsWith('/clinical/')) {
    return { title: 'Clinical Workspace', subtitle: 'Tablet-ready clinical foundation' }
  }

  if (pathname.startsWith('/invoices/')) {
    return { title: 'Invoice Detail', subtitle: 'Invoice version foundation' }
  }

  if (pathname.startsWith('/declarations/')) {
    return { title: 'Declaration Detail', subtitle: 'Declaration detail foundation' }
  }

  return { title: 'Odontho Services', subtitle: 'SVB billing application' }
}

export function AppShell() {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false)
  const { permissions } = useAuth()
  const location = useLocation()
  const page = titleForPath(location.pathname)

  return (
    <div className="flex min-h-svh bg-clinic-surface">
      <div className="hidden lg:block">
        <Sidebar permissions={permissions} />
      </div>
      {mobileNavigationOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            aria-label="Close navigation"
            className="absolute inset-0 bg-slate-950/40"
            onClick={() => setMobileNavigationOpen(false)}
            type="button"
          />
          <div className="relative h-full w-72 max-w-[82vw]">
            <Sidebar
              permissions={permissions}
              onNavigate={() => setMobileNavigationOpen(false)}
            />
          </div>
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          title={page.title}
          subtitle={page.subtitle}
          onMenuClick={() => setMobileNavigationOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-5 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
