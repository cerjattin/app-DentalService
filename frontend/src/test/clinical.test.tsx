import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { authStore } from '../auth/auth-store'
import { ClinicalAppointmentPage } from '../features/clinical/clinical-appointment-page'
import { getEncounter, getTariff } from '../features/clinical/clinical-api'
import { positiveQuantitySchema } from '../features/clinical/clinical-model'
import { renderWithProviders } from './test-utils'

const aid = '90071992547409939999'
const eid = '90071992547409938888'
const pid = '90071992547409937777'
const did = '90071992547409936666'
const sid = '90071992547409935555'
const insuranceId = '90071992547409934444'
const fullPermissions = [
  'appointment.read',
  'appointment.start',
  'patient.read',
  'insurance.read',
  'encounter.read',
  'encounter.create',
  'encounter.update',
  'encounter.complete',
  'diagnosis.read',
  'diagnosis.assign',
  'procedure.read',
  'procedure.update',
  'svb_procedure.read',
  'svb_tariff.read',
  'authorization.read',
  'authorization.create',
  'authorization.update',
]
const appointment = {
  id: aid,
  patientId: pid,
  providerId: 'provider-identifier',
  appointmentNumber: 'QA-F05',
  scheduledStart: '2027-03-10T02:00:00.000Z',
  scheduledEnd: '2027-03-10T02:30:00.000Z',
  status: 'IN_PROGRESS',
  treatmentCaseId: '90071992547409932222',
  patient: {
    id: pid,
    firstName: 'Clinical',
    lastName: 'Patient',
    patientNumber: 'PAT-F05',
    documentNumber: 'DOC-F05',
  },
  provider: {
    id: 'provider-identifier',
    firstName: 'QA',
    lastName: 'Professional',
  },
  location: { name: 'QA Clinic' },
}
const encounter = {
  id: eid,
  appointmentId: aid,
  status: 'OPEN',
  startedAt: '2027-03-10T02:00:00.000Z',
  completedAt: null,
  chiefComplaint: 'Examination',
  clinicalNotes: null,
  patient: { id: pid },
}
const code = {
  id: did,
  code: 'K02',
  description: 'Dental caries',
  codeSystem: 'ICD10',
  isActive: true,
}
const diagnosis = {
  id: '90071992547409931111',
  diagnosisCodeId: did,
  codeSnapshot: 'K02',
  descriptionSnapshot: 'Dental caries',
  isPrimary: true,
  notes: null,
  diagnosisCode: code,
}
const catalogue = {
  id: sid,
  code: 'QA-PROC',
  description: 'QA examination',
  isActive: true,
  requiresAuthorization: false,
  requiresReferral: false,
}
const procedure = {
  id: '90071992547409930001',
  encounterId: eid,
  patientInsuranceId: insuranceId,
  svbProcedureId: sid,
  procedureCodeSnapshot: 'QA-PROC',
  procedureDescriptionSnapshot: 'QA examination',
  status: 'PERFORMED',
  quantity: '2.00',
  unitTariffSnapshot: '75.10',
  currencyCodeSnapshot: 'ANG',
  amount: '150.20',
  treatmentIdSnapshot: 'TC-AUTHORITATIVE',
  insuredIdSnapshot: 'INS-F05',
  diagnosticCodeSnapshot: 'K02',
  diagnosisId: diagnosis.id,
  authorizationIdSnapshot: null,
  authorizationItem: null,
  additionalNote: null,
  svbProcedure: catalogue,
}
const policy = {
  id: insuranceId,
  patientId: pid,
  insuredId: 'INS-F05',
  status: 'ACTIVE',
  validFrom: '2027-01-01',
  validTo: '2027-12-31',
  payer: { id: '77', name: 'QA Payer' },
}
const authorization = {
  id: '1001',
  authorizationId: 'AUTH-QA',
  patientId: pid,
  patientInsuranceId: insuranceId,
  status: 'APPROVED',
  validFrom: '2027-01-01',
  validTo: '2027-12-31',
  issuedAt: null,
  notes: null,
  patientInsurance: { insuredId: 'INS-F05', payer: { name: 'QA Payer' } },
  items: [
    {
      id: '1002',
      svbProcedureId: sid,
      procedureCodeSnapshot: 'QA-PROC',
      authorizedQuantity: '5.00',
      usedQuantity: '1.00',
      remainingQuantity: '4.00',
      validFrom: null,
      validTo: null,
      notes: null,
    },
  ],
}
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
function ok(data: unknown, list = false) {
  return json({
    success: true,
    data,
    ...(list
      ? { meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } }
      : {}),
  })
}
function failure(code: string, status = 409) {
  return json(
    { success: false, error: { code, message: 'RAW_BACKEND_ERROR' } },
    status,
  )
}
function boundary(
  options: {
    absent?: boolean
    completed?: boolean
    appointmentStatus?: string
    requiresAuthorization?: boolean
    fail?: string
    failCode?: string
    pending?: string
    withDiagnosis?: boolean
    withProcedure?: boolean
  } = {},
) {
  let enc = options.absent
    ? null
    : { ...encounter, status: options.completed ? 'COMPLETED' : 'OPEN' }
  let appt = {
    ...appointment,
    status: options.appointmentStatus ?? 'IN_PROGRESS',
  }
  let diagnoses = options.withDiagnosis === false ? [] : [{ ...diagnosis }]
  let procedures = options.withProcedure ? [{ ...procedure }] : []
  const calls: {
    method: string
    url: URL
    body: Record<string, unknown>
    headers: Headers
  }[] = []
  const mock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const parsed = new URL(url)
    const path = parsed.pathname.replace('/api/v1', '')
    const method = init.method ?? 'GET'
    const body = init.body
      ? (JSON.parse(String(init.body)) as Record<string, unknown>)
      : {}
    calls.push({
      method,
      url: parsed,
      body,
      headers: new Headers(init.headers),
    })
    if (`${method} ${path}` === options.pending)
      return new Promise<Response>(() => undefined)
    if (`${method} ${path}` === options.fail)
      return failure(
        options.failCode ?? 'INVALID_CLINICAL_ENCOUNTER_STATUS',
        options.failCode === 'PERMISSION_DENIED' ? 403 : 409,
      )
    if (path === `/appointments/${aid}`) return ok(appt)
    if (path === `/appointments/${aid}/status`) {
      appt = { ...appt, status: String(body.status) }
      return ok(appt)
    }
    if (path === `/appointments/${aid}/clinical-encounter`) {
      if (method === 'POST') enc = { ...encounter }
      return enc ? ok(enc) : failure('CLINICAL_ENCOUNTER_NOT_FOUND', 404)
    }
    if (path === `/clinical-encounters/${eid}`) {
      enc = { ...enc!, ...body }
      return ok(enc)
    }
    if (path === `/clinical-encounters/${eid}/complete`) {
      enc = { ...enc!, status: 'COMPLETED' }
      return ok(enc)
    }
    if (path === `/patients/${pid}/insurance`) return ok([policy])
    if (path === '/diagnosis-codes') return ok([code], true)
    if (path === '/svb-procedures')
      return ok(
        [
          {
            ...catalogue,
            requiresAuthorization: options.requiresAuthorization ?? false,
          },
        ],
        true,
      )
    if (path === `/svb-procedures/${sid}/applicable-tariff`)
      return ok({
        procedure: catalogue,
        tariff: { amount: '75.10', currencyCode: 'ANG' },
        serviceDate: '2027-03-09',
      })
    if (path.startsWith(`/clinical-encounters/${eid}/diagnoses`)) {
      if (method === 'POST') {
        diagnoses = [{ ...diagnosis, ...body }]
        return ok(diagnoses[0])
      }
      if (method === 'PATCH') {
        diagnoses = [{ ...diagnosis, ...body }]
        return ok(diagnoses[0])
      }
      if (method === 'DELETE') {
        diagnoses = []
        return ok(diagnosis)
      }
      return ok(diagnoses)
    }
    if (path.startsWith(`/clinical-encounters/${eid}/procedures`)) {
      if (method === 'POST') {
        procedures = [...procedures, { ...procedure, ...body }]
        return ok(procedures.at(-1))
      }
      if (method === 'PATCH') {
        procedures = [{ ...procedure, ...body }]
        return ok(procedures[0])
      }
      if (method === 'DELETE') {
        procedures = []
        return ok(procedure)
      }
      return ok(procedures)
    }
    if (path === '/authorizations')
      return method === 'GET'
        ? ok([authorization], true)
        : ok({ ...authorization, ...body })
    if (path.startsWith('/authorizations/'))
      return ok({ ...authorization, ...body })
    throw new Error(`Unexpected API call: ${method} ${path}`)
  })
  vi.stubGlobal('fetch', mock)
  return { calls, mock }
}
function renderClinical(permissions = fullPermissions) {
  authStore.setSession('test-memory-token', {
    id: '111',
    email: 'qa@example.test',
    firstName: 'QA',
    lastName: 'Professional',
    organizationId: '1',
    roles: [],
    permissions,
  })
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/clinical/${aid}`]}>
      <Routes>
        <Route
          path="/clinical/:appointmentId"
          element={<ClinicalAppointmentPage />}
        />
      </Routes>
    </MemoryRouter>,
  )
}
afterEach(() => {
  authStore.clearSession()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
async function addProcedureForm() {
  await userEvent.click(
    await screen.findByRole('button', { name: 'Add procedure' }),
  )
  await userEvent.click(
    await screen.findByRole('button', { name: /QA-PROC QA examination/ }),
  )
  await screen.findByText('Tariff: ANG 75.10')
  await userEvent.selectOptions(
    screen.getByLabelText('Procedure insurance'),
    insuranceId,
  )
  await userEvent.type(screen.getByLabelText('Quantity'), '2.00')
}

describe('clinical route and encounter', () => {
  it('denies the clinical route without encounter read and sends no requests', () => {
    const api = boundary()
    renderClinical(['appointment.read', 'encounter.create'])
    expect(
      screen.getByText("You don't have permission to access this area."),
    ).toBeInTheDocument()
    expect(api.mock).not.toHaveBeenCalled()
  })
  it('does not fetch appointment context without its permission', () => {
    const api = boundary()
    renderClinical(['encounter.read'])
    expect(api.mock).not.toHaveBeenCalled()
  })
  it('renders encounter loading', async () => {
    boundary({ pending: `GET /appointments/${aid}/clinical-encounter` })
    renderClinical()
    expect(await screen.findByText('Loading encounter')).toBeInTheDocument()
  })
  it('renders absent encounter and creates exactly once with unchanged IDs', async () => {
    const api = boundary({ absent: true })
    renderClinical()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Open encounter' }),
    )
    await screen.findByLabelText('Clinical notes')
    const writes = api.calls.filter((call) => call.method === 'POST')
    expect(writes).toHaveLength(1)
    expect(writes[0].url.pathname).toBe(
      `/api/v1/appointments/${aid}/clinical-encounter`,
    )
    expect(writes[0].body).toEqual({})
  })
  it('resumes an existing encounter and reuses appointment context without creating one', async () => {
    const api = boundary()
    renderClinical()
    await screen.findByLabelText('Clinical notes')
    expect(screen.getByText('Clinical Patient')).toBeInTheDocument()
    expect(screen.getByText('QA Professional')).toBeInTheDocument()
    expect(api.calls.filter((call) => call.method === 'POST')).toHaveLength(0)
  })
  it('starts a checked-in appointment explicitly before offering encounter creation', async () => {
    const api = boundary({ absent: true, appointmentStatus: 'CHECKED_IN' })
    renderClinical()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Start appointment' }),
    )
    await screen.findByRole('button', { name: 'Open encounter' })
    expect(api.calls.find((call) => call.method === 'PATCH')?.body).toEqual({
      status: 'IN_PROGRESS',
    })
  })
  it('does not offer start or create on an unsupported appointment state', async () => {
    boundary({ absent: true, appointmentStatus: 'CANCELLED' })
    renderClinical()
    await screen.findByText('No clinical encounter recorded.')
    expect(
      screen.queryByRole('button', { name: 'Open encounter' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Start appointment' }),
    ).not.toBeInTheDocument()
  })
  it('saves notes and prevents completion with unsaved notes', async () => {
    const api = boundary()
    renderClinical()
    await userEvent.type(
      await screen.findByLabelText('Clinical notes'),
      'QA notes',
    )
    expect(
      screen.getByRole('button', { name: 'Complete encounter' }),
    ).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Save notes' }))
    await screen.findByText('Clinical notes saved.')
    expect(
      api.calls.find(
        (call) => call.url.pathname === `/api/v1/clinical-encounters/${eid}`,
      )?.body,
    ).toMatchObject({ clinicalNotes: 'QA notes' })
  })
  it('completes through the backend then makes all clinical mutations read only', async () => {
    const api = boundary({ withProcedure: true })
    renderClinical()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Complete encounter' }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    await screen.findByText('This encounter is read only.')
    expect(
      screen.queryByRole('button', { name: 'Add diagnosis' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Add procedure' }),
    ).not.toBeInTheDocument()
    expect(
      api.calls.some(
        (call) =>
          call.url.pathname.endsWith('/complete') && call.method === 'POST',
      ),
    ).toBe(true)
    expect(
      api.calls.filter((call) => call.url.pathname.endsWith('/status')),
    ).toHaveLength(0)
  })
  it('displays completed history without update, authorization or complete actions', async () => {
    boundary({ completed: true, withProcedure: true })
    renderClinical()
    await screen.findByText('This encounter is read only.')
    expect(
      screen.queryByRole('button', { name: 'Complete encounter' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Add authorization' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Clinical notes')).not.toBeInTheDocument()
  })
  it('maps an invalid completion state without raw backend text', async () => {
    boundary({ fail: `POST /clinical-encounters/${eid}/complete` })
    renderClinical()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Complete encounter' }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This encounter cannot be completed in its current state.',
    )
    expect(screen.queryByText('RAW_BACKEND_ERROR')).not.toBeInTheDocument()
  })
  it('retains authentication after a clinical 403', async () => {
    boundary({
      fail: `POST /clinical-encounters/${eid}/complete`,
      failCode: 'PERMISSION_DENIED',
    })
    renderClinical()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Complete encounter' }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    await screen.findByRole('alert')
    expect(authStore.getAccessToken()).toBe('test-memory-token')
  })
  it('hides independent actions and skips forbidden catalogue/insurance reads', async () => {
    const api = boundary()
    renderClinical(['appointment.read', 'encounter.read'])
    await screen.findByText('Examination')
    expect(
      screen.queryByRole('button', { name: /Add|Complete|Save/ }),
    ).not.toBeInTheDocument()
    expect(api.calls).toHaveLength(2)
  })
})
describe('diagnoses', () => {
  it('renders diagnosis snapshots', async () => {
    boundary()
    renderClinical()
    expect(await screen.findByText('Dental caries')).toBeInTheDocument()
    expect(screen.getByText('Primary')).toBeInTheDocument()
  })
  it('searches server catalogue and assigns a diagnosis', async () => {
    const api = boundary({ withDiagnosis: false })
    renderClinical()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Add diagnosis' }),
    )
    fireEvent.change(await screen.findByLabelText('Search diagnosis codes'), {
      target: { value: 'K02' },
    })
    await waitFor(() =>
      expect(
        api.calls.some((call) => call.url.searchParams.get('q') === 'K02'),
      ).toBe(true),
    )
    await userEvent.click(
      await screen.findByRole('button', { name: /K02 Dental caries/ }),
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Save diagnosis' }),
    )
    await screen.findByText('Diagnosis saved.')
    expect(
      api.calls.find((call) => call.method === 'POST')?.body,
    ).toMatchObject({ diagnosisCodeId: did })
    expect(await screen.findByText('Dental caries')).toBeInTheDocument()
  })
  it('edits only diagnosis notes and primary flag', async () => {
    const api = boundary()
    renderClinical()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Edit diagnosis K02' }),
    )
    await userEvent.type(
      screen.getByLabelText('Diagnosis notes'),
      'QA diagnosis note',
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Save diagnosis' }),
    )
    await screen.findByText('Diagnosis saved.')
    expect(api.calls.find((call) => call.method === 'PATCH')?.body).toEqual({
      isPrimary: true,
      notes: 'QA diagnosis note',
    })
  })
  it('removes diagnosis only after confirmation', async () => {
    const api = boundary()
    renderClinical()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Remove diagnosis K02' }),
    )
    expect(api.calls.some((call) => call.method === 'DELETE')).toBe(false)
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    await screen.findByText('No diagnoses recorded.')
  })
})
describe('performed procedures, tariffs and authorizations', () => {
  it('displays backend TreatmentId separately from treatment case reference', async () => {
    boundary({ withProcedure: true })
    renderClinical()
    expect(
      await screen.findByText('TreatmentId: TC-AUTHORITATIVE'),
    ).toBeInTheDocument()
    expect(screen.getByText(appointment.treatmentCaseId)).toBeInTheDocument()
    expect(screen.queryByLabelText('TreatmentId')).not.toBeInTheDocument()
  })
  it('keeps tariff decimals and service-date query authoritative', async () => {
    const api = boundary()
    const result = await getTariff(sid, '2027-03-09')
    expect(result.tariff.amount).toBe('75.10')
    expect(typeof result.tariff.amount).toBe('string')
    expect(api.calls[0].url.searchParams.get('currencyCode')).toBe('ANG')
  })
  it('searches SVB procedures on the server for Curacao service date', async () => {
    const api = boundary()
    renderClinical()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Add procedure' }),
    )
    fireEvent.change(await screen.findByLabelText('Search SVB procedures'), {
      target: { value: 'QA-PROC' },
    })
    await waitFor(() =>
      expect(
        api.calls.some(
          (call) =>
            call.url.searchParams.get('q') === 'QA-PROC' &&
            call.url.searchParams.get('serviceDate') === '2027-03-09',
        ),
      ).toBe(true),
    )
  })
  it('adds a procedure with string quantity/IDs and no invented snapshot fields', async () => {
    const api = boundary()
    renderClinical()
    await addProcedureForm()
    await userEvent.click(
      screen.getByRole('button', { name: 'Save procedure' }),
    )
    await screen.findByText('Procedure saved.')
    const body = api.calls.find((call) => call.method === 'POST')?.body
    expect(body).toEqual({
      svbProcedureId: sid,
      patientInsuranceId: insuranceId,
      quantity: '2.00',
      diagnosisId: null,
      authorizationItemId: null,
      additionalNote: null,
    })
    expect(
      await screen.findByText('TreatmentId: TC-AUTHORITATIVE'),
    ).toBeInTheDocument()
  })
  it('requires an authorization item when the catalogue requires it', async () => {
    const api = boundary({ requiresAuthorization: true })
    renderClinical()
    await addProcedureForm()
    expect(
      screen.getByRole('button', { name: 'Save procedure' }),
    ).toBeDisabled()
    await userEvent.selectOptions(
      await screen.findByLabelText('Authorization item'),
      '1002',
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Save procedure' }),
    )
    await screen.findByText('Procedure saved.')
    expect(
      api.calls.find((call) => call.method === 'POST')?.body
        .authorizationItemId,
    ).toBe('1002')
  })
  it('updates only diagnosis and note, never price or quantity', async () => {
    const api = boundary({ withProcedure: true })
    renderClinical()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Edit procedure QA-PROC' }),
    )
    expect(screen.queryByLabelText('Quantity')).not.toBeInTheDocument()
    await userEvent.type(
      screen.getByLabelText('Procedure notes'),
      'QA procedure note',
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Save procedure' }),
    )
    await screen.findByText('Procedure saved.')
    expect(api.calls.find((call) => call.method === 'PATCH')?.body).toEqual({
      diagnosisId: diagnosis.id,
      additionalNote: 'QA procedure note',
    })
  })
  it('removes a procedure with an explicit irreversible confirmation', async () => {
    const api = boundary({ withProcedure: true })
    renderClinical()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Remove procedure QA-PROC' }),
    )
    expect(screen.getByText(/permanently removes/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    await screen.findByText('No performed procedures recorded.')
    expect(api.calls.filter((call) => call.method === 'DELETE')).toHaveLength(1)
  })
  it('displays authorization usage from the backend', async () => {
    boundary()
    renderClinical()
    await userEvent.click(await screen.findByText('AUTH-QA'))
    expect(
      screen.getByText('Authorized: 5.00 · Used: 1.00 · Remaining: 4.00'),
    ).toBeInTheDocument()
  })
  it('creates an authorization using selected insurance', async () => {
    const api = boundary()
    renderClinical()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Add authorization' }),
    )
    const dialog = screen.getByRole('dialog')
    await userEvent.selectOptions(
      within(dialog).getByLabelText('Insurance'),
      insuranceId,
    )
    await userEvent.type(
      within(dialog).getByLabelText('Authorization reference'),
      'AUTH-NEW',
    )
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Save authorization' }),
    )
    await screen.findByText('Authorization saved.')
    expect(
      api.calls.find((call) => call.method === 'POST')?.body,
    ).toMatchObject({
      patientId: pid,
      patientInsuranceId: insuranceId,
      authorizationId: 'AUTH-NEW',
      status: 'PENDING',
    })
  })
  it('denies authorization mutation controls independently', async () => {
    boundary()
    renderClinical(
      fullPermissions.filter(
        (p) => p !== 'authorization.create' && p !== 'authorization.update',
      ),
    )
    await userEvent.click(await screen.findByText('AUTH-QA'))
    expect(
      screen.queryByRole('button', { name: 'Add authorization' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Edit authorization' }),
    ).not.toBeInTheDocument()
  })
  it('maps procedure validation errors without displaying raw backend text', async () => {
    boundary({
      fail: `POST /clinical-encounters/${eid}/procedures`,
      failCode: 'INSURANCE_NOT_VALID',
    })
    renderClinical()
    await addProcedureForm()
    await userEvent.click(
      screen.getByRole('button', { name: 'Save procedure' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This insurance is not valid for the procedure service date.',
    )
  })
  it('does not turn unrelated 404 responses into no-encounter state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(failure('APPOINTMENT_NOT_FOUND', 404)),
    )
    await expect(getEncounter(aid)).rejects.toMatchObject({
      code: 'APPOINTMENT_NOT_FOUND',
    })
  })
  it('updates authorization status and refreshes the current procedure context', async () => {
    const api = boundary({ withProcedure: true })
    renderClinical()
    await userEvent.click(await screen.findByText('AUTH-QA'))
    await userEvent.click(
      screen.getByRole('button', { name: 'Edit authorization' }),
    )
    await userEvent.selectOptions(
      screen.getByLabelText('Authorization status'),
      'EXPIRED',
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Save authorization' }),
    )
    await screen.findByText('Authorization saved.')
    expect(api.calls.find((call) => call.method === 'PATCH')?.body.status).toBe(
      'EXPIRED',
    )
    await waitFor(() =>
      expect(
        api.calls.filter(
          (call) =>
            call.method === 'GET' && call.url.pathname.endsWith('/procedures'),
        ).length,
      ).toBeGreaterThan(1),
    )
  })

  it('adds an authorization item with a string limit and no fabricated procedure ID', async () => {
    const api = boundary()
    renderClinical()
    await userEvent.click(await screen.findByText('AUTH-QA'))
    await userEvent.click(
      screen.getByRole('button', { name: 'Add authorization item' }),
    )
    await userEvent.type(
      screen.getByLabelText('Authorized quantity (empty for unlimited)'),
      '3.50',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save item' }))
    await screen.findByText('Authorization saved.')
    expect(api.calls.find((call) => call.method === 'POST')?.body).toEqual({
      svbProcedureId: null,
      authorizedQuantity: '3.50',
      validFrom: null,
      validTo: null,
      notes: null,
    })
  })

  it('preserves consumed authorization item procedure ownership when editing', async () => {
    const api = boundary()
    renderClinical()
    await userEvent.click(await screen.findByText('AUTH-QA'))
    await userEvent.click(
      screen.getByRole('button', { name: 'Edit authorization item 1002' }),
    )
    expect(
      screen.queryByRole('button', { name: 'Select procedure' }),
    ).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Item notes'), 'QA item update')
    await userEvent.click(screen.getByRole('button', { name: 'Save item' }))
    await screen.findByText('Authorization saved.')
    expect(
      api.calls.find((call) => call.method === 'PATCH')?.body,
    ).not.toHaveProperty('svbProcedureId')
  })

  it('keeps the procedure dialog open during an in-flight mutation', async () => {
    boundary({ pending: `POST /clinical-encounters/${eid}/procedures` })
    renderClinical()
    await addProcedureForm()
    await userEvent.click(
      screen.getByRole('button', { name: 'Save procedure' }),
    )
    await screen.findByRole('button', { name: 'Saving...' })
    await userEvent.click(screen.getByRole('button', { name: 'Close dialog' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('blocks submission when authoritative tariff lookup fails', async () => {
    boundary({
      fail: `GET /svb-procedures/${sid}/applicable-tariff`,
      failCode: 'SVB_TARIFF_AMBIGUOUS',
    })
    renderClinical()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Add procedure' }),
    )
    await userEvent.click(
      await screen.findByRole('button', { name: /QA-PROC QA examination/ }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Multiple tariffs apply.',
    )
    expect(
      screen.getByRole('button', { name: 'Save procedure' }),
    ).toBeDisabled()
  })

  it('validates quantities without floating-point conversion', () => {
    expect(positiveQuantitySchema.safeParse('0.00').success).toBe(false)
    expect(positiveQuantitySchema.parse('123456789012345.67')).toBe(
      '123456789012345.67',
    )
    expect(positiveQuantitySchema.safeParse('1.234').success).toBe(false)
  })
})
