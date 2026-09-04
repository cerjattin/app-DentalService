import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  createMemoryRouter,
  MemoryRouter,
  Route,
  RouterProvider,
  Routes,
} from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiFetch, ApiError } from '../api'
import { normalizeApiBaseUrl } from '../api/client'
import { authStore } from '../auth/auth-store'
import { AuthProvider } from '../auth/auth-context'
import { PermissionGuard } from '../auth/permission-guard'
import { RequireAuth } from '../auth/require-auth'
import { LoginPage } from '../features/auth/login-page'
import { AppShell } from '../components/app-shell/app-shell'
import { Topbar } from '../components/app-shell/topbar'
import { formatBusinessDate, formatBusinessDateTime } from '../lib/timezone'
import { PermissionRoute } from '../routes/permission-route'
import type { AuthenticatedUser } from '../types/auth'
import type { EntityId } from '../types/core'
import { renderWithProviders } from './test-utils'

const testUser: AuthenticatedUser = {
  id: '9007199254740993',
  email: 'user@example.test',
  firstName: 'Test',
  lastName: 'User',
  organizationId: '1',
  roles: ['RECEPTION'],
  permissions: ['patient.read', 'appointment.read'],
}

describe('API base URL', () => {
  it('uses the configured API prefix without duplicating path segments', () => {
    expect(normalizeApiBaseUrl('http://127.0.0.1:3000/api/v1/')).toBe(
      'http://127.0.0.1:3000/api/v1',
    )
  })

  it('rejects missing and invalid API base URLs', () => {
    expect(() => normalizeApiBaseUrl(undefined)).toThrow('VITE_API_BASE_URL is required.')
    expect(() => normalizeApiBaseUrl('/api/v1')).toThrow(
      'VITE_API_BASE_URL must be a valid absolute URL.',
    )
  })
})

function renderLoginRoute() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<div>Dashboard route</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  authStore.clearSession()
  vi.restoreAllMocks()
  localStorage.clear()
  sessionStorage.clear()
  window.history.replaceState(null, '', '/')
})

describe('authentication integration', () => {
  it('logs in, stores the token in memory, and hydrates user permissions from /auth/me', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              accessToken: 'backend-token',
              tokenType: 'Bearer',
              expiresIn: '15m',
              user: testUser,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: testUser }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    vi.stubGlobal('fetch', fetchMock)

    renderLoginRoute()

    await userEvent.type(screen.getByLabelText('Email'), testUser.email)
    await userEvent.type(screen.getByLabelText('Password'), 'secret')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await screen.findByText('Dashboard route')

    expect(authStore.getAccessToken()).toBe('backend-token')
    expect(authStore.getUser()?.permissions).toEqual(testUser.permissions)
    expect(localStorage.getItem('accessToken')).toBeNull()
    expect(sessionStorage.getItem('accessToken')).toBeNull()
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://api.test/api/v1/auth/login',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://api.test/api/v1/auth/me',
      expect.objectContaining({ headers: expect.any(Headers) }),
    )
  })

  it('shows a safe invalid credentials message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: false,
            error: { code: 'INVALID_CREDENTIALS', message: 'raw backend text' },
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )

    renderLoginRoute()

    await userEvent.type(screen.getByLabelText('Email'), testUser.email)
    await userEvent.type(screen.getByLabelText('Password'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials.')
    expect(screen.queryByText('raw backend text')).not.toBeInTheDocument()
    expect(authStore.getAccessToken()).toBeNull()
  })

  it('shows a backend unavailable state for network failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    renderLoginRoute()

    await userEvent.type(screen.getByLabelText('Email'), testUser.email)
    await userEvent.type(screen.getByLabelText('Password'), 'secret')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Backend unavailable.')
  })

  it('disables submit while authenticating', async () => {
    let resolveLogin: (response: Response) => void = () => undefined
    const pendingLogin = new Promise<Response>((resolve) => {
      resolveLogin = resolve
    })
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(pendingLogin))

    renderLoginRoute()

    await userEvent.type(screen.getByLabelText('Email'), testUser.email)
    await userEvent.type(screen.getByLabelText('Password'), 'secret')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(screen.getByRole('button', { name: 'Signing in...' })).toBeDisabled()

    resolveLogin(
      new Response(
        JSON.stringify({
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' },
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      ),
    )
  })

  it('validates required login fields', async () => {
    renderLoginRoute()

    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument()
    expect(screen.getByText('Enter your password.')).toBeInTheDocument()
  })
})

describe('API auth behavior', () => {
  it('injects Authorization only when a token exists', async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ success: true, data: { ok: true } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    await apiFetch('/patients')
    expect(
      new Headers((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).get(
        'Authorization',
      ),
    ).toBeNull()

    authStore.setSession('secret-token', testUser)
    await apiFetch('/patients')
    expect(
      new Headers((fetchMock.mock.calls[1]?.[1] as RequestInit).headers).get(
        'Authorization',
      ),
    ).toBe('Bearer secret-token')
  })

  it('preserves backend error codes in ApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: false,
            error: { code: 'PATIENT_NOT_FOUND', message: 'Missing' },
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )

    await expect(apiFetch('/patients/1')).rejects.toMatchObject({
      code: 'PATIENT_NOT_FOUND',
    } satisfies Partial<ApiError>)
  })

  it('clears session on authenticated 401 responses', async () => {
    authStore.setSession('secret-token', testUser)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: false,
            error: {
              code: 'AUTHENTICATION_REQUIRED',
              message: 'Authentication is required',
            },
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )

    renderWithProviders(<div>Provider mounted</div>)

    await expect(apiFetch('/auth/me')).rejects.toMatchObject({
      code: 'AUTHENTICATION_REQUIRED',
    })
    expect(authStore.getAccessToken()).toBeNull()
    expect(authStore.getUser()).toBeNull()
  })

  it('does not clear session on 403 permission failures', async () => {
    authStore.setSession('secret-token', testUser)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: false,
            error: { code: 'PERMISSION_DENIED', message: 'Permission denied' },
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )

    renderWithProviders(<div>Provider mounted</div>)

    await expect(apiFetch('/users')).rejects.toMatchObject({
      code: 'PERMISSION_DENIED',
    })
    expect(authStore.getAccessToken()).toBe('secret-token')
    expect(authStore.getUser()).toEqual(testUser)
  })
})

describe('authorization, routing, and navigation', () => {
  it('renders PermissionGuard content when required permission exists', () => {
    authStore.setSession('memory-token', {
      ...testUser,
      permissions: ['patient.read'],
    })

    renderWithProviders(
      <PermissionGuard anyOf={['patient.read']}>
        <span>Allowed content</span>
      </PermissionGuard>,
    )

    expect(screen.getByText('Allowed content')).toBeInTheDocument()
  })

  it('redirects unauthenticated protected routes to login', () => {
    const router = createMemoryRouter(
      [
        {
          element: <RequireAuth />,
          children: [{ path: '/dashboard', element: <div>Protected</div> }],
        },
        { path: '/login', element: <div>Login route</div> },
      ],
      { initialEntries: ['/dashboard'] },
    )

    renderWithProviders(<RouterProvider router={router} />)

    expect(screen.getByText('Login route')).toBeInTheDocument()
  })

  it('allows a permitted protected route', () => {
    authStore.setSession('memory-token', testUser)
    const router = createMemoryRouter(
      [
        {
          element: <RequireAuth />,
          children: [
            {
              element: <PermissionRoute anyOf={['patient.read']} />,
              children: [{ path: '/patients', element: <div>Patients route</div> }],
            },
          ],
        },
        { path: '/login', element: <div>Login route</div> },
        { path: '/access-denied', element: <div>Denied route</div> },
      ],
      { initialEntries: ['/patients'] },
    )

    renderWithProviders(<RouterProvider router={router} />)

    expect(screen.getByText('Patients route')).toBeInTheDocument()
  })

  it('sends authenticated permission failures to access denied', async () => {
    authStore.setSession('memory-token', testUser)
    const router = createMemoryRouter(
      [
        {
          element: <RequireAuth />,
          children: [
            {
              element: <PermissionRoute anyOf={['invoice.read']} />,
              children: [{ path: '/invoices', element: <div>Invoices route</div> }],
            },
          ],
        },
        { path: '/login', element: <div>Login route</div> },
        { path: '/access-denied', element: <div>Denied route</div> },
      ],
      { initialEntries: ['/invoices'] },
    )

    renderWithProviders(<RouterProvider router={router} />)

    expect(await screen.findByText('Denied route')).toBeInTheDocument()
    expect(screen.queryByText('Login route')).not.toBeInTheDocument()
  })

  it('filters navigation by permissions', () => {
    authStore.setSession('memory-token', {
      ...testUser,
      permissions: ['patient.read'],
    })

    const router = createMemoryRouter(
      [
        {
          element: <AppShell />,
          children: [{ path: '/dashboard', element: <div>Dashboard body</div> }],
        },
      ],
      { initialEntries: ['/dashboard'] },
    )

    renderWithProviders(<RouterProvider router={router} />)

    expect(screen.getByText('Patients')).toBeInTheDocument()
    expect(screen.queryByText('Invoices')).not.toBeInTheDocument()
  })

  it('local logout clears token, user, and permissions', async () => {
    authStore.setSession('memory-token', testUser)
    const router = createMemoryRouter(
      [
        {
          path: '/dashboard',
          element: <Topbar title="Dashboard" onMenuClick={() => undefined} />,
        },
        { path: '/login', element: <div>Login route</div> },
      ],
      { initialEntries: ['/dashboard'] },
    )

    renderWithProviders(<RouterProvider router={router} />)
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    await waitFor(() => expect(authStore.getAccessToken()).toBeNull())
    expect(authStore.getUser()).toBeNull()
  })
})

describe('foundation type and timezone behavior', () => {
  it('keeps EntityId values as strings', () => {
    const id: EntityId = '9007199254740993'

    expect(typeof id).toBe('string')
    expect(id).toBe('9007199254740993')
  })

  it('formats dates in the business timezone', () => {
    const timestamp = '2026-09-01T03:30:00.000Z'

    expect(formatBusinessDate(timestamp)).toBe('2026-08-31')
    expect(formatBusinessDateTime(timestamp)).toContain('2026')
  })
})
