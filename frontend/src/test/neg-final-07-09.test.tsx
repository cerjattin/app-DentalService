import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { authStore } from '../auth/auth-store'
import { deploymentContext } from '../app/deployment-context'
import { EnvironmentNotice } from '../components/app-shell/environment-notice'
import { ManualPortalWorkflow } from '../features/declarations/manual-portal-workflow'
import type { Declaration, DeclarationExport, DeclarationItem } from '../types/declaration'
import { renderWithProviders } from './test-utils'
import { syntheticReadiness } from './fixtures/svb-readiness'

const line = { id: '900719925474099311', invoiceItemId: '900719925474099312', sequenceNumber: 1, invoiceNumberSnapshot: 'QA-001', serviceDateSnapshot: '2026-11-03', insuredIdSnapshot: '000012345', amountSnapshot: '999999999.99', assistanceSnapshot: null, numberOfTreatmentsSnapshot: null } as DeclarationItem
const declaration = { id: '900719925474099313', status: 'EXPORTED' } as Declaration
const exportRow = { id: '900719925474099314', format: 'JSON', schemaVersion: '1', adapterVersion: 'svb-test', recordCount: 2, exportedByUserId: '900719925474099315', exportedAt: '2026-11-03T12:00:00Z', document: { originalFilename: 'qa-technical.json', sha256: 'a'.repeat(64) } } as DeclarationExport
const session = (permissions: string[]) => authStore.setSession('memory-uat', { id: '1', organizationId: '1', firstName: 'QA', lastName: 'User', email: 'qa@local.invalid', roles: [], permissions })
afterEach(() => { authStore.clearSession(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('NEG-FINAL-07 manual portal preparation', () => {
  it('groups the worksheet by invoice and requires no upload file', async () => {
    session(['declaration.read']); renderWithProviders(<ManualPortalWorkflow declaration={declaration} items={[line, { ...line, id: '22', sequenceNumber: 2 }]} exports={[]} />)
    await userEvent.click(screen.getByText('Manual entry worksheet'))
    expect(screen.getAllByRole('heading', { name: 'Invoice QA-001' })).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Review line 2' })).toBeEnabled()
    expect(screen.getByText(/one manual presentation per invoice/)).toBeInTheDocument()
    expect(screen.queryByLabelText('File to review')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Review line 1' }))
    const modal = screen.getByRole('dialog'); expect(within(modal).getByText('000012345')).toBeInTheDocument(); expect(within(modal).queryByRole('textbox')).not.toBeInTheDocument()
  })
  it('only enables the official portal link with authoritative synthetic QA availability, without patient data or referrer', async () => {
    session(['declaration.read', 'svb_procedure.read']); vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: true, data: syntheticReadiness() }), { headers: { 'Content-Type': 'application/json' } })))
    renderWithProviders(<ManualPortalWorkflow declaration={declaration} items={[]} exports={[]} />)
    const portal = await screen.findByRole('link', { name: 'Open official portal' })
    expect(portal).toHaveAttribute('href', 'https://online.svbcur.org/SVB_CarePortal/')
    expect(portal).toHaveAttribute('referrerpolicy', 'no-referrer'); expect(portal).toHaveAttribute('target', '_blank'); expect(portal).toHaveAttribute('rel', 'noopener noreferrer')
  })
  it('never invents submission/result success when their evidence contract is unavailable', () => {
    session(['declaration.read', 'declaration.submit']); const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
    renderWithProviders(<ManualPortalWorkflow declaration={declaration} items={[]} exports={[]} />)
    expect(screen.getByRole('button', { name: 'Record portal entry' })).toBeDisabled(); expect(screen.getByRole('button', { name: 'Record SVB result' })).toBeDisabled()
    expect(screen.getByText('A receipt is not acceptance. Acceptance is not payment.')).toBeInTheDocument(); expect(fetcher).not.toHaveBeenCalled()
  })
  it('shows exact stored file identity without calculating totals or claiming portal compatibility', async () => {
    session(['declaration.read']); renderWithProviders(<ManualPortalWorkflow declaration={declaration} items={[]} exports={[exportRow]} />)
    await userEvent.click(screen.getByText('Technical file identity'))
    expect(screen.getByText('a'.repeat(64))).toBeInTheDocument(); expect(screen.getByText(exportRow.exportedByUserId)).toBeInTheDocument()
    expect(screen.getByText(/not an approved SVB upload layout/)).toBeInTheDocument()
  })
})

describe('NEG-FINAL-08 visible environment', () => {
  it('does not guess a production environment or version', () => { expect(deploymentContext(undefined, undefined)).toEqual({ label: 'Environment not identified', release: 'Version not identified' }) })
  it('accepts only known environment names and a public release identifier', () => { expect(deploymentContext('QA', 'rc-20261103.1')).toEqual({ label: 'QA', release: 'rc-20261103.1' }); expect(deploymentContext('private-secret', 'https://user:pass@host')).toEqual({ label: 'Environment not identified', release: 'Version not identified' }) })
  it('shows the environment and manual operation before any session is established', () => {
    vi.stubEnv('VITE_APP_ENVIRONMENT', 'pilot'); vi.stubEnv('VITE_APP_VERSION', 'rc-1')
    renderWithProviders(<EnvironmentNotice />); expect(screen.getByLabelText('Application environment')).toHaveTextContent('Clinic pilot'); expect(screen.getByText(/No automatic submission/)).toBeInTheDocument()
  })
})
