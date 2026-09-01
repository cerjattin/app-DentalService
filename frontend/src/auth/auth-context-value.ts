import { createContext } from 'react'
import type { AuthenticatedUser, Permission } from '../types/auth'

export interface AuthContextValue {
  user: AuthenticatedUser | null
  permissions: Permission[]
  isAuthenticated: boolean
  setAccessToken: (token: string) => void
  setUser: (user: AuthenticatedUser) => void
  setSession: (token: string, user: AuthenticatedUser) => void
  clearSession: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
