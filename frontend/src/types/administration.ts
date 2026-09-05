import type { EntityId } from './core'

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED'
export interface UserRole {
  id: EntityId
  code: string
  name: string
  isActive: boolean
  assignedAt: string
}
export interface AdminUser {
  id: EntityId
  organizationId: EntityId
  email: string
  firstName: string
  lastName: string
  status: UserStatus
  lastLoginAt: string | null
  passwordChangedAt: string | null
  failedLoginAttempts: number
  lockedUntil: string | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
  roles: UserRole[]
}
export interface RolePermission { code: string; name: string }
export interface AdminRole {
  id: EntityId
  code: 'ADMIN' | 'RECEPTION' | 'PROVIDER'
  name: string
  description: string | null
  isSystem: boolean
  permissions: RolePermission[]
}
export interface UserFilters {
  q?: string
  status?: UserStatus
  role?: AdminRole['code']
  page: number
  pageSize: number
}
export interface CreateUserDto {
  email: string
  firstName: string
  lastName: string
  password: string
  roleCodes: AdminRole['code'][]
}
export interface UpdateUserDto { email?: string; firstName?: string; lastName?: string }
export interface UpdateUserStatusDto { status: 'ACTIVE' | 'INACTIVE'; reason?: string }

export interface AdminProviderUser {
  id: EntityId
  email: string
  firstName: string
  lastName: string
  status: UserStatus
}
export interface AdminProvider {
  id: EntityId
  organizationId: EntityId
  userId: EntityId | null
  svbProviderId: string | null
  firstName: string
  lastName: string
  licenseNumber: string | null
  specialty: string | null
  email: string | null
  phone: string | null
  isActive: boolean
  user: AdminProviderUser | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}
export interface ProviderFilters { q?: string; isActive?: boolean; page: number; pageSize: number }
export interface ProviderWriteDto {
  userId?: EntityId | null
  svbProviderId?: string | null
  firstName: string
  lastName: string
  licenseNumber?: string | null
  specialty?: string | null
  email?: string | null
  phone?: string | null
  isActive?: boolean
}
export type ProviderUpdateDto = Partial<ProviderWriteDto>
