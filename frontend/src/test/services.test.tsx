import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, getApiErrorMessage } from '../api'
import { authStore } from '../auth/auth-store'
import { Sidebar } from '../components/app-shell/sidebar'
import { ServiceDetailPage } from '../features/administration/services/service-detail-page'
import { ServicesPage } from '../features/administration/services/services-page'
import { serviceSchema, tariffSchema } from '../features/administration/services/service-model'
import { CatalogueSearch } from '../features/clinical/catalogue-search'
import { catalogueKeys, searchProcedures } from '../features/clinical/clinical-api'
import { createService, createTariff, getService, getApplicableTariff, invalidateService, invalidateTariffs, listServices, listTariffs, setServiceStatus, svbServiceKeys, updateService, updateTariff } from '../features/svb-catalog/svb-catalog-api'
import { PermissionRoute } from '../routes/permission-route'
import { routePermissions } from '../routes/route-permissions'
import type { SvbProcedure, SvbTariff } from '../types/svb-catalog'
import { renderWithProviders } from './test-utils'

const id = '90071992547409931234'
const tariffId = '90071992547409931235'
const service: SvbProcedure = { id, code: 'QA-M03', description: 'QA service description', category: 'Restorative', unit: 'TOOTH', requiresAuthorization: true, requiresReferral: false, isActive: true, validFrom: '2026-01-01', validTo: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }
const tariff: SvbTariff = { id: tariffId, svbProcedureId: id, amount: '88.80', currencyCode: 'ANG', validFrom: '2026-01-01', validTo: null, isActive: true, createdAt: service.createdAt, updatedAt: service.updatedAt }
const all = ['svb_procedure.read', 'svb_procedure.manage', 'svb_tariff.read', 'svb_tariff.manage']
function session(permissions = all) { authStore.setSession('m03-memory', { id: '1', organizationId: '1', email: 'qa@local.invalid', firstName: 'QA', lastName: 'Admin', roles: [], permissions }) }
function ok(data: unknown, meta?: unknown, status = 200) { return new Response(JSON.stringify({ success: true, data, ...(meta ? { meta } : {}) }), { status, headers: { 'Content-Type': 'application/json' } }) }
function fail(code: string, status = 409) { return new Response(JSON.stringify({ success: false, error: { code, message: 'RAW DATABASE DETAILS' } }), { status, headers: { 'Content-Type': 'application/json' } }) }
function boundary(options: { empty?: boolean; active?: boolean; error?: string; errorMethod?: string; errorCode?: string; status?: number; pages?: number } = {}) {
  let current = { ...service, isActive: options.active ?? true }
  let tariffs = [tariff]
  const calls: { method: string; path: string; query: URLSearchParams; body: unknown }[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
    const parsed = new URL(url); const path = parsed.pathname.replace('/api/v1', ''); const method = init.method ?? 'GET'
    const body: unknown = typeof init.body === 'string' ? JSON.parse(init.body) : undefined
    calls.push({ method, path, query: parsed.searchParams, body })
    if (path === options.error && method === (options.errorMethod ?? 'GET')) return fail(options.errorCode ?? 'SVB_PROCEDURE_NOT_FOUND', options.status)
    if (path === '/svb-procedures' && method === 'GET') {
      const requestedActive = parsed.searchParams.get('isActive')
      const rows = options.empty || (requestedActive && current.isActive !== (requestedActive === 'true')) ? [] : [current]
      return ok(rows, { page: +(parsed.searchParams.get('page') ?? 1), pageSize: 20, total: rows.length, totalPages: options.pages ?? 1 })
    }
    if (path === '/svb-procedures' && method === 'POST') { current = { ...current, ...(body as object) }; return ok(current, undefined, 201) }
    if (path === `/svb-procedures/${id}`) { if (method === 'PATCH') current = { ...current, ...(body as object) }; return ok(current) }
    if (path === `/svb-procedures/${id}/status`) { current = { ...current, ...(body as object) }; return ok(current) }
    if (path.endsWith('/applicable-tariff')) return current.isActive ? ok({ procedure: current, tariff: tariffs[0], serviceDate: '2026-10-28' }) : fail('SVB_PROCEDURE_INACTIVE')
    if (path === `/svb-procedures/${id}/tariffs` && method === 'GET') return ok(tariffs, { page: 1, totalPages: 1, total: tariffs.length, pageSize: 20 })
    if (path === `/svb-procedures/${id}/tariffs` && method === 'POST') { const created = { ...tariff, ...(body as object) }; tariffs = [created]; return ok(created, undefined, 201) }
    if (path === `/svb-procedures/${id}/tariffs/${tariffId}` && method === 'PATCH') { const updated = { ...tariff, ...(body as object) }; tariffs = [updated]; return ok(updated) }
    throw new Error(`Unexpected request: ${method} ${path}`)
  }))
  return { calls }
}
function renderPage(detail = false, permissions = all) {
  session(permissions)
  return renderWithProviders(<MemoryRouter initialEntries={[detail ? `/admin/services/${id}` : '/admin/services']}><Routes><Route path="/admin/services" element={<ServicesPage />} /><Route path="/admin/services/:serviceId" element={<ServiceDetailPage />} /></Routes></MemoryRouter>)
}
const user = () => userEvent.setup()
async function openCreate() { const u = user(); renderPage(); await screen.findByText('QA-M03'); await u.click(screen.getByRole('button', { name: 'Create service' })); return u }
async function fillCreate(u: ReturnType<typeof user>) { await u.type(screen.getByLabelText('Service code / SKU'), 'NEW-QA'); await u.type(screen.getByLabelText('Description'), 'New service') }
afterEach(() => { authStore.clearSession(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('MASTER-03 API and Decimal contracts', () => {
  it('sends only supported service filters and preserves false values', async () => { const { calls } = boundary(); await listServices({ q: 'QA', category: 'Restorative', isActive: false, requiresAuthorization: false, requiresReferral: true, serviceDate: '2026-10-28', page: 2, pageSize: 20 }); expect(Object.fromEntries(calls[0]!.query)).toEqual({ q: 'QA', category: 'Restorative', isActive: 'false', requiresAuthorization: 'false', requiresReferral: 'true', serviceDate: '2026-10-28', page: '2', pageSize: '20' }) })
  it('preserves the detail string ID beyond JS safe integer range', async () => { const { calls } = boundary(); expect((await getService(id)).id).toBe(id); expect(calls[0]?.path).toBe(`/svb-procedures/${id}`) })
  it('creates using the actual service DTO', async () => { const { calls } = boundary(); await createService({ code: 'QA', description: 'Test', requiresReferral: true }); expect(calls[0]).toMatchObject({ method: 'POST', body: { code: 'QA', description: 'Test', requiresReferral: true } }) })
  it('patches service mutable fields', async () => { const { calls } = boundary(); await updateService(id, { unit: null }); expect(calls[0]).toMatchObject({ method: 'PATCH', body: { unit: null } }) })
  it('changes lifecycle through PATCH status and never DELETE', async () => { const { calls } = boundary(); await setServiceStatus(id, false); expect(calls[0]).toMatchObject({ method: 'PATCH', path: `/svb-procedures/${id}/status`, body: { isActive: false } }) })
  it('loads all tariff history without an implicit active filter', async () => { const { calls } = boundary(); await listTariffs(id, { page: 1, pageSize: 20 }); expect(calls[0]?.query.has('isActive')).toBe(false) })
  it('creates a tariff without converting Decimal strings', async () => { const { calls } = boundary(); const body = { amount: '88.80', currencyCode: 'ANG', validFrom: '2026-01-01', validTo: null, isActive: true }; expect((await createTariff(id, body)).amount).toBe('88.80'); expect(calls[0]?.body).toEqual(body) })
  it('scopes tariff edits to both string parent and tariff IDs', async () => { const { calls } = boundary(); await updateTariff(id, tariffId, { amount: '9999999999999.99' }); expect(calls[0]).toMatchObject({ path: `/svb-procedures/${id}/tariffs/${tariffId}`, method: 'PATCH', body: { amount: '9999999999999.99' } }) })
  it('looks up applicable tariff with explicit date and currency', async () => { const { calls } = boundary(); await getApplicableTariff(id, '2026-10-28', 'ANG'); expect(calls[0]?.query.get('currencyCode')).toBe('ANG'); expect(calls[0]?.query.get('serviceDate')).toBe('2026-10-28') })
  it('retains the session after 403', async () => { session(); boundary({ error: '/svb-procedures', errorCode: 'PERMISSION_DENIED', status: 403 }); await expect(listServices({ page: 1, pageSize: 20 })).rejects.toMatchObject({ status: 403 }); expect(authStore.getAccessToken()).toBe('m03-memory') })
})

describe('MASTER-03 permissions, navigation and list', () => {
  it('shows Services navigation with svb_procedure.read', () => { renderWithProviders(<MemoryRouter><Sidebar permissions={['svb_procedure.read']} /></MemoryRouter>); expect(screen.getByRole('link', { name: 'Services' })).toHaveAttribute('href', '/admin/services') })
  it('hides Services navigation without read permission', () => { renderWithProviders(<MemoryRouter><Sidebar permissions={['svb_procedure.manage']} /></MemoryRouter>); expect(screen.queryByRole('link', { name: 'Services' })).not.toBeInTheDocument() })
  it('protects direct routes with the read permission', async () => { session([]); renderWithProviders(<MemoryRouter initialEntries={['/admin/services']}><Routes><Route element={<PermissionRoute anyOf={routePermissions.services} />}><Route path="/admin/services" element={<ServicesPage />} /></Route><Route path="/access-denied" element={<p>Denied route</p>} /></Routes></MemoryRouter>); expect(await screen.findByText('Denied route')).toBeInTheDocument() })
  it('does not request the catalogue without read permission', () => { const { calls } = boundary(); renderPage(false, []); expect(calls).toHaveLength(0); expect(screen.queryByText('Loading services')).not.toBeInTheDocument() })
  it('renders list loading', () => { vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined))); renderPage(); expect(screen.getByText('Loading services')).toBeInTheDocument() })
  it('renders list empty state', async () => { boundary({ empty: true }); renderPage(); expect(await screen.findByText('No services found')).toBeInTheDocument() })
  it('renders a safe list error and retry', async () => { boundary({ error: '/svb-procedures' }); renderPage(); expect(await screen.findByText('Unable to load services')).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument(); expect(screen.queryByText('RAW DATABASE DETAILS')).not.toBeInTheDocument() })
  it('renders service code, description and active status', async () => { boundary(); renderPage(); expect(await screen.findByText('QA-M03')).toBeInTheDocument(); expect(screen.getByText(service.description)).toBeInTheDocument(); expect(screen.getAllByText('Active').length).toBeGreaterThan(0) })
  it('renders inactive services in the administrative list', async () => { boundary({ active: false }); renderPage(); await screen.findByText('QA-M03'); expect(screen.getAllByText('Inactive').length).toBeGreaterThan(0) })
  it('submits search and status/category/requirement filters to Backend', async () => { const { calls } = boundary(); const u = user(); renderPage(); await screen.findByText('QA-M03'); await u.type(screen.getByLabelText('Search services'), 'QA'); await u.selectOptions(screen.getByLabelText('Status'), 'false'); await u.type(screen.getByLabelText('Category'), 'Restorative'); await u.selectOptions(screen.getByLabelText('Authorization'), 'true'); await u.click(screen.getByRole('button', { name: 'Search' })); await waitFor(() => expect(calls.some((c) => c.query.get('q') === 'QA' && c.query.get('isActive') === 'false' && c.query.get('requiresAuthorization') === 'true')).toBe(true)) })
  it('paginates through Backend and preserves filters', async () => { const { calls } = boundary({ pages: 2 }); const u = user(); renderPage(); await screen.findByText('QA-M03'); await u.click(screen.getByRole('button', { name: 'Next page' })); await waitFor(() => expect(calls.some((c) => c.query.get('page') === '2')).toBe(true)) })
  it('hides creation without independent manage permission', async () => { boundary(); renderPage(false, ['svb_procedure.read']); await screen.findByText('QA-M03'); expect(screen.queryByRole('button', { name: 'Create service' })).not.toBeInTheDocument() })
})

describe('MASTER-03 creation, detail and lifecycle', () => {
  it('creates through the form then navigates to string-ID detail', async () => { const { calls } = boundary(); const u = await openCreate(); await fillCreate(u); await u.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Create service' })); expect(await screen.findByText('Service ID')).toBeInTheDocument(); expect(screen.getByText(id)).toBeInTheDocument(); expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ code: 'NEW-QA', description: 'New service', category: null, unit: null, requiresAuthorization: false, requiresReferral: false, isActive: true, validFrom: null, validTo: null }) })
  it('maps duplicate code errors inside the create dialog', async () => { boundary({ error: '/svb-procedures', errorMethod: 'POST', errorCode: 'SVB_PROCEDURE_CODE_ALREADY_EXISTS' }); const u = await openCreate(); await fillCreate(u); await u.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Create service' })); expect(await screen.findByRole('alert')).toHaveTextContent('A service with this code already exists.') })
  it('prevents an obviously inverted service period before POST', async () => { const { calls } = boundary(); const u = await openCreate(); await fillCreate(u); await u.type(screen.getByLabelText('Valid from'), '2026-07-01'); await u.type(screen.getByLabelText('Valid to'), '2026-06-30'); await u.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Create service' })); expect(await screen.findByRole('alert')).toHaveTextContent('Valid to must be on or after valid from.'); expect(calls.some((c) => c.method === 'POST')).toBe(false) })
  it('renders detail, flags, string ID and tariffs', async () => { boundary(); renderPage(true); expect(await screen.findByText(id)).toBeInTheDocument(); expect(await screen.findByText('88.80')).toBeInTheDocument(); expect(screen.getByText('TOOTH')).toBeInTheDocument(); expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument() })
  it('renders detail loading', () => { vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined))); renderPage(true); expect(screen.getByText('Loading service')).toBeInTheDocument() })
  it('renders detail errors', async () => { boundary({ error: `/svb-procedures/${id}` }); renderPage(true); expect(await screen.findByText('Unable to load service')).toBeInTheDocument() })
  it('edits service then refetches detail', async () => { const { calls } = boundary(); const u = user(); renderPage(true); await screen.findByText(id); await u.click(screen.getByRole('button', { name: 'Edit service' })); await u.clear(screen.getByLabelText('Description')); await u.type(screen.getByLabelText('Description'), 'Edited description'); await u.click(screen.getByRole('button', { name: 'Save changes' })); await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument()); expect(await screen.findByText('Edited description')).toBeInTheDocument(); expect(calls.some((c) => c.method === 'PATCH' && c.path === `/svb-procedures/${id}`)).toBe(true) })
  it('requires confirmation before deactivation and updates the detail', async () => { const { calls } = boundary(); const u = user(); renderPage(true); await screen.findByText(id); await u.click(screen.getByRole('button', { name: 'Deactivate service' })); expect(calls.some((c) => c.method === 'PATCH')).toBe(false); await u.click(screen.getByRole('button', { name: 'Confirm' })); expect(await screen.findByRole('button', { name: 'Activate service' })).toBeInTheDocument(); expect(calls.find((c) => c.path.endsWith('/status'))?.body).toEqual({ isActive: false }); expect(calls.some((c) => c.method === 'DELETE')).toBe(false) })
  it('cancels lifecycle confirmation without mutation', async () => { const { calls } = boundary(); const u = user(); renderPage(true); await screen.findByText(id); await u.click(screen.getByRole('button', { name: 'Deactivate service' })); await u.click(screen.getByRole('button', { name: 'Cancel' })); expect(calls.some((c) => c.method === 'PATCH')).toBe(false) })
  it('activates an inactive service', async () => { const { calls } = boundary({ active: false }); const u = user(); renderPage(true); await screen.findByText(id); await u.click(screen.getByRole('button', { name: 'Activate service' })); await u.click(screen.getByRole('button', { name: 'Confirm' })); expect(await screen.findByRole('button', { name: 'Deactivate service' })).toBeInTheDocument(); expect(calls.find((c) => c.path.endsWith('/status'))?.body).toEqual({ isActive: true }) })
  it('shows status errors within confirmation and keeps the session', async () => { boundary({ error: `/svb-procedures/${id}/status`, errorMethod: 'PATCH', errorCode: 'PERMISSION_DENIED', status: 403 }); const u = user(); renderPage(true); await screen.findByText(id); await u.click(screen.getByRole('button', { name: 'Deactivate service' })); await u.click(screen.getByRole('button', { name: 'Confirm' })); expect(await screen.findByRole('alert')).toHaveTextContent("You don't have permission"); expect(screen.getByRole('dialog')).toBeInTheDocument(); expect(authStore.getAccessToken()).toBe('m03-memory') })
  it('hides service mutations without manage permission', async () => { boundary(); renderPage(true, ['svb_procedure.read']); await screen.findByText(id); expect(screen.queryByRole('button', { name: 'Edit service' })).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Deactivate service' })).not.toBeInTheDocument() })
})

describe('MASTER-03 tariff administration', () => {
  it('does not fetch tariff data without tariff.read', async () => { const { calls } = boundary(); renderPage(true, ['svb_procedure.read']); await screen.findByText(id); expect(screen.getByText('You do not have permission to view tariffs.')).toBeInTheDocument(); expect(calls.some((c) => c.path.includes('/tariffs'))).toBe(false) })
  it('shows read-only history without tariff.manage', async () => { boundary(); renderPage(true, ['svb_procedure.read', 'svb_tariff.read']); await screen.findByText('88.80'); expect(screen.queryByRole('button', { name: 'Add tariff' })).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Edit tariff' })).not.toBeInTheDocument() })
  it('allows tariff create with manage independently of tariff.read', async () => { boundary(); renderPage(true, ['svb_procedure.read', 'svb_tariff.manage']); await screen.findByText(id); expect(screen.getByRole('button', { name: 'Add tariff' })).toBeInTheDocument(); expect(screen.getByText('You do not have permission to view tariffs.')).toBeInTheDocument() })
  it('renders tariff load errors', async () => { boundary({ error: `/svb-procedures/${id}/tariffs` }); renderPage(true); expect(await screen.findByText('Unable to load tariffs')).toBeInTheDocument() })
  it('creates a tariff through the form preserving trailing zeros and explicit currency', async () => { const { calls } = boundary(); const u = user(); renderPage(true); await screen.findByText('88.80'); await u.click(screen.getByRole('button', { name: 'Add tariff' })); expect(screen.getByLabelText('Currency code', { selector: '#tariff-currency' })).toHaveValue(''); await u.type(screen.getByLabelText('Amount'), '99.90'); await u.type(screen.getByLabelText('Currency code', { selector: '#tariff-currency' }), 'ang'); await u.type(screen.getByLabelText('Valid from'), '2026-07-01'); await u.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add tariff' })); expect(await screen.findByText('99.90')).toBeInTheDocument(); expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ amount: '99.90', currencyCode: 'ANG', validFrom: '2026-07-01', validTo: null, isActive: true }) })
  it('edits tariff amount and active status through scoped PATCH', async () => { const { calls } = boundary(); const u = user(); renderPage(true); await screen.findByText('88.80'); await u.click(screen.getByRole('button', { name: 'Edit tariff' })); await u.clear(screen.getByLabelText('Amount')); await u.type(screen.getByLabelText('Amount'), '89.90'); await u.click(screen.getByLabelText('Active tariff')); await u.click(screen.getByRole('button', { name: 'Save tariff' })); expect(await screen.findByText('89.90')).toBeInTheDocument(); expect(calls.find((c) => c.method === 'PATCH')?.body).toMatchObject({ amount: '89.90', isActive: false }) })
  it('shows Backend overlap error and retains the entered amount', async () => { boundary({ error: `/svb-procedures/${id}/tariffs/${tariffId}`, errorMethod: 'PATCH', errorCode: 'SVB_TARIFF_PERIOD_OVERLAP' }); const u = user(); renderPage(true); await screen.findByText('88.80'); await u.click(screen.getByRole('button', { name: 'Edit tariff' })); await u.click(screen.getByRole('button', { name: 'Save tariff' })); expect(await screen.findByRole('alert')).toHaveTextContent('overlaps another active tariff'); expect(screen.getByLabelText('Amount')).toHaveValue('88.80'); expect(screen.queryByText('RAW DATABASE DETAILS')).not.toBeInTheDocument() })
  it('looks up an applicable tariff separately from history', async () => { boundary(); const u = user(); renderPage(true); await screen.findByText('88.80'); await u.type(screen.getByLabelText('Service date'), '2026-10-28'); await u.type(screen.getByLabelText('Currency code'), 'ANG'); await u.click(screen.getByRole('button', { name: 'Look up tariff' })); expect(await screen.findByText('ANG 88.80')).toBeInTheDocument(); expect(screen.getByRole('region', { name: 'Tariff history' })).toBeInTheDocument() })
})

describe('MASTER-03 targeted cache and Clinical regression', () => {
  it('shares the exact list and applicable tariff query keys with Clinical', () => { expect(catalogueKeys.procedures('QA', 1, '2026-10-28')).toEqual(svbServiceKeys.list({ q: 'QA', page: 1, pageSize: 20, isActive: true, serviceDate: '2026-10-28' })); expect(catalogueKeys.tariff(id, '2026-10-28')).toEqual(svbServiceKeys.applicableTariff(id, '2026-10-28', 'ANG')) })
  it('invalidates both catalogue experiences and selected detail without invalidating history snapshots', async () => {
    const client = new QueryClient()
    const keys = [svbServiceKeys.list({ page: 1, pageSize: 20 }), catalogueKeys.procedures('', 1, '2026-10-28'), svbServiceKeys.detail(id), catalogueKeys.tariff(id, '2026-10-28'), svbServiceKeys.detail('other'), ['clinical-encounter', '1', 'procedures'], ['invoices', '1']]
    keys.forEach((key) => client.setQueryData(key, { snapshot: 'Unchanged' }))
    await invalidateService(client, id)
    expect(keys.map((key) => client.getQueryState(key)?.isInvalidated)).toEqual([true, true, true, true, false, false, false])
    expect(client.getQueryData(keys[5]!)).toEqual({ snapshot: 'Unchanged' })
  })
  it('invalidates only selected tariff history and applicable queries after tariff mutation', async () => {
    const client = new QueryClient()
    const keys = [svbServiceKeys.tariffs(id, { page: 1, pageSize: 20 }), catalogueKeys.tariff(id, '2026-10-28'), svbServiceKeys.detail(id), svbServiceKeys.list({ page: 1, pageSize: 20 }), svbServiceKeys.tariffs('other', { page: 1, pageSize: 20 })]
    keys.forEach((key) => client.setQueryData(key, {})); await invalidateTariffs(client, id)
    expect(keys.map((key) => client.getQueryState(key)?.isInvalidated)).toEqual([true, true, false, false, false])
  })
  it('Clinical active catalogue still uses Backend active/date filters', async () => { const { calls } = boundary(); const rows = await searchProcedures('QA', 1, '2026-10-28'); expect(rows.data[0]?.id).toBe(id); expect(Object.fromEntries(calls[0]!.query)).toMatchObject({ isActive: 'true', serviceDate: '2026-10-28' }) })
  it('inactive services are excluded from the actual Clinical selector', async () => { boundary({ active: false }); session(); renderWithProviders(<CatalogueSearch kind="procedure" serviceDate="2026-10-28" onSelect={() => undefined} />); expect(await screen.findByText('No matching codes found.')).toBeInTheDocument(); expect(screen.queryByText('QA-M03')).not.toBeInTheDocument() })
})

describe('MASTER-03 date/decimal and error behavior', () => {
  it('rejects float/exponent/negative/excess-precision amounts as strings', () => { for (const amount of ['1e3', '-1.00', '1.234', '10000000000000.00']) expect(tariffSchema.safeParse({ amount, currencyCode: 'ANG', validFrom: '2026-01-01', validTo: '', isActive: true }).success).toBe(false) })
  it('validates tariff periods and real calendar dates without implementing overlap rules', () => { expect(tariffSchema.safeParse({ amount: '88.80', currencyCode: 'ANG', validFrom: '2026-07-01', validTo: '2026-06-30', isActive: true }).success).toBe(false); expect(tariffSchema.safeParse({ amount: '88.80', currencyCode: 'ANG', validFrom: '2026-02-30', validTo: '', isActive: true }).success).toBe(false) })
  it('accepts open procedure bounds and exact maximum Decimal strings', () => { expect(serviceSchema.safeParse({ code: 'QA', description: 'QA', category: '', unit: '', requiresAuthorization: false, requiresReferral: false, isActive: true, validFrom: '', validTo: '' }).success).toBe(true); expect(tariffSchema.parse({ amount: '9999999999999.99', currencyCode: 'ANG', validFrom: '2026-01-01', validTo: '', isActive: true }).amount).toBe('9999999999999.99') })
  it.each(['SVB_PROCEDURE_CODE_ALREADY_EXISTS', 'INVALID_SVB_PROCEDURE_PERIOD', 'SVB_PROCEDURE_NOT_FOUND', 'SVB_PROCEDURE_INACTIVE', 'SVB_TARIFF_NOT_FOUND', 'SVB_TARIFF_ALREADY_EXISTS', 'INVALID_SVB_TARIFF_PERIOD', 'SVB_TARIFF_PERIOD_OVERLAP'])('maps exact Backend error %s', (code) => { const message = getApiErrorMessage(new ApiError({ code, message: 'RAW DATABASE DETAILS', status: 409 })); expect(message).not.toBe('Unexpected backend error.'); expect(message).not.toContain('RAW') })
})
