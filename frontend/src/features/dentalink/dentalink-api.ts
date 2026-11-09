import { apiFetch, apiFetchResult } from '../../api'
import type { PaginationMeta } from '../../types/patient'

export interface DentalinkAccount {
  id: string
  externalAccountId: string
  label: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}
export interface DentalinkStatus {
  account: DentalinkAccount
  state: 'DISABLED' | 'NOT_CONFIGURED' | 'SYNTHETIC_QA' | 'PREPARED_ADAPTER'
  canPreview: boolean
  realConnectionVerified: false
  mode: 'READ_ONLY_IMPORT'
}
export interface DentalinkMapping {
  id: string
  kind: 'PROVIDER' | 'LOCATION'
  externalId: string
  localId: string
}
export interface DentalinkRun {
  id: string
  accountId: string
  state: 'READING' | 'PREVIEW_READY' | 'CONFIRMED'
  from: string | null
  to: string | null
  contentHash: string | null
  counts: Partial<Record<'total' | 'ready' | 'issues' | 'imported' | 'skipped' | 'pages', number>>
  hasNextPage: boolean
  sourceMode: string
  realConnectionVerified: false
  createdAt: string
  confirmedAt: string | null
}
export interface DentalinkItem {
  id: string
  entityType: 'PATIENT' | 'APPOINTMENT'
  externalId: string
  data: Record<string, unknown>
  disposition: 'READY' | 'ISSUE' | 'IMPORTED' | 'SKIPPED'
  issueCodes: string[]
  patientId: string | null
  appointmentId: string | null
}
export interface PreviewRequest {
  idempotencyKey: string
  from?: string
  to?: string
}
export interface ConfirmRequest {
  idempotencyKey: string
  expectedContentHash: string
}
export const dentalinkKeys = {
  all: ['dentalink'] as const,
  account: (id: string) => ['dentalink', id] as const,
}
const root = '/integrations/dentalink/accounts'
const account = (id: string) => `${root}/${encodeURIComponent(id)}`
const preview = (id: string, run: string) => `${account(id)}/previews/${encodeURIComponent(run)}`
const list = <T>(path: string, page: number, signal?: AbortSignal) =>
  apiFetchResult<T[], PaginationMeta>(`${path}?page=${page}&pageSize=20`, {
    signal,
    cache: 'no-store',
  })
export const listDentalinkAccounts = (page: number, signal?: AbortSignal) =>
  list<DentalinkAccount>(root, page, signal)
export const createDentalinkAccount = (body: { externalAccountId: string; label: string }) =>
  apiFetch<DentalinkAccount>(root, { method: 'POST', body })
export const enableDentalinkAccount = (id: string, enabled: boolean) =>
  apiFetch<DentalinkAccount>(account(id), { method: 'PATCH', body: { enabled } })
export const getDentalinkStatus = (id: string, signal?: AbortSignal) =>
  apiFetch<DentalinkStatus>(`${account(id)}/status`, { signal, cache: 'no-store' })
export const getDentalinkMappings = (id: string, signal?: AbortSignal) =>
  apiFetch<DentalinkMapping[]>(`${account(id)}/mappings`, { signal, cache: 'no-store' })
export const saveDentalinkMapping = (id: string, body: Omit<DentalinkMapping, 'id'>) =>
  apiFetch<DentalinkMapping>(`${account(id)}/mappings`, { method: 'PUT', body })
export const listDentalinkRuns = (id: string, page: number, signal?: AbortSignal) =>
  list<DentalinkRun>(`${account(id)}/previews`, page, signal)
export const createDentalinkPreview = (id: string, body: PreviewRequest) =>
  apiFetch<DentalinkRun>(`${account(id)}/previews`, { method: 'POST', body })
export const getDentalinkRun = (id: string, run: string, signal?: AbortSignal) =>
  apiFetch<DentalinkRun>(preview(id, run), { signal, cache: 'no-store' })
export const listDentalinkItems = (id: string, run: string, page: number, signal?: AbortSignal) =>
  list<DentalinkItem>(`${preview(id, run)}/items`, page, signal)
export const readDentalinkNextPage = (id: string, run: string) =>
  apiFetch<DentalinkRun>(`${preview(id, run)}/read-next-page`, { method: 'POST' })
export const confirmDentalinkRun = (id: string, run: string, body: ConfirmRequest) =>
  apiFetch<DentalinkRun>(`${preview(id, run)}/confirm`, { method: 'POST', body })

export const validExternalId = (value: string) =>
  value.length > 0 &&
  value.length <= 255 &&
  value.trim() === value &&
  ![...value].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
