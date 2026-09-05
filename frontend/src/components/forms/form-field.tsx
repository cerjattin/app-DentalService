import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'

type DescribedControlProps = {
  'aria-describedby'?: string
  'aria-invalid'?: boolean
}

interface FormFieldProps {
  label: string
  htmlFor: string
  error?: string
  hint?: string
  children: ReactNode
}

export function FormField({
  label,
  htmlFor,
  error,
  hint,
  children,
}: FormFieldProps) {
  const descriptionId = error || hint ? `${htmlFor}-description` : undefined
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<DescribedControlProps>, {
        ...(descriptionId ? { 'aria-describedby': descriptionId } : {}),
        ...(error ? { 'aria-invalid': true } : {}),
      })
    : children

  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      {control}
      {error ? (
        <p id={descriptionId} role="alert" className="text-xs text-clinic-danger">{error}</p>
      ) : hint ? (
        <p id={descriptionId} className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  )
}
