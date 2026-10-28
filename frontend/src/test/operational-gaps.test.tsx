import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { authStore } from '../auth/auth-store'
import { createAppointment, listClinicLocations } from '../features/appointments/appointment-api'
import { AppointmentCreateAction } from '../features/appointments/appointment-create-dialog'
import { AppointmentsPage } from '../features/appointments/appointments-page'
import { ReceptionPage } from '../features/reception/reception-page'
import { DashboardPage } from '../features/dashboard/dashboard-page'
import { getDashboardReport } from '../features/dashboard/dashboard-api'
import { appointmentCreateSchema } from '../features/appointments/appointment-create-model'
import { renderWithProviders } from './test-utils'
import type { DashboardReportData } from '../types/reporting'
const id = '9007199254740993'
const permissions = ['appointment.read', 'appointment.create', 'patient.read', 'provider.read', 'clinic_location.read', 'dashboard.read']
const report: DashboardReportData = { period: { from: '2026-10-28', to: '2026-10-28', timezone: 'America/Curacao' }, providerId: null,
  kpis: { production: [{ currencyCode: 'ANG', amount: '9999999999999.99' }], svbBilled: [{ currencyCode: 'ANG', amount: '88.80' }], patientsSeen: 2, appointments: 3, pendingSignatures: 1, closedInvoices: 1, toDeclare: 1 },
  productionTimeline: [{ date: '2026-10-28', currencyCode: 'ANG', amount: '9999999999999.99', chartPercent: 100 }],
  productionByProvider: [{ providerId: id, providerName: 'QA Provider', currencyCode: 'ANG', amount: '9999999999999.99', chartPercent: 100 }] }
function session(p = permissions) { authStore.setSession('memory-ops', { id: '1', organizationId: '1', firstName: 'QA', lastName: 'Admin', email: 'qa@local.invalid', permissions: p, roles: [] }) }
function ok(data: unknown, meta?: unknown) { return new Response(JSON.stringify({ success: true, data, ...(meta ? { meta } : {}) }), { headers: { 'Content-Type': 'application/json' } }) }
function boundary(options: { empty?: boolean; error?: string; code?: string; status?: number } = {}) {
  const calls: { path: string; method: string; body: unknown; query: URLSearchParams }[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
    const u = new URL(url), path = u.pathname.replace('/api/v1', ''), method = init.method ?? 'GET'
    const body: unknown = typeof init.body === 'string' ? JSON.parse(init.body) : undefined
    calls.push({ path, method, body, query: u.searchParams })
    if (options.error === method + ' ' + path) return new Response(JSON.stringify({ success: false, error: { code: options.code ?? 'PERMISSION_DENIED', message: 'RAW DATABASE ERROR' } }), { status: options.status ?? 403, headers: { 'Content-Type': 'application/json' } })
    if (path === '/reports/dashboard') return ok(options.empty ? { ...report, kpis: { ...report.kpis, production: [], svbBilled: [] }, productionTimeline: [], productionByProvider: [] } : report)
    if (path === '/patients') return ok(options.empty ? [] : [{ id, firstName: 'QA', lastName: 'Patient', patientNumber: 'PAT-QA' }], { total: options.empty ? 0 : 1, totalPages: 1 })
    if (path === '/providers') return ok(options.empty ? [] : [{ id, firstName: 'QA', lastName: 'Provider', isActive: true }], { total: options.empty ? 0 : 1, totalPages: 1 })
    if (path === '/clinic-locations') return ok(options.empty ? [] : [{ id, code: 'MAIN', name: 'QA Clinic', isActive: true }])
    if (path === '/appointments' && method === 'POST') return ok({ id, appointmentNumber: 'APT-QA', ...(body as object) })
    if (path === '/appointments') return ok([], { total: 0, totalPages: 0 })
    throw new Error('Unexpected: ' + method + ' ' + path)
  }))
  return calls
}
function render(ui = <AppointmentCreateAction />, p = permissions) { session(p); return renderWithProviders(<MemoryRouter>{ui}</MemoryRouter>) }
async function open() { const u = userEvent.setup(); render(); await u.click(screen.getByRole('button', { name: 'Create appointment' })); await screen.findByRole('option', { name: 'QA Clinic' }); return u }
async function fill(u: ReturnType<typeof userEvent.setup>) {
  const d = within(screen.getByRole('dialog'))
  await u.selectOptions(d.getByLabelText('Patient'), id); await u.selectOptions(d.getByLabelText('Provider'), id); await u.selectOptions(d.getByLabelText('Clinic location'), id)
  await u.type(d.getByLabelText('Scheduled start'), '2026-10-28T09:00')
  await u.type(d.getByLabelText('Scheduled end'), '2026-10-28T09:30')
  await u.type(d.getByLabelText('Reason'), 'Routine')
  await u.type(d.getByLabelText('Notes'), 'QA notes')
}
afterEach(() => { authStore.clearSession(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
describe('Appointment creation correction', () => {
  it('posts opaque IDs and the exact creation DTO', async () => { const calls = boundary(); await createAppointment({ patientId: id, providerId: id, clinicLocationId: id, scheduledStart: '2026-10-28T13:00:00Z', scheduledEnd: '2026-10-28T13:30:00Z' }); expect(calls[0]).toMatchObject({ method: 'POST', path: '/appointments', body: { patientId: id, providerId: id, clinicLocationId: id } }) })
  it('loads the active location lookup with string identities', async () => { const calls = boundary(); expect((await listClinicLocations())[0]?.id).toBe(id); expect(calls[0]?.query.get('isActive')).toBe('true') })
  it('hides creation without appointment.create', () => { render(undefined, ['appointment.read']); expect(screen.queryByRole('button', { name: 'Create appointment' })).not.toBeInTheDocument() })
  it.each(['clinic_location.read', 'provider.read', 'patient.read'])('requires independent lookup permission %s', (denied) => { render(undefined, permissions.filter((p) => p !== denied)); expect(screen.getByRole('button', { name: 'Create appointment' })).toBeDisabled() })
  it.each([<AppointmentsPage />, <ReceptionPage />])('uses the same creation action from each workspace', async (page) => { boundary(); const u = userEvent.setup(); render(page); await u.click(await screen.findByRole('button', { name: 'Create appointment' })); expect(await screen.findByRole('dialog', { name: 'Create appointment' })).toBeInTheDocument(); expect(await screen.findByRole('option', { name: 'QA Clinic' })).toBeInTheDocument() })
  it('creates from real selections with Curacao timestamps and preserves strings', async () => { const calls = boundary(); const u = await open(); await fill(u); await u.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Create appointment' })); expect(await screen.findByRole('link', { name: 'APT-QA' })).toHaveAttribute('href', '/appointments/' + id); expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ patientId: id, providerId: id, clinicLocationId: id, scheduledStart: '2026-10-28T13:00:00.000Z', scheduledEnd: '2026-10-28T13:30:00.000Z', reason: 'Routine', notes: 'QA notes' }) })
  it('shows empty lookup state and prevents submission', async () => { boundary({ empty: true }); const u = userEvent.setup(); render(); await u.click(screen.getByRole('button', { name: 'Create appointment' })); expect(await screen.findByText(/No matching patients/)).toBeInTheDocument(); expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Create appointment' })).toBeDisabled() })
  it('shows lookup failure with retry', async () => { boundary({ error: 'GET /clinic-locations' }); const u = userEvent.setup(); render(); await u.click(screen.getByRole('button', { name: 'Create appointment' })); expect(await screen.findByRole('button', { name: 'Retry choices' })).toBeInTheDocument() })
  it('retains form values and session after a creation 403', async () => { boundary({ error: 'POST /appointments' }); const u = await open(); await fill(u); await u.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Create appointment' })); expect(await screen.findByRole('alert')).not.toHaveTextContent('RAW'); expect(screen.getByLabelText('Reason')).toHaveValue('Routine'); expect(authStore.getAccessToken()).toBe('memory-ops') })
  it('maps overlap errors without raw backend text', async () => { boundary({ error: 'POST /appointments', code: 'APPOINTMENT_PROVIDER_OVERLAP', status: 409 }); const u = await open(); await fill(u); await u.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Create appointment' })); expect(await screen.findByRole('alert')).toHaveTextContent('overlapping appointment') })
  it('rejects inverted periods before submission', () => { expect(appointmentCreateSchema.safeParse({ patientId: id, providerId: id, clinicLocationId: id, scheduledStart: '2026-10-28T10:00', scheduledEnd: '2026-10-28T09:00', reason: '', notes: '' }).success).toBe(false) })
})
describe('Live Dashboard correction', () => {
  it('requests only supported dates and opaque provider IDs', async () => { const calls = boundary(); await getDashboardReport({ from: '2026-10-28', to: '2026-10-29', providerId: id }); expect(Object.fromEntries(calls[0]!.query)).toEqual({ from: '2026-10-28', to: '2026-10-29', providerId: id }) })
  it('renders all seven live indicators, exact Decimal amounts and both charts', async () => { boundary(); render(<DashboardPage />); expect(await screen.findByText('Production')).toBeInTheDocument(); for (const name of ['SVB Billed','Patients Seen','Appointments','Pending Signatures','Closed Invoices','To Declare']) expect(screen.getAllByText(name).length).toBeGreaterThan(0); expect(screen.getByText('ANG 88.80')).toBeInTheDocument(); expect(screen.getAllByText('ANG 9999999999999.99')).toHaveLength(3); expect(screen.getByText('Production timeline')).toBeInTheDocument(); expect(screen.getByText('Production by Provider')).toBeInTheDocument() })
  it('does not fetch reporting without dashboard.read', async () => { const calls = boundary(); render(<DashboardPage />, permissions.filter((p) => p !== 'dashboard.read')); expect(screen.queryByRole('region', { name: 'Dashboard reporting' })).not.toBeInTheDocument(); expect(calls).toHaveLength(0) })
  it('does not fetch provider choices without provider.read', async () => { const calls = boundary(); render(<DashboardPage />, ['dashboard.read']); await screen.findByText('Production'); expect(calls.some((c) => c.path === '/providers')).toBe(false) })
  it('renders reporting loading', () => { vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined))); render(<DashboardPage />, ['dashboard.read']); expect(screen.getByText('Loading dashboard report')).toBeInTheDocument() })
  it('renders empty chart states without fabricated money totals', async () => { boundary({ empty: true }); render(<DashboardPage />); expect(await screen.findByText('No production in this period.')).toBeInTheDocument(); expect(screen.getAllByText('No amounts recorded')).toHaveLength(2) })
  it('renders safe report errors with retry', async () => { boundary({ error: 'GET /reports/dashboard', code: 'INVALID_REPORT_PERIOD', status: 400 }); render(<DashboardPage />); expect(await screen.findByText('Unable to load dashboard report')).toBeInTheDocument(); expect(screen.getByText(/at most 366 days/)).toBeInTheDocument(); expect(screen.queryByText('RAW DATABASE ERROR')).not.toBeInTheDocument() })
  it('applies date and provider filters through the Backend query', async () => { const calls = boundary(); const u = userEvent.setup(); render(<DashboardPage />); await screen.findByText('Production'); await u.clear(screen.getByLabelText('From')); await u.type(screen.getByLabelText('From'), '2026-10-01'); await u.selectOptions(screen.getByLabelText('Provider'), id); await u.click(screen.getByRole('button', { name: 'Apply filters' })); await waitFor(() => expect(calls.some((c) => c.path === '/reports/dashboard' && c.query.get('from') === '2026-10-01' && c.query.get('providerId') === id)).toBe(true)) })
})
