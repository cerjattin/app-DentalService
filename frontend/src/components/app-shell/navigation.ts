import {
  CalendarDays,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Settings,
  Stethoscope,
  Users,
  UserRoundCog,
  WalletCards,
} from 'lucide-react'
import type { ComponentType } from 'react'

export interface NavigationItem {
  label: string
  path: string
  permissions: string[]
  icon: ComponentType<{ size?: number; className?: string }>
  unavailable?: boolean
  unavailableReason?: string
}

export interface NavigationGroup {
  label: string
  items: NavigationItem[]
}

export const navigationGroups: NavigationGroup[] = [
  {
    label: 'Workspace',
    items: [
      {
        label: 'Dashboard',
        path: '/dashboard',
        permissions: [],
        icon: LayoutDashboard,
      },
      {
        label: 'Reception',
        path: '/reception',
        permissions: ['appointment.read'],
        icon: ClipboardList,
      },
      {
        label: 'Patients',
        path: '/patients',
        permissions: ['patient.read'],
        icon: Users,
      },
      {
        label: 'Appointments',
        path: '/appointments',
        permissions: ['appointment.read'],
        icon: CalendarDays,
      },
      {
        label: 'Clinical',
        path: '/clinical/current',
        permissions: ['encounter.read'],
        icon: Stethoscope,
        unavailable: true,
        unavailableReason: 'Open the clinical workspace from an eligible appointment.',
      },
    ],
  },
  {
    label: 'SVB',
    items: [
      {
        label: 'Invoices',
        path: '/invoices',
        permissions: ['invoice.read'],
        icon: WalletCards,
      },
      {
        label: 'Declarations',
        path: '/declarations',
        permissions: ['declaration.read'],
        icon: FileText,
      },
    ],
  },
  {
    label: 'Administration',
    items: [
      {
        label: 'Administration',
        path: '/admin',
        permissions: ['user.read', 'provider.read', 'role.read'],
        icon: UserRoundCog,
      },
      {
        label: 'Users',
        path: '/admin/users',
        permissions: ['user.read'],
        icon: Users,
      },
      {
        label: 'Providers',
        path: '/admin/providers',
        permissions: ['provider.read'],
        icon: Stethoscope,
      },
      {
        label: 'Settings',
        path: '/admin/settings',
        permissions: ['user.read', 'provider.read', 'role.read'],
        icon: Settings,
        unavailable: true,
        unavailableReason: 'Settings backend CRUD is not available in the frozen contract.',
      },
    ],
  },
]
