import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { authStore } from '../auth/auth-store'
import { ClinicalAppointmentPage } from '../features/clinical/clinical-appointment-page'
import {
  addEncounterProcedure,
  assignDiagnosis,
  completeEncounter,
  getApplicableTariff,
  listAuthorizations,
  removeDiagnosis,
  searchDiagnosisCodes,
  searchSvbProcedures,
  updateDiagnosis,
} from '../features/clinical/clinical-api'
import type { Appointment } from '../types/appointment'
import type { AuthenticatedUser } from '../types/auth'
import type { ClinicalEncounter, EncounterProcedure } from '../types/clinical'
import type { PatientInsurance } from '../types/patient'
import { PermissionRoute } from '../routes/permission-route'
import { renderWithProviders } from './test-utils'

const appointmentId = '90071992547409939999'
const patientId = '90071992547409931234'
const encounterId = '80071992547409939999'

const appointment: Appointment = {
  id: appointmentId, organizationId: '1', appointmentNumber: 'APT-00042', patientId,
  providerId: '70000000000000000001', clinicLocationId: '60000000000000000001',
  treatmentCaseId: '50000000000000000001', accidentCaseId: null,
  scheduledStart: '2026-09-01T13:00:00.000Z', scheduledEnd: '2026-09-01T13:30:00.000Z',
  status: 'IN_PROGRESS', reason: 'Routine visit', notes: null, checkedInAt: '2026-09-01T12:55:00.000Z',
  startedAt: '2026-09-01T13:00:00.000Z', completedAt: null, cancelledAt: null, cancellationReason: null,
  patient: { id: patientId, patientNumber: 'PAT-00042', firstName: 'Ana', middleName: null, lastName: 'Martina', secondLastName: null, documentType: 'ID', documentNumber: 'ABC-123', status: 'ACTIVE' },
  provider: { id: '70000000000000000001', svbProviderId: 'SVB-P-1', firstName: 'John', lastName: 'Dentist', isActive: true },
  location: { id: '60000000000000000001', code: 'MAIN', name: 'Main Clinic', isActive: true },
  createdByUserId: '10', createdAt: '2026-08-01T12:00:00.000Z', updatedAt: '2026-09-01T13:00:00.000Z',
}

const encounter: ClinicalEncounter = {
  id: encounterId, appointmentId, providerId: appointment.providerId, status: 'OPEN',
  startedAt: '2026-09-01T13:01:00.000Z', completedAt: null, chiefComplaint: 'Tooth pain', clinicalNotes: 'Initial review',
  appointment: { id: appointmentId, appointmentNumber: appointment.appointmentNumber, scheduledStartAt: appointment.scheduledStart, scheduledEndAt: appointment.scheduledEnd, status: 'IN_PROGRESS' },
  patient: { id: patientId, patientNumber: 'PAT-00042', firstName: 'Ana', middleName: null, lastName: 'Martina', secondLastName: null },
  provider: { id: appointment.providerId, svbProviderId: 'SVB-P-1', firstName: 'John', lastName: 'Dentist', isActive: true },
  createdByUserId: '10', createdAt: '2026-09-01T13:01:00.000Z', updatedAt: '2026-09-01T13:01:00.000Z',
}

const insurance: PatientInsurance = {
  id: '40000000000000000001', patientId, payerId: '3', insuredId: 'SVB-7788',
  validFrom: '2026-01-01', validTo: '2026-12-31', status: 'ACTIVE', isPrimary: true,
  verifiedAt: null, verificationSource: null, verifiedBy: null,
  payer: { id: '3', code: 'SVB', name: 'Social Insurance Bank', payerType: 'GOVERNMENT' },
  createdAt: '', updatedAt: '',
}

const performedProcedure = {
  id: '30000000000000000001', encounterId, patientInsuranceId: insurance.id,
  svbProcedureId: '20000000000000000001', svbTariffId: '21000000000000000001',
  authorizationItemId: null, diagnosisId: null, performedByProviderId: appointment.providerId,
  procedureCodeSnapshot: 'SVB-101', procedureDescriptionSnapshot: 'Clinical procedure',
  providerIdSnapshot: 'SVB-P-1', insuredIdSnapshot: 'SVB-7788', unitTariffSnapshot: '125.50',
  currencyCodeSnapshot: 'ANG', quantity: '2.00', amount: '251.00', authorizationIdSnapshot: null,
  diagnosticCodeSnapshot: null, treatmentIdSnapshot: 'TRT-BACKEND-9001', accidentFormNumberSnapshot: null,
  numberOfTreatmentsSnapshot: null, assistanceSnapshot: null, policlinicSnapshot: 'MAIN',
  performedAt: '2026-09-01T13:10:00.000Z', additionalNote: null, status: 'PERFORMED',
  createdByUserId: '10', createdAt: '', updatedAt: '',
  svbProcedure: { id: '20000000000000000001', code: 'SVB-101', description: 'Clinical procedure', requiresAuthorization: false, requiresReferral: false },
  svbTariff: { id: '21000000000000000001', amount: '125.50', currencyCode: 'ANG', validFrom: null, validTo: null },
  patientInsurance: { id: insurance.id, patientId, insuredId: 'SVB-7788', status: 'ACTIVE', validFrom: null, validTo: null, payer: { id: '3', code: 'SVB', name: 'Social Insurance Bank' } },
  authorizationItem: null, diagnosis: null,
  performedByProvider: { id: appointment.providerId, svbProviderId: 'SVB-P-1', firstName: 'John', lastName: 'Dentist' },
} satisfies EncounterProcedure

const authUser: AuthenticatedUser = {
  id: '10', email: 'provider@example.test', firstName: 'John', lastName: 'Dentist', organizationId: '1', roles: ['PROVIDER'], permissions: [],
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

function success(data: unknown) {
  return json({ success: true, data })
}

function list(data: unknown[]) {
  return json({ success: true, data, meta: { page: 1, pageSize: 100, total: data.length, totalPages: data.length ? 1 : 0 } })
}

function installClinicalFetch(currentEncounter: ClinicalEncounter | null, currentAppointment = appointment) {
  return vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (url.endsWith(`/appointments/${appointmentId}/clinical-encounter`)) {
      if (init?.method === 'POST') return Promise.resolve(success(encounter))
      if (!currentEncounter) return Promise.resolve(json({ success: false, error: { code: 'CLINICAL_ENCOUNTER_NOT_FOUND', message: 'missing' } }, 404))
      return Promise.resolve(success(currentEncounter))
    }
    if (url.endsWith(`/appointments/${appointmentId}`)) return Promise.resolve(success(currentAppointment))
    if (url.includes(`/patients/${patientId}/insurance`)) return Promise.resolve(success([insurance]))
    if (url.endsWith(`/clinical-encounters/${encounterId}/diagnoses`)) return Promise.resolve(success([]))
    if (url.endsWith(`/clinical-encounters/${encounterId}/procedures`)) return Promise.resolve(success([performedProcedure]))
    if (url.includes('/authorizations?')) return Promise.resolve(list([]))
    if (url.endsWith(`/clinical-encounters/${encounterId}/complete`)) return Promise.resolve(success({ ...encounter, status: 'COMPLETED', completedAt: '2026-09-01T14:00:00.000Z', updatedAt: '2026-09-01T14:00:00.000Z' }))
    return Promise.resolve(success([]))
  })
}

function renderClinical(permissions: string[], currentEncounter: ClinicalEncounter | null = encounter, currentAppointment = appointment) {
  authStore.setSession('token', { ...authUser, permissions })
  const fetchMock = installClinicalFetch(currentEncounter, currentAppointment)
  vi.stubGlobal('fetch', fetchMock)
  renderWithProviders(<MemoryRouter initialEntries={[`/clinical/${appointmentId}`]}><Routes><Route path="/clinical/:appointmentId" element={<ClinicalAppointmentPage />} /></Routes></MemoryRouter>)
  return fetchMock
}

afterEach(() => {
  authStore.clearSession()
  vi.restoreAllMocks()
})

describe('clinical encounter lifecycle', () => {
  it('requires both appointment and encounter read permissions at the route boundary', async () => {
    authStore.setSession('token', { ...authUser, permissions: ['encounter.read'] })
    renderWithProviders(<MemoryRouter initialEntries={['/clinical/1']}><Routes><Route element={<PermissionRoute allOf={['appointment.read', 'encounter.read']} />}><Route path="/clinical/:appointmentId" element={<div>Clinical allowed</div>} /></Route><Route path="/access-denied" element={<div>Access denied</div>} /></Routes></MemoryRouter>)
    expect(await screen.findByText('Access denied')).toBeInTheDocument()
  })

  it('loads appointment context, resumes an encounter, and preserves the string appointment ID', async () => {
    const fetchMock = renderClinical(['encounter.read', 'diagnosis.read', 'procedure.read', 'insurance.read'])
    expect(await screen.findByText('Tooth pain')).toBeInTheDocument()
    expect(screen.getByText('Ana Martina')).toBeInTheDocument()
    expect(await screen.findByText('TRT-BACKEND-9001')).toBeInTheDocument()
    expect(screen.getByText('ANG 125.50')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith(`/appointments/${appointmentId}/clinical-encounter`))).toBe(true)
  })

  it('starts a checked-in appointment through the documented transition', async () => {
    const checkedIn = { ...appointment, status: 'CHECKED_IN' as const }
    const fetchMock = installClinicalFetch(null, checkedIn)
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith(`/appointments/${appointmentId}/status`) && init?.method === 'PATCH') return Promise.resolve(success(appointment))
      if (url.endsWith(`/appointments/${appointmentId}/clinical-encounter`)) return Promise.resolve(json({ success: false, error: { code: 'CLINICAL_ENCOUNTER_NOT_FOUND', message: 'missing' } }, 404))
      if (url.endsWith(`/appointments/${appointmentId}`)) return Promise.resolve(success(checkedIn))
      return Promise.resolve(success([]))
    })
    authStore.setSession('token', { ...authUser, permissions: ['encounter.read', 'appointment.start'] })
    vi.stubGlobal('fetch', fetchMock)
    renderWithProviders(<MemoryRouter initialEntries={[`/clinical/${appointmentId}`]}><Routes><Route path="/clinical/:appointmentId" element={<ClinicalAppointmentPage />} /></Routes></MemoryRouter>)
    await userEvent.click(await screen.findByRole('button', { name: 'Start appointment' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/status'))).toBe(true))
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/status'))
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ status: 'IN_PROGRESS' })
  })

  it('creates an encounter only with encounter.create', async () => {
    const fetchMock = renderClinical(['encounter.read', 'encounter.create'], null)
    await userEvent.type(await screen.findByLabelText('Chief complaint'), 'Sensitivity')
    await userEvent.click(screen.getByRole('button', { name: 'Open encounter' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(true))
    const call = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ chiefComplaint: 'Sensitivity', clinicalNotes: null })
  })

  it('filters independent actions by permission', async () => {
    renderClinical(['encounter.read', 'diagnosis.read', 'procedure.read'])
    await screen.findByText('Diagnoses')
    expect(screen.queryByRole('button', { name: 'Add diagnosis' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add procedure' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Complete encounter' })).not.toBeInTheDocument()
  })

  it('completes through the encounter endpoint and becomes read-only', async () => {
    const fetchMock = renderClinical(['encounter.read', 'encounter.update', 'encounter.complete', 'diagnosis.read', 'diagnosis.assign', 'procedure.read', 'procedure.update', 'svb_procedure.read'])
    await userEvent.click(await screen.findByRole('button', { name: 'Complete encounter' }))
    await userEvent.click(screen.getByRole('button', { name: 'Complete encounter' }))
    await screen.findByText('Clinical encounter completed and is now read-only.')
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith(`/clinical-encounters/${encounterId}/complete`))).toBe(true)
    expect(screen.queryByRole('button', { name: 'Add diagnosis' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add procedure' })).not.toBeInTheDocument()
  })
})

describe('clinical API contracts', () => {
  it('keeps entity IDs and Decimal tariff values as strings', async () => {
    const fetchMock = vi.fn().mockResolvedValue(success({ id: 'tariff-id', amount: '125.50', currencyCode: 'ANG' }))
    vi.stubGlobal('fetch', fetchMock)
    const tariff = await getApplicableTariff('90071992547409939999', '2026-09-01')
    expect(tariff.amount).toBe('125.50')
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/svb-procedures/90071992547409939999/applicable-tariff')
  })

  it('sends performed-procedure insurance, authorization, diagnosis, and quantity unchanged', async () => {
    const fetchMock = vi.fn().mockResolvedValue(success(performedProcedure))
    vi.stubGlobal('fetch', fetchMock)
    await addEncounterProcedure(encounterId, { patientInsuranceId: insurance.id, svbProcedureId: '20000000000000000001', authorizationItemId: '19000000000000000001', diagnosisId: '18000000000000000001', quantity: '2.00', additionalNote: 'Clinical note' })
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(body).toEqual({ patientInsuranceId: insurance.id, svbProcedureId: '20000000000000000001', authorizationItemId: '19000000000000000001', diagnosisId: '18000000000000000001', quantity: '2.00', additionalNote: 'Clinical note' })
  })

  it('uses the diagnosis search and encounter assignment endpoints', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(success([])))
    vi.stubGlobal('fetch', fetchMock)
    await searchDiagnosisCodes('K02')
    await assignDiagnosis(encounterId, { diagnosisCodeId: '18000000000000000001', isPrimary: true, notes: null })
    await updateDiagnosis(encounterId, '17000000000000000001', { isPrimary: false, notes: 'Reviewed' })
    await removeDiagnosis(encounterId, '17000000000000000001')
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/diagnosis-codes?q=K02')
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe('POST')
    expect(fetchMock.mock.calls[2]?.[1]?.method).toBe('PATCH')
    expect(fetchMock.mock.calls[3]?.[1]?.method).toBe('DELETE')
  })

  it('uses bounded server catalogue and authorization queries', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(list([])))
    vi.stubGlobal('fetch', fetchMock)
    await searchSvbProcedures('restoration', '2026-09-01')
    await listAuthorizations(patientId, '2026-09-01')
    expect(fetchMock.mock.calls[0]?.[0]).toContain('q=restoration')
    expect(fetchMock.mock.calls[0]?.[0]).toContain('pageSize=20')
    expect(fetchMock.mock.calls[1]?.[0]).toContain(`patientId=${patientId}`)
    expect(fetchMock.mock.calls[1]?.[0]).toContain('pageSize=100')
  })

  it('preserves invalid clinical transition codes without clearing authentication', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ success: false, error: { code: 'INVALID_CLINICAL_ENCOUNTER_STATUS', message: 'raw backend text' } }, 409)))
    authStore.setSession('token', { ...authUser, permissions: ['encounter.complete'] })
    await expect(completeEncounter(encounterId)).rejects.toMatchObject({ code: 'INVALID_CLINICAL_ENCOUNTER_STATUS', status: 409 })
    expect(authStore.getAccessToken()).toBe('token')
  })
})
