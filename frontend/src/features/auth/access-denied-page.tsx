import { ShieldAlert } from 'lucide-react'
import { PageHeader } from '../../components/app-shell/page-header'
import { Card } from '../../components/ui/card'
import { Link } from 'react-router'

export function AccessDeniedPage() {
  return (
    <div>
      <PageHeader
        title="Access denied"
        description="You don't have permission to access this area."
      />
      <Card className="max-w-xl p-5">
        <div className="flex gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-700">
            <ShieldAlert size={20} aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Permission required
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Backend authorization remains the source of truth. Ask an
              administrator if your access needs to change.
            </p>
            <Link
              className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-clinic-blue px-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinic-blue focus-visible:ring-offset-2"
              to="/dashboard"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </Card>
    </div>
  )
}
