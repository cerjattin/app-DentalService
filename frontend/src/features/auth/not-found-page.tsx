import { Link } from 'react-router'
import { PageHeader } from '../../components/app-shell/page-header'
import { EmptyState } from '../../components/feedback/empty-state'

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Page not found"
        description="The requested application page does not exist."
      />
      <EmptyState
        title="Nothing is available at this address"
        description="Check the address or return to your permitted dashboard."
        action={
          <Link
            className="inline-flex min-h-9 items-center justify-center rounded-md bg-clinic-blue px-3 py-2 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinic-blue focus-visible:ring-offset-2"
            to="/dashboard"
          >
            Back to dashboard
          </Link>
        }
      />
    </div>
  )
}
