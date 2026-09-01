import type { EntityId } from './core'

export type Permission = string

export interface AuthenticatedUser {
  id: EntityId
  email: string
  firstName: string
  lastName: string
  organizationId: EntityId
  roles: string[]
  permissions: Permission[]
}

export interface LoginResponse {
  accessToken: string
  tokenType: 'Bearer'
  expiresIn: string
  user: AuthenticatedUser
}
