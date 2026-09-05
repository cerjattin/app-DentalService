import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { authStore } from '../auth/auth-store'
import { PermissionRoute } from '../routes/permission-route'
import { AdminPage } from '../features/administration/admin-page'
import { AdminProvidersPage } from '../features/administration/admin-providers-page'
import { AdminSettingsPage } from '../features/administration/admin-settings-page'
import { AdminUsersPage } from '../features/administration/admin-users-page'
import { AccessDeniedPage } from '../features/auth/access-denied-page'
import {
  createProvider,
  createUser,
  getProvider,
  getUser,
  listProviders,
  listRoles,
  listUsers,
  replaceUserRoles,
  updateProvider,
  updateUser,
  updateUserStatus,
} from '../features/administration/administration-api'
import type { AdminProvider, AdminRole, AdminUser } from '../types/administration'
import { renderWithProviders } from './test-utils'

const userId = '90071992547409973001'
const providerId = '90071992547409973002'
const roleId = '90071992547409973003'
const now = '2027-07-01T14:00:00.000Z'
const role: AdminRole = { id: roleId, code: 'PROVIDER', name: 'Provider', description: 'Clinical provider access', isSystem: true, permissions: [{ code: 'encounter.read', name: 'Read encounters' }] }
const adminUser: AdminUser = {
  id: userId, organizationId: '1', email: 'qa.f09@local.invalid', firstName: 'QA', lastName: 'F09', status: 'ACTIVE',
  lastLoginAt: now, passwordChangedAt: now, failedLoginAttempts: 0, lockedUntil: null, archivedAt: null, createdAt: now, updatedAt: now,
  roles: [{ id: roleId, code: 'PROVIDER', name: 'Provider', isActive: true, assignedAt: now }],
}
const provider: AdminProvider = {
  id: providerId, organizationId: '1', userId, svbProviderId: 'SVB-F09', firstName: 'QA', lastName: 'Provider', licenseNumber: 'LIC-F09', specialty: 'Dentistry', email: 'qa.provider@local.invalid', phone: '+59990000', isActive: true,
  user: { id: userId, email: adminUser.email, firstName: adminUser.firstName, lastName: adminUser.lastName, status: 'ACTIVE' }, archivedAt: null, createdAt: now, updatedAt: now,
}
function ok(data: unknown, meta?: unknown) { return new Response(JSON.stringify({ success: true, data, ...(meta ? { meta } : {}) }), { headers: { 'Content-Type': 'application/json' } }) }
function fail(code: string, status = 409) { return new Response(JSON.stringify({ success: false, error: { code, message: 'RAW' } }), { status, headers: { 'Content-Type': 'application/json' } }) }
function boundary(options: { emptyUsers?: boolean; emptyProviders?: boolean; errorPath?: string; errorCode?: string; errorStatus?: number } = {}) {
  let currentUser = adminUser
  let currentProvider = provider
  const calls: { method: string; path: string; search: string; body: unknown }[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
    const parsed = new URL(url); const path = parsed.pathname.replace('/api/v1', ''); const method = init.method ?? 'GET'; const body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body
    calls.push({ method, path, search: parsed.search, body })
    if (`${method} ${path}` === options.errorPath) return fail(options.errorCode ?? 'USER_NOT_FOUND', options.errorStatus)
    if (path === '/roles') return ok([role])
    if (path === '/users' && method === 'GET') return ok(options.emptyUsers ? [] : [currentUser], { page: 1, pageSize: 20, total: options.emptyUsers ? 0 : 1, totalPages: options.emptyUsers ? 0 : 1 })
    if (path === '/users' && method === 'POST') return ok(currentUser)
    if (path === `/users/${userId}` && method === 'GET') return ok(currentUser)
    if (path === `/users/${userId}` && method === 'PATCH') { currentUser = { ...currentUser, ...(body as object) }; return ok(currentUser) }
    if (path.endsWith('/status')) { currentUser = { ...currentUser, status: (body as { status: AdminUser['status'] }).status }; return ok(currentUser) }
    if (path.endsWith('/roles')) { currentUser = { ...currentUser, roles: [adminUser.roles[0]!] }; return ok(currentUser) }
    if (path === '/providers' && method === 'GET') return ok(options.emptyProviders ? [] : [currentProvider], { page: 1, pageSize: 20, total: options.emptyProviders ? 0 : 1, totalPages: options.emptyProviders ? 0 : 1 })
    if (path === '/providers' && method === 'POST') return ok(currentProvider)
    if (path === `/providers/${providerId}` && method === 'GET') return ok(currentProvider)
    if (path === `/providers/${providerId}` && method === 'PATCH') { currentProvider = { ...currentProvider, ...(body as object) }; return ok(currentProvider) }
    throw new Error(`Unexpected ${method} ${path}`)
  }))
  return { calls }
}
const allPermissions = ['user.read', 'user.create', 'user.update', 'user.assign_roles', 'role.read', 'provider.read', 'provider.create', 'provider.update']
function session(permissions = allPermissions, id = 'current-admin') { authStore.setSession('memory-f09', { id, organizationId: '1', email: 'admin@local.invalid', firstName: 'Current', lastName: 'Admin', roles: ['ADMIN'], permissions }) }
function renderPage(page: 'admin' | 'users' | 'providers' | 'settings', permissions = allPermissions, id = 'current-admin') {
  session(permissions, id)
  const component = page === 'admin' ? <AdminPage /> : page === 'users' ? <AdminUsersPage /> : page === 'providers' ? <AdminProvidersPage /> : <AdminSettingsPage />
  return renderWithProviders(<MemoryRouter>{component}</MemoryRouter>)
}
afterEach(() => { authStore.clearSession(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('F09 administration API contract', () => {
  it('lists users with supported filters', async () => { const { calls } = boundary(); await listUsers({ q: 'QA', status: 'ACTIVE', role: 'PROVIDER', page: 1, pageSize: 20 }); expect(calls[0]?.search).toBe('?q=QA&status=ACTIVE&role=PROVIDER&page=1&pageSize=20') })
  it('gets a user with the string ID unchanged', async () => { const { calls } = boundary(); expect((await getUser(userId)).id).toBe(userId); expect(calls[0]?.path).toBe(`/users/${userId}`) })
  it('creates a user with the exact DTO', async () => { const { calls } = boundary(); const dto = { email: adminUser.email, firstName: 'QA', lastName: 'F09', password: 'temporary-f09-password', roleCodes: ['PROVIDER'] as const }; await createUser({ ...dto, roleCodes: [...dto.roleCodes] }); expect(calls[0]?.body).toEqual(dto) })
  it('updates only supported user profile fields', async () => { const { calls } = boundary(); await updateUser(userId, { firstName: 'Updated' }); expect(calls[0]).toMatchObject({ method: 'PATCH', path: `/users/${userId}`, body: { firstName: 'Updated' } }) })
  it('changes user status without deleting the account', async () => { const { calls } = boundary(); await updateUserStatus(userId, { status: 'INACTIVE', reason: 'QA status test' }); expect(calls[0]).toMatchObject({ path: `/users/${userId}/status`, body: { status: 'INACTIVE', reason: 'QA status test' } }) })
  it('replaces roles by Backend role codes', async () => { const { calls } = boundary(); await replaceUserRoles(userId, ['PROVIDER']); expect(calls[0]).toMatchObject({ method: 'PUT', path: `/users/${userId}/roles`, body: { roleCodes: ['PROVIDER'] } }) })
  it('renders Backend-defined permissions from roles', async () => { boundary(); expect((await listRoles())[0]?.permissions[0]?.code).toBe('encounter.read') })
  it('lists providers with supported filters', async () => { const { calls } = boundary(); await listProviders({ q: 'Dentist', isActive: true, page: 1, pageSize: 20 }); expect(calls[0]?.search).toBe('?q=Dentist&isActive=true&page=1&pageSize=20') })
  it('gets a provider and preserves provider and user IDs as strings', async () => { boundary(); const row = await getProvider(providerId); expect(row.id).toBe(providerId); expect(row.userId).toBe(userId) })
  it('creates a provider with the authoritative user association', async () => { const { calls } = boundary(); await createProvider({ userId, firstName: 'QA', lastName: 'Provider', isActive: true }); expect(calls[0]?.body).toEqual({ userId, firstName: 'QA', lastName: 'Provider', isActive: true }) })
  it('updates provider status through PATCH', async () => { const { calls } = boundary(); await updateProvider(providerId, { isActive: false }); expect(calls[0]).toMatchObject({ method: 'PATCH', path: `/providers/${providerId}`, body: { isActive: false } }) })
})

describe('F09 administration UI', () => {
  it('denies an admin route without administrative permissions', async () => { session([]); renderWithProviders(<MemoryRouter initialEntries={['/admin']}><Routes><Route path="/access-denied" element={<AccessDeniedPage />} /><Route element={<PermissionRoute anyOf={['user.read', 'provider.read', 'role.read']} />}><Route path="/admin" element={<AdminPage />} /></Route></Routes></MemoryRouter>); expect(await screen.findByText('Access denied')).toBeInTheDocument() })
  it('renders permission-aware administration areas and role permissions', async () => { boundary(); renderPage('admin'); expect(await screen.findByText('encounter.read')).toBeInTheDocument(); expect(screen.getByText('Settings management is not available in the current Backend contract.')).toBeInTheDocument() })
  it('renders user list data, roles and status', async () => { boundary(); renderPage('users'); expect(await screen.findByText('QA F09')).toBeInTheDocument(); expect(screen.getByText(adminUser.email)).toBeInTheDocument(); expect(screen.getAllByText('Provider').length).toBeGreaterThanOrEqual(2); expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(2) })
  it('renders user list loading', () => { session(); vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined))); renderPage('users'); expect(screen.getByText('Loading users')).toBeInTheDocument() })
  it('renders empty users', async () => { boundary({ emptyUsers: true }); renderPage('users'); expect(await screen.findByText('No users found')).toBeInTheDocument() })
  it('renders mapped Backend user errors', async () => { boundary({ errorPath: 'GET /users', errorCode: 'USER_NOT_FOUND', errorStatus: 404 }); renderPage('users'); expect(await screen.findByText('The user could not be found.')).toBeInTheDocument(); expect(screen.queryByText('RAW')).not.toBeInTheDocument() })
  it('sends debounced user search to the Backend', async () => { const user = userEvent.setup(); const { calls } = boundary(); renderPage('users'); await screen.findByText('QA F09'); await user.type(screen.getByPlaceholderText('Name or email'), 'F09 search'); await waitFor(() => expect(calls.some((call) => call.path === '/users' && call.search.includes('q=F09+search'))).toBe(true)) })
  it('hides user mutations when only user.read is granted', async () => { boundary(); renderPage('users', ['user.read']); await screen.findByText('QA F09'); expect(screen.queryByRole('button', { name: 'Create user' })).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument() })
  it('loads user detail from the exact endpoint', async () => { const user = userEvent.setup(); const { calls } = boundary(); renderPage('users'); await user.click(await screen.findByRole('button', { name: 'View' })); expect(await screen.findByText('User details')).toBeInTheDocument(); await waitFor(() => expect(calls.some((call) => call.path === `/users/${userId}`)).toBe(true)) })
  it('disables deactivation for the authenticated user', async () => { boundary(); renderPage('users', allPermissions, userId); const button = await screen.findByRole('button', { name: 'Deactivate' }); expect(button).toBeDisabled() })
  it('renders provider list and linked user identity', async () => { boundary(); renderPage('providers'); expect(await screen.findByText('QA Provider')).toBeInTheDocument(); expect(screen.getByText(adminUser.email)).toBeInTheDocument(); expect(screen.getByText('SVB-F09')).toBeInTheDocument() })
  it('renders empty providers', async () => { boundary({ emptyProviders: true }); renderPage('providers'); expect(await screen.findByText('No providers found')).toBeInTheDocument() })
  it('loads provider detail and string ID', async () => { const user = userEvent.setup(); boundary(); renderPage('providers'); await user.click(await screen.findByRole('button', { name: 'View' })); expect(await screen.findByText('Provider details')).toBeInTheDocument(); expect(screen.getByText(providerId)).toBeInTheDocument() })
  it('hides provider mutations without create or update permissions', async () => { boundary(); renderPage('providers', ['provider.read']); await screen.findByText('QA Provider'); expect(screen.queryByRole('button', { name: 'Create provider' })).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument() })
  it('shows the provider-user relationship as authoritative and read-only in detail', async () => { const user = userEvent.setup(); boundary(); renderPage('providers'); await user.click(await screen.findByRole('button', { name: 'View' })); expect(await screen.findByText(`QA F09 (${adminUser.email})`)).toBeInTheDocument() })
  it('keeps Settings explicitly unavailable', () => { renderPage('settings'); expect(screen.getByText('Settings unavailable')).toBeInTheDocument(); expect(screen.getByText('Settings management is not available in the current Backend contract.')).toBeInTheDocument(); expect(screen.queryByRole('textbox')).not.toBeInTheDocument() })
  it('retains authentication after an administration 403', async () => { session(); vi.stubGlobal('fetch', vi.fn(async () => fail('PERMISSION_DENIED', 403))); await expect(getUser(userId)).rejects.toMatchObject({ code: 'PERMISSION_DENIED', status: 403 }); expect(authStore.getAccessToken()).toBe('memory-f09') })
})
