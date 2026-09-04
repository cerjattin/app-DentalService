import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { authStore } from '../auth/auth-store'
import {
  captureSignature,
  createCorrectionReplacement,
  generateInvoicePdf,
  listInvoiceCorrections,
  requestInvoiceCorrection,
  resolveInvoiceCorrection,
  transitionInvoice,
  updateCorrectionItem,
} from '../features/billing/billing-api'
import { InvoiceDetailPage } from '../features/billing/invoice-detail-page'
import { renderWithProviders } from './test-utils'

const invoiceId = '90071992547409971001'
const originalVersionId = '90071992547409971002'
const replacementVersionId = '90071992547409971003'
const correctionId = '90071992547409971004'
const originalItemId = '90071992547409971005'
const replacementItemId = '90071992547409971006'
const now = '2027-05-12T14:00:00.000Z'
const hash = 'b'.repeat(64)

const item = {
  id: originalItemId,
  invoiceVersionId: originalVersionId,
  lineNumber: 1,
  detailInvoiceNumber: 'QA-CORR-01',
  encounterProcedureId: '501',
  sourceInvoiceItemId: null,
  svbProcedureId: '502',
  svbTariffId: '503',
  serviceDateSnapshot: '2027-05-12',
  procedureCodeSnapshot: 'QA-PROC',
  procedureDescriptionSnapshot: 'QA correction procedure',
  providerIdSnapshot: 'QA-PROVIDER',
  insuredIdSnapshot: 'QA-INSURED',
  unitTariffSnapshot: '120.50',
  currencyCodeSnapshot: 'ANG',
  quantity: '2.00',
  amount: '241.00',
  authorizationIdSnapshot: null,
  diagnosticCodeSnapshot: 'QA-DX',
  treatmentIdSnapshot: 'QA-TREATMENT',
  accidentFormNumberSnapshot: null,
  numberOfTreatmentsSnapshot: null,
  assistanceSnapshot: null,
  referrerIdSnapshot: null,
  policlinicSnapshot: 'QA-POLI',
  additionalNote: null,
  createdAt: now,
  updatedAt: now,
}
const original = {
  id: originalVersionId,
  invoiceId,
  versionNumber: 1,
  versionType: 'ORIGINAL',
  supersedesVersionId: null,
  status: 'CLOSED',
  invoiceDate: '2027-05-12',
  currencyCode: 'ANG',
  totalAmount: '241.00',
  declarantIdSnapshot: 'QA-DECLARANT',
  patientNameSnapshot: 'QA Correction Patient',
  patientDocumentTypeSnapshot: 'QA',
  patientDocumentNumberSnapshot: 'QA-CORR-PATIENT',
  insuredIdSnapshot: 'QA-INSURED',
  contentHash: hash,
  preparedByUserId: '1',
  lockedAt: now,
  signedAt: now,
  closedAt: now,
  supersededAt: null,
  createdAt: now,
  updatedAt: now,
  items: [item],
}
const correction = {
  id: correctionId,
  invoiceId,
  sourceVersionId: originalVersionId,
  replacementVersionId: null as string | null,
  reasonCode: 'QA_CORRECTION',
  reasonText: 'Controlled QA correction',
  status: 'REQUESTED',
  requestedByUserId: '1',
  requestedAt: now,
  approvedByUserId: null,
  approvedAt: null,
  resolvedByUserId: null,
  resolvedAt: null,
  metadata: null,
  createdAt: now,
  updatedAt: now,
  sourceVersion: original,
  replacementVersion: null,
}

function ok(data: unknown) {
  return new Response(JSON.stringify({ success: true, data }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
function fail(code: string, status = 409) {
  return new Response(
    JSON.stringify({ success: false, error: { code, message: 'RAW' } }),
    { status, headers: { 'Content-Type': 'application/json' } },
  )
}

function boundary(options: { correctionStatus?: string; replacement?: boolean; failPath?: string; failCode?: string; failStatus?: number } = {}) {
  let replacement = options.replacement ?? false
  let correctionStatus = options.correctionStatus ?? 'REQUESTED'
  let replacementItem = {
    ...item,
    id: replacementItemId,
    invoiceVersionId: replacementVersionId,
    sourceInvoiceItemId: originalItemId,
  }
  const calls: { method: string; path: string; body: unknown }[] = []
  const replacementVersion = () => ({
    ...original,
    id: replacementVersionId,
    versionNumber: 2,
    versionType: 'CORRECTION',
    supersedesVersionId: originalVersionId,
    status: 'DRAFT',
    contentHash: null,
    lockedAt: null,
    signedAt: null,
    closedAt: null,
    items: [replacementItem],
  })
  const invoice = () => ({
    id: invoiceId,
    organizationId: '1',
    appointmentId: '601',
    patientId: '602',
    patientInsuranceId: '603',
    invoiceNumber: 'QA-CORRECTION-1',
    status: replacement || correctionStatus === 'REQUESTED' || correctionStatus === 'APPROVED' ? 'CORRECTION_REQUIRED' : 'CLOSED',
    currentVersionId: replacement ? replacementVersionId : originalVersionId,
    createdByUserId: '1',
    cancelledByUserId: null,
    cancelledAt: null,
    cancellationReason: null,
    createdAt: now,
    updatedAt: now,
    appointment: { id: '601', appointmentNumber: 'QA-APPT', scheduledStartAt: now, scheduledEndAt: now, status: 'COMPLETED' },
    patient: { id: '602', patientNumber: 'QA-PATIENT', firstName: 'QA', middleName: null, lastName: 'Correction', secondLastName: null, documentType: 'QA', documentNumber: 'QA-CORR-PATIENT' },
    patientInsurance: { id: '603', insuredId: 'QA-INSURED', status: 'ACTIVE', payer: { id: '604', code: 'QA', name: 'QA Payer' } },
    currentVersion: replacement ? replacementVersion() : original,
    versions: replacement ? [{ ...original, status: 'CLOSED' }, replacementVersion()] : [original],
  })
  const correctionSnapshot = () => ({
    ...correction,
    status: correctionStatus,
    replacementVersionId: replacement ? replacementVersionId : null,
    replacementVersion: replacement ? replacementVersion() : null,
  })
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
    const parsed = new URL(url)
    const path = parsed.pathname.replace('/api/v1', '')
    const method = init.method ?? 'GET'
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body
    calls.push({ method, path, body })
    if (`${method} ${path}` === options.failPath) return fail(options.failCode ?? 'INVOICE_CORRECTION_NOT_APPROVABLE', options.failStatus)
    if (path === `/invoices/${invoiceId}`) return ok(invoice())
    if (path === `/invoices/${invoiceId}/corrections` && method === 'GET') return ok([correctionSnapshot()])
    if (path === `/invoices/${invoiceId}/corrections` && method === 'POST') { correctionStatus = 'REQUESTED'; return ok(correctionSnapshot()) }
    if (path.endsWith('/approve')) { correctionStatus = 'APPROVED'; return ok(correctionSnapshot()) }
    if (path.endsWith('/reject')) { correctionStatus = 'REJECTED'; return ok(correctionSnapshot()) }
    if (path.endsWith('/cancel')) { correctionStatus = 'CANCELLED'; return ok(correctionSnapshot()) }
    if (path.endsWith('/replacement')) { replacement = true; return ok(correctionSnapshot()) }
    if (path === `/invoices/${invoiceId}/status-history`) return ok([{ id: '701', invoiceId, invoiceVersionId: originalVersionId, oldStatus: 'CLOSED', newStatus: 'CORRECTION_REQUIRED', reason: null, changedByUserId: '1', changedAt: now, metadata: null }])
    if (path === `/invoices/${invoiceId}/versions/${originalVersionId}`) return ok(original)
    if (path === `/invoices/${invoiceId}/versions/${replacementVersionId}` && method === 'GET') return ok(replacementVersion())
    if (path.endsWith(`/items/${replacementItemId}`)) { replacementItem = { ...replacementItem, ...(body as object), amount: '250.00' }; return ok(replacementItem) }
    if (path.endsWith('/signatures')) return ok([])
    if (path.endsWith('/documents')) return ok([])
    if (path.endsWith('/prepare-signature') || path.endsWith('/sign') || path.endsWith('/close') || path.endsWith('/pdf')) return ok(invoice())
    throw new Error(`Unexpected ${method} ${path}`)
  }))
  return { calls, original, replacementVersion }
}

const allPermissions = ['invoice.read', 'invoice.request_correction', 'invoice.apply_correction', 'invoice.prepare_signature', 'signature.capture', 'document.upload', 'invoice.sign', 'invoice.close', 'document.read', 'document.generate']
function renderDetail(permissions = allPermissions) {
  authStore.setSession('memory-f07', { id: '1', organizationId: '1', email: 'qa@example.test', firstName: 'QA', lastName: 'Admin', roles: [], permissions })
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/invoices/${invoiceId}`]}>
      <Routes><Route path="/invoices/:invoiceId" element={<InvoiceDetailPage />} /></Routes>
    </MemoryRouter>,
  )
}
afterEach(() => { authStore.clearSession(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('F07 correction API contract', () => {
  it('lists corrections with the exact logical invoice ID', async () => {
    const { calls } = boundary()
    expect((await listInvoiceCorrections(invoiceId))[0]?.sourceVersionId).toBe(originalVersionId)
    expect(calls[0]?.path).toBe(`/invoices/${invoiceId}/corrections`)
  })
  it('requests a correction without invented fields', async () => {
    const { calls } = boundary()
    await requestInvoiceCorrection(invoiceId, { reasonCode: 'QA', reasonText: 'QA reason' })
    expect(calls[0]).toEqual({ method: 'POST', path: `/invoices/${invoiceId}/corrections`, body: { reasonCode: 'QA', reasonText: 'QA reason' } })
  })
  it.each(['approve', 'reject', 'cancel'] as const)('uses the documented %s transition', async (operation) => {
    const { calls } = boundary()
    await resolveInvoiceCorrection(invoiceId, correctionId, operation, operation === 'approve' ? undefined : { reason: 'QA resolution' })
    expect(calls[0]?.path).toBe(`/invoices/${invoiceId}/corrections/${correctionId}/${operation}`)
  })
  it('creates the replacement without copying data in the client', async () => {
    const { calls } = boundary({ correctionStatus: 'APPROVED' })
    await createCorrectionReplacement(invoiceId, correctionId)
    expect(calls[0]).toEqual({ method: 'POST', path: `/invoices/${invoiceId}/corrections/${correctionId}/replacement`, body: undefined })
  })
  it('patches only the replacement item using string IDs and decimals', async () => {
    const { calls } = boundary({ correctionStatus: 'APPROVED', replacement: true })
    await updateCorrectionItem(invoiceId, replacementVersionId, replacementItemId, { unitTariffSnapshot: '125.00', quantity: '2.00' })
    expect(calls[0]).toEqual({ method: 'PATCH', path: `/invoices/${invoiceId}/versions/${replacementVersionId}/items/${replacementItemId}`, body: { unitTariffSnapshot: '125.00', quantity: '2.00' } })
  })
  it('keeps signature, close and PDF associated with the replacement version', async () => {
    const { calls } = boundary({ replacement: true })
    await captureSignature(invoiceId, replacementVersionId, { signatureDocumentId: '801', signatureType: 'OTHER', captureMethod: 'MOUSE', expectedContentHash: hash, signerName: 'QA signer' })
    await transitionInvoice(invoiceId, replacementVersionId, 'close')
    await generateInvoicePdf(invoiceId, replacementVersionId)
    expect(calls.map((call) => call.path)).toEqual([
      `/invoices/${invoiceId}/versions/${replacementVersionId}/signatures`,
      `/invoices/${invoiceId}/versions/${replacementVersionId}/close`,
      `/invoices/${invoiceId}/versions/${replacementVersionId}/pdf`,
    ])
  })
})

describe('F07 correction workflow UI', () => {
  it('shows correction request only for a closed current version with permission', async () => {
    boundary({ correctionStatus: 'REJECTED' })
    renderDetail()
    expect(await screen.findByRole('button', { name: 'Request correction' })).toBeInTheDocument()
  })
  it('does not imply correction rights from invoice read', async () => {
    boundary({ correctionStatus: 'REJECTED' })
    renderDetail(['invoice.read'])
    await screen.findByText('Controlled QA correction')
    expect(screen.queryByRole('button', { name: 'Request correction' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
  })
  it('submits a correction request through the accessible form', async () => {
    const { calls } = boundary({ correctionStatus: 'REJECTED' })
    renderDetail()
    await userEvent.click(await screen.findByRole('button', { name: 'Request correction' }))
    const dialog = screen.getByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('Reason code'), 'DATA_FIX')
    await userEvent.type(within(dialog).getByLabelText('Correction reason'), 'Correct the QA snapshot')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Request correction' }))
    await screen.findByText('Correction requested.')
    expect(calls.some((call) => call.method === 'POST' && call.body && (call.body as { reasonCode?: string }).reasonCode === 'DATA_FIX')).toBe(true)
  })
  it('supports approval and rejection as separate authoritative transitions', async () => {
    const { calls } = boundary()
    renderDetail()
    await userEvent.click(await screen.findByRole('button', { name: 'Approve' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm' }))
    await screen.findByText('Correction approved.')
    expect(calls.some((call) => call.path.endsWith('/approve'))).toBe(true)
  })
  it('creates a replacement and keeps the original historical version', async () => {
    const { calls } = boundary({ correctionStatus: 'APPROVED' })
    renderDetail()
    await userEvent.click(await screen.findByRole('button', { name: 'Create replacement version' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm' }))
    expect(await screen.findByText('Version 2 - Correction')).toBeInTheDocument()
    expect(screen.getByText(originalVersionId)).toBeInTheDocument()
    expect(calls.some((call) => call.path.endsWith('/replacement'))).toBe(true)
  })
  it('shows version relationships and status history', async () => {
    boundary({ correctionStatus: 'APPROVED', replacement: true })
    renderDetail()
    expect(await screen.findByText(/replacement version 2/)).toBeInTheDocument()
    await userEvent.click(screen.getByText('Invoice status history'))
    expect(screen.getByText('Closed to Correction required')).toBeInTheDocument()
  })
  it('edits only a draft replacement item and preserves decimal strings', async () => {
    const { calls } = boundary({ correctionStatus: 'APPROVED', replacement: true })
    renderDetail()
    await userEvent.click(await screen.findByRole('button', { name: 'Edit item' }))
    const dialog = screen.getByRole('dialog')
    const tariff = within(dialog).getByLabelText('Unit tariff')
    await userEvent.clear(tariff)
    await userEvent.type(tariff, '125.00')
    await userEvent.type(within(dialog).getByLabelText('Additional note'), 'Controlled F07 change')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save correction item' }))
    await screen.findByText('Correction item updated.')
    const patchCall = calls.find((call) => call.method === 'PATCH')
    expect(patchCall?.path).toContain(`/versions/${replacementVersionId}/items/${replacementItemId}`)
    expect((patchCall?.body as { unitTariffSnapshot: unknown }).unitTariffSnapshot).toBe('125.00')
  })
  it('never exposes item editing on the closed original version', async () => {
    boundary({ correctionStatus: 'APPROVED', replacement: true })
    renderDetail()
    await screen.findByRole('button', { name: 'Edit item' })
    await userEvent.selectOptions(screen.getByLabelText('Invoice version'), originalVersionId)
    await screen.findByText('Version 1 - Original')
    expect(screen.queryByRole('button', { name: 'Edit item' })).not.toBeInTheDocument()
    expect(screen.getByText('This version is read only.')).toBeInTheDocument()
  })
  it('maps invalid correction state without exposing Backend text', async () => {
    boundary({ failPath: `POST /invoices/${invoiceId}/corrections/${correctionId}/approve`, failCode: 'INVOICE_CORRECTION_NOT_APPROVABLE' })
    renderDetail()
    await userEvent.click(await screen.findByRole('button', { name: 'Approve' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm' }))
    expect(await screen.findByText('Only a requested correction can be approved.')).toBeInTheDocument()
    expect(screen.queryByText('RAW')).not.toBeInTheDocument()
  })
  it('preserves authentication on correction 403', async () => {
    boundary({ failPath: `POST /invoices/${invoiceId}/corrections/${correctionId}/approve`, failCode: 'PERMISSION_DENIED', failStatus: 403 })
    renderDetail()
    await userEvent.click(await screen.findByRole('button', { name: 'Approve' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(screen.getByText("You don't have permission to access this area.")).toBeInTheDocument())
    expect(authStore.getAccessToken()).toBe('memory-f07')
  })
})
