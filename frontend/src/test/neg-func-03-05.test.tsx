import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { authStore } from '../auth/auth-store'
import { AdminSettingsPage } from '../features/administration/admin-settings-page'
import { AddDeclarationItemDialog } from '../features/declarations/declaration-candidate-dialog'
import { removeDeclarationItem, cancelDraftDeclaration } from '../features/declarations/declaration-api'
import { DeclarationDraftAction } from '../features/declarations/declaration-draft-actions'
import { TreatmentCasesSection } from '../features/treatment-cases/treatment-cases-section'
import { TreatmentCaseSelector } from '../features/treatment-cases/treatment-case-selector'
import { TreatmentCaseForm } from '../features/treatment-cases/treatment-case-form'
import { AppointmentCreateDialog } from '../features/appointments/appointment-create-dialog'
import { AppointmentUpdateDialog } from '../features/appointments/appointment-update-dialog'
import { ApiError } from '../api'
import type { Appointment } from '../types/appointment'
import { parseDeclarationAssignments } from '../features/billing/declaration-assignment-model'
import type { TreatmentCase } from '../types/treatment-case'
import type { Declaration, DeclarationItem } from '../types/declaration'
import { renderWithProviders } from './test-utils'

const organization = { id: '90071992547409930', legalName: 'QA Clinic', tradeName: null, declarantId: '00001', email: null, phone: null, timezone: 'America/Curacao', updatedAt: '2026-10-31T12:00:00Z', revision: 'a'.repeat(64) }
const caseRecord: TreatmentCase = { id: '90071992547409933', organizationId: '1', patientId: '11', treatmentId: '0000123', treatmentType: 'QA care', description: null, status: 'PLANNED', startedAt: null, completedAt: null, createdAt: '2026-10-31T12:00:00Z', updatedAt: '2026-10-31T12:00:00Z', isEditable: true }
const declaration = { id: '90071992547409935', declarationNumber: 'QAD-QA', status: 'DRAFT', declarantIdSnapshot: null, periodStart: null, periodEnd: null } as Declaration
const item = { id: '90071992547409936', invoiceItemId: '90071992547409937', invoiceNumberSnapshot: 'QAI-QA' } as DeclarationItem
const candidate = { invoiceId: '91', invoiceVersionId: '92', invoiceItemId: item.invoiceItemId, invoiceNumber: 'QAI-QA', versionNumber: 2, detailInvoiceNumber: 'QAI-2-1', serviceDate: '2026-10-31', procedureCode: '001', procedureDescription: 'QA service', providerIdSnapshot: '001', insuredIdSnapshot: '002', amount: '177.60', currencyCode: 'ANG', svbReadiness: 'INCOMPLETE', issues: [{ field: 'Assistance', code: 'DECLARATION_SVB_DATA_INCOMPLETE' }] }
const meta = { page: 1, pageSize: 20, total: 21, totalPages: 2 }
function ok(data: unknown, pagination?: unknown) { return new Response(JSON.stringify({ success: true, data, ...(pagination ? { meta: pagination } : {}) }), { headers: { 'Content-Type': 'application/json' } }) }
function fail(code: string) { return new Response(JSON.stringify({ success: false, error: { code, message: 'private backend detail' } }), { status: 409, headers: { 'Content-Type': 'application/json' } }) }
function session(permissions: string[]) { authStore.setSession('memory-qa', { id: '1', organizationId: '1', email: 'qa@example.test', firstName: 'QA', lastName: 'Test', roles: [], permissions }) }
function render(ui: React.ReactElement) { return renderWithProviders(<MemoryRouter>{ui}</MemoryRouter>) }
afterEach(() => { authStore.clearSession(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('NEG-FE03 organization settings', () => {
  it('reads with an independent permission and renders read-only fields', async () => {
    session(['organization.read']); const fetcher = vi.fn(async () => ok(organization)); vi.stubGlobal('fetch', fetcher); render(<AdminSettingsPage />)
    expect(await screen.findByLabelText('Declarant ID')).toHaveValue('00001'); expect(screen.getByLabelText('Legal name')).toBeDisabled(); expect(screen.queryByRole('button', { name: 'Save settings' })).not.toBeInTheDocument(); expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it.each(['00002', ''])('confirms changing/clearing identity and returns opaque revision (%s)', async (identity) => {
    session(['organization.read', 'organization.update']); const bodies: unknown[] = []
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => { if (init?.method === 'PATCH') { bodies.push(JSON.parse(init.body)); return ok({ ...organization, declarantId: identity || null, revision: 'b'.repeat(64) }) } return ok(organization) }))
    render(<AdminSettingsPage />); await screen.findByLabelText('Declarant ID'); await userEvent.clear(screen.getByLabelText('Declarant ID')); if (identity) await userEvent.type(screen.getByLabelText('Declarant ID'), identity)
    await userEvent.type(screen.getByLabelText('Reason for change'), 'QA identity update'); await userEvent.click(screen.getByRole('button', { name: 'Save settings' })); expect(bodies).toEqual([])
    await userEvent.click(screen.getByRole('button', { name: 'Confirm settings change' })); await screen.findByText('Organization settings saved.')
    expect(bodies).toEqual([{ expectedRevision: organization.revision, reason: 'QA identity update', declarantId: identity || null }])
  })
  it('preserves edits and stale revision during conflict and explicit comparison', async () => {
    session(['organization.read', 'organization.update']); let reads = 0; const bodies: unknown[] = []
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => { if (init?.method === 'PATCH') { bodies.push(JSON.parse(init.body)); return fail('ORGANIZATION_VERSION_CONFLICT') } reads++; return ok(reads > 1 ? { ...organization, legalName: 'Concurrent change', revision: 'b'.repeat(64) } : organization) }))
    render(<AdminSettingsPage />); await screen.findByLabelText('Legal name'); await userEvent.clear(screen.getByLabelText('Legal name')); await userEvent.type(screen.getByLabelText('Legal name'), 'My unsaved clinic'); await userEvent.type(screen.getByLabelText('Reason for change'), 'QA conflict')
    await userEvent.click(screen.getByRole('button', { name: 'Save settings' })); await userEvent.click(await screen.findByRole('button', { name: 'Compare current settings' })); await screen.findByText('Concurrent change'); expect(screen.getByLabelText('Legal name')).toHaveValue('My unsaved clinic')
    await userEvent.click(screen.getByRole('button', { name: 'Save settings' })); await waitFor(() => expect(bodies).toHaveLength(2)); expect(bodies[1]).toMatchObject({ expectedRevision: organization.revision }); expect(screen.queryByText('private backend detail')).not.toBeInTheDocument()
  })
  it('blocks navigation with dirty settings until the user explicitly discards', async () => {
    session(['organization.read', 'organization.update']); vi.stubGlobal('fetch', vi.fn(async () => ok(organization)))
    const router = createMemoryRouter([{ path: '/', element: <AdminSettingsPage /> }, { path: '/next', element: <p>Next page</p> }]); renderWithProviders(<RouterProvider router={router} />)
    await screen.findByLabelText('Legal name'); await userEvent.type(screen.getByLabelText('Legal name'), ' edited'); void router.navigate('/next'); await screen.findByRole('dialog', { name: 'Discard unsaved changes?' }); expect(screen.queryByText('Next page')).not.toBeInTheDocument(); await userEvent.click(screen.getByRole('button', { name: 'Keep editing' })); expect(router.state.location.pathname).toBe('/')
    void router.navigate('/next'); await userEvent.click(await screen.findByRole('button', { name: 'Discard and leave' })); expect(await screen.findByText('Next page')).toBeInTheDocument()
  })
})

describe('NEG-FE04 candidate selection and resolution', () => {
  it('uses server pagination/filters, shows incomplete snapshots and selects the exact string ID', async () => {
    session(['declaration.read', 'invoice.read', 'declaration.update']); const urls: URL[] = []; const submit = vi.fn()
    vi.stubGlobal('fetch', vi.fn(async (url) => { urls.push(new URL(url)); return ok([candidate], meta) }))
    render(<AddDeclarationItemDialog declaration={declaration} pending={false} onClose={vi.fn()} onSubmit={submit} />); await screen.findByText('Incomplete SVB data'); expect(screen.getByText('ANG 177.60')).toBeInTheDocument(); expect(screen.getByText('Assistance: Missing snapshot data')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Next candidates' })); await waitFor(() => expect(urls.at(-1)?.searchParams.get('page')).toBe('2'))
    await userEvent.type(screen.getByLabelText('Search invoice items'), 'QAI'); await userEvent.type(screen.getByLabelText('Service date from'), '2026-10-01'); await userEvent.click(screen.getByRole('button', { name: 'Search candidates' })); await waitFor(() => expect(urls.at(-1)?.searchParams.get('q')).toBe('QAI')); expect(urls.at(-1)?.searchParams.get('page')).toBe('1'); expect(urls.at(-1)?.searchParams.get('from')).toBe('2026-10-01')
    await userEvent.click(await screen.findByRole('button', { name: `Add item ${item.invoiceItemId}` })); expect(submit).toHaveBeenCalledWith({ invoiceItemId: item.invoiceItemId }); expect(screen.queryByLabelText('Invoice item ID')).not.toBeInTheDocument()
  })
  it('renders empty candidates without inventing availability', async () => { session(['declaration.read', 'invoice.read']); vi.stubGlobal('fetch', vi.fn(async () => ok([], { ...meta, total: 0, totalPages: 0 }))); render(<AddDeclarationItemDialog declaration={declaration} pending={false} onClose={vi.fn()} onSubmit={vi.fn()} />); expect(await screen.findByText('No available invoice items match these filters.')).toBeInTheDocument() })
  it('requires invoice.read before requesting candidates', () => { session(['declaration.read', 'declaration.update']); const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher); render(<AddDeclarationItemDialog declaration={declaration} pending={false} onClose={vi.fn()} onSubmit={vi.fn()} />); expect(fetcher).not.toHaveBeenCalled(); expect(screen.getByRole('alert')).toHaveTextContent('invoice.read') })
  it('read-only permission can inspect candidates but cannot add', async () => { session(['declaration.read', 'invoice.read']); vi.stubGlobal('fetch', vi.fn(async () => ok([candidate], meta))); render(<AddDeclarationItemDialog declaration={declaration} pending={false} onClose={vi.fn()} onSubmit={vi.fn()} />); expect(await screen.findByRole('button', { name: `Add item ${item.invoiceItemId}` })).toBeDisabled() })
  it('removes using DeclarationItem.id and sends reason in a DELETE JSON body', async () => { const calls: RequestInit[] = []; const urls: string[] = []; vi.stubGlobal('fetch', vi.fn(async (url, init) => { urls.push(url); calls.push(init); return ok({ ...declaration, items: [] }) })); await removeDeclarationItem(declaration.id, item.id, 'QA removal'); expect(urls[0]).toContain(`/items/${item.id}`); expect(calls[0]?.method).toBe('DELETE'); expect(JSON.parse(calls[0]?.body as string)).toEqual({ reason: 'QA removal' }) })
  it('cancels a draft with a reason and no fabricated status patch', async () => { const fetcher = vi.fn(async () => ok({ ...declaration, status: 'CANCELLED' })); vi.stubGlobal('fetch', fetcher); await cancelDraftDeclaration(declaration.id, 'QA cancellation'); expect(fetcher).toHaveBeenCalledWith(expect.stringContaining(`/declarations/${declaration.id}/cancel`), expect.objectContaining({ method: 'POST', body: JSON.stringify({ reason: 'QA cancellation' }) })) })
  it('keeps a failed removal reason and displays its conflict inside the modal', async () => {
    session(['declaration.update']); vi.stubGlobal('fetch', vi.fn(async () => fail('DECLARATION_ITEM_NOT_FOUND'))); render(<DeclarationDraftAction declaration={declaration} item={item} />)
    await userEvent.click(screen.getByRole('button', { name: `Remove item ${item.id}` })); const modal = screen.getByRole('dialog'); await userEvent.type(within(modal).getByLabelText('Reason'), 'QA preserve reason'); await userEvent.click(within(modal).getByRole('button', { name: 'Remove item' })); await within(modal).findByRole('alert'); expect(within(modal).getByLabelText('Reason')).toHaveValue('QA preserve reason'); expect(screen.queryByText('private backend detail')).not.toBeInTheDocument()
  })
  it('validates assignment error details before constructing links', () => { expect(parseDeclarationAssignments({ assignments: [{ declarationId: '../evil', declarationNumber: null, status: 'DRAFT', items: [] }] })).toEqual([]); expect(parseDeclarationAssignments({ assignments: [{ declarationId: '90071992547409939', declarationNumber: null, status: 'DRAFT', items: [{ declarationItemId: item.id, invoiceItemId: item.invoiceItemId }] }] })[0]?.declarationId).toBe('90071992547409939') })
})

describe('NEG-FE05 patient treatment cases', () => {
  it('clears case selection when the appointment patient changes', async () => {
    session(['patient.read', 'provider.read', 'clinic_location.read', 'treatment_case.read'])
    const urls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      urls.push(String(url)); const path = new URL(url).pathname
      if (path.endsWith('/patients')) return ok([{ id: '11', firstName: 'QA', lastName: 'First', patientNumber: 'P1' }, { id: '22', firstName: 'QA', lastName: 'Second', patientNumber: 'P2' }], meta)
      if (path.endsWith('/providers')) return ok([{ id: '31', firstName: 'QA', lastName: 'Provider' }], meta)
      if (path.endsWith('/clinic-locations')) return ok([{ id: '41', name: 'QA clinic' }])
      if (path.endsWith('/treatment-cases')) return ok(path.includes('/11/') ? [caseRecord] : [], meta)
      return ok(caseRecord)
    }))
    render(<AppointmentCreateDialog onClose={vi.fn()} onCreated={vi.fn()} />); await screen.findByRole('option', { name: 'QA First — P1' }); await userEvent.selectOptions(screen.getByLabelText('Patient', { exact: true }), '11'); await screen.findByRole('option', { name: /0000123/ }); await userEvent.selectOptions(screen.getByLabelText('Treatment case', { exact: true }), caseRecord.id)
    await userEvent.selectOptions(screen.getByLabelText('Patient', { exact: true }), '22'); await waitFor(() => expect(screen.getByLabelText('Treatment case', { exact: true })).toHaveValue('')); expect(screen.queryByRole('option', { name: /0000123/ })).not.toBeInTheDocument(); expect(urls.some((url) => url.includes('/patients/22/treatment-cases?'))).toBe(true)
  })
  it('preserves appointment edits on clinical lock and explicitly retains the recorded reference', async () => {
    session(['treatment_case.read']); vi.stubGlobal('fetch', vi.fn(async () => ok([caseRecord], meta)))
    const record = { id: '71', patientId: '11', providerId: '31', organizationId: '1', treatmentCaseId: null, scheduledStart: '2026-11-01T14:00:00Z', scheduledEnd: '2026-11-01T14:30:00Z', reason: 'Existing reason', notes: '', provider: { id: '31', firstName: 'QA', lastName: 'Provider', isActive: true }, location: { name: 'QA clinic' } } as Appointment
    const submit = vi.fn(); render(<AppointmentUpdateDialog appointment={record} providers={[]} canReadProviders={false} open onOpenChange={vi.fn()} onSubmit={submit} isPending={false} error={new ApiError({ status: 409, code: 'APPOINTMENT_CLINICAL_CONTEXT_LOCKED', message: 'private backend detail' })} />)
    await userEvent.type(screen.getByLabelText('Notes'), 'Keep appointment notes'); expect(screen.getByLabelText('Treatment case', { exact: true })).toBeDisabled(); await userEvent.click(screen.getByRole('button', { name: 'Keep recorded treatment case' })); await userEvent.click(screen.getByRole('button', { name: 'Save changes' })); await waitFor(() => expect(submit).toHaveBeenCalled()); expect(submit.mock.calls[0]?.[0]).toMatchObject({ notes: 'Keep appointment notes' }); expect(submit.mock.calls[0]?.[0]).not.toHaveProperty('treatmentCaseId')
  })
  it('does not request cases without read permission or expose manual keys', () => { session([]); const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher); render(<TreatmentCasesSection patientId="11" active />); expect(fetcher).not.toHaveBeenCalled(); expect(screen.queryByRole('button', { name: 'Create treatment case' })).not.toBeInTheDocument() })
  it('shows server-readonly linked cases without edit/status/delete controls', async () => {
    session(['treatment_case.read', 'treatment_case.manage']); vi.stubGlobal('fetch', vi.fn(async (url) => ok(String(url).includes('?') ? [{ ...caseRecord, isEditable: false }] : { ...caseRecord, isEditable: false }, meta))); render(<TreatmentCasesSection patientId="11" active />)
    await userEvent.click(await screen.findByRole('button', { name: 'View case 0000123' })); const modal = screen.getByRole('dialog'); expect(await within(modal).findByText(/Internal case reference/)).toHaveTextContent(caseRecord.id); expect(within(modal).queryByRole('button', { name: 'Edit treatment case' })).not.toBeInTheDocument(); expect(within(modal).getByText(/This case is read only/)).toBeInTheDocument()
  })
  it('creates an external reference preserving leading zeros and server-owned status', async () => {
    session(['treatment_case.read', 'treatment_case.manage']); const bodies: unknown[] = []; vi.stubGlobal('fetch', vi.fn(async (_url, init) => { bodies.push(JSON.parse(init.body)); return ok(caseRecord) })); const closed = vi.fn(); render(<TreatmentCaseForm patientId="11" onClose={closed} />)
    await userEvent.type(screen.getByLabelText('External treatment ID'), '0000123'); await userEvent.click(screen.getByRole('button', { name: 'Save treatment case' })); await waitFor(() => expect(closed).toHaveBeenCalled()); expect(bodies).toEqual([{ treatmentId: '0000123', treatmentType: null, description: null }])
  })
  it('retains edits on a concurrent first-use rejection and protects dismissal', async () => {
    session(['treatment_case.read', 'treatment_case.manage']); vi.stubGlobal('fetch', vi.fn(async () => fail('TREATMENT_CASE_NOT_EDITABLE'))); const close = vi.fn(); render(<TreatmentCaseForm patientId="11" record={caseRecord} onClose={close} />)
    await userEvent.type(screen.getByLabelText('Description'), 'keep this edit'); await userEvent.click(screen.getByRole('button', { name: 'Save treatment case' })); await screen.findByRole('alert'); expect(screen.getByLabelText('Description')).toHaveValue('keep this edit'); await userEvent.click(screen.getByRole('button', { name: 'Cancel' })); expect(close).not.toHaveBeenCalled(); await userEvent.click(screen.getByRole('button', { name: 'Keep editing' })); expect(screen.getByLabelText('Description')).toHaveValue('keep this edit')
  })
  it('permits read-only selection and excludes a foreign-patient option and closed states', async () => {
    session(['treatment_case.read']); vi.stubGlobal('fetch', vi.fn(async (url) => ok(String(url).includes('?') ? [caseRecord, { ...caseRecord, id: '88', patientId: '22', treatmentId: 'FOREIGN' }, { ...caseRecord, id: '99', status: 'COMPLETED', treatmentId: 'CLOSED' }] : caseRecord, meta)))
    function Selector() { const [value, setValue] = useState(''); return <TreatmentCaseSelector patientId="11" value={value} onChange={setValue} /> }
    render(<Selector />); const option = await screen.findByRole('option', { name: /0000123/ }); expect(option).toBeEnabled(); expect(screen.queryByRole('option', { name: /FOREIGN/ })).not.toBeInTheDocument(); expect(screen.getByRole('option', { name: /CLOSED/ })).toBeDisabled(); await userEvent.selectOptions(screen.getByLabelText('Treatment case'), caseRecord.id); expect(screen.getByLabelText('Treatment case')).toHaveValue(caseRecord.id)
  })
})
