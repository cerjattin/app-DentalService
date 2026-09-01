import { apiFetch, apiFetchResult } from '../../api'
import type { EntityId } from '../../types/core'
import type {
  InsuranceUpdateDto,
  InsuranceWriteDto,
  PaginationMeta,
  Patient,
  PatientInsurance,
  PatientListFilters,
  PatientUpdateDto,
  PatientWriteDto,
  Payer,
} from '../../types/patient'

export const patientKeys = {
  all: ['patients'] as const,
  lists: () => [...patientKeys.all, 'list'] as const,
  list: (filters: PatientListFilters) =>
    [...patientKeys.lists(), filters] as const,
  details: () => [...patientKeys.all, 'detail'] as const,
  detail: (id: EntityId) => [...patientKeys.details(), id] as const,
  insurance: (id: EntityId) =>
    [...patientKeys.detail(id), 'insurance'] as const,
  payers: () => [...patientKeys.all, 'payers'] as const,
}

function patientListPath(filters: PatientListFilters) {
  const params = new URLSearchParams({
    page: String(filters.page),
    pageSize: String(filters.pageSize),
  })
  if (filters.q) params.set('q', filters.q)
  if (filters.status) params.set('status', filters.status)
  return `/patients?${params.toString()}`
}

export function listPatients(filters: PatientListFilters, signal?: AbortSignal) {
  return apiFetchResult<Patient[], PaginationMeta>(patientListPath(filters), {
    signal,
  })
}

export function getPatient(id: EntityId, signal?: AbortSignal) {
  return apiFetch<Patient>(`/patients/${id}`, { signal })
}

export function createPatient(input: PatientWriteDto) {
  return apiFetch<Patient>('/patients', { method: 'POST', body: input })
}

export function updatePatient(id: EntityId, input: PatientUpdateDto) {
  return apiFetch<Patient>(`/patients/${id}`, { method: 'PATCH', body: input })
}

export function listPayers(signal?: AbortSignal) {
  return apiFetch<Payer[]>('/payers', { signal })
}

export function listPatientInsurance(id: EntityId, signal?: AbortSignal) {
  return apiFetch<PatientInsurance[]>(`/patients/${id}/insurance`, { signal })
}

export function createInsurance(id: EntityId, input: InsuranceWriteDto) {
  return apiFetch<PatientInsurance>(`/patients/${id}/insurance`, {
    method: 'POST',
    body: input,
  })
}

export function updateInsurance(
  patientId: EntityId,
  insuranceId: EntityId,
  input: InsuranceUpdateDto,
) {
  return apiFetch<PatientInsurance>(
    `/patients/${patientId}/insurance/${insuranceId}`,
    { method: 'PATCH', body: input },
  )
}

export function verifyInsurance(
  patientId: EntityId,
  insuranceId: EntityId,
  verificationSource: string,
) {
  return apiFetch<PatientInsurance>(
    `/patients/${patientId}/insurance/${insuranceId}/verify`,
    { method: 'POST', body: { verificationSource } },
  )
}
