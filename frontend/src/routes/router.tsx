import { lazy, type ComponentType } from 'react'
import type { RouteObject } from 'react-router'
import { Navigate } from 'react-router'
import { RequireAuth } from '../auth/require-auth'
import { AppShell } from '../components/app-shell/app-shell'
import { PermissionRoute } from './permission-route'
import { RouteLoadBoundary } from './route-load-boundary'
import { routePermissions } from './route-permissions'

function lazyPage<T extends Record<K, ComponentType>, K extends keyof T>(
  loader: () => Promise<T>,
  exportName: K,
) {
  return lazy(async () => ({ default: (await loader())[exportName] }))
}

const LoginPage = lazyPage(() => import('../features/auth/login-page'), 'LoginPage')
const AccessDeniedPage = lazyPage(() => import('../features/auth/access-denied-page'), 'AccessDeniedPage')
const NotFoundPage = lazyPage(() => import('../features/auth/not-found-page'), 'NotFoundPage')
const DashboardPage = lazyPage(() => import('../features/dashboard/dashboard-page'), 'DashboardPage')
const ReceptionPage = lazyPage(() => import('../features/reception/reception-page'), 'ReceptionPage')
const PatientsPage = lazyPage(() => import('../features/patients/patients-page'), 'PatientsPage')
const PatientDetailPage = lazyPage(() => import('../features/patients/patient-detail-page'), 'PatientDetailPage')
const AppointmentsPage = lazyPage(() => import('../features/appointments/appointments-page'), 'AppointmentsPage')
const AppointmentDetailPage = lazyPage(() => import('../features/appointments/appointment-detail-page'), 'AppointmentDetailPage')
const ClinicalAppointmentPage = lazyPage(() => import('../features/clinical/clinical-appointment-page'), 'ClinicalAppointmentPage')
const InvoicesPage = lazyPage(() => import('../features/billing/invoices-page'), 'InvoicesPage')
const InvoiceDetailPage = lazyPage(() => import('../features/billing/invoice-detail-page'), 'InvoiceDetailPage')
const DeclarationsPage = lazyPage(() => import('../features/declarations/declarations-page'), 'DeclarationsPage')
const DeclarationDetailPage = lazyPage(() => import('../features/declarations/declaration-detail-page'), 'DeclarationDetailPage')
const AdminPage = lazyPage(() => import('../features/administration/admin-page'), 'AdminPage')
const AdminUsersPage = lazyPage(() => import('../features/administration/admin-users-page'), 'AdminUsersPage')
const AdminProvidersPage = lazyPage(() => import('../features/administration/admin-providers-page'), 'AdminProvidersPage')
const AdminSettingsPage = lazyPage(() => import('../features/administration/admin-settings-page'), 'AdminSettingsPage')

function load(Page: ComponentType) {
  return <RouteLoadBoundary><Page /></RouteLoadBoundary>
}

export const routes: RouteObject[] = [
  { path: '/login', element: load(LoginPage) },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: '/dashboard', element: load(DashboardPage) },
          { path: '/access-denied', element: load(AccessDeniedPage) },
          {
            element: <PermissionRoute anyOf={routePermissions.reception} />,
            children: [{ path: '/reception', element: load(ReceptionPage) }],
          },
          {
            element: <PermissionRoute anyOf={routePermissions.patients} />,
            children: [
              { path: '/patients', element: load(PatientsPage) },
              { path: '/patients/:patientId', element: load(PatientDetailPage) },
            ],
          },
          {
            element: <PermissionRoute anyOf={routePermissions.appointments} />,
            children: [
              { path: '/appointments', element: load(AppointmentsPage) },
              { path: '/appointments/:appointmentId', element: load(AppointmentDetailPage) },
            ],
          },
          {
            element: <PermissionRoute anyOf={routePermissions.clinical} />,
            children: [{ path: '/clinical/:appointmentId', element: load(ClinicalAppointmentPage) }],
          },
          {
            element: <PermissionRoute anyOf={routePermissions.invoices} />,
            children: [
              { path: '/invoices', element: load(InvoicesPage) },
              { path: '/invoices/:invoiceId', element: load(InvoiceDetailPage) },
            ],
          },
          {
            element: <PermissionRoute anyOf={routePermissions.declarations} />,
            children: [
              { path: '/declarations', element: load(DeclarationsPage) },
              { path: '/declarations/:declarationId', element: load(DeclarationDetailPage) },
            ],
          },
          {
            element: <PermissionRoute anyOf={routePermissions.admin} />,
            children: [
              { path: '/admin', element: load(AdminPage) },
              { path: '/admin/users', element: load(AdminUsersPage) },
              { path: '/admin/providers', element: load(AdminProvidersPage) },
              { path: '/admin/settings', element: load(AdminSettingsPage) },
            ],
          },
          { path: '*', element: load(NotFoundPage) },
        ],
      },
    ],
  },
]
