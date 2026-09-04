import { apiFetch, apiFetchResult } from '../../api'
import { apiDownload } from '../../api/client'
import type {
  CaptureSignatureDto,
  DocumentMetadata,
  Invoice,
  InvoiceCorrection,
  InvoiceDocument,
  InvoiceFilters,
  InvoiceSignature,
  InvoiceVersion,
  InvoiceStatusHistory,
  RequestInvoiceCorrectionDto,
  ResolveInvoiceCorrectionDto,
  SignatureContent,
  UpdateCorrectionInvoiceItemDto,
  InvoiceItem,
} from '../../types/billing'
import type { EntityId } from '../../types/core'
import type { PaginationMeta } from '../../types/patient'

export const invoiceKeys = {
  all: ['invoices'] as const,
  lists: () => [...invoiceKeys.all, 'list'] as const,
  list: (filters: InvoiceFilters) => [...invoiceKeys.lists(), filters] as const,
  detail: (id: EntityId) => [...invoiceKeys.all, 'detail', id] as const,
}
export const invoiceVersionKeys = {
  invoice: (id: EntityId) => ['invoice-versions', id] as const,
  detail: (id: EntityId, versionId: EntityId) =>
    [...invoiceVersionKeys.invoice(id), versionId] as const,
}
export const correctionKeys = {
  invoice: (id: EntityId) => ['invoice-corrections', id] as const,
  detail: (id: EntityId, correctionId: EntityId) =>
    [...correctionKeys.invoice(id), correctionId] as const,
}
export const invoiceHistoryKeys = {
  invoice: (id: EntityId) => ['invoice-status-history', id] as const,
}
export const signatureKeys = {
  version: (id: EntityId, versionId: EntityId) =>
    ['signatures', id, versionId] as const,
  content: (id: EntityId, versionId: EntityId) =>
    [...signatureKeys.version(id, versionId), 'content'] as const,
  list: (id: EntityId, versionId: EntityId) =>
    [...signatureKeys.version(id, versionId), 'list'] as const,
}
export const invoiceDocumentKeys = {
  invoice: (id: EntityId) => ['invoice-documents', id] as const,
}
export function listInvoices(filters: InvoiceFilters, signal?: AbortSignal) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters))
    if (value !== undefined && value !== '') params.set(key, String(value))
  return apiFetchResult<Invoice[], PaginationMeta>(`/invoices?${params}`, {
    signal,
  })
}
export function getInvoice(id: EntityId, signal?: AbortSignal) {
  return apiFetch<Invoice>(`/invoices/${id}`, { signal })
}
export function createInvoice(appointmentId: EntityId) {
  return apiFetch<Invoice>(`/appointments/${appointmentId}/invoice`, {
    method: 'POST',
  })
}
function versionPath(id: EntityId, versionId: EntityId) {
  return `/invoices/${id}/versions/${versionId}`
}
export function getInvoiceVersion(
  id: EntityId,
  versionId: EntityId,
  signal?: AbortSignal,
) {
  return apiFetch<InvoiceVersion>(versionPath(id, versionId), { signal })
}
export function listInvoiceCorrections(id: EntityId, signal?: AbortSignal) {
  return apiFetch<InvoiceCorrection[]>(`/invoices/${id}/corrections`, {
    signal,
  })
}
export function requestInvoiceCorrection(
  id: EntityId,
  body: RequestInvoiceCorrectionDto,
) {
  return apiFetch<InvoiceCorrection>(`/invoices/${id}/corrections`, {
    method: 'POST',
    body,
  })
}
export type CorrectionResolution = 'approve' | 'reject' | 'cancel'
export function resolveInvoiceCorrection(
  id: EntityId,
  correctionId: EntityId,
  operation: CorrectionResolution,
  body?: ResolveInvoiceCorrectionDto,
) {
  return apiFetch<InvoiceCorrection>(
    `/invoices/${id}/corrections/${correctionId}/${operation}`,
    { method: 'POST', ...(body ? { body } : {}) },
  )
}
export function createCorrectionReplacement(
  id: EntityId,
  correctionId: EntityId,
) {
  return apiFetch<InvoiceCorrection>(
    `/invoices/${id}/corrections/${correctionId}/replacement`,
    { method: 'POST' },
  )
}
export function updateCorrectionItem(
  id: EntityId,
  versionId: EntityId,
  itemId: EntityId,
  body: UpdateCorrectionInvoiceItemDto,
) {
  return apiFetch<InvoiceItem>(
    `${versionPath(id, versionId)}/items/${itemId}`,
    { method: 'PATCH', body },
  )
}
export function listInvoiceStatusHistory(
  id: EntityId,
  signal?: AbortSignal,
) {
  return apiFetch<InvoiceStatusHistory[]>(`/invoices/${id}/status-history`, {
    signal,
  })
}
export type InvoiceOperation = 'prepare-signature' | 'sign' | 'close'
export function transitionInvoice(
  id: EntityId,
  versionId: EntityId,
  operation: InvoiceOperation,
) {
  return apiFetch<Invoice>(`${versionPath(id, versionId)}/${operation}`, {
    method: 'POST',
  })
}
export function getSignatureContent(
  id: EntityId,
  versionId: EntityId,
  signal?: AbortSignal,
) {
  return apiFetch<SignatureContent>(
    `${versionPath(id, versionId)}/signature-content`,
    { signal },
  )
}
export function listSignatures(
  id: EntityId,
  versionId: EntityId,
  signal?: AbortSignal,
) {
  return apiFetch<InvoiceSignature[]>(
    `${versionPath(id, versionId)}/signatures`,
    { signal },
  )
}
export function uploadSignature(blob: Blob, versionId: EntityId) {
  const params = new URLSearchParams({
    documentType: 'SIGNATURE',
    originalFilename: `signature-v${versionId}.png`,
  })
  return apiFetch<DocumentMetadata>(`/documents?${params}`, {
    method: 'POST',
    rawBody: blob,
    headers: { 'Content-Type': 'image/png' },
  })
}
export function captureSignature(
  id: EntityId,
  versionId: EntityId,
  body: CaptureSignatureDto,
) {
  return apiFetch<InvoiceSignature>(
    `${versionPath(id, versionId)}/signatures`,
    { method: 'POST', body },
  )
}
export function listInvoiceDocuments(id: EntityId, signal?: AbortSignal) {
  return apiFetch<InvoiceDocument[]>(`/invoices/${id}/documents`, { signal })
}
export function generateInvoicePdf(id: EntityId, versionId: EntityId) {
  return apiFetch<InvoiceDocument>(`${versionPath(id, versionId)}/pdf`, {
    method: 'POST',
  })
}
export function downloadDocument(id: EntityId, signal?: AbortSignal) {
  return apiDownload(`/documents/${id}/download`, signal)
}
