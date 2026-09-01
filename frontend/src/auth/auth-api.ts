import { apiFetch } from '../api'
import type { AuthenticatedUser, LoginResponse } from '../types/auth'

export interface LoginCredentials {
  email: string
  password: string
}

export function login(credentials: LoginCredentials) {
  return apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: credentials,
    skipUnauthorizedHandler: true,
  })
}

export function getCurrentUser() {
  return apiFetch<AuthenticatedUser>('/auth/me')
}
