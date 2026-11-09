import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, it, vi } from 'vitest'
import { authStore } from '../auth/auth-store'
import { DentalinkPage } from '../features/dentalink/dentalink-page'
import { DentalinkRunView } from '../features/dentalink/dentalink-run'
import { validExternalId } from '../features/dentalink/dentalink-api'
import { renderWithProviders } from './test-utils'

const accountId = '90071992547409939999'
const runId = '90071992547409939998'
const localId = '90071992547409939997'
const account = {
  id: accountId,
  externalAccountId: '000001',
  label: 'Synthetic source',
  enabled: true,
}
const hash = 'a'.repeat(64)
const run = {
  id: runId,
  accountId,
  state: 'PREVIEW_READY',
  from: null,
  to: null,
  contentHash: hash,
  counts: { total: 2, ready: 1, issues: 1 },
  hasNextPage: false,
  sourceMode: 'SYNTHETIC',
  realConnectionVerified: false,
  createdAt: '2026-11-08T12:00:00Z',
  confirmedAt: null,
}
const rows = [
  {
    id: '1',
    entityType: 'PATIENT',
    externalId: '00007',
    data: {
      firstName: 'Synthetic',
      lastName: 'Patient',
      injectedPrivateField: 'DO NOT DISPLAY RAW PAYLOAD',
    },
    disposition: 'READY',
    issueCodes: [],
    patientId: null,
    appointmentId: null,
  },
  {
    id: '2',
    entityType: 'APPOINTMENT',
    externalId: '00008',
    data: {},
    disposition: 'ISSUE',
    issueCodes: ['PROVIDER_MAPPING_MISSING'],
    patientId: null,
    appointmentId: null,
  },
]
const full = [
  'dentalink.read',
  'dentalink.manage',
  'dentalink.import',
  'patient.read',
  'appointment.read',
  'patient.create',
  'appointment.create',
  'provider.read',
  'clinic_location.read',
]
const ok = (data: unknown, meta = { page: 1, pageSize: 20, total: 1, totalPages: 1 }) =>
  new Response(JSON.stringify({ success: true, data, meta }), {
    headers: { 'Content-Type': 'application/json' },
  })
const fail = (code: string) =>
  new Response(JSON.stringify({ success: false, error: { code, message: 'RAW SERVER MESSAGE' } }), {
    status: 409,
    headers: { 'Content-Type': 'application/json' },
  })
function session(permissions = full) {
  authStore.setSession('memory-qa', {
    id: '1',
    organizationId: '1',
    email: 'qa@local.invalid',
    firstName: 'QA',
    lastName: 'Operator',
    roles: ['ADMIN'],
    permissions,
  })
}
function render(ui = <DentalinkPage />) {
  return renderWithProviders(<MemoryRouter>{ui}</MemoryRouter>)
}
function mock(
  handler?: (path: string, init?: RequestInit) => Response | Promise<Response> | undefined,
) {
  const calls: { path: string; init?: RequestInit }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input, init) => {
      const path = new URL(String(input)).pathname
      calls.push({ path, init })
      const special = await handler?.(path, init)
      if (special) return special
      if (path.endsWith('/accounts')) return ok([account])
      if (path.endsWith('/status'))
        return ok({
          account,
          state: 'SYNTHETIC_QA',
          canPreview: true,
          realConnectionVerified: false,
          mode: 'READ_ONLY_IMPORT',
        })
      if (path.endsWith('/mappings')) return ok([])
      if (path.endsWith('/providers'))
        return ok([{ id: localId, firstName: 'QA', lastName: 'Provider' }])
      if (path.endsWith('/items')) return ok(rows)
      if (path.endsWith('/previews')) return ok([run])
      return ok(run)
    }),
  )
  return calls
}
afterEach(() => {
  authStore.clearSession()
  vi.unstubAllGlobals()
})
it('preserves exact external identifiers and rejects unsafe or trimmed variants', () => {
  expect(validExternalId('000007')).toBe(true)
  expect(validExternalId('AbC')).toBe(true)
  expect(validExternalId(' 000007')).toBe(false)
  expect(validExternalId('000007\n')).toBe(false)
  expect(validExternalId('')).toBe(false)
})
it('shows not configured without fabricated results or an enabled preview action', async () => {
  session()
  mock((path) =>
    path.endsWith('/status')
      ? ok({
          account,
          state: 'NOT_CONFIGURED',
          canPreview: false,
          realConnectionVerified: false,
          mode: 'READ_ONLY_IMPORT',
        })
      : path.endsWith('/previews')
        ? ok([])
        : undefined,
  )
  render()
  await userEvent.click(await screen.findByRole('button', { name: 'Synthetic source · 000001' }))
  expect(await screen.findByText('Synthetic source · NOT_CONFIGURED')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Prepare preview' })).toBeDisabled()
  expect(await screen.findByText('No import runs recorded.')).toBeInTheDocument()
  expect(screen.queryByText('Ready')).not.toBeInTheDocument()
})
it('uses effective permissions rather than ADMIN to expose configuration or private rows', async () => {
  session(['dentalink.read'])
  const calls = mock()
  render()
  expect(screen.queryByRole('button', { name: 'Create disabled account' })).not.toBeInTheDocument()
  await userEvent.click(await screen.findByRole('button', { name: 'Synthetic source · 000001' }))
  await userEvent.click(
    await screen.findByRole('button', { name: `Review #${runId} · PREVIEW_READY` }),
  )
  expect(
    await screen.findByText(
      'Patient and appointment read permissions are required to view private rows.',
    ),
  ).toBeInTheDocument()
  expect(calls.some((call) => call.path.endsWith('/items'))).toBe(false)
  expect(
    screen.queryByRole('button', { name: 'Review local import confirmation' }),
  ).not.toBeInTheDocument()
})
it('recovers the same preview request after a lost response and rejects an offset-free period', async () => {
  session()
  const writes: unknown[] = []
  mock((path, init) => {
    if (path.endsWith('/previews') && init?.method === 'POST') {
      writes.push(JSON.parse(String(init.body)))
      if (writes.length === 1) throw new TypeError('Lost response')
      return ok(run)
    }
  })
  render()
  await userEvent.click(await screen.findByRole('button', { name: 'Synthetic source · 000001' }))
  await screen.findByText('Synthetic source · SYNTHETIC_QA')
  await userEvent.type(screen.getByLabelText('From (ISO with offset)'), '2026-11-08T00:00:00')
  await userEvent.type(screen.getByLabelText('To (ISO with offset)'), '2026-11-09T00:00:00')
  expect(screen.getByRole('button', { name: 'Prepare preview' })).toBeDisabled()
  await userEvent.type(screen.getByLabelText('From (ISO with offset)'), '-04:00')
  await userEvent.type(screen.getByLabelText('To (ISO with offset)'), '-04:00')
  await userEvent.click(screen.getByRole('button', { name: 'Prepare preview' }))
  await userEvent.click(
    await screen.findByRole('button', { name: 'Recover preview with original request' }),
  )
  await waitFor(() => expect(writes).toHaveLength(2))
  expect(writes[1]).toEqual(writes[0])
  expect(writes[0]).toMatchObject({
    from: '2026-11-08T00:00:00-04:00',
    to: '2026-11-09T00:00:00-04:00',
  })
})
it('requires explicit confirmation and retains exact hash and key across an ambiguous failure', async () => {
  session()
  const writes: unknown[] = []
  let confirmed = false
  mock((path, init) => {
    if (path.endsWith('/confirm')) {
      writes.push(JSON.parse(String(init?.body)))
      if (writes.length === 1) throw new TypeError('Lost response')
      confirmed = true
      return ok({ ...run, state: 'CONFIRMED' })
    }
    if (path.endsWith(runId))
      return ok({ ...run, state: confirmed ? 'CONFIRMED' : 'PREVIEW_READY' })
  })
  render(<DentalinkRunView accountId={accountId} runId={runId} />)
  await userEvent.click(
    await screen.findByRole('button', { name: 'Review local import confirmation' }),
  )
  expect(writes).toHaveLength(0)
  await userEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Confirm local import',
    }),
  )
  await screen.findByText(/original confirmation key and content hash are retained/)
  await waitFor(() =>
    expect(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm local import' }),
    ).toBeEnabled(),
  )
  await userEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Confirm local import',
    }),
  )
  await screen.findByRole('status')
  expect(writes).toHaveLength(2)
  expect(writes[1]).toEqual(writes[0])
  expect(writes[0]).toMatchObject({ expectedContentHash: hash })
})
it('reconciles a committed confirmation after response loss without offering a second import', async () => {
  session()
  let confirmed = false
  let writes = 0
  mock((path, init) => {
    if (path.endsWith('/confirm') && init?.method === 'POST') {
      writes++
      confirmed = true
      throw new TypeError('Lost after commit')
    }
    if (path.endsWith(runId))
      return ok({ ...run, state: confirmed ? 'CONFIRMED' : 'PREVIEW_READY' })
  })
  render(<DentalinkRunView accountId={accountId} runId={runId} />)
  await userEvent.click(
    await screen.findByRole('button', { name: 'Review local import confirmation' }),
  )
  await userEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm local import' }),
  )
  expect(await screen.findByText(/Local import confirmed\./)).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Review local import confirmation' }),
  ).not.toBeInTheDocument()
  expect(writes).toBe(1)
})
it('shows issues and only allowlisted administrative fields with links to existing operational views', async () => {
  session()
  mock((path) =>
    path.endsWith('/items')
      ? ok([{ ...rows[0], disposition: 'IMPORTED', patientId: localId }, rows[1]])
      : undefined,
  )
  render(<DentalinkRunView accountId={accountId} runId={runId} />)
  expect(await screen.findByText('Provider mapping missing')).toBeInTheDocument()
  expect(screen.queryByText(/DO NOT DISPLAY RAW PAYLOAD/)).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Open patient' })).toHaveAttribute(
    'href',
    `/patients/${localId}`,
  )
  expect(screen.getByRole('cell', { name: /00007/ })).toHaveTextContent('PATIENT00007')
})
it('cannot confirm an incomplete reading and retries reading without supplying a browser cursor', async () => {
  session()
  const bodies: unknown[] = []
  let reading = true
  mock((path, init) => {
    if (path.endsWith('/read-next-page')) {
      bodies.push(init?.body)
      reading = false
      return ok(run)
    }
    if (path.endsWith(runId))
      return ok(reading ? { ...run, state: 'READING', contentHash: null, hasNextPage: true } : run)
  })
  render(<DentalinkRunView accountId={accountId} runId={runId} />)
  await screen.findByRole('button', { name: 'Read next source page' })
  expect(
    screen.queryByRole('button', { name: 'Review local import confirmation' }),
  ).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Read next source page' }))
  expect(
    await screen.findByRole('button', { name: 'Review local import confirmation' }),
  ).toBeInTheDocument()
  expect(bodies).toEqual([undefined])
})
it('does not manufacture zero counts or enable confirmation when rows fail to load', async () => {
  session()
  mock((path) =>
    path.endsWith('/items')
      ? fail('DENTALINK_RESOURCE_NOT_FOUND')
      : path.endsWith(runId)
        ? ok({ ...run, counts: {} })
        : undefined,
  )
  render(<DentalinkRunView accountId={accountId} runId={runId} />)
  expect(await screen.findByText('Unable to load preview rows')).toBeInTheDocument()
  expect(screen.getAllByText('Not reported')).toHaveLength(6)
  expect(
    screen.queryByRole('button', { name: 'Review local import confirmation' }),
  ).not.toBeInTheDocument()
  expect(screen.queryByText('RAW SERVER MESSAGE')).not.toBeInTheDocument()
})
