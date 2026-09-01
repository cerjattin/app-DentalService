import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router'
import type { ReactNode } from 'react'
import { AuthProvider } from '../auth/auth-context'
import { queryClient } from './query-client'

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>{children}</AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
