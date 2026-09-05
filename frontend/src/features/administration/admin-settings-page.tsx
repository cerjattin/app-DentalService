import { PageHeader } from '../../components/app-shell/page-header'
import { EmptyState } from '../../components/feedback/empty-state'

export function AdminSettingsPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Settings" description="Organization configuration" />
      <EmptyState title="Settings unavailable" description="Settings management is not available in the current Backend contract." />
    </div>
  )
}
