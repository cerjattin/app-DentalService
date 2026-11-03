import { apiFetch } from '../../api'
import { apiDownload } from '../../api/client'
import type { DocumentMetadata } from '../../types/billing'
import type { DeclarationSubmission } from '../../types/declaration'
import type { ManualDossier, ManualEntry, ManualResultInput, ManualSubmissionInput } from '../../types/manual-entry'

export const manualEntryKey = (id: string) => ['declarations', 'detail', id, 'manual-entry'] as const
const path = (id: string) => `/declarations/${id}/manual-entry`
export const getManualDossier = (id: string, signal?: AbortSignal) => apiFetch<ManualDossier>(path(id), { signal })
export const downloadManualDossier = (id: string) => apiDownload(`${path(id)}/download`)
export const prepareManualEntry = (id: string, idempotencyKey: string) => apiFetch<ManualEntry>(`${path(id)}/prepare`, { method: 'POST', body: { idempotencyKey } })
export const flagManualUncertainty = (id: string, entryId: string, reason: string) => apiFetch<ManualEntry>(`${path(id)}/${entryId}/uncertain`, { method: 'POST', body: { reason } })
export const releaseManualEntry = (id: string, entryId: string, body: { reason: string; confirmation: 'NOT_PRESENTED_VERIFIED'; resolutionDocumentId?: string }) => apiFetch<ManualEntry>(`${path(id)}/${entryId}/release`, { method: 'POST', body })
export const recordManualSubmission = (id: string, body: ManualSubmissionInput) => apiFetch<DeclarationSubmission & { manualEntry: ManualEntry }>(`/declarations/${id}/submissions/manual`, { method: 'POST', body })
export const recordManualResult = (id: string, submissionId: string, body: ManualResultInput) => apiFetch<ManualEntry>(`/declarations/${id}/submissions/${submissionId}/official-result`, { method: 'POST', body })
export function uploadManualEvidence(file: File) {
  const query = new URLSearchParams({ documentType: 'OTHER', originalFilename: file.name })
  return apiFetch<DocumentMetadata>(`/documents?${query}`, { method: 'POST', rawBody: file, headers: { 'Content-Type': file.type } })
}
