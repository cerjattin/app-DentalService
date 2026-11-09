import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { authStore } from '../auth/auth-store'
import { ClinicalAppointmentPage } from '../features/clinical/clinical-appointment-page'
import { positiveQuantitySchema } from '../features/clinical/clinical-model'
import { renderWithProviders } from './test-utils'

const appointmentId = '90071992547409939'
const encounterId = '90071992547409938'
const serviceId = '90071992547409937'
const serviceRowId = '90071992547409936'
const appointmentPath = `/appointments/${appointmentId}`
const servicesPath = `/clinical-encounters/${encounterId}/procedures`
const finishPath = `/clinical-encounters/${encounterId}/finish-services`
const permissions = ['appointment.read', 'appointment.start', 'appointment.complete', 'encounter.read',
  'encounter.create', 'encounter.complete', 'procedure.read', 'procedure.update', 'svb_procedure.read']
const service = { id: serviceId, code: 'QA-SERVICE', description: 'Synthetic service', requiresAuthorization: true, requiresReferral: true }
const serviceRow = { id: serviceRowId, status: 'PERFORMED', procedureCodeSnapshot: service.code,
  procedureDescriptionSnapshot: service.description, quantity: '1.25', amount: null }

function boundary(options: { status?: string; encounter?: boolean; rows?: typeof serviceRow[]; rejectFinish?: boolean; lostAdd?: boolean } = {}) {
  let status = options.status ?? 'CONFIRMED'
  let open = options.encounter ?? false
  let rows = options.rows ?? []
  const calls: { path: string; method: string; query: URLSearchParams; body: unknown }[] = []
  const encounter = () => ({ id: encounterId, appointmentId, status: status === 'COMPLETED' ? 'COMPLETED' : 'OPEN',
    appointment: { status }, clinicalNotes: 'Historic note hidden from this workflow' })
  const response = (data: unknown, code = 200) => new Response(JSON.stringify(data), { status: code, headers: { 'Content-Type': 'application/json' } })
  const ok = (data: unknown) => response({ success: true, data, meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } })
  vi.stubGlobal('fetch', vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(input)
    const path = url.pathname.replace('/api/v1', '')
    const method = init?.method ?? 'GET'
    const body = init?.body ? JSON.parse(String(init.body)) : null
    calls.push({ path, method, query: url.searchParams, body })
    if (path === appointmentPath) return ok({ id: appointmentId, appointmentNumber: 'QA-ATT',
      scheduledStart: '2027-03-10T02:00:00Z', scheduledEnd: '2027-03-10T02:30:00Z', status,
      patient: { firstName: 'QA', lastName: 'Patient' }, provider: { firstName: 'QA', lastName: 'Professional' },
      location: { name: 'QA site' } })
    if (path === `${appointmentPath}/clinical-encounter`) {
      return open ? ok(encounter()) : response({ success: false, error: { code: 'CLINICAL_ENCOUNTER_NOT_FOUND' } }, 404)
    }
    if (path === `${appointmentPath}/clinical-encounter/start` && method === 'POST') {
      status = 'IN_PROGRESS'
      open = true
      return ok(encounter())
    }
    if (path === '/svb-procedures') return ok([service])
    if (path === servicesPath) {
      if (method === 'POST') {
        rows = [...rows, serviceRow]
        if (options.lostAdd) throw new TypeError('Synthetic response lost after save')
        return ok(serviceRow)
      }
      return ok(rows)
    }
    if (path === `${servicesPath}/${serviceRowId}` && method === 'DELETE') {
      rows = []
      return ok(serviceRow)
    }
    if (path === finishPath && method === 'POST') {
      if (options.rejectFinish) return response({ success: false, error: { code: 'ATTENTION_SERVICES_REQUIRED', message: 'raw detail' } }, 409)
      status = 'COMPLETED'
      return ok(encounter())
    }
    throw new Error(`Unexpected request ${method} ${path}`)
  }))
  return calls
}

function renderAttention(grants = permissions) {
  authStore.setSession('synthetic-token', { id: '1', email: 'qa@local.invalid', firstName: 'QA', lastName: 'User',
    organizationId: '1', roles: [], permissions: grants })
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/clinical/${appointmentId}`]}>
      <Routes><Route path="/clinical/:appointmentId" element={<ClinicalAppointmentPage />} /></Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  authStore.clearSession()
  vi.unstubAllGlobals()
})

describe('service attention', () => {
  it('starts directly from a confirmed appointment', async () => {
    const calls = boundary()
    renderAttention()
    await userEvent.click(await screen.findByRole('button', { name: 'Start attention' }))
    expect(await screen.findByRole('heading', { name: 'Services provided' })).toBeInTheDocument()
    expect(calls.filter((call) => call.method === 'POST')).toMatchObject([
      { path: `${appointmentPath}/clinical-encounter/start`, body: null },
    ])
  })

  it('requires confirmation and permission before offering to start', async () => {
    const calls = boundary({ status: 'SCHEDULED' })
    renderAttention()
    expect(await screen.findByText('Confirm the appointment before starting attention.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start attention' })).not.toBeInTheDocument()
    expect(calls.every((call) => call.method === 'GET')).toBe(true)
  })

  it('lets a professional remove and replace a service using only service ID and quantity', async () => {
    const calls = boundary({ status: 'IN_PROGRESS', encounter: true, rows: [serviceRow] })
    renderAttention()
    await userEvent.click(await screen.findByRole('button', { name: 'Remove service QA-SERVICE' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm' }))
    await screen.findByText('No services recorded.')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add service' })).toHaveFocus())
    await userEvent.click(screen.getByRole('button', { name: 'Add service' }))
    await userEvent.click(await screen.findByRole('button', { name: 'QA-SERVICE Synthetic service' }))
    const modal = screen.getByRole('dialog')
    await userEvent.clear(within(modal).getByLabelText('Quantity'))
    await userEvent.type(within(modal).getByLabelText('Quantity'), '1.25')
    await userEvent.click(within(modal).getByRole('button', { name: 'Save service' }))
    await screen.findByText('Service recorded.')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add service' })).toHaveFocus())
    expect(calls.find((call) => call.path === servicesPath && call.method === 'POST')?.body)
      .toEqual({ svbProcedureId: serviceId, quantity: '1.25' })
    expect(calls.find((call) => call.path === '/svb-procedures')?.query.get('serviceDate')).toBe('2027-03-09')
    expect(calls.some((call) => /insurance|authorizations|diagnos|applicable-tariff/.test(call.path))).toBe(false)
    expect(screen.queryByText('Historic note hidden from this workflow')).not.toBeInTheDocument()
  })

  it('completes service attention and directs the appointment to reception', async () => {
    const calls = boundary({ status: 'IN_PROGRESS', encounter: true, rows: [serviceRow] })
    renderAttention()
    await userEvent.click(await screen.findByRole('button', { name: 'Complete attention' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm' }))
    expect(await screen.findByText('Ready for billing')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add service' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create invoice' })).not.toBeInTheDocument()
    expect(calls.filter((call) => call.method === 'POST')).toMatchObject([{ path: finishPath }])
  })

  it('keeps attention open after the server rejects empty completion', async () => {
    boundary({ status: 'IN_PROGRESS', encounter: true, rejectFinish: true })
    renderAttention()
    await userEvent.click(await screen.findByRole('button', { name: 'Complete attention' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Add at least one service')
    expect(screen.queryByText('Ready for billing')).not.toBeInTheDocument()
  })

  it('skips service requests and write controls without their permissions', async () => {
    const calls = boundary({ status: 'IN_PROGRESS', encounter: true })
    renderAttention(['appointment.read', 'encounter.read'])
    await screen.findByText('In attention')
    await waitFor(() => expect(calls.some((call) => call.path.endsWith('/clinical-encounter'))).toBe(true))
    expect(calls.some((call) => call.path === servicesPath)).toBe(false)
    expect(screen.queryByRole('button', { name: 'Complete attention' })).not.toBeInTheDocument()
  })

  it('rejects zero and excess decimal places without changing quantity to a number', () => {
    expect(positiveQuantitySchema.safeParse('0.00').success).toBe(false)
    expect(positiveQuantitySchema.safeParse('1.001').success).toBe(false)
    expect(positiveQuantitySchema.parse('2.01')).toBe('2.01')
  })
})


it('reconciles a lost service response without an automatic retry or losing the selection', async () => {
  const calls = boundary({ status: 'IN_PROGRESS', encounter: true, lostAdd: true }); renderAttention()
  await userEvent.click(await screen.findByRole('button', { name: 'Add service' }))
  await userEvent.click(await screen.findByRole('button', { name: 'QA-SERVICE Synthetic service' }))
  await userEvent.clear(screen.getByLabelText('Quantity')); await userEvent.type(screen.getByLabelText('Quantity'), '1.25')
  await userEvent.click(screen.getByRole('button', { name: 'Save service' }))
  const dialog = screen.getByRole('dialog')
  expect(await within(dialog).findByText(/The response did not confirm this save/)).toBeInTheDocument()
  expect(within(dialog).getByLabelText('Quantity')).toHaveValue('1.25')
  expect(within(dialog).getByRole('button', { name: 'Save another service' })).toBeDisabled()
  await userEvent.click(within(dialog).getByRole('button', { name: 'Refresh saved services' }))
  await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Save another service' })).toBeEnabled())
  expect(within(dialog).getByRole('list', { name: 'Current saved services' })).toHaveTextContent('QA-SERVICE · 1.25')
  expect(calls.filter(c => c.path === servicesPath && c.method === 'POST')).toHaveLength(1)
})
