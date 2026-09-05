import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, getApiErrorMessage } from '../api'
import { authStore } from '../auth/auth-store'
import { AppShell } from '../components/app-shell/app-shell'
import { DataTable } from '../components/data-table/data-table'
import { FormField } from '../components/forms/form-field'
import { ConfirmDialog } from '../components/ui/confirm-dialog'
import { Input } from '../components/ui/input'
import { saveBlob } from '../lib/download'
import { RouteLoadBoundary } from '../routes/route-load-boundary'
import { routes } from '../routes/router'
import type { AuthenticatedUser } from '../types/auth'
import { renderWithProviders } from './test-utils'

const user: AuthenticatedUser = {
  id: '9007199254740993',
  email: 'qa@example.test',
  firstName: 'QA',
  lastName: 'User',
  organizationId: '1',
  roles: ['RECEPTION'],
  permissions: ['patient.read'],
}

afterEach(() => {
  authStore.clearSession()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('route hardening', () => {
  it('renders a visible fallback while a route chunk is loading', () => {
    const Pending = () => {
      throw new Promise(() => undefined)
    }
    render(
      <MemoryRouter>
        <RouteLoadBoundary>
          <Pending />
        </RouteLoadBoundary>
      </MemoryRouter>,
    )
    expect(screen.getByRole('status')).toHaveTextContent('Loading page')
  })

  it('renders a professional 404 for an authenticated unknown route', async () => {
    authStore.setSession('memory-token', user)
    const router = createMemoryRouter(routes, { initialEntries: ['/missing-page'] })
    renderWithProviders(<RouterProvider router={router} />)
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to dashboard' })).toHaveAttribute('href', '/dashboard')
  })
})

describe('responsive and accessibility hardening', () => {
  it('provides a keyboard-focusable region for wide tables', () => {
    render(<DataTable rows={[{ id: '1' }]} getRowKey={(row) => row.id} columns={[{ key: 'id', header: 'ID', render: (row) => row.id }]} />)
    expect(screen.getByRole('region', { name: 'Scrollable data table' })).toHaveAttribute('tabindex', '0')
  })

  it('associates field errors with their controls', () => {
    render(<FormField label="Name" htmlFor="name" error="Name is required."><Input id="name" /></FormField>)
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-describedby', 'name-description')
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Name is required.')
  })

  it('uses a modal drawer that closes with Escape', async () => {
    authStore.setSession('memory-token', user)
    const router = createMemoryRouter([{ element: <AppShell />, children: [{ path: '/dashboard', element: <div>Dashboard body</div> }] }], { initialEntries: ['/dashboard'] })
    renderWithProviders(<RouterProvider router={router} />)
    await userEvent.click(screen.getByRole('button', { name: 'Open navigation' }))
    expect(screen.getByRole('dialog', { name: 'Application navigation' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Application navigation' })).not.toBeInTheDocument()
  })

  it('disables consequential dialog actions while pending', () => {
    render(
      <MemoryRouter>
        <ConfirmDialog open title="Confirm change" description="Permanent action" pending onCancel={() => undefined} onConfirm={() => undefined} />
      </MemoryRouter>,
    )
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled()
  })
})

describe('failure and download hardening', () => {
  it('uses safe fallback messages for unknown and network errors', () => {
    expect(getApiErrorMessage(new ApiError({ code: 'UNKNOWN_CODE', message: 'raw', status: 500 }))).toBe('Unexpected backend error.')
    expect(getApiErrorMessage(new TypeError('Failed to fetch'))).toBe('Backend unavailable. Check the connection and try again.')
  })

  it('revokes generated download object URLs after use', () => {
    vi.useFakeTimers()
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    saveBlob(new Blob(['data']), 'export.csv')
    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
    expect(document.querySelector('a[download="export.csv"]')).toBeNull()
    vi.runAllTimers()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test')
  })
})
