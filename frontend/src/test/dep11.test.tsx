import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { authStore } from '../auth/auth-store'
import { Dialog } from '../components/ui/dialog'
import { useSvbPilotReadiness } from '../features/svb-readiness/use-svb-pilot-readiness'
import { svbReadinessKeys } from '../features/svb-readiness/svb-readiness-api'
import { syntheticReadiness } from './fixtures/svb-readiness'
import { renderWithProviders } from './test-utils'
function Availability() {
 const result = useSvbPilotReadiness(); const client = useQueryClient()
 return <><button disabled={!result.canRecord}>New preparation</button><button onClick={() => void client.invalidateQueries({ queryKey: svbReadinessKeys.all })}>Refresh availability</button><span>{result.isError ? 'Availability failed' : result.isFetching ? 'Checking availability' : 'Availability checked'}</span></>
}
afterEach(() => { authStore.clearSession(); vi.unstubAllGlobals() })
it('revokes cached true during refresh and keeps it revoked after a network error', async () => {
 authStore.setSession('qa-memory', { id: '1', organizationId: '1', firstName: 'QA', lastName: 'QA', email: 'qa@local.invalid', roles: [], permissions: ['svb_procedure.read'] })
 let rejectRefresh: (reason: Error) => void = () => {}; let first = true
 vi.stubGlobal('fetch', vi.fn(async () => { if (first) { first = false; return new Response(JSON.stringify({ success: true, data: syntheticReadiness() }), { headers: { 'Content-Type': 'application/json' } }) } return new Promise<Response>((_, reject) => { rejectRefresh = reject }) }))
 renderWithProviders(<Availability />)
 await waitFor(() => expect(screen.getByRole('button', { name: 'New preparation' })).toBeEnabled())
 await userEvent.click(screen.getByRole('button', { name: 'Refresh availability' }))
 expect(screen.getByRole('button', { name: 'New preparation' })).toBeDisabled()
 rejectRefresh(new TypeError('Offline'))
 await screen.findByText('Availability failed')
 expect(screen.getByRole('button', { name: 'New preparation' })).toBeDisabled()
})
it('returns keyboard focus to the opening control after Escape and Cancel', async () => {
 function Example() { const [open, setOpen] = useState(false); return <><button onClick={() => setOpen(true)}>Open editor</button>{open ? <Dialog open title="QA editor" onOpenChange={setOpen}><input aria-label="QA field" /><button onClick={() => setOpen(false)}>Cancel</button></Dialog> : null}</> }
 renderWithProviders(<Example />)
 const opener = screen.getByRole('button', { name: 'Open editor' }); await userEvent.click(opener)
 await userEvent.keyboard('{Escape}'); await waitFor(() => expect(opener).toHaveFocus())
 await userEvent.keyboard('{Enter}'); await userEvent.click(screen.getByRole('button', { name: 'Cancel' })); await waitFor(() => expect(opener).toHaveFocus())
})
