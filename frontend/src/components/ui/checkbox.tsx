import type { InputHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export function Checkbox({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn(
        'h-4 w-4 rounded border-clinic-border-strong text-clinic-blue focus:ring-2 focus:ring-clinic-blue/30',
        className,
      )}
      {...props}
    />
  )
}
