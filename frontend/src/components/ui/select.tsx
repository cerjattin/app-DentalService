import type { SelectHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-9 w-full rounded-md border border-clinic-border bg-white px-3 text-sm text-slate-900 focus:border-clinic-blue focus:outline-none focus:ring-2 focus:ring-clinic-blue/20 disabled:bg-slate-100',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}
