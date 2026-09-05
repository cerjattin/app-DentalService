import { apiFetch, apiFetchResult } from '../../api'
import type {
  AdminProvider,
  AdminRole,
  AdminUser,
  CreateUserDto,
  ProviderFilters,
  ProviderUpdateDto,
  ProviderWriteDto,
  UpdateUserDto,
  UpdateUserStatusDto,
  UserFilters,
} from '../../types/administration'
import type { EntityId } from '../../types/core'
import type { PaginationMeta } from '../../types/patient'

function pathWithFilters<T extends object>(path: string, filters: T) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters))
    if (value !== undefined && value !== '') params.set(key, String(value))
  return `${path}?${params}`
}

export const userKeys = {
  all: ['admin-users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (filters: UserFilters) => [...userKeys.lists(), filters] as const,
  detail: (id: EntityId) => [...userKeys.all, 'detail', id] as const,
}
export const roleKeys = { all: ['admin-roles'] as const }
export const permissionKeys = { all: ['admin-role-permissions'] as const }
export const providerKeys = {
  all: ['providers'] as const,
  lists: () => [...providerKeys.all, 'list'] as const,
  list: (filters: ProviderFilters) => [...providerKeys.lists(), filters] as const,
  detail: (id: EntityId) => [...providerKeys.all, 'detail', id] as const,
}

export function listUsers(filters: UserFilters, signal?: AbortSignal) {
  return apiFetchResult<AdminUser[], PaginationMeta>(pathWithFilters('/users', filters), { signal })
}
export function getUser(id: EntityId, signal?: AbortSignal) { return apiFetch<AdminUser>(`/users/${id}`, { signal }) }
export function createUser(body: CreateUserDto) { return apiFetch<AdminUser>('/users', { method: 'POST', body }) }
export function updateUser(id: EntityId, body: UpdateUserDto) { return apiFetch<AdminUser>(`/users/${id}`, { method: 'PATCH', body }) }
export function updateUserStatus(id: EntityId, body: UpdateUserStatusDto) { return apiFetch<AdminUser>(`/users/${id}/status`, { method: 'PATCH', body }) }
export function replaceUserRoles(id: EntityId, roleCodes: AdminRole['code'][]) { return apiFetch<AdminUser>(`/users/${id}/roles`, { method: 'PUT', body: { roleCodes } }) }
export function listRoles(signal?: AbortSignal) { return apiFetch<AdminRole[]>('/roles', { signal }) }

export function listProviders(filters: ProviderFilters, signal?: AbortSignal) {
  return apiFetchResult<AdminProvider[], PaginationMeta>(pathWithFilters('/providers', filters), { signal })
}
export function getProvider(id: EntityId, signal?: AbortSignal) { return apiFetch<AdminProvider>(`/providers/${id}`, { signal }) }
export function createProvider(body: ProviderWriteDto) { return apiFetch<AdminProvider>('/providers', { method: 'POST', body }) }
export function updateProvider(id: EntityId, body: ProviderUpdateDto) { return apiFetch<AdminProvider>(`/providers/${id}`, { method: 'PATCH', body }) }
