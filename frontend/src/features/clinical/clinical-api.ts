import { apiFetch, apiFetchResult } from '../../api'
import type {
  Authorization,
  ClinicalEncounter,
  DiagnosisCode,
  EncounterDiagnosis,
  EncounterProcedure,
  EncounterProcedureCreateDto,
  SvbProcedure,
  SvbTariff,
} from '../../types/clinical'
import type { EntityId } from '../../types/core'
import type { PaginationMeta } from '../../types/patient'

export const encounterKeys = {
  all: ['clinical-encounters'] as const,
  byAppointment: (appointmentId: EntityId) =>
    [...encounterKeys.all, 'appointment', appointmentId] as const,
  detail: (encounterId: EntityId) =>
    [...encounterKeys.all, 'detail', encounterId] as const,
}

export const diagnosisKeys = {
  all: ['diagnoses'] as const,
  codes: (q: string) => [...diagnosisKeys.all, 'codes', q] as const,
  encounter: (encounterId: EntityId) =>
    [...diagnosisKeys.all, 'encounter', encounterId] as const,
}

export const svbProcedureKeys = {
  all: ['svb-procedures'] as const,
  search: (q: string, serviceDate: string) =>
    [...svbProcedureKeys.all, 'search', q, serviceDate] as const,
  tariff: (procedureId: EntityId, serviceDate: string) =>
    [...svbProcedureKeys.all, 'tariff', procedureId, serviceDate] as const,
}

export const authorizationKeys = {
  all: ['authorizations'] as const,
  patient: (patientId: EntityId, serviceDate: string) =>
    [...authorizationKeys.all, 'patient', patientId, serviceDate] as const,
}

export const performedProcedureKeys = {
  all: ['encounter-procedures'] as const,
  encounter: (encounterId: EntityId) =>
    [...performedProcedureKeys.all, 'encounter', encounterId] as const,
}

export function getEncounterByAppointment(appointmentId: EntityId, signal?: AbortSignal) {
  return apiFetch<ClinicalEncounter>(`/appointments/${appointmentId}/clinical-encounter`, { signal })
}

export function createEncounter(
  appointmentId: EntityId,
  input: { chiefComplaint?: string | null; clinicalNotes?: string | null },
) {
  return apiFetch<ClinicalEncounter>(`/appointments/${appointmentId}/clinical-encounter`, {
    method: 'POST',
    body: input,
  })
}

export function updateEncounter(
  encounterId: EntityId,
  input: { chiefComplaint?: string | null; clinicalNotes?: string | null },
) {
  return apiFetch<ClinicalEncounter>(`/clinical-encounters/${encounterId}`, {
    method: 'PATCH',
    body: input,
  })
}

export function completeEncounter(encounterId: EntityId) {
  return apiFetch<ClinicalEncounter>(`/clinical-encounters/${encounterId}/complete`, { method: 'POST' })
}

export function listEncounterDiagnoses(encounterId: EntityId, signal?: AbortSignal) {
  return apiFetch<EncounterDiagnosis[]>(`/clinical-encounters/${encounterId}/diagnoses`, { signal })
}

export function searchDiagnosisCodes(q: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ q, isActive: 'true', page: '1', pageSize: '20' })
  return apiFetchResult<DiagnosisCode[], PaginationMeta>(`/diagnosis-codes?${params}`, { signal })
}

export function assignDiagnosis(encounterId: EntityId, input: { diagnosisCodeId: EntityId; isPrimary: boolean; notes?: string | null }) {
  return apiFetch<EncounterDiagnosis>(`/clinical-encounters/${encounterId}/diagnoses`, { method: 'POST', body: input })
}

export function updateDiagnosis(encounterId: EntityId, diagnosisId: EntityId, input: { isPrimary?: boolean; notes?: string | null }) {
  return apiFetch<EncounterDiagnosis>(`/clinical-encounters/${encounterId}/diagnoses/${diagnosisId}`, { method: 'PATCH', body: input })
}

export function removeDiagnosis(encounterId: EntityId, diagnosisId: EntityId) {
  return apiFetch<EncounterDiagnosis>(`/clinical-encounters/${encounterId}/diagnoses/${diagnosisId}`, { method: 'DELETE' })
}

export function searchSvbProcedures(q: string, serviceDate: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ q, isActive: 'true', serviceDate, page: '1', pageSize: '20' })
  return apiFetchResult<SvbProcedure[], PaginationMeta>(`/svb-procedures?${params}`, { signal })
}

export function getApplicableTariff(procedureId: EntityId, serviceDate: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ serviceDate, currencyCode: 'ANG' })
  return apiFetch<SvbTariff>(`/svb-procedures/${procedureId}/applicable-tariff?${params}`, { signal })
}

export function listAuthorizations(patientId: EntityId, serviceDate: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ patientId, serviceDate, page: '1', pageSize: '100' })
  return apiFetchResult<Authorization[], PaginationMeta>(`/authorizations?${params}`, { signal })
}

export function listEncounterProcedures(encounterId: EntityId, signal?: AbortSignal) {
  return apiFetch<EncounterProcedure[]>(`/clinical-encounters/${encounterId}/procedures`, { signal })
}

export function addEncounterProcedure(encounterId: EntityId, input: EncounterProcedureCreateDto) {
  return apiFetch<EncounterProcedure>(`/clinical-encounters/${encounterId}/procedures`, { method: 'POST', body: input })
}

export function updateEncounterProcedure(encounterId: EntityId, procedureId: EntityId, input: { diagnosisId?: EntityId | null; additionalNote?: string | null }) {
  return apiFetch<EncounterProcedure>(`/clinical-encounters/${encounterId}/procedures/${procedureId}`, { method: 'PATCH', body: input })
}

export function removeEncounterProcedure(encounterId: EntityId, procedureId: EntityId) {
  return apiFetch<EncounterProcedure>(`/clinical-encounters/${encounterId}/procedures/${procedureId}`, { method: 'DELETE' })
}
