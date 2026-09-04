import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getApiErrorMessage } from '../../api'
import { Button } from '../../components/ui/button'
import { Dialog } from '../../components/ui/dialog'
import type { PaginationMeta } from '../../types/patient'

export function ClinicalSection({
  title,
  actions,
  children,
}: {
  title: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="min-w-0 border-t border-clinic-border py-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        {actions}
      </div>
      {children}
    </section>
  )
}
export function MutationError({ error }: { error: unknown }) {
  return error ? (
    <p
      role="alert"
      className="my-3 rounded-md bg-red-50 p-3 text-sm text-clinic-danger"
    >
      {getApiErrorMessage(error)}
    </p>
  ) : null
}
export function Pager({
  page,
  meta,
  onChange,
  disabled = false,
}: {
  page: number
  meta?: PaginationMeta
  onChange: (page: number) => void
  disabled?: boolean
}) {
  return (
    <div className="mt-3 flex items-center justify-end gap-3 text-sm">
      <Button
        aria-label="Previous results"
        title="Previous results"
        variant="secondary"
        disabled={disabled || page <= 1}
        onClick={() => onChange(page - 1)}
      >
        <ChevronLeft size={16} />
      </Button>
      <span>
        Page {page} of {Math.max(1, meta?.totalPages ?? 1)}
      </span>
      <Button
        aria-label="Next results"
        title="Next results"
        variant="secondary"
        disabled={disabled || page >= (meta?.totalPages ?? 1)}
        onClick={() => onChange(page + 1)}
      >
        <ChevronRight size={16} />
      </Button>
    </div>
  )
}
export function ClinicalConfirm({
  title,
  description,
  onClose,
  onConfirm,
  pending,
  error,
}: {
  title: string
  description: string
  onClose: () => void
  onConfirm: () => void
  pending: boolean
  error: unknown
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose()
      }}
      title={title}
      description={description}
    >
      <MutationError error={error} />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" disabled={pending} onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={pending} onClick={onConfirm}>
          {pending ? 'Saving...' : 'Confirm'}
        </Button>
      </div>
    </Dialog>
  )
}
