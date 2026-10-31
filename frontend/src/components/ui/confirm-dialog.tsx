import { Button } from './button'
import { Dialog } from './dialog'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  pending?: boolean
  error?: string | undefined
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  pending = false,
  error,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !pending && !nextOpen && onCancel()} title={title} description={description}>
      {error ? <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-clinic-danger">{error}</p> : null}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" disabled={pending} onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant="danger" disabled={pending} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  )
}
