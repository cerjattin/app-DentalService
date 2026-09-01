import { cn } from '../../lib/cn'

type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

const toneClasses: Record<StatusTone, string> = {
  neutral: 'bg-slate-100 text-slate-600',
  info: 'bg-blue-100 text-blue-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
}

export function StatusBadge({
  children,
  tone = 'neutral',
}: {
  children: string
  tone?: StatusTone
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium',
        toneClasses[tone],
      )}
    >
      {children}
    </span>
  )
}
