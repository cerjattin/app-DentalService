import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import { useAuth } from '../../auth/use-auth'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'

const pageTitles: Record<string, { title: string; subtitle?: string }> = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Operational overview' },
  '/reception': { title: 'Reception', subtitle: 'Front desk workspace' },
  '/patients': { title: 'Patients', subtitle: 'Patient records and insurance' },
  '/appointments': { title: 'Appointments', subtitle: 'Scheduling and status workflow' },
  '/invoices': { title: 'Invoices', subtitle: 'SVB billing' },
  '/declarations': { title: 'Declarations', subtitle: 'SVB batches and submissions' },
  '/admin': { title: 'Administration', subtitle: 'Users, roles and providers' },
  '/admin/users': { title: 'Users', subtitle: 'Profiles, status and role assignments' },
  '/admin/providers': { title: 'Providers', subtitle: 'Professional and user relationships' },
  '/admin/settings': { title: 'Settings', subtitle: 'Unavailable in the Backend contract' },
}

function titleForPath(pathname: string) {
  if (pageTitles[pathname]) {
    return pageTitles[pathname]
  }

  if (pathname.startsWith('/patients/')) {
    return { title: 'Patient Profile', subtitle: 'Patient and insurance details' }
  }

  if (pathname.startsWith('/appointments/')) {
    return { title: 'Appointment Detail', subtitle: 'Schedule, status and patient context' }
  }

  if (pathname.startsWith('/clinical/')) {
    return { title: 'Clinical Workspace', subtitle: 'Encounter and procedures' }
  }

  if (pathname.startsWith('/invoices/')) {
    return { title: 'Invoice Detail', subtitle: 'Invoice version and documents' }
  }

  if (pathname.startsWith('/declarations/')) {
    return { title: 'Declaration Detail', subtitle: 'Items, exports and submissions' }
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
      <div className="hidden xl:block">
        <Sidebar permissions={permissions} />
      </div>
      <DialogPrimitive.Root
        open={mobileNavigationOpen}
        onOpenChange={setMobileNavigationOpen}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-slate-950/40 xl:hidden" />
          <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 w-72 max-w-[82vw] focus:outline-none xl:hidden">
            <DialogPrimitive.Title className="sr-only">
              Application navigation
            </DialogPrimitive.Title>
            <Sidebar
              permissions={permissions}
              onNavigate={() => setMobileNavigationOpen(false)}
            />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
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
