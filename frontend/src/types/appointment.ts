import type { EntityId } from './core'
import type { PaginationMeta } from './patient'

export type AppointmentStatus =
  | 'SCHEDULED'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'

export interface AppointmentPatient {
  id: EntityId
  patientNumber: string
  firstName: string
  middleName: string | null
  lastName: string
  secondLastName: string | null
  documentType: string | null
  documentNumber: string | null
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED'
}

export interface AppointmentProvider {
  id: EntityId
  svbProviderId: string | null
  firstName: string
  lastName: string
  isActive: boolean
}

export interface AppointmentLocation {
  id: EntityId
  code: string
  name: string
  isActive: boolean
}

export interface Appointment {
  id: EntityId
  organizationId: EntityId
  appointmentNumber: string
  patientId: EntityId
  providerId: EntityId
  clinicLocationId: EntityId
  treatmentCaseId: EntityId | null
  accidentCaseId: EntityId | null
  scheduledStart: string
  scheduledEnd: string
  status: AppointmentStatus
  reason: string | null
  notes: string | null
  checkedInAt: string | null
  startedAt: string | null
  completedAt: string | null
  cancelledAt: string | null
  cancellationReason: string | null
  patient: AppointmentPatient
  provider: AppointmentProvider
  location: AppointmentLocation
  createdByUserId: EntityId
  createdAt: string
  updatedAt: string
}

export interface AppointmentListFilters {
  date?: string
  from?: string
  to?: string
  patientId?: EntityId
  providerId?: EntityId
  clinicLocationId?: EntityId
  status?: AppointmentStatus
  q?: string
  page: number
  pageSize: number
}

export interface AppointmentUpdateDto {
  clinicLocationId?: EntityId
  providerId?: EntityId
  treatmentCaseId?: EntityId | null
  accidentCaseId?: EntityId | null
  scheduledStart?: string
  scheduledEnd?: string
  reason?: string | null
  notes?: string | null
}

export interface AppointmentStatusDto {
  status: AppointmentStatus
  reason?: string
}

export interface Provider {
  id: EntityId
  organizationId: EntityId
  userId: EntityId | null
  svbProviderId: string | null
  firstName: string
  lastName: string
  licenseNumber: string | null
  specialty: string | null
  email: string | null
  phone: string | null
  isActive: boolean
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

export type AppointmentListResult = {
  data: Appointment[]
  meta?: PaginationMeta
}
