import { ApiError, apiFetch, apiFetchResult } from '../../api'
import type { EntityId } from '../../types/core'
import type { PaginationMeta } from '../../types/patient'
import type {
  Authorization,
  AuthorizationItem,
  AuthorizationItemWriteDto,
  AuthorizationUpdateDto,
  AuthorizationWriteDto,
  ClinicalEncounter,
  DiagnosisCode,
  DiagnosisUpdateDto,
  DiagnosisWriteDto,
  EncounterDiagnosis,
  EncounterProcedure,
  EncounterWriteDto,
  ProcedureUpdateDto,
  ProcedureWriteDto,
  SvbProcedure,
  TariffResolution,
} from '../../types/clinical'

export const encounterKeys = {
  appointment: (id: EntityId) =>
    ['clinical-encounter', 'appointment', id] as const,
  diagnoses: (id: EntityId) => ['clinical-encounter', id, 'diagnoses'] as const,
  procedures: (id: EntityId) =>
    ['clinical-encounter', id, 'procedures'] as const,
}
export const catalogueKeys = {
  diagnoses: (q: string, page: number) => ['diagnosis-codes', q, page] as const,
  procedures: (q: string, page: number, date: string) =>
    ['svb-procedures', q, page, date] as const,
  tariff: (id: EntityId, date: string) =>
    ['svb-tariff', id, date, 'ANG'] as const,
}
export const authorizationKeys = {
  patient: (id: EntityId) => ['authorizations', 'patient', id] as const,
  list: (id: EntityId, page: number, q: string) =>
    [...authorizationKeys.patient(id), page, q] as const,
}
export async function getEncounter(
  appointmentId: EntityId,
  signal?: AbortSignal,
) {
  try {
    return await apiFetch<ClinicalEncounter>(
      `/appointments/${appointmentId}/clinical-encounter`,
      { signal },
    )
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status === 404 &&
      error.code === 'CLINICAL_ENCOUNTER_NOT_FOUND'
    )
      return null
    throw error
  }
}
export const createEncounter = (id: EntityId, body: EncounterWriteDto) =>
  apiFetch<ClinicalEncounter>(`/appointments/${id}/clinical-encounter`, {
    method: 'POST',
    body,
  })
export const updateEncounter = (id: EntityId, body: EncounterWriteDto) =>
  apiFetch<ClinicalEncounter>(`/clinical-encounters/${id}`, {
    method: 'PATCH',
    body,
  })
export const completeEncounter = (id: EntityId) =>
  apiFetch<ClinicalEncounter>(`/clinical-encounters/${id}/complete`, {
    method: 'POST',
  })
const diagnosesPath = (id: EntityId) => `/clinical-encounters/${id}/diagnoses`
export const listDiagnoses = (id: EntityId, signal?: AbortSignal) =>
  apiFetch<EncounterDiagnosis[]>(diagnosesPath(id), { signal })
export const addDiagnosis = (id: EntityId, body: DiagnosisWriteDto) =>
  apiFetch<EncounterDiagnosis>(diagnosesPath(id), { method: 'POST', body })
export const updateDiagnosis = (
  id: EntityId,
  diagnosisId: EntityId,
  body: DiagnosisUpdateDto,
) =>
  apiFetch<EncounterDiagnosis>(`${diagnosesPath(id)}/${diagnosisId}`, {
    method: 'PATCH',
    body,
  })
export const removeDiagnosis = (id: EntityId, diagnosisId: EntityId) =>
  apiFetch<EncounterDiagnosis>(`${diagnosesPath(id)}/${diagnosisId}`, {
    method: 'DELETE',
  })
export function searchDiagnoses(q: string, page: number, signal?: AbortSignal) {
  return apiFetchResult<DiagnosisCode[], PaginationMeta>(
    `/diagnosis-codes?${new URLSearchParams({ q, page: String(page), pageSize: '20', isActive: 'true' })}`,
    { signal },
  )
}
export function searchProcedures(
  q: string,
  page: number,
  serviceDate: string,
  signal?: AbortSignal,
) {
  return apiFetchResult<SvbProcedure[], PaginationMeta>(
    `/svb-procedures?${new URLSearchParams({ q, page: String(page), pageSize: '20', isActive: 'true', serviceDate })}`,
    { signal },
  )
}
export const getTariff = (
  id: EntityId,
  serviceDate: string,
  signal?: AbortSignal,
) =>
  apiFetch<TariffResolution>(
    `/svb-procedures/${id}/applicable-tariff?${new URLSearchParams({ serviceDate, currencyCode: 'ANG' })}`,
    { signal },
  )
const proceduresPath = (id: EntityId) => `/clinical-encounters/${id}/procedures`
export const listProcedures = (id: EntityId, signal?: AbortSignal) =>
  apiFetch<EncounterProcedure[]>(proceduresPath(id), { signal })
export const addProcedure = (id: EntityId, body: ProcedureWriteDto) =>
  apiFetch<EncounterProcedure>(proceduresPath(id), { method: 'POST', body })
export const updateProcedure = (
  id: EntityId,
  procedureId: EntityId,
  body: ProcedureUpdateDto,
) =>
  apiFetch<EncounterProcedure>(`${proceduresPath(id)}/${procedureId}`, {
    method: 'PATCH',
    body,
  })
export const removeProcedure = (id: EntityId, procedureId: EntityId) =>
  apiFetch<EncounterProcedure>(`${proceduresPath(id)}/${procedureId}`, {
    method: 'DELETE',
  })
export const listAuthorizations = (
  patientId: EntityId,
  page: number,
  q: string,
  signal?: AbortSignal,
) =>
  apiFetchResult<Authorization[], PaginationMeta>(
    `/authorizations?${new URLSearchParams({ patientId, page: String(page), pageSize: '20', q })}`,
    { signal },
  )
export const createAuthorization = (body: AuthorizationWriteDto) =>
  apiFetch<Authorization>('/authorizations', { method: 'POST', body })
export const updateAuthorization = (
  id: EntityId,
  body: AuthorizationUpdateDto,
) => apiFetch<Authorization>(`/authorizations/${id}`, { method: 'PATCH', body })
export const createAuthorizationItem = (
  id: EntityId,
  body: AuthorizationItemWriteDto,
) =>
  apiFetch<AuthorizationItem>(`/authorizations/${id}/items`, {
    method: 'POST',
    body,
  })
export const updateAuthorizationItem = (
  id: EntityId,
  itemId: EntityId,
  body: AuthorizationItemWriteDto,
) =>
  apiFetch<AuthorizationItem>(`/authorizations/${id}/items/${itemId}`, {
    method: 'PATCH',
    body,
  })
