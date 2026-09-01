import { apiFetch, apiFetchResult } from '../../api'
import type {
  Appointment,
  AppointmentListFilters,
  AppointmentStatusDto,
  AppointmentUpdateDto,
  Provider,
} from '../../types/appointment'
import type { EntityId } from '../../types/core'
import type { PaginationMeta } from '../../types/patient'

export const appointmentKeys = {
  all: ['appointments'] as const,
  lists: () => [...appointmentKeys.all, 'list'] as const,
  list: (filters: AppointmentListFilters) =>
    [...appointmentKeys.lists(), filters] as const,
  details: () => [...appointmentKeys.all, 'detail'] as const,
  detail: (id: EntityId) => [...appointmentKeys.details(), id] as const,
  providers: () => [...appointmentKeys.all, 'providers'] as const,
}

export const receptionKeys = {
  all: ['reception'] as const,
  worklist: (date: string, status?: string, q?: string) =>
    [...receptionKeys.all, 'worklist', date, status ?? 'all', q ?? ''] as const,
}

function appointmentListPath(filters: AppointmentListFilters) {
  const params = new URLSearchParams({
    page: String(filters.page),
    pageSize: String(filters.pageSize),
  })
  const keys: (keyof AppointmentListFilters)[] = [
    'date',
    'from',
    'to',
    'patientId',
    'providerId',
    'clinicLocationId',
    'status',
    'q',
  ]
  for (const key of keys) {
    const value = filters[key]
    if (typeof value === 'string' && value) params.set(key, value)
  }
  return `/appointments?${params.toString()}`
}

export function listAppointments(
  filters: AppointmentListFilters,
  signal?: AbortSignal,
) {
  return apiFetchResult<Appointment[], PaginationMeta>(
    appointmentListPath(filters),
    { signal },
  )
}

export function getAppointment(id: EntityId, signal?: AbortSignal) {
  return apiFetch<Appointment>(`/appointments/${id}`, { signal })
}

export function updateAppointment(
  id: EntityId,
  input: AppointmentUpdateDto,
) {
  return apiFetch<Appointment>(`/appointments/${id}`, {
    method: 'PATCH',
    body: input,
  })
}

export function changeAppointmentStatus(
  id: EntityId,
  input: AppointmentStatusDto,
) {
  return apiFetch<Appointment>(`/appointments/${id}/status`, {
    method: 'PATCH',
    body: input,
  })
}

export function listActiveProviders(signal?: AbortSignal) {
  return apiFetchResult<Provider[], PaginationMeta>(
    '/providers?isActive=true&page=1&pageSize=100',
    { signal },
  )
}
