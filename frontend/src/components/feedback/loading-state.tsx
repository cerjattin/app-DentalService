import { cn } from '../../lib/cn'

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-slate-200', className)} />
}

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="space-y-3 rounded-lg border border-clinic-border bg-white p-4" aria-busy="true" aria-live="polite" role="status">
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-20 w-full" />
    </div>
  )
}
