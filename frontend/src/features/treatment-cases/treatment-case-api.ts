import { apiFetch, apiFetchResult } from '../../api'
import type { PaginationMeta } from '../../types/patient'
import type { TreatmentCase, TreatmentCaseInput, TreatmentCaseFilters } from '../../types/treatment-case'
export const treatmentCaseKeys = {
  patient: (patientId: string) => ['patient-treatment-cases', patientId] as const,
  list: (patientId: string, filters: TreatmentCaseFilters) => ['patient-treatment-cases', patientId, 'list', filters] as const,
  detail: (patientId: string, id: string) => ['patient-treatment-cases', patientId, 'detail', id] as const,
}
const path = (patientId: string) => `/patients/${patientId}/treatment-cases`
export const listTreatmentCases = (patientId: string, filters: TreatmentCaseFilters, signal?: AbortSignal) => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== '') params.set(key, String(value))
  return apiFetchResult<TreatmentCase[], PaginationMeta>(`${path(patientId)}?${params}`, { signal })
}
export const getTreatmentCase = (patientId: string, id: string, signal?: AbortSignal) => apiFetch<TreatmentCase>(`${path(patientId)}/${id}`, { signal })
export const createTreatmentCase = (patientId: string, body: TreatmentCaseInput) => apiFetch<TreatmentCase>(path(patientId), { method: 'POST', body })
export const updateTreatmentCase = (patientId: string, id: string, body: Partial<TreatmentCaseInput>) => apiFetch<TreatmentCase>(`${path(patientId)}/${id}`, { method: 'PATCH', body })
