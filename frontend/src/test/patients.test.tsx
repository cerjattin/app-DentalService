import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { authStore } from '../auth/auth-store'
import { PatientDetailPage } from '../features/patients/patient-detail-page'
import { PatientsPage } from '../features/patients/patients-page'
import type { AuthenticatedUser } from '../types/auth'
import type { Patient, PatientInsurance } from '../types/patient'
import { renderWithProviders } from './test-utils'

const user: AuthenticatedUser = {
  id: '10',
  email: 'reception@example.test',
  firstName: 'Reception',
  lastName: 'User',
  organizationId: '1',
  roles: ['RECEPTION'],
  permissions: ['patient.read'],
}

const patient: Patient = {
  id: '90071992547409931234',
  organizationId: '1',
  patientNumber: 'PAT-00042',
  firstName: 'Ana',
  middleName: null,
  lastName: 'Martina',
  secondLastName: null,
  dateOfBirth: '1990-05-12',
  sex: 'FEMALE',
  documentType: 'ID',
  documentNumber: 'ABC-123',
  email: 'ana@example.test',
  phone: '5999000000',
  mobilePhone: null,
  addressLine1: 'Clinic Road 1',
  addressLine2: null,
  city: 'Willemstad',
  countryCode: 'CW',
  status: 'ACTIVE',
  archivedAt: null,
  createdAt: '2026-08-01T12:00:00.000Z',
  updatedAt: '2026-08-01T12:00:00.000Z',
  insuranceCoverages: [],
}

const insurance: PatientInsurance = {
  id: '80000000000000000001',
  patientId: patient.id,
  payerId: '7',
  insuredId: 'SVB-9912',
  validFrom: '2026-01-01',
  validTo: '2026-12-31',
  status: 'ACTIVE',
  isPrimary: true,
  verifiedAt: '2026-08-31T15:00:00.000Z',
  verificationSource: 'SVB portal',
  verifiedBy: { id: '10', firstName: 'Reception', lastName: 'User', email: user.email },
  payer: { id: '7', code: 'SVB', name: 'Social Insurance Bank', payerType: 'GOVERNMENT' },
  createdAt: '2026-01-01T12:00:00.000Z',
  updatedAt: '2026-08-31T15:00:00.000Z',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function patientListResponse(rows: Patient[]) {
  return json({
    success: true,
    data: rows,
    meta: { page: 1, pageSize: 20, total: rows.length, totalPages: rows.length ? 1 : 0 },
  })
}

function renderList(permissions = ['patient.read']) {
  authStore.setSession('token', { ...user, permissions })
  return renderWithProviders(
    <MemoryRouter initialEntries={['/patients']}>
      <Routes>
        <Route path="/patients" element={<PatientsPage />} />
        <Route path="/patients/:patientId" element={<PatientDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function renderDetail(permissions = ['patient.read']) {
  authStore.setSession('token', { ...user, permissions })
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/patients/${patient.id}`]}>
      <Routes>
        <Route path="/patients/:patientId" element={<PatientDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  authStore.clearSession()
  vi.restoreAllMocks()
})

describe('patient list', () => {
  it('renders the loading state', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => undefined)))
    renderList()
    expect(screen.getByText('Loading patients')).toBeInTheDocument()
  })

  it('renders contracted patient fields on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(patientListResponse([patient])))
    renderList()
    expect(await screen.findByText('Ana Martina')).toBeInTheDocument()
    expect(screen.getByText('PAT-00042')).toBeInTheDocument()
    expect(screen.getByText('ABC-123')).toBeInTheDocument()
  })

  it('renders the empty state', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(patientListResponse([])))
    renderList()
    expect(await screen.findByText('No patients yet')).toBeInTheDocument()
  })

  it('renders a safe backend error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ success: false, error: { code: 'PATIENT_NOT_FOUND', message: 'raw text' } }, 404)))
    renderList()
    expect(await screen.findByText('Unable to load patients')).toBeInTheDocument()
    expect(screen.getByText('The patient could not be found.')).toBeInTheDocument()
    expect(screen.queryByText('raw text')).not.toBeInTheDocument()
  })

  it('sends debounced search through the supported q parameter', async () => {
    const fetchMock = vi.fn().mockResolvedValue(patientListResponse([]))
    vi.stubGlobal('fetch', fetchMock)
    renderList()
    fireEvent.change(screen.getByLabelText('Search patients'), { target: { value: 'SVB-9912' } })
    await waitFor(
      () => expect(fetchMock.mock.calls.some(([url]) => String(url).includes('q=SVB-9912'))).toBe(true),
      { timeout: 1000 },
    )
  })

  it('shows create only with patient.create permission', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(patientListResponse([])))
    const view = renderList(['patient.read'])
    await screen.findByText('No patients yet')
    expect(screen.queryByRole('button', { name: 'Create patient' })).not.toBeInTheDocument()
    view.unmount()
    renderList(['patient.read', 'patient.create'])
    expect(await screen.findByRole('button', { name: 'Create patient' })).toBeInTheDocument()
  })

  it('creates a patient and sends only the documented DTO', async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return Promise.resolve(json({ success: true, data: patient }, 201))
      return Promise.resolve(patientListResponse([]))
    })
    vi.stubGlobal('fetch', fetchMock)
    renderList(['patient.read', 'patient.create'])
    await userEvent.click(await screen.findByRole('button', { name: 'Create patient' }))
    await userEvent.type(screen.getByLabelText('First name'), 'Ana')
    await userEvent.type(screen.getByLabelText('Last name'), 'Martina')
    await userEvent.click(screen.getByRole('button', { name: 'Create patient' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(true))
    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
    expect(JSON.parse(String(postCall?.[1]?.body))).toMatchObject({ firstName: 'Ana', lastName: 'Martina' })
  })

  it('maps backend validation errors in the create form', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, init?: RequestInit) =>
      Promise.resolve(init?.method === 'POST'
        ? json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'raw schema error' } }, 400)
        : patientListResponse([])),
    ))
    renderList(['patient.read', 'patient.create'])
    await userEvent.click(await screen.findByRole('button', { name: 'Create patient' }))
    await userEvent.type(screen.getByLabelText('First name'), 'Ana')
    await userEvent.type(screen.getByLabelText('Last name'), 'Martina')
    await userEvent.click(screen.getByRole('button', { name: 'Create patient' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Check the highlighted fields and try again.')
    expect(screen.queryByText('raw schema error')).not.toBeInTheDocument()
  })
})

describe('patient detail and insurance', () => {
  it('renders detail loading and then patient information with the string ID unchanged', async () => {
    let resolveRequest: (response: Response) => void = () => undefined
    const pending = new Promise<Response>((resolve) => { resolveRequest = resolve })
    const fetchMock = vi.fn().mockReturnValue(pending)
    vi.stubGlobal('fetch', fetchMock)
    renderDetail()
    expect(screen.getByText('Loading patient')).toBeInTheDocument()
    resolveRequest(json({ success: true, data: patient }))
    expect(await screen.findByText('Patient information')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/patients/${patient.id}`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('shows edit only with patient.update permission', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(json({ success: true, data: patient }))))
    const view = renderDetail(['patient.read'])
    await screen.findByText('Patient information')
    expect(screen.queryByRole('button', { name: 'Edit patient' })).not.toBeInTheDocument()
    view.unmount()
    renderDetail(['patient.read', 'patient.update'])
    expect(await screen.findByRole('button', { name: 'Edit patient' })).toBeInTheDocument()
  })

  it('renders insurance and exposes actions only for their exact permissions', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/insurance')) return Promise.resolve(json({ success: true, data: [insurance] }))
      if (url.endsWith('/payers')) return Promise.resolve(json({ success: true, data: [insurance.payer] }))
      return Promise.resolve(json({ success: true, data: patient }))
    }))
    renderDetail(['patient.read', 'insurance.read', 'insurance.verify'])
    expect(await screen.findByText('Social Insurance Bank')).toBeInTheDocument()
    expect(screen.getByText('SVB-9912')).toBeInTheDocument()
    expect(screen.getByText('SVB portal')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Verify' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add insurance' })).not.toBeInTheDocument()
  })

  it('does not fetch or expose insurance actions without insurance.read', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ success: true, data: patient }))
    vi.stubGlobal('fetch', fetchMock)
    renderDetail(['patient.read', 'insurance.create', 'insurance.update', 'insurance.verify'])
    expect(await screen.findByText('Insurance access unavailable')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Add insurance' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Verify' })).not.toBeInTheDocument()
  })
})
