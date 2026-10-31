import { useContext } from 'react'
import { UNSAFE_DataRouterContext, useBeforeUnload, useBlocker } from 'react-router'
import { ConfirmDialog } from '../ui/confirm-dialog'

function RouteLeaveGuard({ active }: { active: boolean }) {
  const blocker = useBlocker(active)
  return <ConfirmDialog open={blocker.state === 'blocked'} title="Discard unsaved changes?" description="Your changes have not been saved. Leave this page and discard them?" confirmLabel="Discard and leave" cancelLabel="Keep editing" onCancel={() => blocker.reset?.()} onConfirm={() => blocker.proceed?.()} />
}

export function UnsavedChanges({ active }: { active: boolean }) {
  const dataRouter = useContext(UNSAFE_DataRouterContext)
  useBeforeUnload((event) => { if (active) { event.preventDefault(); event.returnValue = '' } })
  return dataRouter ? <RouteLeaveGuard active={active} /> : null
}
