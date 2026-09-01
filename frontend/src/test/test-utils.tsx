import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderOptions } from '@testing-library/react'
import type { ReactElement } from 'react'
import { AuthProvider } from '../auth/auth-context'

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  const testQueryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(ui, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={testQueryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    ),
    ...options,
  })
}
