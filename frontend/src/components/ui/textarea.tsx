import type { TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'min-h-24 w-full rounded-md border border-clinic-border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-clinic-blue focus:outline-none focus:ring-2 focus:ring-clinic-blue/20 disabled:bg-slate-100',
        className,
      )}
      {...props}
    />
  )
}
