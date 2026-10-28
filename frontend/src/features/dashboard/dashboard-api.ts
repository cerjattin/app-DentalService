import { apiFetch, apiFetchResult } from '../../api'
import type { Provider } from '../../types/appointment'
import type { PaginationMeta } from '../../types/patient'
import type { DashboardFilters, DashboardReportData } from '../../types/reporting'
export const dashboardKeys = {
  all: ['dashboard-report'] as const,
  report: (filters: DashboardFilters) => [...dashboardKeys.all, filters] as const,
  providers: (q: string) => ['report-providers', q] as const,
}
export function getDashboardReport(filters: DashboardFilters, signal?: AbortSignal) {
  const params = new URLSearchParams({ from: filters.from, to: filters.to })
  if (filters.providerId) params.set('providerId', filters.providerId)
  return apiFetch<DashboardReportData>(`/reports/dashboard?${params}`, { signal })
}
export const listReportProviders = (q: string, signal?: AbortSignal) =>
  apiFetchResult<Provider[], PaginationMeta>(`/providers?${new URLSearchParams({ q, page: '1', pageSize: '100' })}`, { signal })
