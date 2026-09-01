import { AlertTriangle } from 'lucide-react'
import { Button } from '../ui/button'

export function ErrorState({
  title = 'Unable to load this view',
  description,
  onRetry,
}: {
  title?: string
  description?: string
  onRetry?: () => void
}) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5" size={18} aria-hidden="true" />
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description ? <p className="mt-1 text-sm">{description}</p> : null}
          {onRetry ? (
            <Button className="mt-3" variant="secondary" onClick={onRetry}>
              Try again
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
