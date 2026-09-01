import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { authStore } from '../auth/auth-store'
import { AppointmentDetailPage } from '../features/appointments/appointment-detail-page'
import { AppointmentsPage } from '../features/appointments/appointments-page'
import { ReceptionPage } from '../features/reception/reception-page'
import { formatBusinessDate } from '../lib/timezone'
import type { Appointment, AppointmentStatus } from '../types/appointment'
import type { AuthenticatedUser } from '../types/auth'
import { renderWithProviders } from './test-utils'

const user: AuthenticatedUser = {
  id: '10',
  email: 'reception@example.test',
  firstName: 'Reception',
  lastName: 'User',
  organizationId: '1',
  roles: ['RECEPTION'],
  permissions: ['appointment.read'],
}

const appointment: Appointment = {
  id: '90071992547409939999',
  organizationId: '1',
  appointmentNumber: 'APT-00042',
  patientId: '90071992547409931234',
  providerId: '70000000000000000001',
  clinicLocationId: '60000000000000000001',
  treatmentCaseId: null,
  accidentCaseId: null,
  scheduledStart: '2026-09-01T13:00:00.000Z',
  scheduledEnd: '2026-09-01T13:30:00.000Z',
  status: 'SCHEDULED',
  reason: 'Routine visit',
  notes: null,
  checkedInAt: null,
  startedAt: null,
  completedAt: null,
  cancelledAt: null,
  cancellationReason: null,
  patient: {
    id: '90071992547409931234',
    patientNumber: 'PAT-00042',
    firstName: 'Ana',
    middleName: null,
    lastName: 'Martina',
    secondLastName: null,
    documentType: 'ID',
    documentNumber: 'ABC-123',
    status: 'ACTIVE',
  },
  provider: {
    id: '70000000000000000001',
    svbProviderId: 'SVB-P-1',
    firstName: 'John',
    lastName: 'Dentist',
    isActive: true,
  },
  location: {
    id: '60000000000000000001',
    code: 'MAIN',
    name: 'Main Clinic',
    isActive: true,
  },
  createdByUserId: '10',
  createdAt: '2026-08-01T12:00:00.000Z',
  updatedAt: '2026-08-01T12:00:00.000Z',
}

function withStatus(status: AppointmentStatus): Appointment {
  return { ...appointment, status }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function listResponse(rows: Appointment[]) {
  return json({
    success: true,
    data: rows,
    meta: { page: 1, pageSize: 20, total: rows.length, totalPages: rows.length ? 1 : 0 },
  })
}

function renderList(permissions = ['appointment.read']) {
  authStore.setSession('token', { ...user, permissions })
  return renderWithProviders(
    <MemoryRouter initialEntries={['/appointments']}>
      <Routes><Route path="/appointments" element={<AppointmentsPage />} /></Routes>
    </MemoryRouter>,
  )
}

function renderDetail(
  permissions = ['appointment.read'],
  item: Appointment = appointment,
) {
  authStore.setSession('token', { ...user, permissions })
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/appointments/${item.id}`]}>
      <Routes>
        <Route path="/appointments/:appointmentId" element={<AppointmentDetailPage />} />
        <Route path="/clinical/:appointmentId" element={<div>Clinical placeholder</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  authStore.clearSession()
  vi.restoreAllMocks()
})

describe('appointment list', () => {
  it('renders loading, success, and contracted appointment data', async () => {
    let resolveRequest: (response: Response) => void = () => undefined
    const pending = new Promise<Response>((resolve) => { resolveRequest = resolve })
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(pending))
    renderList()
    expect(screen.getByText('Loading appointments')).toBeInTheDocument()
    resolveRequest(listResponse([appointment]))
    expect(await screen.findByText('Ana Martina')).toBeInTheDocument()
    expect(screen.getByText('John Dentist')).toBeInTheDocument()
    expect(screen.getByText('Main Clinic')).toBeInTheDocument()
  })

  it('renders the empty state', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(listResponse([])))
    renderList()
    expect(await screen.findByText('No appointments yet')).toBeInTheDocument()
  })

  it('renders a safe list error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ success: false, error: { code: 'APPOINTMENT_NOT_FOUND', message: 'raw backend text' } }, 404)))
    renderList()
    expect(await screen.findByText('Unable to load appointments')).toBeInTheDocument()
    expect(screen.getByText('The appointment could not be found.')).toBeInTheDocument()
    expect(screen.queryByText('raw backend text')).not.toBeInTheDocument()
  })

  it('sends supported search, date, and status filters', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(listResponse([])))
    vi.stubGlobal('fetch', fetchMock)
    renderList()
    fireEvent.change(screen.getByLabelText('Search appointments'), { target: { value: 'PAT-00042' } })
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-01' } })
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'CONFIRMED' } })
    await waitFor(() => {
      const urls = fetchMock.mock.calls.map(([url]) => String(url))
      expect(urls.some((url) => url.includes('q=PAT-00042') && url.includes('date=2026-09-01') && url.includes('status=CONFIRMED'))).toBe(true)
    }, { timeout: 1000 })
  })

  it('represents creation as unavailable when the required lookup contract is missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(listResponse([])))
    renderList(['appointment.read', 'appointment.create'])
    expect(await screen.findByRole('button', { name: 'Create appointment' })).toBeDisabled()
  })
})

describe('appointment detail and updates', () => {
  it('renders detail and preserves the string appointment ID unchanged', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ success: true, data: appointment }))
    vi.stubGlobal('fetch', fetchMock)
    renderDetail()
    expect(await screen.findByText('Appointment information')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/appointments/${appointment.id}`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('shows update controls only with appointment.update', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(json({ success: true, data: appointment }))))
    const view = renderDetail()
    await screen.findByText('Appointment information')
    expect(screen.queryByRole('button', { name: 'Edit appointment' })).not.toBeInTheDocument()
    view.unmount()
    renderDetail(['appointment.read', 'appointment.update'])
    expect(await screen.findByRole('button', { name: 'Edit appointment' })).toBeInTheDocument()
  })

  it('updates accepted appointment fields without changing opaque relationship IDs', async () => {
    const provider = {
      id: appointment.provider.id,
      organizationId: '1', userId: null, svbProviderId: 'SVB-P-1', firstName: 'John', lastName: 'Dentist', licenseNumber: null, specialty: null, email: null, phone: null, isActive: true, archivedAt: null, createdAt: appointment.createdAt, updatedAt: appointment.updatedAt,
    }
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes('/providers')) return Promise.resolve(json({ success: true, data: [provider], meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 } }))
      if (init?.method === 'PATCH') return Promise.resolve(json({ success: true, data: { ...appointment, reason: 'Updated reason' } }))
      return Promise.resolve(json({ success: true, data: appointment }))
    })
    vi.stubGlobal('fetch', fetchMock)
    renderDetail(['appointment.read', 'appointment.update', 'provider.read'])
    await userEvent.click(await screen.findByRole('button', { name: 'Edit appointment' }))
    await userEvent.clear(screen.getByLabelText('Reason'))
    await userEvent.type(screen.getByLabelText('Reason'), 'Updated reason')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(true))
    const patchCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH')
    const body = JSON.parse(String(patchCall?.[1]?.body))
    expect(body.providerId).toBe(appointment.providerId)
    expect(body.reason).toBe('Updated reason')
    expect(body).not.toHaveProperty('clinicLocationId')
    expect(body).not.toHaveProperty('patientId')
  })

  it('shows the clinical handoff only in an eligible state with clinical permission', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(json({ success: true, data: withStatus('CHECKED_IN') }))))
    renderDetail(['appointment.read', 'encounter.read'], withStatus('CHECKED_IN'))
    expect(await screen.findByRole('link', { name: 'Open clinical workspace' })).toHaveAttribute('href', `/clinical/${appointment.id}`)
  })
})

describe('appointment status transitions', () => {
  it('confirms through the status endpoint with appointment.update', async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) =>
      Promise.resolve(json({ success: true, data: init?.method === 'PATCH' ? withStatus('CONFIRMED') : appointment })),
    )
    vi.stubGlobal('fetch', fetchMock)
    renderDetail(['appointment.read', 'appointment.update'])
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([url, init]) => String(url).endsWith('/status') && init?.method === 'PATCH')).toBe(true))
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/status'))
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ status: 'CONFIRMED' })
    expect(await screen.findByText('Confirmed')).toBeInTheDocument()
  })

  it('checks in through the status endpoint with appointment.check_in', async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) =>
      Promise.resolve(json({ success: true, data: init?.method === 'PATCH' ? withStatus('CHECKED_IN') : appointment })),
    )
    vi.stubGlobal('fetch', fetchMock)
    renderDetail(['appointment.read', 'appointment.check_in'])
    await userEvent.click(await screen.findByRole('button', { name: 'Check in' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/status'))).toBe(true))
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/status'))
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ status: 'CHECKED_IN' })
  })

  it('records cancellation using the documented reason field', async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) =>
      Promise.resolve(json({ success: true, data: init?.method === 'PATCH' ? withStatus('CANCELLED') : appointment })),
    )
    vi.stubGlobal('fetch', fetchMock)
    renderDetail(['appointment.read', 'appointment.cancel'])
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
    await userEvent.type(screen.getByLabelText('Reason (optional)'), 'Patient called')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/status'))).toBe(true))
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/status'))
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ status: 'CANCELLED', reason: 'Patient called' })
  })

  it('records no-show as its own transition', async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) =>
      Promise.resolve(json({ success: true, data: init?.method === 'PATCH' ? withStatus('NO_SHOW') : appointment })),
    )
    vi.stubGlobal('fetch', fetchMock)
    renderDetail(['appointment.read', 'appointment.cancel'])
    await userEvent.click(await screen.findByRole('button', { name: 'Mark no-show' }))
    await userEvent.click(screen.getByRole('button', { name: 'Mark no-show' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/status'))).toBe(true))
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/status'))
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ status: 'NO_SHOW' })
  })

  it('maps an invalid transition without clearing the authenticated session', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, init?: RequestInit) =>
      Promise.resolve(init?.method === 'PATCH'
        ? json({ success: false, error: { code: 'INVALID_APPOINTMENT_STATUS_TRANSITION', message: 'raw transition error' } }, 409)
        : json({ success: true, data: appointment })),
    ))
    renderDetail(['appointment.read', 'appointment.update'])
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('This appointment status change is no longer valid.')
    expect(authStore.getAccessToken()).toBe('token')
  })
})

describe('reception workspace', () => {
  it('loads the bounded today worklist and renders reception actions', async () => {
    const fetchMock = vi.fn().mockResolvedValue(listResponse([appointment]))
    vi.stubGlobal('fetch', fetchMock)
    authStore.setSession('token', { ...user, permissions: ['appointment.read', 'appointment.check_in'] })
    renderWithProviders(<MemoryRouter><ReceptionPage /></MemoryRouter>)
    expect(await screen.findByText('Today')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Check in' })).toBeInTheDocument()
    const expectedDate = `date=${formatBusinessDate(new Date())}`
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes(expectedDate) && String(url).includes('pageSize=100'))).toBe(true)
  })
})
