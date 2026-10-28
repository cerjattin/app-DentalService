import type { QueryClient } from '@tanstack/react-query'
import { apiFetch, apiFetchResult } from '../../api'
import type { EntityId } from '../../types/core'
import type { PaginationMeta } from '../../types/patient'
import type { ServiceFilters, ServiceWriteDto, SvbProcedure, SvbTariff, TariffFilters, TariffResolution, TariffWriteDto } from '../../types/svb-catalog'

export const svbServiceKeys = {
  all: ['svb-procedures'] as const,
  lists: () => [...svbServiceKeys.all, 'list'] as const,
  list: (filters: ServiceFilters) => [...svbServiceKeys.lists(), filters] as const,
  detail: (id: EntityId) => [...svbServiceKeys.all, 'detail', id] as const,
  tariffLists: (id: EntityId) => [...svbServiceKeys.detail(id), 'tariffs'] as const,
  tariffs: (id: EntityId, filters: TariffFilters) => [...svbServiceKeys.tariffLists(id), filters] as const,
  applicableTariffs: (id: EntityId) => [...svbServiceKeys.detail(id), 'applicable-tariff'] as const,
  applicableTariff: (id: EntityId, serviceDate: string, currencyCode: string) => [...svbServiceKeys.applicableTariffs(id), serviceDate, currencyCode] as const,
}
function query(filters: ServiceFilters | TariffFilters) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  return params.toString()
}
const path = (id: EntityId) => `/svb-procedures/${id}`
export const listServices = (filters: ServiceFilters, signal?: AbortSignal) =>
  apiFetchResult<SvbProcedure[], PaginationMeta>(`/svb-procedures?${query(filters)}`, { signal })
export const getService = (id: EntityId, signal?: AbortSignal) => apiFetch<SvbProcedure>(path(id), { signal })
export const createService = (body: ServiceWriteDto) => apiFetch<SvbProcedure>('/svb-procedures', { method: 'POST', body })
export const updateService = (id: EntityId, body: Partial<ServiceWriteDto>) => apiFetch<SvbProcedure>(path(id), { method: 'PATCH', body })
export const setServiceStatus = (id: EntityId, isActive: boolean) => apiFetch<SvbProcedure>(`${path(id)}/status`, { method: 'PATCH', body: { isActive } })
export const listTariffs = (id: EntityId, filters: TariffFilters, signal?: AbortSignal) =>
  apiFetchResult<SvbTariff[], PaginationMeta>(`${path(id)}/tariffs?${query(filters)}`, { signal })
export const createTariff = (id: EntityId, body: TariffWriteDto) => apiFetch<SvbTariff>(`${path(id)}/tariffs`, { method: 'POST', body })
export const updateTariff = (id: EntityId, tariffId: EntityId, body: Partial<TariffWriteDto>) => apiFetch<SvbTariff>(`${path(id)}/tariffs/${tariffId}`, { method: 'PATCH', body })
export const getApplicableTariff = (id: EntityId, serviceDate: string, currencyCode: string, signal?: AbortSignal) =>
  apiFetch<TariffResolution>(`${path(id)}/applicable-tariff?${new URLSearchParams({ serviceDate, currencyCode })}`, { signal })

export async function invalidateService(client: QueryClient, id?: EntityId) {
  await Promise.all([
    client.invalidateQueries({ queryKey: svbServiceKeys.lists() }),
    ...(id ? [client.invalidateQueries({ queryKey: svbServiceKeys.detail(id) })] : []),
  ])
}
export async function invalidateTariffs(client: QueryClient, id: EntityId) {
  await Promise.all([
    client.invalidateQueries({ queryKey: svbServiceKeys.tariffLists(id) }),
    client.invalidateQueries({ queryKey: svbServiceKeys.applicableTariffs(id) }),
  ])
}
