import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, expect, it, vi } from 'vitest'
import { authStore } from '../auth/auth-store'
import { ReceptionPage } from '../features/reception/reception-page'
import { AppointmentBilling } from '../features/billing/appointment-billing'
import { AppointmentUpdateDialog } from '../features/appointments/appointment-update-dialog'
import type { Appointment } from '../types/appointment'
import { renderWithProviders } from './test-utils'
const id = '90071992547409939999'
const appointment = { id, patientId: '90071992547409939998', providerId: '90071992547409939997', appointmentNumber: 'OPS-QA-1', scheduledStart: '2026-11-01T13:00:00Z', scheduledEnd: '2026-11-01T13:30:00Z', status: 'COMPLETED', patient: { firstName: 'Synthetic', lastName: 'OPS patient', patientNumber: 'QA-OPS-1' }, provider: { id: '90071992547409939997', firstName: 'QA', lastName: 'Provider' }, location: { name: 'QA location' } } as Appointment
const ok = (data: unknown, meta?: unknown) => new Response(JSON.stringify({ success: true, data, meta }), { headers: { 'Content-Type': 'application/json' } })
const fail = (code: string) => new Response(JSON.stringify({ success: false, error: { code, message: 'RAW BACKEND DETAIL' } }), { status: 409, headers: { 'Content-Type': 'application/json' } })
function session(permissions: string[]) { authStore.setSession('memory-ops-qa', { id: '1', organizationId: '1', email: 'qa@local.invalid', firstName: 'QA', lastName: 'Operator', roles: [], permissions }) }
afterEach(() => { authStore.clearSession(); vi.unstubAllGlobals() })
it('finds earlier completed appointments with server pagination and checks invoice status on opening', async () => {
 session(['appointment.read', 'invoice.read'])
 const calls: URL[] = []
 vi.stubGlobal('fetch', vi.fn(async (input) => { const url = new URL(String(input)); calls.push(url); return ok(url.searchParams.get('status') === 'COMPLETED' ? [{ ...appointment, appointmentNumber: url.searchParams.get('page') === '2' ? 'OPS-QA-21' : appointment.appointmentNumber }] : [], { page: Number(url.searchParams.get('page')), pageSize: 20, total: 21, totalPages: 2 }) }))
 renderWithProviders(<MemoryRouter><ReceptionPage /></MemoryRouter>)
 await userEvent.click(screen.getByRole('button', { name: 'Completed / billing review' }))
 expect(await screen.findByText('OPS-QA-1')).toBeInTheDocument()
 const completed = calls.find(url => url.searchParams.get('status') === 'COMPLETED')!
 expect(completed.searchParams.has('date')).toBe(false); expect(completed.searchParams.get('pageSize')).toBe('20')
 expect(screen.getByRole('link', { name: 'Review billing' })).toHaveAttribute('href', `/appointments/${id}`)
 expect(screen.getByText(/includes appointments already invoiced/)).toBeInTheDocument()
 await waitFor(() => expect(screen.getByRole('button', { name: 'Next completed page' })).toBeEnabled())
 await userEvent.click(screen.getByRole('button', { name: 'Next completed page' }))
 expect(await screen.findByText('OPS-QA-21')).toBeInTheDocument()
 fireEvent.change(screen.getByLabelText('Service date (optional)'), { target: { value: '2026-11-01' } })
 await waitFor(() => expect(calls.some(url => url.searchParams.get('date') === '2026-11-01' && url.searchParams.get('page') === '1')).toBe(true))
})
it('does not expose the billing queue from a role name without invoice.read', async () => {
 session(['appointment.read']); authStore.setUser({ ...authStore.getUser()!, roles: ['ADMIN'] })
 vi.stubGlobal('fetch', vi.fn(async () => ok([], { total: 0, totalPages: 0 })))
 renderWithProviders(<MemoryRouter><ReceptionPage /></MemoryRouter>)
 await screen.findByText('No appointments today')
 expect(screen.queryByRole('button', { name: 'Completed / billing review' })).not.toBeInTheDocument()
})
it('keeps explicit billing choices after a pricing error and retries the same appointment', async () => {
 session(['invoice.read', 'invoice.create', 'insurance.read'])
 const writes: unknown[] = []
 vi.stubGlobal('fetch', vi.fn(async (input, init) => {
  const path = new URL(String(input)).pathname
  if (path.endsWith('/insurance')) return ok([{ id: '90071992547409939996', status: 'ACTIVE', payer: { name: 'Synthetic payer' }, insuredId: '00000123' }])
  if (init?.method === 'POST') { writes.push(JSON.parse(String(init.body))); return writes.length === 1 ? fail('SVB_TARIFF_NOT_FOUND') : ok({ id: '90071992547409939995' }) }
  return ok([], { total: 0, totalPages: 0 })
 }))
 renderWithProviders(<MemoryRouter><Routes><Route path="/" element={<AppointmentBilling appointment={appointment} />} /><Route path="/invoices/:invoiceId" element={<p>Exact created invoice</p>} /></Routes></MemoryRouter>)
 await userEvent.click(await screen.findByRole('button', { name: 'Create invoice' }))
 await screen.findByRole('option', { name: 'Synthetic payer · 00000123' })
 await userEvent.selectOptions(screen.getByLabelText('Insurance'), '90071992547409939996')
 await userEvent.type(screen.getByLabelText('Currency code'), 'ang')
 await userEvent.click(screen.getByRole('button', { name: 'Confirm creation' }))
 const modal = screen.getByRole('dialog'); await within(modal).findByRole('alert')
 expect(screen.getByLabelText('Insurance')).toHaveValue('90071992547409939996'); expect(screen.getByLabelText('Currency code')).toHaveValue('ANG')
 await userEvent.click(screen.getByRole('button', { name: 'Confirm creation' }))
 expect(await screen.findByText('Exact created invoice')).toBeInTheDocument()
 expect(writes).toEqual([{ patientInsuranceId: '90071992547409939996', currencyCode: 'ANG' }, { patientInsuranceId: '90071992547409939996', currencyCode: 'ANG' }])
})
it('retains a rescheduling draft when another operator has started the appointment', async () => {
 session(['appointment.read', 'appointment.update'])
 const submit = vi.fn(); const props = { providers: [], canReadProviders: false, open: true, onOpenChange: vi.fn(), onSubmit: submit, isPending: false }
 const view = renderWithProviders(<MemoryRouter><AppointmentUpdateDialog {...props} appointment={{ ...appointment, status: 'CONFIRMED' }} /></MemoryRouter>)
 await userEvent.type(screen.getByLabelText('Reason'), 'SYNTHETIC retained schedule edit')
 view.rerender(<MemoryRouter><AppointmentUpdateDialog {...props} appointment={{ ...appointment, status: 'IN_PROGRESS' }} /></MemoryRouter>)
 expect(screen.getByLabelText('Reason')).toHaveValue('SYNTHETIC retained schedule edit')
 expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
 expect(screen.getByRole('alert')).toHaveTextContent('can no longer be rescheduled')
 expect(submit).not.toHaveBeenCalled()
})
