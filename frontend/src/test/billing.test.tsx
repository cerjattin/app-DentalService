import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { authStore } from '../auth/auth-store'
import { InvoiceDetailPage } from '../features/billing/invoice-detail-page'
import { InvoicesPage } from '../features/billing/invoices-page'
import { AppointmentBilling } from '../features/billing/appointment-billing'
import {
  createInvoice,
  downloadDocument,
  getInvoice,
  getInvoiceVersion,
  listInvoices,
  transitionInvoice,
  uploadSignature,
} from '../features/billing/billing-api'
import { signerSchema } from '../features/billing/billing-model'
import type { Appointment } from '../types/appointment'
import { renderWithProviders } from './test-utils'

const iid = '90071992547409939999'
const vid = '90071992547409938888'
const aid = '90071992547409937777'
const docid = '90071992547409936666'
const hash = 'a'.repeat(64)
const permissions = [
  'invoice.read',
  'invoice.create',
  'invoice.prepare_signature',
  'signature.capture',
  'document.upload',
  'invoice.sign',
  'invoice.close',
  'document.read',
  'document.generate',
  'appointment.read',
]
const item = {
  id: '90071992547409930001',
  invoiceVersionId: vid,
  lineNumber: 1,
  detailInvoiceNumber: 'QA-INVOICE-1-01',
  encounterProcedureId: '71',
  sourceInvoiceItemId: null,
  svbProcedureId: '81',
  svbTariffId: '91',
  serviceDateSnapshot: '2027-03-10',
  procedureCodeSnapshot: 'QA-PROC-A',
  procedureDescriptionSnapshot: 'QA examination',
  providerIdSnapshot: 'QA-PROVIDER',
  insuredIdSnapshot: 'QA-INSURED',
  unitTariffSnapshot: '75.10',
  currencyCodeSnapshot: 'ANG',
  quantity: '2.00',
  amount: '150.20',
  authorizationIdSnapshot: null,
  diagnosticCodeSnapshot: 'QA-DX',
  treatmentIdSnapshot: 'TC-SERVER',
  accidentFormNumberSnapshot: null,
  numberOfTreatmentsSnapshot: null,
  assistanceSnapshot: null,
  referrerIdSnapshot: null,
  policlinicSnapshot: 'POLI-SERVER',
  additionalNote: null,
  createdAt: '2027-03-10T13:00:00Z',
  updatedAt: '2027-03-10T13:00:00Z',
}
const version = {
  id: vid,
  invoiceId: iid,
  versionNumber: 1,
  versionType: 'ORIGINAL',
  supersedesVersionId: null,
  status: 'DRAFT',
  invoiceDate: '2027-03-10',
  currencyCode: 'ANG',
  totalAmount: '275.70',
  declarantIdSnapshot: 'QA-DECLARANT',
  patientNameSnapshot: 'QA Patient',
  patientDocumentTypeSnapshot: 'QA',
  patientDocumentNumberSnapshot: 'QA-DOCUMENT',
  insuredIdSnapshot: 'QA-INSURED',
  contentHash: null as string | null,
  preparedByUserId: '11',
  lockedAt: null as string | null,
  signedAt: null as string | null,
  closedAt: null as string | null,
  supersededAt: null,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
  items: [
    item,
    {
      ...item,
      id: '90071992547409930002',
      lineNumber: 2,
      procedureCodeSnapshot: 'QA-PROC-B',
      quantity: '1.00',
      unitTariffSnapshot: '125.50',
      amount: '125.50',
    },
  ],
}
const invoice = {
  id: iid,
  organizationId: '1',
  appointmentId: aid,
  patientId: '101',
  patientInsuranceId: '102',
  invoiceNumber: 'QA-INVOICE-1',
  status: 'DRAFT',
  currentVersionId: vid,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
  appointment: {
    id: aid,
    appointmentNumber: 'QA-APPOINTMENT',
    scheduledStartAt: item.createdAt,
    scheduledEndAt: item.createdAt,
    status: 'COMPLETED',
  },
  patient: {
    id: '101',
    patientNumber: 'QA-PATIENT-1',
    firstName: 'QA',
    lastName: 'Patient',
    middleName: null,
    secondLastName: null,
  },
  patientInsurance: {
    id: '102',
    insuredId: 'QA-INSURED',
    status: 'ACTIVE',
    payer: { id: '103', name: 'QA Payer', code: 'QA' },
  },
  currentVersion: version,
  versions: [version],
}
const document = {
  id: docid,
  originalFilename: 'QA-INVOICE-1.pdf',
  mimeType: 'application/pdf',
  sizeBytes: '9999',
  documentType: 'SIGNED_INVOICE_PDF',
  createdAt: item.createdAt,
}
const documentLink = {
  id: '1111',
  invoiceVersionId: vid,
  documentId: docid,
  documentRole: 'SIGNED_INVOICE_PDF',
  document,
}
const signature = {
  id: '2222',
  invoiceVersionId: vid,
  signatureDocumentId: docid,
  patientId: '101',
  signatureType: 'PATIENT',
  signerName: 'QA Patient',
  signerRelationship: null,
  captureMethod: 'MOUSE',
  signedContentHash: hash,
  signatureHash: hash,
  status: 'VALID',
  signedAt: item.createdAt,
  document,
}
function ok(data: unknown, meta?: unknown) {
  return new Response(
    JSON.stringify({ success: true, data, ...(meta ? { meta } : {}) }),
    { headers: { 'Content-Type': 'application/json' } },
  )
}
function error(code: string, status = 409) {
  return new Response(
    JSON.stringify({
      success: false,
      error: { code, message: 'RAW_BACKEND_ERROR' },
    }),
    { status, headers: { 'Content-Type': 'application/json' } },
  )
}
function boundary(
  options: {
    status?: string
    empty?: boolean
    existing?: boolean
    signatures?: boolean
    documents?: boolean
    historical?: boolean
    correction?: boolean
    fail?: string
    code?: string
    http?: number
    pending?: string
    captureLost?: boolean
  } = {},
) {
  let current = {
    ...version,
    status: options.status ?? 'DRAFT',
    versionType: options.correction ? 'CORRECTION' : 'ORIGINAL',
    ...(options.status && options.status !== 'DRAFT'
      ? { contentHash: hash, lockedAt: item.createdAt }
      : {}),
  }
  let sigs = options.signatures ? [signature] : []
  let docs = options.documents ? [documentLink] : []
  let exists = options.existing ?? true
  const calls: {
    path: string
    method: string
    url: URL
    body: unknown
    headers: Headers
    signal: AbortSignal | null | undefined
  }[] = []
  const snapshot = () => ({
    ...invoice,
    status:
      options.correction && current.status === 'DRAFT'
        ? 'CORRECTION_REQUIRED'
        : current.status,
    currentVersion: current,
    versions: options.historical
      ? [
          current,
          { ...version, id: '7777', versionNumber: 2, status: 'SUPERSEDED' },
        ]
      : [current],
  })
  const mock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const parsed = new URL(url)
    const path = parsed.pathname.replace('/api/v1', '')
    const method = init.method ?? 'GET'
    const body =
      typeof init.body === 'string'
        ? (JSON.parse(init.body) as unknown)
        : init.body
    calls.push({
      path,
      method,
      url: parsed,
      body,
      headers: new Headers(init.headers),
      signal: init.signal,
    })
    if (`${method} ${path}` === options.pending)
      return new Promise<Response>(() => undefined)
    if (`${method} ${path}` === options.fail)
      return error(options.code ?? 'INVOICE_NOT_PREPARABLE', options.http)
    if (path === '/invoices')
      return ok(options.empty || !exists ? [] : [snapshot()], {
        page: 1,
        pageSize: 20,
        total: options.empty ? 0 : 1,
        totalPages: 2,
      })
    if (path === `/appointments/${aid}/invoice`) {
      exists = true
      return ok(snapshot())
    }
    if (path === `/invoices/${iid}`) return ok(snapshot())
    if (path === `/invoices/${iid}/corrections`) return ok([])
    if (path === `/invoices/${iid}/status-history`) return ok([])
    if (path.endsWith('/versions/7777'))
      return ok({
        ...version,
        id: '7777',
        versionNumber: 2,
        status: 'SUPERSEDED',
      })
    if (path === `/invoices/${iid}/versions/${vid}`) return ok(current)
    if (path.endsWith('/prepare-signature')) {
      current = {
        ...current,
        status: 'PENDING_SIGNATURE',
        contentHash: hash,
        lockedAt: item.createdAt,
      }
      return ok(snapshot())
    }
    if (path.endsWith('/signature-content'))
      return ok({
        schema: 'odontho.invoice-signature.v1',
        contentHash: hash,
        lockedAt: item.createdAt,
        content: {
          invoice: {
            invoiceNumber: invoice.invoiceNumber,
            versionNumber: 1,
            patientName: 'QA Patient',
            currencyCode: 'ANG',
            totalAmount: current.totalAmount,
          },
          items: current.items.map((i) => ({
            lineNumber: i.lineNumber,
            procedureCode: i.procedureCodeSnapshot,
            procedureDescription: i.procedureDescriptionSnapshot,
            quantity: i.quantity,
            currencyCode: 'ANG',
            amount: i.amount,
          })),
        },
      })
    if (path.endsWith('/signatures')) {
      if (method === 'POST') {
        sigs = [signature]
        if (options.captureLost) throw new TypeError('Network response lost')
        return ok(signature)
      }
      return ok(sigs)
    }
    if (path.endsWith('/sign')) {
      current = { ...current, status: 'SIGNED', signedAt: item.createdAt }
      return ok(snapshot())
    }
    if (path.endsWith('/close')) {
      current = { ...current, status: 'CLOSED', closedAt: item.createdAt }
      return ok(snapshot())
    }
    if (path === '/documents')
      return ok({
        ...document,
        documentType: 'SIGNATURE',
        mimeType: 'image/png',
      })
    if (path.endsWith('/download'))
      return new Response('%PDF-QA', {
        headers: { 'Content-Type': 'application/pdf' },
      })
    if (path.endsWith('/pdf')) {
      docs = [documentLink]
      return ok(documentLink)
    }
    if (path.endsWith('/documents')) return ok(docs)
    throw new Error(`Unexpected request ${method} ${path}`)
  })
  vi.stubGlobal('fetch', mock)
  return { calls, mock }
}
function session(perms = permissions) {
  authStore.setSession('memory-only-qa', {
    id: '11',
    organizationId: '1',
    email: 'qa@example.test',
    firstName: 'QA',
    lastName: 'Staff',
    roles: [],
    permissions: perms,
  })
}
function renderBilling(list = false, perms = permissions) {
  session(perms)
  return renderWithProviders(
    <MemoryRouter initialEntries={[list ? '/invoices' : `/invoices/${iid}`]}>
      <Routes>
        <Route path="/invoices" element={<InvoicesPage />} />
        <Route path="/invoices/:invoiceId" element={<InvoiceDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}
async function confirmAction(name: string) {
  await userEvent.click(await screen.findByRole('button', { name }))
  await userEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm' }),
  )
}
function canvasMock() {
  class TestPointerEvent extends MouseEvent {
    pointerId: number
    pointerType: string
    constructor(type: string, init: PointerEventInit) {
      super(type, init)
      this.pointerId = init.pointerId ?? 1
      this.pointerType = init.pointerType ?? 'mouse'
    }
  }
  vi.stubGlobal('PointerEvent', TestPointerEvent)
  const ctx = {
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
  }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D,
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
    (callback) => callback(new Blob(['qa-png'], { type: 'image/png' })),
  )
  vi.spyOn(
    HTMLCanvasElement.prototype,
    'getBoundingClientRect',
  ).mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    width: 600,
    height: 200,
    right: 600,
    bottom: 200,
    toJSON: () => ({}),
  })
  return ctx
}
async function draw(pointerType = 'mouse') {
  await userEvent.click(
    await screen.findByRole('button', { name: 'Capture signature' }),
  )
  await screen.findByText(/QA-INVOICE-1 \/ v1/)
  const pad = screen.getByRole('img', { name: 'Signature drawing area' })
  Object.defineProperty(pad, 'setPointerCapture', {
    value: vi.fn(),
    configurable: true,
  })
  fireEvent.pointerDown(pad, {
    clientX: 10,
    clientY: 20,
    pointerId: 1,
    button: 0,
    pointerType,
  })
  fireEvent.pointerMove(pad, { clientX: 80, clientY: 60, pointerId: 1 })
  fireEvent.pointerUp(pad, { pointerId: 1 })
}
afterEach(() => {
  authStore.clearSession()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('F06 invoice list and contract', () => {
  it('shows list loading', () => {
    boundary({ pending: 'GET /invoices' })
    renderBilling(true)
    expect(screen.getByText('Loading invoices')).toBeInTheDocument()
  })
  it('shows one logical invoice and current version', async () => {
    boundary()
    renderBilling(true)
    expect(
      await screen.findByRole('link', { name: 'QA-INVOICE-1' }),
    ).toHaveAttribute('href', `/invoices/${iid}`)
    expect(screen.getByText('v1 - Original')).toBeInTheDocument()
    expect(screen.getByText('ANG 275.70')).toBeInTheDocument()
  })
  it('shows empty results', async () => {
    boundary({ empty: true })
    renderBilling(true)
    expect(await screen.findByText('No invoices found')).toBeInTheDocument()
  })
  it('maps errors without raw messages', async () => {
    boundary({ fail: 'GET /invoices', code: 'INVOICE_NOT_FOUND', http: 404 })
    renderBilling(true)
    expect(
      await screen.findByText('The invoice could not be found.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('RAW_BACKEND_ERROR')).not.toBeInTheDocument()
  })
  it('uses supported search/status/page parameters', async () => {
    const { calls } = boundary()
    renderBilling(true)
    await screen.findByText('QA-PATIENT-1')
    await userEvent.type(screen.getByRole('textbox'), 'QA{Enter}')
    await userEvent.selectOptions(screen.getByRole('combobox'), 'CLOSED')
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    await waitFor(() =>
      expect(
        calls.some(
          (c) =>
            c.url.searchParams.get('q') === 'QA' &&
            c.url.searchParams.get('status') === 'CLOSED' &&
            c.url.searchParams.get('page') === '2',
        ),
      ).toBe(true),
    )
  })
  it('denies invoice reads without requesting data', () => {
    const { mock } = boundary()
    renderBilling(true, [])
    expect(
      screen.getByText("You don't have permission to access this area."),
    ).toBeInTheDocument()
    expect(mock).not.toHaveBeenCalled()
  })
  it('preserves IDs and financial decimal strings', async () => {
    const { calls } = boundary()
    session()
    const data = await getInvoice(iid)
    expect(data.id).toBe(iid)
    expect(data.currentVersion?.totalAmount).toBe('275.70')
    expect(data.currentVersion?.items[0]?.quantity).toBe('2.00')
    expect(calls[0]?.path).toBe(`/invoices/${iid}`)
  })
  it('looks up appointment invoice with exact string ID and signal', async () => {
    const { calls } = boundary()
    const abort = new AbortController()
    await listInvoices(
      { appointmentId: aid, page: 1, pageSize: 1 },
      abort.signal,
    )
    expect(calls[0]?.url.searchParams.get('appointmentId')).toBe(aid)
    expect(calls[0]?.signal).toBe(abort.signal)
  })
  it('creates one invoice without fabricated request fields', async () => {
    const { calls } = boundary()
    const data = await createInvoice(aid)
    expect(data.currentVersion?.items).toHaveLength(2)
    expect(calls[0]).toMatchObject({
      method: 'POST',
      path: `/appointments/${aid}/invoice`,
      body: undefined,
    })
  })
})

describe('F06 invoice version lifecycle', () => {
  it('shows detail loading', () => {
    boundary({ pending: `GET /invoices/${iid}` })
    renderBilling()
    expect(screen.getByText('Loading invoice')).toBeInTheDocument()
  })
  it('renders multiple authoritative items, total and snapshots', async () => {
    boundary()
    renderBilling()
    await screen.findByText('QA-PROC-A')
    expect(screen.getByText('QA-PROC-B')).toBeInTheDocument()
    expect(screen.getByText('ANG 275.70')).toBeInTheDocument()
    expect(screen.getAllByText('TC-SERVER')).toHaveLength(2)
    expect(screen.getAllByText('POLI-SERVER')).toHaveLength(2)
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  })
  it('prepares then refreshes the version', async () => {
    const { calls } = boundary()
    renderBilling()
    await confirmAction('Prepare for signature')
    expect(
      await screen.findByText('Invoice prepared for signature.'),
    ).toBeInTheDocument()
    expect(
      await screen.findByRole('button', { name: 'Capture signature' }),
    ).toBeInTheDocument()
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1)
    expect(
      calls.some(
        (c) => c.path.endsWith('/prepare-signature') && c.body === undefined,
      ),
    ).toBe(true)
  })
  it('does not imply prepare permission from read', async () => {
    boundary()
    renderBilling(false, ['invoice.read'])
    await screen.findByText('QA-PROC-A')
    expect(
      screen.queryByRole('button', { name: 'Prepare for signature' }),
    ).not.toBeInTheDocument()
  })
  it('requires upload and capture permission together', async () => {
    boundary({ status: 'PENDING_SIGNATURE' })
    renderBilling(false, ['invoice.read', 'signature.capture'])
    await screen.findByText('No signature recorded for this version.')
    expect(
      screen.queryByRole('button', { name: 'Capture signature' }),
    ).not.toBeInTheDocument()
  })
  it('confirms signed using existing version evidence without recapture', async () => {
    const { calls } = boundary({
      status: 'PENDING_SIGNATURE',
      signatures: true,
    })
    renderBilling()
    await confirmAction('Confirm signed')
    expect(await screen.findByText('Invoice signed.')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Capture signature' }),
    ).not.toBeInTheDocument()
    expect(calls.filter((c) => c.method === 'POST').map((c) => c.path)).toEqual(
      [`/invoices/${iid}/versions/${vid}/sign`],
    )
  })
  it('closes a signed invoice and refreshes PDF availability', async () => {
    const { calls } = boundary({ status: 'SIGNED', signatures: true })
    renderBilling()
    await confirmAction('Close invoice')
    expect(await screen.findByText('Invoice closed.')).toBeInTheDocument()
    expect(
      await screen.findByRole('button', { name: 'Generate PDF' }),
    ).toBeInTheDocument()
    expect(
      calls.some((c) => c.path.endsWith('/close') && c.method === 'POST'),
    ).toBe(true)
  })
  it.each(['SIGNED', 'CLOSED', 'SUPERSEDED', 'VOID'])(
    '%s versions expose no prepare/capture/edit controls',
    async (status) => {
      boundary({ status })
      renderBilling()
      await screen.findByText('QA-PROC-A')
      expect(screen.getByText('This version is read only.')).toBeInTheDocument()
      expect(
        screen.queryByRole('button', {
          name: /Prepare for signature|Capture signature|Edit/,
        }),
      ).not.toBeInTheDocument()
    },
  )
  it('supports the F07 lifecycle on the current correction version', async () => {
    boundary({ status: 'PENDING_SIGNATURE', correction: true })
    renderBilling()
    await screen.findByText('QA-PROC-A')
    expect(
      await screen.findByRole('button', { name: 'Capture signature' }),
    ).toBeInTheDocument()
  })
  it('reads historical versions by string ID', async () => {
    const { calls } = boundary({ historical: true })
    renderBilling()
    await screen.findByText('QA-PROC-A')
    await userEvent.selectOptions(screen.getByRole('combobox'), '7777')
    expect(await screen.findByText('Version 2 - Original')).toBeInTheDocument()
    expect(
      await screen.findByText(
        'No PDF document available for this historical version.',
      ),
    ).toBeInTheDocument()
    expect(calls.some((c) => c.path.endsWith('/versions/7777'))).toBe(true)
    expect(
      screen.queryByRole('button', { name: 'Prepare for signature' }),
    ).not.toBeInTheDocument()
  })
  it('maps invalid state and preserves auth on 403', async () => {
    boundary({
      fail: `POST /invoices/${iid}/versions/${vid}/prepare-signature`,
      code: 'PERMISSION_DENIED',
      http: 403,
    })
    renderBilling()
    await confirmAction('Prepare for signature')
    expect(
      await screen.findByText("You don't have permission to access this area."),
    ).toBeInTheDocument()
    expect(authStore.getAccessToken()).toBe('memory-only-qa')
  })
  it('preserves version ID on explicit retrieval', async () => {
    const { calls } = boundary()
    await getInvoiceVersion(iid, vid)
    expect(calls[0]?.path).toBe(`/invoices/${iid}/versions/${vid}`)
  })
})

describe('F06 signature and binary documents', () => {
  it.each([
    ['touch', 'TOUCHSCREEN'],
    ['pen', 'SIGNATURE_PAD'],
  ])(
    'records %s capture with the documented method',
    async (pointerType, captureMethod) => {
      canvasMock()
      const { calls } = boundary({ status: 'PENDING_SIGNATURE' })
      renderBilling()
      await draw(pointerType)
      await userEvent.click(screen.getByRole('checkbox'))
      await userEvent.click(
        screen.getByRole('button', { name: 'Save signature' }),
      )
      await screen.findByRole('button', { name: 'Confirm signed' })
      expect(
        calls.find((c) => c.method === 'POST' && c.path.endsWith('/signatures'))
          ?.body,
      ).toMatchObject({ captureMethod })
    },
  )
  it('uploads PNG as binary with Bearer, not JSON/base64', async () => {
    const { calls } = boundary()
    session()
    const blob = new Blob(['qa'], { type: 'image/png' })
    await uploadSignature(blob, vid)
    expect(calls[0]?.body).toBe(blob)
    expect(calls[0]?.headers.get('Content-Type')).toBe('image/png')
    expect(calls[0]?.headers.get('Authorization')).toBe('Bearer memory-only-qa')
    expect(calls[0]?.url.searchParams.get('documentType')).toBe('SIGNATURE')
  })
  it('downloads authenticated binary bytes', async () => {
    const { calls } = boundary()
    session()
    const blob = await downloadDocument(docid)
    expect(await blob.text()).toBe('%PDF-QA')
    expect(calls[0]?.path).toBe(`/documents/${docid}/download`)
    expect(calls[0]?.headers.get('Authorization')).toBe('Bearer memory-only-qa')
  })
  it('normalizes binary endpoint errors and preserves 403 session', async () => {
    boundary({
      fail: `GET /documents/${docid}/download`,
      code: 'PERMISSION_DENIED',
      http: 403,
    })
    session()
    await expect(downloadDocument(docid)).rejects.toMatchObject({
      code: 'PERMISSION_DENIED',
      status: 403,
    })
    expect(authStore.getAccessToken()).toBe('memory-only-qa')
  })
  it('validates representative name and relationship', () => {
    expect(
      signerSchema.safeParse({
        signatureType: 'GUARDIAN',
        signerName: '',
        signerRelationship: '',
        confirmed: true,
      }).success,
    ).toBe(false)
    expect(
      signerSchema.safeParse({
        signatureType: 'PATIENT',
        signerName: '',
        signerRelationship: '',
        confirmed: true,
      }).success,
    ).toBe(true)
  })
  it('requires ink and supports clearing proportional pointer capture', async () => {
    const ctx = canvasMock()
    boundary({ status: 'PENDING_SIGNATURE' })
    renderBilling()
    await draw()
    expect(ctx.lineTo).toHaveBeenCalledWith(160, 120)
    expect(screen.getByRole('button', { name: 'Save signature' })).toBeEnabled()
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(
      screen.getByRole('button', { name: 'Save signature' }),
    ).toBeDisabled()
    expect(screen.getByRole('checkbox')).not.toBeChecked()
  })
  it('requires confirmation before signature upload', async () => {
    canvasMock()
    const { calls } = boundary({ status: 'PENDING_SIGNATURE' })
    renderBilling()
    await draw()
    await userEvent.click(
      screen.getByRole('button', { name: 'Save signature' }),
    )
    expect(
      await screen.findByText('Confirm before saving the signature.'),
    ).toBeInTheDocument()
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0)
  })
  it('saves evidence once with expected content hash and exact version', async () => {
    canvasMock()
    const { calls } = boundary({ status: 'PENDING_SIGNATURE' })
    renderBilling()
    await draw()
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.dblClick(
      screen.getByRole('button', { name: 'Save signature' }),
    )
    expect(
      await screen.findByRole('button', { name: 'Confirm signed' }),
    ).toBeInTheDocument()
    const captures = calls.filter(
      (c) => c.method === 'POST' && c.path.endsWith('/signatures'),
    )
    expect(captures).toHaveLength(1)
    expect(captures[0]?.body).toEqual({
      signatureDocumentId: docid,
      signatureType: 'PATIENT',
      captureMethod: 'MOUSE',
      expectedContentHash: hash,
    })
    expect(calls.some((c) => c.path.endsWith('/sign'))).toBe(false)
  })
  it('reconciles lost capture response instead of duplicating evidence', async () => {
    canvasMock()
    const { calls } = boundary({
      status: 'PENDING_SIGNATURE',
      captureLost: true,
    })
    renderBilling()
    await draw()
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(
      screen.getByRole('button', { name: 'Save signature' }),
    )
    expect(
      await screen.findByRole('button', { name: 'Confirm signed' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(
      calls.filter(
        (c) => c.method === 'POST' && c.path.endsWith('/signatures'),
      ),
    ).toHaveLength(1)
  })
  it('generates PDF and invalidates only invoice documents', async () => {
    const { calls } = boundary({ status: 'CLOSED', signatures: true })
    renderBilling()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Generate PDF' }),
    )
    expect(
      await screen.findByRole('button', { name: 'View / download PDF' }),
    ).toBeInTheDocument()
    expect(
      calls.filter((c) => c.path.endsWith('/documents')).length,
    ).toBeGreaterThan(1)
    expect(calls.filter((c) => c.method === 'POST').map((c) => c.path)).toEqual(
      [`/invoices/${iid}/versions/${vid}/pdf`],
    )
  })
  it('does not request documents without read permission', async () => {
    const { calls } = boundary({ status: 'CLOSED' })
    renderBilling(false, ['invoice.read'])
    expect(
      await screen.findByText('Document access requires permission.'),
    ).toBeInTheDocument()
    expect(calls.some((c) => c.path.endsWith('/documents'))).toBe(false)
    expect(
      screen.queryByRole('button', { name: 'Generate PDF' }),
    ).not.toBeInTheDocument()
  })
  it('does not offer PDF generation before close', async () => {
    boundary({ status: 'SIGNED' })
    renderBilling()
    expect(
      await screen.findByText(
        'PDF is available after signing and closing the invoice.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Generate PDF' }),
    ).not.toBeInTheDocument()
  })
  it('releases PDF object URLs when preview closes', async () => {
    const create = vi.fn(() => 'blob:qa-pdf')
    const revoke = vi.fn()
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = create
        static revokeObjectURL = revoke
      },
    )
    boundary({ status: 'CLOSED', documents: true })
    renderBilling()
    await userEvent.click(
      await screen.findByRole('button', { name: 'View / download PDF' }),
    )
    expect(
      await screen.findByRole('link', { name: 'Download PDF' }),
    ).toHaveAttribute('href', 'blob:qa-pdf')
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Close dialog',
      }),
    )
    expect(revoke).toHaveBeenCalledWith('blob:qa-pdf')
  })
  it('does not persist credentials during billing', async () => {
    boundary()
    session()
    await transitionInvoice(iid, vid, 'prepare-signature')
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })
  it('shows a clear PDF fallback without embedding an empty viewer', async () => {
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = () => 'blob:qa-pdf'
        static revokeObjectURL = vi.fn()
      },
    )
    boundary({ status: 'CLOSED', documents: true })
    renderBilling()
    await userEvent.click(
      await screen.findByRole('button', { name: 'View / download PDF' }),
    )
    expect(await screen.findByText('PDF document ready.')).toBeInTheDocument()
    expect(
      screen.getByText('PDF preview is unavailable in this browser.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Download PDF' })).toHaveAttribute(
      'download',
      'QA-INVOICE-1.pdf',
    )
    expect(screen.queryByTitle('Invoice PDF preview')).not.toBeInTheDocument()
  })
  it('401 on document download clears the authenticated session', async () => {
    boundary({
      status: 'CLOSED',
      documents: true,
      fail: `GET /documents/${docid}/download`,
      code: 'AUTHENTICATION_REQUIRED',
      http: 401,
    })
    renderBilling()
    await userEvent.click(
      await screen.findByRole('button', { name: 'View / download PDF' }),
    )
    await waitFor(() => expect(authStore.getAccessToken()).toBeNull())
    expect(authStore.getUser()).toBeNull()
  })
  it('requires invoice.close independently from read', async () => {
    boundary({ status: 'SIGNED', signatures: true })
    renderBilling(false, ['invoice.read'])
    await screen.findByText('QA-PROC-A')
    expect(
      screen.queryByRole('button', { name: 'Close invoice' }),
    ).not.toBeInTheDocument()
  })
  it('shows the documented hash mismatch without losing drawn evidence', async () => {
    canvasMock()
    const { calls } = boundary({
      status: 'PENDING_SIGNATURE',
      fail: `POST /invoices/${iid}/versions/${vid}/signatures`,
      code: 'SIGNATURE_CONTENT_HASH_MISMATCH',
    })
    renderBilling()
    await draw()
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(
      screen.getByRole('button', { name: 'Save signature' }),
    )
    expect(
      await screen.findByText(
        'Invoice content changed. Refresh and review before signing.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('Signature captured locally')).toBeInTheDocument()
    expect(calls.filter((c) => c.path === '/documents')).toHaveLength(1)
  })
})

describe('F06 appointment billing entry', () => {
  function entry(perms: string[], status = 'COMPLETED') {
    session(perms)
    return renderWithProviders(
      <MemoryRouter>
        <AppointmentBilling
          appointment={
            {
              id: aid,
              appointmentNumber: 'QA-APPOINTMENT',
              status,
            } as Appointment
          }
        />
      </MemoryRouter>,
    )
  }
  it('opens the existing logical invoice instead of offering another', async () => {
    boundary()
    entry(permissions)
    expect(
      await screen.findByRole('link', { name: 'Open invoice QA-INVOICE-1' }),
    ).toHaveAttribute('href', `/invoices/${iid}`)
    expect(
      screen.queryByRole('button', { name: 'Create invoice' }),
    ).not.toBeInTheDocument()
  })
  it('creates from a completed appointment after confirmation', async () => {
    const { calls } = boundary({ existing: false })
    entry(permissions)
    await userEvent.click(
      await screen.findByRole('button', { name: 'Create invoice' }),
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Confirm creation' }),
    )
    await waitFor(() =>
      expect(
        calls.some(
          (c) =>
            c.method === 'POST' && c.path === `/appointments/${aid}/invoice`,
        ),
      ).toBe(true),
    )
  })
  it('does not offer creation without create permission', async () => {
    boundary({ existing: false })
    entry(['invoice.read'])
    expect(await screen.findByText('No invoice recorded.')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Create invoice' }),
    ).not.toBeInTheDocument()
  })
  it('does not silently complete an appointment', async () => {
    const { calls } = boundary({ existing: false })
    entry(permissions, 'IN_PROGRESS')
    expect(
      await screen.findByText(
        'Complete the appointment and clinical encounter before billing.',
      ),
    ).toBeInTheDocument()
    expect(calls.some((c) => c.method !== 'GET')).toBe(false)
  })
})
