import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { authStore } from '../auth/auth-store'
import { ManualEntryDialog } from '../features/declarations/manual-entry-dialog'
import { ManualEntryPanel } from '../features/declarations/manual-entry-panel'
import { getManualDossier } from '../features/declarations/manual-entry-api'
import type { Declaration } from '../types/declaration'
import type { ManualDossier, ManualEntry, ManualInvoiceLine } from '../types/manual-entry'
import { renderWithProviders } from './test-utils'
import * as downloads from '../lib/download'
import { syntheticReadiness } from './fixtures/svb-readiness'

const id = '900719925474099313'
const line: ManualInvoiceLine = { declarationItemId: '900719925474099314', sequenceNumber: 1, invoiceId: '900719925474099315', invoiceItemId: '900719925474099316', invoiceVersionId: '900719925474099317', versionNumber: 2, invoiceNumber: 'QA-001', invoiceContentHash: 'b'.repeat(64), procedureCode: 'QA', procedureDescription: 'Synthetic service', quantity: '2.00', unitTariff: '88.80', amount: '177.60', currencyCode: 'ANG' }
const entry: ManualEntry = { id: '900719925474099318', declarationId: id, state: 'PREPARED', schemaVersion: 'ODONTHO_MANUAL_ENTRY_V1', entryMode: 'MANUAL_ENTRY', contentHash: 'a'.repeat(64), preparedByUserId: '1', preparedAt: '2026-11-03T10:00:00Z', uncertaintyReason: null, releaseReason: null, releasedAt: null, resolutionDocumentId: null, submissionId: null, receiptDocumentId: null, receiptSha256: null, externalSubmittedAt: null, recordedAt: null, result: null }
const dossier: ManualDossier = { content: { schemaVersion: 'ODONTHO_MANUAL_ENTRY_V1', entryMode: 'MANUAL_ENTRY', notOfficialSvbFile: true, officialRulesVerified: false, externalSubmissionPerformedByApplication: false, items: [line], totalsByCurrency: [{ currencyCode: 'ANG', amount: '177.60' }] }, contentHash: entry.contentHash, entry: null }
const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { headers: { 'Content-Type': 'application/json' } })
const session = (permissions = ['declaration.read', 'invoice.read', 'declaration.submit', 'document.upload', 'document.read', 'svb_procedure.read']) => authStore.setSession('memory-manual', { id: '1', organizationId: '1', firstName: 'QA', lastName: 'User', email: 'qa@local.invalid', roles: [], permissions })
function stubManualFetch(handler: typeof fetch) {
  vi.stubGlobal('fetch', vi.fn<typeof fetch>(async (url, options) => new URL(String(url)).pathname.endsWith('/svb-pilot/readiness') ? ok(syntheticReadiness()) : handler(url, options)))
}
afterEach(() => { authStore.clearSession(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('manual entry integration', () => {
  it('reads the mounted dossier endpoint with a string ID, memory token and abort signal', async () => {
    session(); const fetcher = vi.fn(async () => ok(dossier)); stubManualFetch(fetcher); const signal = new AbortController().signal
    expect(await getManualDossier(id, signal)).toEqual(dossier)
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining(`/declarations/${id}/manual-entry`), expect.objectContaining({ signal, headers: expect.any(Headers) }))
    const options = fetcher.mock.calls[0] as unknown as [string, RequestInit]; expect(new Headers(options[1].headers).get('Authorization')).toBe('Bearer memory-manual')
  })
  it('requires one invoice and displays exact backend totals without an export prerequisite', async () => {
    session(); stubManualFetch(async () => ok({ ...dossier, content: { ...dossier.content, items: [line, { ...line, declarationItemId: '2', invoiceId: '3', invoiceNumber: 'QA-002' }] } }))
    renderWithProviders(<MemoryRouter><ManualEntryPanel declaration={{ id, status: 'DRAFT' } as Declaration} hasItems /></MemoryRouter>)
    expect(await screen.findByText(/contains 2 invoices/)).toBeInTheDocument()
    expect(screen.getByText('Backend total: ANG 177.60')).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Prepare manual entry' })).toBeDisabled()
    expect(screen.getByRole('link', { name: 'QA-001 / v2' })).toHaveAttribute('href', `/invoices/${line.invoiceId}?versionId=${line.invoiceVersionId}`)
  })
  it('retries preparation with the original key after a lost response and never calls submit/export', async () => {
    session(); const writes: { path: string; body: unknown }[] = []
    stubManualFetch(async (url, options) => { const path = new URL(String(url)).pathname; if (options?.method === 'POST') { writes.push({ path, body: JSON.parse(String(options.body)) }); throw new TypeError('Lost response') } if (path.includes('/invoices/')) return ok({ status: 'CLOSED', items: [{ id: line.invoiceItemId }] }); return ok(dossier) })
    renderWithProviders(<MemoryRouter><ManualEntryPanel declaration={{ id, status: 'DRAFT' } as Declaration} hasItems /></MemoryRouter>)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Prepare manual entry' })).toBeEnabled())
    await userEvent.click(screen.getByRole('button', { name: 'Prepare manual entry' }))
    const dialog = screen.getByRole('dialog', { name: 'Prepare manual entry?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Prepare manual entry' })); await within(dialog).findByRole('alert')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Prepare manual entry' })); await waitFor(() => expect(writes).toHaveLength(2))
    expect(writes[0]).toEqual(writes[1]); expect(writes[0]?.path).toBe(`/api/v1/declarations/${id}/manual-entry/prepare`)
  })
  it('blocks an incomplete per-invoice dossier even when a backend preparation exists', async () => {
    session(); const fetcher = vi.fn<typeof fetch>(async (url) => new URL(String(url)).pathname.includes('/invoices/') ? ok({ status: 'CLOSED', items: [{ id: line.invoiceItemId }, { id: '900719925474099399' }] }) : ok({ ...dossier, entry })); stubManualFetch(fetcher)
    renderWithProviders(<MemoryRouter><ManualEntryPanel declaration={{ id, status: 'DRAFT' } as Declaration} hasItems /></MemoryRouter>)
    expect(await screen.findByText(/contains only 1 of 2 items/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Prepare manual entry' })).toBeDisabled(); expect(screen.getByRole('button', { name: 'Record portal entry' })).toBeDisabled()
    expect(fetcher.mock.calls.every(([, options]) => !options?.method || options.method === 'GET')).toBe(true)
  })
  it('disables preparation and download when a cached Draft becomes cancelled', async () => {
    session(); stubManualFetch(async (url) => new URL(String(url)).pathname.includes('/invoices/') ? ok({ status: 'CLOSED', items: [{ id: line.invoiceItemId }] }) : ok(dossier))
    const rendered = renderWithProviders(<MemoryRouter><ManualEntryPanel declaration={{ id, status: 'DRAFT' } as Declaration} hasItems /></MemoryRouter>)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Prepare manual entry' })).toBeEnabled())
    rendered.rerender(<MemoryRouter><ManualEntryPanel declaration={{ id, status: 'CANCELLED' } as Declaration} hasItems /></MemoryRouter>)
    expect(screen.getByRole('button', { name: 'Prepare manual entry' })).toBeDisabled(); expect(screen.getByRole('button', { name: 'Download internal dossier' })).toBeDisabled()
    expect(screen.getByText(/cancelled declaration is historical/)).toBeInTheDocument()
  })
  it('does not save downloaded dossier bytes whose hash differs from the reviewed snapshot', async () => {
    session(); vi.stubGlobal('crypto', { randomUUID: () => 'qa-download-integrity-key', subtle: { digest: vi.fn(async () => new Uint8Array(32).buffer) } }); const save = vi.spyOn(downloads, 'saveBlob').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async (url) => { const path = new URL(String(url)).pathname; if (path.endsWith('/download')) return new Response('{}', { headers: { 'Content-Type': 'application/json' } }); if (path.includes('/invoices/')) return ok({ status: 'CLOSED', items: [{ id: line.invoiceItemId }] }); return ok(dossier) }))
    renderWithProviders(<MemoryRouter><ManualEntryPanel declaration={{ id, status: 'DRAFT' } as Declaration} hasItems /></MemoryRouter>)
    await userEvent.click(await screen.findByRole('button', { name: 'Download internal dossier' }))
    expect(await screen.findByText(/The frozen dossier changed/)).toBeInTheDocument(); expect(save).not.toHaveBeenCalled()
  })
  it('requires receipt, confirmation and absence reason; retries the same content and uploaded document after a lost record response', async () => {
    const user = userEvent.setup(); const writes: { path: string; body: unknown }[] = []; let uploads = 0
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async (url, options) => { const path = new URL(String(url)).pathname; if (path.endsWith('/documents')) { uploads++; return ok({ id: '900719925474099319' }) } writes.push({ path, body: JSON.parse(String(options?.body)) }); throw new TypeError('Lost response') }))
    renderWithProviders(<ManualEntryDialog action="record" canRecordNew declarationId={id} entry={entry} lines={[line]} onClose={vi.fn()} onSaved={vi.fn()} onReconcile={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Record portal entry' })); expect(await screen.findByText('Attach the external evidence before recording.')).toBeInTheDocument(); expect(writes).toHaveLength(0)
    await user.type(screen.getByLabelText('External date and time (America/Curacao)'), '2026-11-03T08:30')
    await user.click(screen.getByLabelText('The portal or response supplied no reference'))
    await user.type(screen.getByLabelText('Reason / explanation'), 'Synthetic receipt has no reference')
    await user.upload(screen.getByLabelText('Portal receipt', { exact: false }), new File(['%PDF-1.4 synthetic QA'], 'qa-receipt.pdf', { type: 'application/pdf' }))
    await user.click(screen.getByLabelText(/I verified that this invoice was already entered/))
    await user.click(screen.getByRole('button', { name: 'Record portal entry' })); await screen.findByRole('button', { name: 'Retry same record' })
    expect(screen.getByLabelText('External reference')).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Retry same record' })); await waitFor(() => expect(writes).toHaveLength(2))
    expect(uploads).toBe(1); expect(writes[0]).toEqual(writes[1]); expect(writes[0]?.body).toMatchObject({ manualEntryId: entry.id, expectedContentHash: entry.contentHash, receiptDocumentId: '900719925474099319', externalReference: null, submittedAt: '2026-11-03T12:30:00.000Z', confirmation: 'ALREADY_ENTERED_IN_OFFICIAL_PORTAL' })
    expect(writes[0]?.path).toBe(`/api/v1/declarations/${id}/submissions/manual`)
  })
  it('records an evidenced partial response with all exact line IDs, without assuming accepted defaults', async () => {
    const user = userEvent.setup(); const writes: { path: string; body: unknown }[] = []; const saved = vi.fn()
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async (url, options) => { const path = new URL(String(url)).pathname; if (path.endsWith('/documents')) return ok({ id: '900719925474099319' }); writes.push({ path, body: JSON.parse(String(options?.body)) }); return ok({ ...entry, state: 'RECORDED' }) }))
    renderWithProviders(<ManualEntryDialog action="result" declarationId={id} entry={{ ...entry, state: 'RECORDED', submissionId: '900719925474099320' }} lines={[line, { ...line, declarationItemId: '900719925474099321', sequenceNumber: 2 }]} onClose={vi.fn()} onSaved={saved} onReconcile={vi.fn()} />)
    expect(screen.getByLabelText('Line 1 result')).toHaveValue('')
    await user.type(screen.getByLabelText('External date and time (America/Curacao)'), '2026-11-03T09:30'); await user.type(screen.getByLabelText('External reference'), 'QA-RESPONSE')
    await user.selectOptions(screen.getByLabelText('Overall SVB result'), 'PARTIALLY_REJECTED'); await user.selectOptions(screen.getByLabelText('Line 1 result'), 'ACCEPTED'); await user.selectOptions(screen.getByLabelText('Line 2 result'), 'REJECTED')
    await user.upload(screen.getByLabelText('Official response evidence', { exact: false }), new File(['%PDF-1.4 synthetic QA'], 'qa-response.pdf', { type: 'application/pdf' })); await user.click(screen.getByLabelText(/I reviewed the official response/))
    await user.click(screen.getByRole('button', { name: 'Record SVB result' })); expect(await screen.findByText(/Choose every line result/)).toBeInTheDocument(); expect(writes).toHaveLength(0)
    await user.type(screen.getByLabelText('Line 2 response code'), 'QA-REJECT'); await user.click(screen.getByRole('button', { name: 'Record SVB result' })); await waitFor(() => expect(saved).toHaveBeenCalled())
    expect(writes[0]).toMatchObject({ path: `/api/v1/declarations/${id}/submissions/900719925474099320/official-result`, body: { status: 'PARTIALLY_REJECTED', lines: [{ declarationItemId: line.declarationItemId, status: 'ACCEPTED' }, { declarationItemId: '900719925474099321', status: 'REJECTED', responseCode: 'QA-REJECT' }] } })
  })
  it('cannot release uncertainty without portal verification evidence and protects dirty edits on close', async () => {
    const closed = vi.fn(); const fetcher = vi.fn(); stubManualFetch(fetcher)
    renderWithProviders(<ManualEntryDialog action="release" declarationId={id} entry={{ ...entry, state: 'UNCERTAIN' }} lines={[line]} onClose={closed} onSaved={vi.fn()} onReconcile={vi.fn()} />)
    await userEvent.type(screen.getByLabelText('Reason / explanation'), 'QA verified no external record')
    await userEvent.click(screen.getByLabelText(/I checked the official portal/)); await userEvent.click(screen.getByRole('button', { name: 'Release preparation' }))
    expect(await screen.findByText('Attach the external evidence before recording.')).toBeInTheDocument(); expect(fetcher).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' })); expect(screen.getByRole('dialog', { name: 'Close this record?' })).toBeInTheDocument(); expect(closed).not.toHaveBeenCalled()
  })
})



describe('DEP10 authoritative availability', () => {
  it.each(['false', 'absent', 'error'])('blocks new actions for readiness %s while retaining resolution', async (mode) => {
    session()
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async (url) => {
      const path = new URL(String(url)).pathname
      if (path.endsWith('/readiness')) {
        if (mode === 'error') throw new TypeError('offline')
        const readiness = syntheticReadiness(false); if (mode === 'absent') delete readiness.manualPortalRecordingEnabled
        return ok(readiness)
      }
      if (path.includes('/invoices/')) return ok({ status: 'CLOSED', items: [{ id: line.invoiceItemId }] })
      return ok({ ...dossier, entry: { ...entry, state: 'UNCERTAIN' } })
    }))
    renderWithProviders(<MemoryRouter><ManualEntryPanel declaration={{ id, status: 'DRAFT' } as Declaration} hasItems /></MemoryRouter>)
    expect(await screen.findByText(/Preparation .*UNCERTAIN/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Prepare manual entry' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Record portal entry' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Release verified preparation' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Download internal dossier' })).toBeEnabled()
  })
  it('rechecks availability at preparation confirmation and never posts when it changed to false', async () => {
    session(); let reads = 0; const writes = vi.fn()
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async (url, options) => {
      const path = new URL(String(url)).pathname
      if (path.endsWith('/readiness')) return ok(syntheticReadiness(++reads === 1))
      if (options?.method === 'POST') { writes(); return ok(entry) }
      if (path.includes('/invoices/')) return ok({ status: 'CLOSED', items: [{ id: line.invoiceItemId }] })
      return ok(dossier)
    }))
    renderWithProviders(<MemoryRouter><ManualEntryPanel declaration={{ id, status: 'DRAFT' } as Declaration} hasItems /></MemoryRouter>)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Prepare manual entry' })).toBeEnabled())
    await userEvent.click(screen.getByRole('button', { name: 'Prepare manual entry' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Prepare manual entry' }))
    expect(await within(screen.getByRole('dialog')).findByText('SVB submission pending — file specification not confirmed.')).toBeInTheDocument()
    expect(writes).not.toHaveBeenCalled()
  })
  it('retains form values when recording is disabled and associates invalid evidence with its control', async () => {
    const props = { action: 'record' as const, declarationId: id, entry, lines: [line], onClose: vi.fn(), onSaved: vi.fn(), onReconcile: vi.fn() }
    const view = renderWithProviders(<ManualEntryDialog {...props} canRecordNew />)
    await userEvent.type(screen.getByLabelText('Reason / explanation'), 'SYNTHETIC retained reason')
    const file = screen.getByLabelText('Portal receipt', { exact: false })
    await userEvent.upload(file, new File([], 'empty.pdf', { type: 'application/pdf' }))
    expect(file).toHaveAttribute('aria-invalid', 'true'); expect(file).toHaveAccessibleDescription(/Use a non-empty PDF/)
    view.rerender(<ManualEntryDialog {...props} canRecordNew={false} />)
    expect(screen.getByLabelText('Reason / explanation')).toHaveValue('SYNTHETIC retained reason')
    expect(screen.getByRole('button', { name: 'Record portal entry' })).toBeDisabled()
  })
})
