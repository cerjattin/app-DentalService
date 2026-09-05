import { apiFetch, apiFetchResult } from '../../api'
import { apiDownload } from '../../api/client'
import type {
  CreateDeclarationDto,
  Declaration,
  DeclarationExport,
  DeclarationExportFormat,
  DeclarationFilters,
  DeclarationItem,
  DeclarationSubmission,
  SubmissionResultDto,
} from '../../types/declaration'
import type { EntityId } from '../../types/core'
import type { PaginationMeta } from '../../types/patient'

export const declarationKeys = {
  all: ['declarations'] as const,
  lists: () => [...declarationKeys.all, 'list'] as const,
  list: (filters: DeclarationFilters) =>
    [...declarationKeys.lists(), filters] as const,
  detail: (id: EntityId) => [...declarationKeys.all, 'detail', id] as const,
  items: (id: EntityId) => [...declarationKeys.detail(id), 'items'] as const,
  exports: (id: EntityId) => [...declarationKeys.detail(id), 'exports'] as const,
  submissions: (id: EntityId) =>
    [...declarationKeys.detail(id), 'submissions'] as const,
}

export function listDeclarations(
  filters: DeclarationFilters,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters))
    if (value !== undefined && value !== '') params.set(key, String(value))
  return apiFetchResult<Declaration[], PaginationMeta>(
    `/declarations?${params}`,
    { signal },
  )
}
export function getDeclaration(id: EntityId, signal?: AbortSignal) {
  return apiFetch<Declaration>(`/declarations/${id}`, { signal })
}
export function createDeclaration(body: CreateDeclarationDto) {
  return apiFetch<Declaration>('/declarations', { method: 'POST', body })
}
export function listDeclarationItems(id: EntityId, signal?: AbortSignal) {
  return apiFetch<DeclarationItem[]>(`/declarations/${id}/items`, { signal })
}
export function addDeclarationItem(id: EntityId, invoiceItemId: EntityId) {
  return apiFetch<DeclarationItem>(`/declarations/${id}/items`, {
    method: 'POST',
    body: { invoiceItemId },
  })
}
export function markDeclarationReady(id: EntityId) {
  return apiFetch<Declaration>(`/declarations/${id}/ready`, { method: 'POST' })
}
export function listDeclarationExports(id: EntityId, signal?: AbortSignal) {
  return apiFetch<DeclarationExport[]>(`/declarations/${id}/exports`, {
    signal,
  })
}
export function createDeclarationExport(
  id: EntityId,
  format: DeclarationExportFormat,
) {
  return apiFetch<DeclarationExport>(`/declarations/${id}/exports`, {
    method: 'POST',
    body: { format },
  })
}
export function downloadDeclarationExport(
  documentId: EntityId,
  signal?: AbortSignal,
) {
  return apiDownload(`/documents/${documentId}/download`, signal)
}
export function listDeclarationSubmissions(
  id: EntityId,
  signal?: AbortSignal,
) {
  return apiFetch<DeclarationSubmission[]>(`/declarations/${id}/submissions`, {
    signal,
  })
}
export function submitDeclaration(id: EntityId) {
  return apiFetch<DeclarationSubmission>(`/declarations/${id}/submit`, {
    method: 'POST',
  })
}
export function recordSubmissionResult(
  id: EntityId,
  submissionId: EntityId,
  body: SubmissionResultDto,
) {
  return apiFetch<DeclarationSubmission>(
    `/declarations/${id}/submissions/${submissionId}/result`,
    { method: 'POST', body },
  )
}
