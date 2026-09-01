import type { RouteObject } from 'react-router'
import { Navigate } from 'react-router'
import { RequireAuth } from '../auth/require-auth'
import { AppShell } from '../components/app-shell/app-shell'
import { AccessDeniedPage } from '../features/auth/access-denied-page'
import { LoginPage } from '../features/auth/login-page'
import { AdminPage } from '../features/administration/admin-page'
import { AdminProvidersPage } from '../features/administration/admin-providers-page'
import { AdminSettingsPage } from '../features/administration/admin-settings-page'
import { AdminUsersPage } from '../features/administration/admin-users-page'
import { AppointmentsPage } from '../features/appointments/appointments-page'
import { AppointmentDetailPage } from '../features/appointments/appointment-detail-page'
import { ClinicalAppointmentPage } from '../features/clinical/clinical-appointment-page'
import { DashboardPage } from '../features/dashboard/dashboard-page'
import { DeclarationDetailPage } from '../features/declarations/declaration-detail-page'
import { DeclarationsPage } from '../features/declarations/declarations-page'
import { InvoiceDetailPage } from '../features/billing/invoice-detail-page'
import { InvoicesPage } from '../features/billing/invoices-page'
import { PatientDetailPage } from '../features/patients/patient-detail-page'
import { PatientsPage } from '../features/patients/patients-page'
import { ReceptionPage } from '../features/reception/reception-page'
import { PermissionRoute } from './permission-route'
import { routePermissions } from './route-permissions'

export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/access-denied', element: <AccessDeniedPage /> },
          {
            element: <PermissionRoute anyOf={routePermissions.reception} />,
            children: [{ path: '/reception', element: <ReceptionPage /> }],
          },
          {
            element: <PermissionRoute anyOf={routePermissions.patients} />,
            children: [
              { path: '/patients', element: <PatientsPage /> },
              { path: '/patients/:patientId', element: <PatientDetailPage /> },
            ],
          },
          {
            element: <PermissionRoute anyOf={routePermissions.appointments} />,
            children: [
              { path: '/appointments', element: <AppointmentsPage /> },
              {
                path: '/appointments/:appointmentId',
                element: <AppointmentDetailPage />,
              },
            ],
          },
          {
            element: <PermissionRoute allOf={[...routePermissions.clinical, 'appointment.read']} />,
            children: [
              {
                path: '/clinical/:appointmentId',
                element: <ClinicalAppointmentPage />,
              },
            ],
          },
          {
            element: <PermissionRoute anyOf={routePermissions.invoices} />,
            children: [
              { path: '/invoices', element: <InvoicesPage /> },
              { path: '/invoices/:invoiceId', element: <InvoiceDetailPage /> },
            ],
          },
          {
            element: <PermissionRoute anyOf={routePermissions.declarations} />,
            children: [
              { path: '/declarations', element: <DeclarationsPage /> },
              {
                path: '/declarations/:declarationId',
                element: <DeclarationDetailPage />,
              },
            ],
          },
          {
            element: <PermissionRoute anyOf={routePermissions.admin} />,
            children: [
              { path: '/admin', element: <AdminPage /> },
              { path: '/admin/users', element: <AdminUsersPage /> },
              { path: '/admin/providers', element: <AdminProvidersPage /> },
              { path: '/admin/settings', element: <AdminSettingsPage /> },
            ],
          },
        ],
      },
    ],
  },
]
