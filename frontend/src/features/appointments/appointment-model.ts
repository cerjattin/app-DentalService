import type { Appointment, AppointmentStatus } from '../../types/appointment'

export const appointmentStatuses: AppointmentStatus[] = [
  'SCHEDULED',
  'CONFIRMED',
  'CHECKED_IN',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
]

export function appointmentStatusLabel(status: AppointmentStatus) {
  const labels: Record<AppointmentStatus, string> = {
    SCHEDULED: 'Scheduled',
    CONFIRMED: 'Confirmed',
    CHECKED_IN: 'Checked in',
    IN_PROGRESS: 'In progress',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
    NO_SHOW: 'No-show',
  }
  return labels[status]
}

export function appointmentStatusTone(status: AppointmentStatus) {
  if (status === 'COMPLETED') return 'success' as const
  if (status === 'CHECKED_IN' || status === 'IN_PROGRESS') return 'info' as const
  if (status === 'CONFIRMED') return 'success' as const
  if (status === 'SCHEDULED') return 'warning' as const
  return 'danger' as const
}

export function appointmentPatientName(appointment: Appointment) {
  return [
    appointment.patient.firstName,
    appointment.patient.middleName,
    appointment.patient.lastName,
    appointment.patient.secondLastName,
  ]
    .filter(Boolean)
    .join(' ')
}

export function appointmentProviderName(appointment: Appointment) {
  return `${appointment.provider.firstName} ${appointment.provider.lastName}`
}

export interface AppointmentTransition {
  status: AppointmentStatus
  label: string
  permission: string
  tone: 'primary' | 'secondary' | 'danger'
  requiresDialog?: boolean
}

export function availableTransitions(
  status: AppointmentStatus,
): AppointmentTransition[] {
  if (status === 'SCHEDULED') {
    return [
      { status: 'CONFIRMED', label: 'Confirm', permission: 'appointment.update', tone: 'secondary' },
      { status: 'CHECKED_IN', label: 'Check in', permission: 'appointment.check_in', tone: 'primary' },
      { status: 'CANCELLED', label: 'Cancel', permission: 'appointment.cancel', tone: 'danger', requiresDialog: true },
      { status: 'NO_SHOW', label: 'Mark no-show', permission: 'appointment.cancel', tone: 'secondary', requiresDialog: true },
    ]
  }
  if (status === 'CONFIRMED') {
    return [
      { status: 'CHECKED_IN', label: 'Check in', permission: 'appointment.check_in', tone: 'primary' },
      { status: 'CANCELLED', label: 'Cancel', permission: 'appointment.cancel', tone: 'danger', requiresDialog: true },
      { status: 'NO_SHOW', label: 'Mark no-show', permission: 'appointment.cancel', tone: 'secondary', requiresDialog: true },
    ]
  }
  if (status === 'CHECKED_IN') {
    return [
      { status: 'IN_PROGRESS', label: 'Start appointment', permission: 'appointment.start', tone: 'primary' },
      { status: 'CANCELLED', label: 'Cancel', permission: 'appointment.cancel', tone: 'danger', requiresDialog: true },
      { status: 'NO_SHOW', label: 'Mark no-show', permission: 'appointment.cancel', tone: 'secondary', requiresDialog: true },
    ]
  }
  if (status === 'IN_PROGRESS') {
    return [
      { status: 'COMPLETED', label: 'Complete appointment', permission: 'appointment.complete', tone: 'primary' },
      { status: 'CANCELLED', label: 'Cancel', permission: 'appointment.cancel', tone: 'danger', requiresDialog: true },
    ]
  }
  return []
}
