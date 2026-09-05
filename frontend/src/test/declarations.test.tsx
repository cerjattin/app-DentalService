import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { authStore } from '../auth/auth-store'
import {
  addDeclarationItem,
  createDeclaration,
  createDeclarationExport,
  downloadDeclarationExport,
  getDeclaration,
  listDeclarations,
  markDeclarationReady,
  recordSubmissionResult,
  submitDeclaration,
} from '../features/declarations/declaration-api'
import { DeclarationDetailPage } from '../features/declarations/declaration-detail-page'
import { DeclarationsPage } from '../features/declarations/declarations-page'
import type { Declaration, DeclarationStatus } from '../types/declaration'
import { renderWithProviders } from './test-utils'

const declarationId = '90071992547409972001'
const declarationItemId = '90071992547409972002'
const currentInvoiceItemId = '90071992547409972003'
const supersededInvoiceItemId = '90071992547409972004'
const exportId = '90071992547409972005'
const documentId = '90071992547409972006'
const submissionId = '90071992547409972007'
const now = '2027-06-03T14:00:00.000Z'

function declaration(status: DeclarationStatus = 'DRAFT'): Declaration {
  return {
    id: declarationId, organizationId: '1', payerId: '44', declarationNumber: 'QAD-000001', status,
    periodStart: '2027-06-01', periodEnd: '2027-06-30', declarantIdSnapshot: 'QA-DECLARANT', submissionReference: null,
    notes: 'Controlled QA declaration', createdByUserId: '1', readyAt: status === 'DRAFT' ? null : now,
    exportedAt: ['EXPORTED', 'SUBMITTED', 'ACCEPTED'].includes(status) ? now : null,
    submittedAt: ['SUBMITTED', 'ACCEPTED'].includes(status) ? now : null, acceptedAt: status === 'ACCEPTED' ? now : null,
    rejectedAt: null, createdAt: now, updatedAt: now,
    payer: { id: '44', code: 'SVB', name: 'Social Insurance Bank', payerType: 'SVB' },
    items: [item], exports: status === 'DRAFT' || status === 'READY' ? [] : [exportRow], submissions: status === 'SUBMITTED' ? [submission] : [],
  }
}
const item = {
  id: declarationItemId, declarationBatchId: declarationId, invoiceItemId: currentInvoiceItemId, sequenceNumber: 1, lineStatus: 'PENDING',
  declarantIdSnapshot: 'QA-DECLARANT', invoiceNumberSnapshot: 'QAI-000002', detailInvoiceNumberSnapshot: 'QAI-000002-2-1',
  providerIdSnapshot: 'QA-PROVIDER', serviceDateSnapshot: '2027-06-02', insuredIdSnapshot: 'QA-INSURED', accidentFormNumberSnapshot: null,
  treatmentIdSnapshot: 'QA-TREATMENT', amountSnapshot: '200.50', authorizationIdSnapshot: null, numberOfTreatmentsSnapshot: 2,
  assistanceSnapshot: 'N', referrerIdSnapshot: null, diagnosticCodeSnapshot: 'QA-DX', policlinicSnapshot: 'QA-POLI',
  additionalNoteSnapshot: null, responseCode: null, responseMessage: null, createdAt: now, updatedAt: now,
}
const exportRow = {
  id: exportId, declarationBatchId: declarationId, documentId, format: 'CSV' as const, schemaVersion: '1', adapterVersion: '1',
  recordCount: 1, exportedByUserId: '1', exportedAt: now, metadata: null,
  document: { id: documentId, organizationId: '1', documentType: 'DECLARATION_EXPORT', storageProvider: 'LOCAL', originalFilename: 'QAD-000001.csv', mimeType: 'text/csv', sizeBytes: '250', sha256: 'a'.repeat(64), metadata: null, createdByUserId: '1', createdAt: now },
}
const submission = {
  id: submissionId, declarationBatchId: declarationId, declarationExportId: exportId, attemptNumber: 1,
  channel: 'MANUAL' as const, status: 'SUBMITTED' as const, externalReference: 'EXT-QA', requestMetadata: null,
  responseMetadata: null, submittedByUserId: '1', submittedAt: now, respondedAt: null,
}

function ok(data: unknown, meta?: unknown) {
  return new Response(JSON.stringify({ success: true, data, ...(meta ? { meta } : {}) }), { headers: { 'Content-Type': 'application/json' } })
}
function fail(code: string, status = 409) {
  return new Response(JSON.stringify({ success: false, error: { code, message: 'RAW BACKEND MESSAGE' } }), { status, headers: { 'Content-Type': 'application/json' } })
}
function boundary(initialStatus: DeclarationStatus = 'DRAFT') {
  let status = initialStatus
  let rows = initialStatus === 'DRAFT' ? [item] : declaration(initialStatus).items
  let exports = declaration(initialStatus).exports
  let submissions = declaration(initialStatus).submissions
  const calls: { method: string; path: string; body: unknown; search: string }[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
    const parsed = new URL(url)
    const path = parsed.pathname.replace('/api/v1', '')
    const method = init.method ?? 'GET'
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body
    calls.push({ method, path, body, search: parsed.search })
    if (path === '/payers') return ok([{ id: '44', code: 'SVB', name: 'Social Insurance Bank', payerType: 'SVB' }])
    if (path === '/declarations' && method === 'GET') return ok([declaration(status)], { page: 1, pageSize: 20, total: 1, totalPages: 1 })
    if (path === '/declarations' && method === 'POST') return ok(declaration())
    if (path === `/declarations/${declarationId}`) return ok({ ...declaration(status), items: rows, exports, submissions })
    if (path.endsWith('/items') && method === 'GET') return ok(rows)
    if (path.endsWith('/items') && method === 'POST') {
      if ((body as { invoiceItemId: string }).invoiceItemId === supersededInvoiceItemId) return fail('DECLARATION_ITEM_NOT_ELIGIBLE')
      rows = [item]
      return ok(item)
    }
    if (path.endsWith('/ready')) { status = 'READY'; return ok(declaration(status)) }
    if (path.endsWith('/exports') && method === 'GET') return ok(exports)
    if (path.endsWith('/exports') && method === 'POST') { status = 'EXPORTED'; exports = [exportRow]; return ok(exportRow) }
    if (path.endsWith('/submissions') && method === 'GET') return ok(submissions)
    if (path.endsWith('/submit')) { status = 'SUBMITTED'; submissions = [submission]; return ok(submission) }
    if (path.endsWith(`/submissions/${submissionId}/result`)) { status = (body as { status: DeclarationStatus }).status; return ok({ ...submission, ...body, status, respondedAt: now }) }
    if (path.endsWith(`/documents/${documentId}/download`)) return new Response('{"invoice":"QAI-000002"}', { headers: { 'Content-Type': 'application/json' } })
    throw new Error(`Unexpected ${method} ${path}`)
  }))
  return { calls }
}

const readPermissions = ['declaration.read']
const allPermissions = ['declaration.read', 'declaration.create', 'declaration.update', 'declaration.export', 'declaration.submit', 'document.read', 'insurance.read']
function session(permissions = allPermissions) {
  authStore.setSession('memory-f08', { id: '1', organizationId: '1', email: 'qa@example.test', firstName: 'QA', lastName: 'Admin', roles: [], permissions })
}
function renderList(permissions = allPermissions) {
  session(permissions)
  return renderWithProviders(<MemoryRouter initialEntries={['/declarations']}><Routes><Route path="/declarations" element={<DeclarationsPage />} /><Route path="/declarations/:declarationId" element={<DeclarationDetailPage />} /></Routes></MemoryRouter>)
}
function renderDetail(permissions = allPermissions) {
  session(permissions)
  return renderWithProviders(<MemoryRouter initialEntries={[`/declarations/${declarationId}`]}><Routes><Route path="/declarations/:declarationId" element={<DeclarationDetailPage />} /></Routes></MemoryRouter>)
}
afterEach(() => { authStore.clearSession(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('F08 declaration API contract', () => {
  it('lists declarations with only supported query parameters', async () => { const { calls } = boundary(); await listDeclarations({ page: 1, pageSize: 20, q: 'QAD', status: 'DRAFT', payerId: '44' }); expect(calls[0]?.search).toBe('?page=1&pageSize=20&q=QAD&status=DRAFT&payerId=44') })
  it('gets a declaration with its string ID unchanged', async () => { const { calls } = boundary(); expect((await getDeclaration(declarationId)).id).toBe(declarationId); expect(calls[0]?.path).toBe(`/declarations/${declarationId}`) })
  it('creates a declaration without invented fields', async () => { const { calls } = boundary(); await createDeclaration({ payerId: '44', periodStart: '2027-06-01', periodEnd: '2027-06-30' }); expect(calls[0]?.body).toEqual({ payerId: '44', periodStart: '2027-06-01', periodEnd: '2027-06-30' }) })
  it('adds the exact current invoice item ID', async () => { const { calls } = boundary(); await addDeclarationItem(declarationId, currentInvoiceItemId); expect(calls[0]).toMatchObject({ method: 'POST', path: `/declarations/${declarationId}/items`, body: { invoiceItemId: currentInvoiceItemId } }) })
  it('preserves authoritative decimal strings', async () => { boundary(); expect((await getDeclaration(declarationId)).items[0]?.amountSnapshot).toBe('200.50') })
  it('uses the explicit READY transition', async () => { const { calls } = boundary(); await markDeclarationReady(declarationId); expect(calls[0]?.path).toBe(`/declarations/${declarationId}/ready`) })
  it.each(['CSV', 'TXT', 'JSON', 'XML'] as const)('generates the supported %s export', async (format) => { const { calls } = boundary('READY'); await createDeclarationExport(declarationId, format); expect(calls[0]?.body).toEqual({ format }) })
  it('downloads a JSON export as a Blob instead of treating it as an API envelope', async () => { const { calls } = boundary('EXPORTED'); const blob = await downloadDeclarationExport(documentId); expect(blob.type).toBe('application/json'); expect(await blob.text()).toContain('QAI-000002'); expect(calls[0]?.path).toBe(`/documents/${documentId}/download`) })
  it('submits without a fabricated request body', async () => { const { calls } = boundary('EXPORTED'); await submitDeclaration(declarationId); expect(calls[0]).toMatchObject({ method: 'POST', path: `/declarations/${declarationId}/submit`, body: undefined }) })
  it('records a terminal result against the string submission ID', async () => { const { calls } = boundary('SUBMITTED'); await recordSubmissionResult(declarationId, submissionId, { status: 'ACCEPTED', externalReference: 'EXT-QA' }); expect(calls[0]).toMatchObject({ path: `/declarations/${declarationId}/submissions/${submissionId}/result`, body: { status: 'ACCEPTED', externalReference: 'EXT-QA' } }) })
})

describe('F08 declaration workflow UI', () => {
  it('renders declaration loading', () => { session(); vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined))); renderList(); expect(screen.getByText('Loading declarations')).toBeInTheDocument() })
  it('renders an empty declaration list', async () => { session(); vi.stubGlobal('fetch', vi.fn(async () => ok([], { page: 1, pageSize: 20, total: 0, totalPages: 0 }))); renderList(); expect(await screen.findByText('No declarations found')).toBeInTheDocument() })
  it('renders a safe declaration list error', async () => { session(); vi.stubGlobal('fetch', vi.fn(async () => fail('DECLARATION_NOT_FOUND', 404))); renderList(); expect(await screen.findByText('The declaration could not be found.')).toBeInTheDocument() })
  it('renders the declaration list and status', async () => { boundary(); renderList(); expect(await screen.findByText('QAD-000001')).toBeInTheDocument(); expect(screen.getAllByText('Draft')).toHaveLength(2) })
  it('filters declarations through the Backend list query', async () => { const user = userEvent.setup(); const { calls } = boundary(); renderList(); await screen.findByText('QAD-000001'); await user.type(screen.getByPlaceholderText('Declaration number or reference'), 'QA search'); await user.click(screen.getByRole('button', { name: 'Search' })); await waitFor(() => expect(calls.some((call) => call.search.includes('q=QA+search'))).toBe(true)) })
  it('hides declaration creation without its independent permission', async () => { boundary(); renderList(readPermissions); await screen.findByText('QAD-000001'); expect(screen.queryByRole('button', { name: 'Create declaration' })).not.toBeInTheDocument() })
  it('renders declaration snapshots and item data', async () => { boundary(); renderDetail(); expect(await screen.findByText('QAI-000002')).toBeInTheDocument(); expect(screen.getByText('200.50')).toBeInTheDocument(); expect(screen.getByText('QA-TREATMENT')).toBeInTheDocument() })
  it('does not expose draft mutation actions without update permission', async () => { boundary(); renderDetail(readPermissions); await screen.findByText('QAI-000002'); expect(screen.queryByRole('button', { name: 'Add item' })).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Validate and mark ready' })).not.toBeInTheDocument() })
  it('surfaces corrected-version eligibility errors without Backend messages', async () => { const user = userEvent.setup(); boundary(); renderDetail(); await screen.findByText('QAI-000002'); await user.click(screen.getByRole('button', { name: 'Add item' })); await user.type(screen.getByLabelText('Invoice item ID'), supersededInvoiceItemId); await user.click(screen.getByRole('button', { name: 'Add item' })); expect(await screen.findAllByText('This item is not from the current closed invoice version.')).toHaveLength(2); expect(screen.queryByText('RAW BACKEND MESSAGE')).not.toBeInTheDocument() })
  it('keeps READY declarations immutable and exposes export only with permission', async () => { boundary('READY'); renderDetail(); await screen.findByText('QAI-000002'); expect(screen.queryByRole('button', { name: 'Add item' })).not.toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Generate export' })).toBeInTheDocument() })
  it('renders export metadata and an authenticated download action', async () => { boundary('EXPORTED'); renderDetail(); expect(await screen.findByText('QAD-000001.csv')).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument() })
  it('renders immutable submission history and terminal result action', async () => { boundary('SUBMITTED'); renderDetail(); expect(await screen.findByText('EXT-QA')).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Record result' })).toBeInTheDocument() })
  it('does not expose final-state mutations', async () => { boundary('ACCEPTED'); renderDetail(); await screen.findByText('Accepted'); expect(screen.queryByRole('button', { name: 'Add item' })).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Generate export' })).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Submit declaration' })).not.toBeInTheDocument() })
  it('retains authentication after a declaration 403', async () => { session(); vi.stubGlobal('fetch', vi.fn(async () => fail('PERMISSION_DENIED', 403))); await expect(getDeclaration(declarationId)).rejects.toMatchObject({ code: 'PERMISSION_DENIED', status: 403 }); expect(authStore.getAccessToken()).toBe('memory-f08') })
})
