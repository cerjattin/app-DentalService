import {
  useEffect,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { setUnauthorizedHandler } from '../api/unauthorized-handler'
import type { AuthenticatedUser } from '../types/auth'
import { authStore } from './auth-store'
import { AuthContext, type AuthContextValue } from './auth-context-value'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<AuthenticatedUser | null>(() =>
    authStore.getUser(),
  )

  const clearSession = useCallback(() => {
    authStore.clearSession()
    setUser(null)
    queryClient.clear()
  }, [queryClient])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession()

      if (window.location.pathname !== '/login') {
        window.history.replaceState(null, '', '/login')
        window.dispatchEvent(new PopStateEvent('popstate'))
      }
    })

    return () => setUnauthorizedHandler(null)
  }, [clearSession])

  const setAccessToken = useCallback((token: string) => {
    authStore.setAccessToken(token)
  }, [])

  const setAuthenticatedUser = useCallback((nextUser: AuthenticatedUser) => {
    authStore.setUser(nextUser)
    setUser(nextUser)
  }, [])

  const setSession = useCallback((token: string, nextUser: AuthenticatedUser) => {
    authStore.setSession(token, nextUser)
    setUser(nextUser)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      permissions: user?.permissions ?? [],
      isAuthenticated: user !== null,
      setAccessToken,
      setUser: setAuthenticatedUser,
      setSession,
      clearSession,
    }),
    [clearSession, setAccessToken, setAuthenticatedUser, setSession, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
