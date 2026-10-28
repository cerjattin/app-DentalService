import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { prisma } from '../../backend/dist/src/infrastructure/database/prisma.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const requireBackend = createRequire(resolve(root, 'backend/package.json'))
const argon2 = requireBackend('argon2')
const { chromium } = await import(pathToFileURL(process.env.MASTER03_PLAYWRIGHT_MODULE).href)
const db = new URL(process.env.DATABASE_URL)
assert.equal(db.pathname, '/odontho_master03_test')
assert(['127.0.0.1', 'localhost'].includes(db.hostname))
const output = resolve(root, 'frontend/qa/master03')
await mkdir(output, { recursive: true })
const report = { status: 'IN_PROGRESS', network: [], consoleErrors: [], consoleWarnings: [], pageErrors: [], failedRequests: [], responsive: [], steps: [] }
const backend = spawn(process.execPath, ['dist/src/server.js'], { cwd: resolve(root, 'backend'), env: { ...process.env, PORT: '3403', HOST: '127.0.0.1', CORS_ALLOWED_ORIGINS: 'http://127.0.0.1:5173' }, stdio: 'inherit' })
const frontend = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], { cwd: resolve(root, 'frontend'), env: { ...process.env, VITE_API_BASE_URL: 'http://127.0.0.1:3403/api/v1' }, stdio: 'inherit' })
let browser
let page
const code = `TEST-M03-UI-${Date.now()}`
const email = `m03.${randomUUID()}@local.invalid`
const password = randomUUID()
let token
async function ready(url) {
  for (let n = 0; n < 100; n++) { try { if ((await fetch(url)).ok) return } catch { /* starting */ } await delay(300) }
  throw new Error(`Not ready: ${url}`)
}
async function http(path, body) {
  const response = await fetch(`http://127.0.0.1:3403/api/v1${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await response.json()
  assert.equal(response.status, 201, JSON.stringify(data))
  return data.data
}
async function signIn() {
  await page.goto('http://127.0.0.1:5173/login')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  const login = page.waitForResponse((r) => r.url().endsWith('/auth/login') && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  token = (await (await login).json()).data.accessToken
  await page.waitForURL('**/dashboard')
}
async function navServices() {
  const menu = page.getByRole('button', { name: 'Open navigation' })
  if (await menu.isVisible()) await menu.click()
  await page.getByRole('link', { name: 'Services', exact: true }).first().click()
  await page.getByRole('button', { name: 'Create service', exact: true }).waitFor()
}
async function saveResponse(action, method, suffix) {
  const pending = page.waitForResponse((r) => new URL(r.url()).pathname.endsWith(suffix) && r.request().method() === method)
  await action()
  const response = await pending
  assert(response.ok(), `${method} ${suffix}: ${response.status()}`)
  return (await response.json()).data
}
async function clinicalSearch(appointmentId, active, snapshotDescription) {
  await page.getByRole('link', { name: 'Appointments', exact: true }).click()
  await page.getByRole('link', { name: 'View', exact: true }).click()
  await page.getByRole('link', { name: 'Open clinical workspace', exact: true }).click()
  await page.waitForURL(`**/clinical/${appointmentId}`)
  await page.getByText(snapshotDescription, { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Add procedure', exact: true }).click()
  const search = page.getByLabel('Search SVB procedures')
  await search.fill(code)
  await page.waitForResponse((r) => r.url().includes('/svb-procedures?') && new URL(r.url()).searchParams.get('q') === code)
  const match = page.getByRole('button', { name: new RegExp(code) })
  if (active) await match.waitFor()
  else { await page.getByText('No matching codes found.', { exact: true }).waitFor(); assert.equal(await match.count(), 0) }
  await page.getByRole('button', { name: 'Close dialog' }).click()
  report.steps.push(`Clinical selector ${active ? 'includes active' : 'excludes inactive'} service; original snapshot displayed`)
}
async function checkViewport(name) {
  const viewport = page.viewportSize()
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${name}: document overflow`)
  const dialog = page.getByRole('dialog')
  if (await dialog.isVisible()) {
    const b = await dialog.boundingBox()
    assert(b.x >= -1 && b.y >= -1 && b.x + b.width <= viewport.width + 1 && b.y + b.height <= viewport.height + 1, `${name}: dialog outside viewport`)
  }
  await page.screenshot({ path: resolve(output, `${name}.png`), fullPage: true })
}
try {
  await ready('http://127.0.0.1:3403/health/ready')
  await ready('http://127.0.0.1:5173')
  const org = await prisma.organization.findFirstOrThrow({ where: { legalName: 'Odontho Services B.V.' } })
  const role = await prisma.role.findUniqueOrThrow({ where: { code: 'ADMIN' } })
  const admin = await prisma.user.create({ data: { organizationId: org.id, email, passwordHash: await argon2.hash(password), firstName: 'QA', lastName: 'MASTER03', status: 'ACTIVE', userRoles: { create: { roleId: role.id } } } })
  const location = await prisma.clinicLocation.findFirstOrThrow({ where: { organizationId: org.id } })
  const payer = await prisma.payer.findUniqueOrThrow({ where: { code: 'SVB' } })
  const patient = await prisma.patient.create({ data: { organizationId: org.id, patientNumber: `TEST-M03-${Date.now()}`, firstName: 'QA', lastName: 'MASTER03', status: 'ACTIVE' } })
  const provider = await prisma.provider.create({ data: { organizationId: org.id, firstName: 'QA', lastName: 'MASTER03', svbProviderId: 'TEST-M03-PROVIDER', isActive: true } })
  const insurance = await prisma.patientInsurance.create({ data: { patientId: patient.id, payerId: payer.id, insuredId: 'TEST-M03-INSURED', status: 'ACTIVE', isPrimary: true, validFrom: new Date('2026-01-01T00:00:00Z'), validTo: new Date('2026-12-31T00:00:00Z') } })
  const appointment = await prisma.appointment.create({ data: { organizationId: org.id, patientId: patient.id, providerId: provider.id, clinicLocationId: location.id, appointmentNumber: 'TEST-M03-APPOINTMENT', scheduledStartAt: new Date('2026-10-28T13:00:00Z'), scheduledEndAt: new Date('2026-10-28T13:30:00Z'), status: 'IN_PROGRESS', createdByUserId: admin.id } })
  const encounter = await prisma.clinicalEncounter.create({ data: { appointmentId: appointment.id, providerId: provider.id, status: 'OPEN', startedAt: new Date('2026-10-28T13:00:00Z'), createdByUserId: admin.id } })
  report.appointmentId = appointment.id.toString()
  report.encounterId = encounter.id.toString()
  browser = await chromium.launch({ headless: true })
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.on('console', (m) => { if (m.type() === 'error') report.consoleErrors.push(m.text()); if (m.type() === 'warning') report.consoleWarnings.push(m.text()) })
  page.on('pageerror', (e) => report.pageErrors.push(e.message))
  page.on('requestfailed', (r) => { if (!r.failure()?.errorText.includes('ERR_ABORTED')) report.failedRequests.push({ url: r.url(), error: r.failure()?.errorText }) })
  page.on('response', (r) => { if (r.url().includes('/api/v1/')) report.network.push({ method: r.request().method(), path: new URL(r.url()).pathname + new URL(r.url()).search, status: r.status() }) })
  await signIn()
  await navServices()
  await page.getByRole('button', { name: 'Create service', exact: true }).waitFor()
  assert(await page.getByRole('link', { name: 'Services', exact: true }).isVisible())
  await page.getByRole('button', { name: 'Create service', exact: true }).click()
  await page.getByLabel('Service code / SKU').fill(code)
  const originalDescription = 'QA MASTER03 original service'
  await page.getByLabel('Description', { exact: true }).fill(originalDescription)
  await page.getByLabel('Category', { exact: true }).last().fill('QA')
  await page.getByLabel('Unit', { exact: true }).fill('VISIT')
  await page.getByLabel('Valid from', { exact: true }).fill('2026-10-01')
  const created = await saveResponse(() => page.getByRole('dialog').getByRole('button', { name: 'Create service', exact: true }).click(), 'POST', '/svb-procedures')
  report.serviceId = created.id; report.serviceCode = created.code
  await page.getByText(created.id, { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Add tariff', exact: true }).click()
  await page.getByLabel('Amount', { exact: true }).fill('88.80')
  await page.locator('#tariff-currency').fill('ANG')
  await page.getByLabel('Valid from', { exact: true }).fill('2026-10-01')
  const tariff = await saveResponse(() => page.getByRole('dialog').getByRole('button', { name: 'Add tariff', exact: true }).click(), 'POST', `/svb-procedures/${created.id}/tariffs`)
  assert.equal(tariff.amount, '88.80'); report.tariffId = tariff.id
  await page.getByText('88.80', { exact: true }).waitFor()
  const performed = await http(`/clinical-encounters/${encounter.id}/procedures`, { patientInsuranceId: insurance.id.toString(), svbProcedureId: created.id, quantity: '1.00' })
  report.encounterProcedureId = performed.id
  await page.getByRole('button', { name: 'Edit service', exact: true }).click()
  await page.getByLabel('Description', { exact: true }).fill('QA MASTER03 edited service')
  await page.getByLabel('Requires referral', { exact: true }).check()
  await saveResponse(() => page.getByRole('button', { name: 'Save changes', exact: true }).click(), 'PATCH', `/svb-procedures/${created.id}`)
  await page.getByText('QA MASTER03 edited service', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Edit tariff', exact: true }).click()
  await page.getByLabel('Amount', { exact: true }).fill('89.90')
  const editedTariff = await saveResponse(() => page.getByRole('button', { name: 'Save tariff', exact: true }).click(), 'PATCH', `/svb-procedures/${created.id}/tariffs/${tariff.id}`)
  assert.equal(editedTariff.amount, '89.90')
  await page.getByText('89.90', { exact: true }).waitFor()
  await page.getByLabel('Service date', { exact: true }).fill('2026-10-28')
  await page.getByLabel('Currency code', { exact: true }).fill('ANG')
  await page.getByRole('button', { name: 'Look up tariff', exact: true }).click()
  await page.getByText('ANG 89.90', { exact: true }).waitFor()
  report.steps.push('Service create/detail/edit; tariff create/history/edit; explicit applicable lookup; Decimal strings verified')
  await clinicalSearch(appointment.id, true, originalDescription)
  await navServices()
  await page.getByRole('link', { name: code, exact: true }).click()
  await page.getByRole('button', { name: 'Deactivate service', exact: true }).click()
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await page.getByRole('button', { name: 'Activate service', exact: true }).waitFor()
  await clinicalSearch(appointment.id, false, originalDescription)
  await navServices()
  await page.getByRole('link', { name: code, exact: true }).click()
  await page.getByRole('button', { name: 'Activate service', exact: true }).click()
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await page.getByRole('button', { name: 'Deactivate service', exact: true }).waitFor()
  report.steps.push('Confirmed deactivate/activate; active selector exclusion; historical UI snapshot retained')
  for (const [width, height] of [[1440, 900], [1024, 768], [768, 1024], [390, 844]]) {
    await page.setViewportSize({ width, height })
    await navServices()
    await page.getByRole('link', { name: code, exact: true }).waitFor()
    await checkViewport(`${width}x${height}-list`)
    await page.getByRole('button', { name: 'Create service', exact: true }).click()
    await checkViewport(`${width}x${height}-service-dialog`)
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await page.getByRole('link', { name: code, exact: true }).click()
    await page.getByRole('button', { name: 'Edit tariff', exact: true }).waitFor()
    await checkViewport(`${width}x${height}-detail`)
    await page.getByRole('button', { name: 'Edit tariff', exact: true }).click()
    await checkViewport(`${width}x${height}-tariff-dialog`)
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    report.responsive.push({ width, height, status: 'PASSED', views: ['list', 'detail', 'service dialog', 'tariff dialog'] })
  }
  await page.getByRole('button', { name: 'Deactivate service', exact: true }).click()
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await page.getByRole('button', { name: 'Activate service', exact: true }).waitFor()
  const snapshot = await prisma.encounterProcedure.findUniqueOrThrow({ where: { id: BigInt(performed.id) } })
  assert.equal(snapshot.procedureDescriptionSnapshot, originalDescription)
  assert.equal(snapshot.unitTariffSnapshot.toFixed(2), '88.80')
  assert.equal((await prisma.svbProcedure.findUniqueOrThrow({ where: { id: BigInt(created.id) } })).isActive, false)
  assert(!report.network.some((r) => r.method === 'DELETE'))
  assert(!report.network.some((r) => r.status >= 400), JSON.stringify(report.network.filter((r) => r.status >= 400)))
  assert.equal(report.consoleErrors.length, 0, JSON.stringify(report.consoleErrors))
  assert.equal(report.pageErrors.length, 0, JSON.stringify(report.pageErrors))
  assert.equal(report.failedRequests.length, 0, JSON.stringify(report.failedRequests))
  report.status = 'PASSED'
  report.finalActiveState = false
} catch (error) {
  report.status = 'FAILED'
  report.error = error instanceof Error ? error.message : String(error)
  if (page) await page.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => {})
  process.exitCode = 1
} finally {
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ status: report.status, serviceId: report.serviceId, tariffId: report.tariffId, responsive: report.responsive, error: report.error }, null, 2))
  await browser?.close()
  backend.kill('SIGTERM'); frontend.kill('SIGTERM')
  await prisma.$disconnect()
}
