import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DeclarationSnapshotReview, SvbIssueList } from '../features/declarations/svb-data-review'
import type { DeclarationItem } from '../types/declaration'
import type { SvbPilotReadiness } from '../types/svb-readiness'
import { SvbPilotNotice } from '../features/svb-readiness/svb-pilot-notice'
import { getSvbPilotReadiness } from '../features/svb-readiness/svb-readiness-api'
import { authStore } from '../auth/auth-store'
import { renderWithProviders } from './test-utils'
import { ApiError, getApiErrorMessage } from '../api'

const readiness: SvbPilotReadiness = {
  contract: 'NEG-FINAL-06', status: 'BLOCKED', realSubmissionEnabled: false,
  sourceSheet: null, destinationFormat: null, enabledServiceCodes: [], enabledCaseTypes: [],
  unresolvedFields: ['NumberOfTreatments', 'Assistance', 'PoliClinic', 'ReferralEvidence'],
  issues: [{ field: 'SourceSheet', code: 'SVB_SOURCE_RULES_NOT_CONFIGURED' }, { field: 'DestinationFormat', code: 'SVB_DESTINATION_FORMAT_NOT_VERIFIED' }],
}
const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { headers: { 'Content-Type': 'application/json' } })
const session = (permissions: string[]) => authStore.setSession('memory-final06', { id: '1', organizationId: '1', firstName: 'QA', lastName: 'Test', email: 'qa@local.invalid', roles: [], permissions })
afterEach(() => { authStore.clearSession(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('NEG-FINAL-06 server pilot scope', () => {
  it('distinguishes factual manual recording without a file from certified file/API delivery', async () => {
    session(['svb_procedure.read']); vi.stubGlobal('fetch', vi.fn(async () => ok({ ...readiness, manualPortalRecordingEnabled: true, manualEntryRequiresFile: false })))
    renderWithProviders(<SvbPilotNotice />)
    expect(await screen.findByText('Certified SVB file/API delivery blocked')).toBeInTheDocument()
    expect(screen.getByText(/Synthetic QA manual recording is enabled without an upload file/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /submit/i })).not.toBeInTheDocument()
  })
  it('requests only the published endpoint with the abort signal and memory token', async () => {
    session(['svb_procedure.read']); const fetcher = vi.fn<typeof fetch>(async () => ok(readiness)); vi.stubGlobal('fetch', fetcher)
    const signal = new AbortController().signal
    expect(await getSvbPilotReadiness(signal)).toEqual(readiness)
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('/api/v1/svb-pilot/readiness'), expect.objectContaining({ signal }))
    const init = fetcher.mock.calls[0]?.[1] as RequestInit | undefined
    expect(init?.method ?? 'GET').toBe('GET')
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer memory-final06')
  })
  it('shows the server block and its explicitly empty pilot scope', async () => {
    session(['svb_procedure.read']); vi.stubGlobal('fetch', vi.fn(async () => ok(readiness)))
    renderWithProviders(<SvbPilotNotice />)
    expect(await screen.findByText('Real SVB presentation blocked')).toBeInTheDocument()
    expect(screen.getByText('Certified SVB services: None')).toBeInTheDocument()
    expect(screen.getByText('Certified SVB case types: None')).toBeInTheDocument()
    expect(screen.getByText(/Unresolved requirements: NumberOfTreatments, Assistance/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /present|submit/i })).not.toBeInTheDocument()
  })
  it('uses embedded declaration readiness without making an unauthorized catalogue request', () => {
    session(['declaration.read']); const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
    renderWithProviders(<SvbPilotNotice readiness={readiness} />)
    expect(screen.getByText('Real SVB presentation blocked')).toBeInTheDocument(); expect(fetcher).not.toHaveBeenCalled()
    expect(screen.queryByText('Certified SVB services: None')).not.toBeInTheDocument()
  })
  it('does not invent an enabled or empty pilot when no authoritative status is available', () => {
    session(['declaration.read']); vi.stubGlobal('fetch', vi.fn()); renderWithProviders(<SvbPilotNotice />)
    expect(screen.getByText('Real presentation status unavailable')).toBeInTheDocument()
    expect(screen.queryByText('Certified SVB services: None')).not.toBeInTheDocument()
  })
  it('rejects unsupported readiness responses instead of interpreting them as approval', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok({ ...readiness, status: 'READY', realSubmissionEnabled: true })))
    await expect(getSvbPilotReadiness()).rejects.toThrow()
  })
  it('retains the session on a denied pilot query and retries only on explicit request', async () => {
    session(['svb_procedure.read']); let calls = 0
    vi.stubGlobal('fetch', vi.fn(async () => ++calls === 1 ? new Response(JSON.stringify({ success: false, error: { code: 'PERMISSION_DENIED', message: 'private internal detail' } }), { status: 403, headers: { 'Content-Type': 'application/json' } }) : ok(readiness)))
    renderWithProviders(<SvbPilotNotice />)
    const retry = await screen.findByRole('button', { name: 'Retry pilot status' })
    expect(screen.queryByText('Certified SVB services: None')).not.toBeInTheDocument()
    expect(screen.queryByText('private internal detail')).not.toBeInTheDocument()
    expect(authStore.getAccessToken()).toBe('memory-final06'); expect(calls).toBe(1)
    await userEvent.click(retry); expect(await screen.findByText('Certified SVB services: None')).toBeInTheDocument(); expect(calls).toBe(2)
  })
  it.each(['SVB_REAL_PRESENTATION_NOT_ENABLED', 'SVB_REFERRAL_FLOW_NOT_SUPPORTED', 'ACCIDENT_CASE_NOT_FOUND', 'ACCIDENT_INSURANCE_CONTEXT_MISMATCH'])('maps %s without Backend text', (code) => {
    const message = getApiErrorMessage(new ApiError({ code, status: 409, message: 'private internal detail' }))
    expect(message).not.toContain('private internal detail'); expect(message).not.toContain('unexpected')
  })
})

const snapshot: DeclarationItem = {
  id: '90071992547409931234', declarationBatchId: '90071992547409931235', invoiceItemId: '90071992547409931236',
  sequenceNumber: 1, lineStatus: 'PENDING', declarantIdSnapshot: '00123', invoiceNumberSnapshot: 'QA-000001',
  detailInvoiceNumberSnapshot: 'QA-000001-01', providerIdSnapshot: '00123', serviceDateSnapshot: '2026-11-02', insuredIdSnapshot: '000012345',
  accidentFormNumberSnapshot: null, treatmentIdSnapshot: '0000123', amountSnapshot: '9999999999999.99', authorizationIdSnapshot: null,
  numberOfTreatmentsSnapshot: null, assistanceSnapshot: null, referrerIdSnapshot: null, diagnosticCodeSnapshot: null,
  policlinicSnapshot: null, additionalNoteSnapshot: null, responseCode: null, responseMessage: null,
  createdAt: '2026-11-02T12:00:00Z', updatedAt: '2026-11-02T12:00:00Z',
}

describe('NEG-FINAL-06 snapshot presentation', () => {
  it('shows recorded values exactly and leaves unresolved fields unfilled', () => {
    render(<DeclarationSnapshotReview item={snapshot} onClose={vi.fn()} />)
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('000012345')).toBeInTheDocument()
    expect(within(dialog).getByText('0000123')).toBeInTheDocument()
    expect(within(dialog).getByText('9999999999999.99')).toBeInTheDocument()
    expect(within(dialog).getByText('2026-11-02')).toBeInTheDocument()
    expect(within(dialog).getByText('Assistance').parentElement).toHaveTextContent('Not recorded')
    expect(within(dialog).getByText('Number of treatments').parentElement).toHaveTextContent('Not recorded')
    expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument()
    expect(snapshot.numberOfTreatmentsSnapshot).toBeNull()
    expect(snapshot.assistanceSnapshot).toBeNull()
  })
  it('displays recorded zero as a snapshot without deciding its validity', () => {
    render(<DeclarationSnapshotReview item={{ ...snapshot, numberOfTreatmentsSnapshot: 0 }} onClose={vi.fn()} />)
    expect(screen.getByText('Number of treatments').parentElement).toHaveTextContent('0')
    expect(screen.queryByText('SVB data complete')).not.toBeInTheDocument()
  })
  it('explains server-reported missing and invalid fields without applying local validation', () => {
    render(<SvbIssueList issues={[
      { field: 'NumberOfTreatments', code: 'DECLARATION_SVB_DATA_INCOMPLETE' },
      { field: 'PoliClinic', code: 'DECLARATION_SVB_DATA_INVALID' },
      { field: 'ReferrerId', code: 'DECLARATION_SVB_DATA_INCOMPLETE' },
    ]} />)
    expect(screen.getByText('NumberOfTreatments: Missing snapshot data')).toBeInTheDocument()
    expect(screen.getByText('PoliClinic: Invalid snapshot data')).toBeInTheDocument()
    expect(screen.getByText(/Do not derive this value from procedure quantity/)).toBeInTheDocument()
    expect(screen.getByText(/Location SVB configuration is not yet available/)).toBeInTheDocument()
    expect(screen.getByText(/An identifier alone does not establish an authorized referral/)).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })
  it('handles unfamiliar field names without exposing object prototype properties', () => {
    render(<SvbIssueList issues={[{ field: '__proto__', code: 'DECLARATION_SVB_DATA_INVALID' }]} />)
    expect(screen.getByText('__proto__: Invalid snapshot data')).toBeInTheDocument()
    expect(screen.getByText('Review the source record through the authorized correction workflow.')).toBeInTheDocument()
  })
})
