import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Eraser, PenLine } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { ApiError } from '../../api/api-error'
import { LoadingState } from '../../components/feedback/loading-state'
import { FormField } from '../../components/forms/form-field'
import { Button } from '../../components/ui/button'
import { Checkbox } from '../../components/ui/checkbox'
import { Dialog } from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { Select } from '../../components/ui/select'
import type { CaptureMethod, InvoiceVersion } from '../../types/billing'
import type { EntityId } from '../../types/core'
import {
  captureSignature,
  getSignatureContent,
  signatureKeys,
  uploadSignature,
} from './billing-api'
import { BillingError } from './billing-ui'
import { billingLabel, signerSchema } from './billing-model'
import { ConfirmDialog } from '../../components/ui/confirm-dialog'
import { UnsavedChanges } from '../../components/forms/unsaved-changes'

export function SignatureDialog({
  invoiceId,
  version,
  onClose,
  onCaptured,
  onReconcile,
}: {
  invoiceId: EntityId
  version: InvoiceVersion
  onClose: () => void
  onCaptured: () => Promise<void>
  onReconcile: () => Promise<void>
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const drawing = useRef<{ x: number; y: number; pointerId: number } | null>(
    null,
  )
  const uploaded = useRef<EntityId | null>(null)
  const busy = useRef(false)
  const method = useRef<CaptureMethod>('MOUSE')
  const [ink, setInk] = useState(false)
  const [canvasError, setCanvasError] = useState('')
  const [discard, setDiscard] = useState(false)
  const [keyboardFocused, setKeyboardFocused] = useState(false)
  const [keyboardPen, setKeyboardPen] = useState(false)
  const [keyboardPoint, setKeyboardPoint] = useState({ x: 600, y: 200 })
  const content = useQuery({
    queryKey: signatureKeys.content(invoiceId, version.id),
    queryFn: ({ signal }) => getSignatureContent(invoiceId, version.id, signal),
    staleTime: 0,
    retry: false,
  })
  const form = useForm<z.infer<typeof signerSchema>>({
    resolver: zodResolver(signerSchema),
    defaultValues: {
      signatureType: 'PATIENT',
      signerName: '',
      signerRelationship: '',
      confirmed: false,
    },
  })
  const type = useWatch({ control: form.control, name: 'signatureType' })
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d')
    if (ctx) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, 1200, 400)
    }
  }, [])
  const save = useMutation({
    mutationFn: async (values: z.infer<typeof signerSchema>) => {
      if (
        !ink ||
        !canvas.current ||
        !content.data ||
        content.data.contentHash !== version.contentHash
      )
        throw new Error('Signature unavailable')
      if (!uploaded.current) {
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.current!.toBlob(
            (value) =>
              value ? resolve(value) : reject(new Error('Image unavailable')),
            'image/png',
          ),
        )
        uploaded.current = (await uploadSignature(blob, version.id)).id
      }
      await captureSignature(invoiceId, version.id, {
        signatureDocumentId: uploaded.current,
        signatureType: values.signatureType,
        captureMethod: method.current,
        expectedContentHash: content.data.contentHash,
        ...(values.signatureType !== 'PATIENT'
          ? { signerName: values.signerName }
          : {}),
        ...(values.signatureType !== 'PATIENT' && values.signerRelationship
          ? { signerRelationship: values.signerRelationship }
          : {}),
      })
    },
    onSuccess: onCaptured,
    onError: onReconcile,
    onSettled: () => {
      busy.current = false
    },
  })
  function point(e: PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) * 1200) / rect.width,
      y: ((e.clientY - rect.top) * 400) / rect.height,
      pointerId: e.pointerId,
    }
  }
  function clear() {
    const ctx = canvas.current?.getContext('2d')
    if (ctx) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, 1200, 400)
    }
    drawing.current = null
    uploaded.current = null
    setInk(false)
    setCanvasError('')
    setKeyboardPen(false)
    setKeyboardPoint({ x: 600, y: 200 })
    form.setValue('confirmed', false)
  }
  const ready = content.data && content.data.contentHash === version.contentHash
  const dirty = ink || form.formState.isDirty
  const close = () => { if (!busy.current) { if (dirty) setDiscard(true); else onClose() } }
  return (
    <><UnsavedChanges active={dirty && !save.isPending} /><Dialog
      open
      size="wide"
      onEscapeKeyDown={(event) => {
        if (document.activeElement === canvas.current) {
          event.preventDefault()
          setKeyboardPen(false)
        }
      }}
      title={`Signature - version ${version.versionNumber}`}
      description="Review the invoice and signer details before saving permanent signature evidence."
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      {content.isPending ? (
        <LoadingState label="Loading signature content" />
      ) : content.isError ? (
        <>
          <BillingError error={content.error} />
          <Button onClick={() => void content.refetch()}>
            Retry signature content
          </Button>
        </>
      ) : !ready ? (
        <p role="alert">
          Invoice content changed. Close this dialog and refresh the invoice.
        </p>
      ) : (
        <div className="mb-4 border-b border-clinic-border pb-4 text-sm">
          <p className="font-semibold">
            {content.data.content.invoice.patientName}
          </p>
          <p>
            {content.data.content.invoice.invoiceNumber} / v
            {content.data.content.invoice.versionNumber} /{' '}
            {content.data.content.invoice.currencyCode}{' '}
            {content.data.content.invoice.totalAmount}
          </p>
          <ul className="mt-2 space-y-1">
            {content.data.content.items.map((item) => (
              <li key={item.lineNumber}>
                {item.procedureCode} - {item.procedureDescription} /{' '}
                {item.quantity} / {item.currencyCode} {item.amount}
              </li>
            ))}
          </ul>
        </div>
      )}
      <form
        onSubmit={(event) =>
          void form.handleSubmit((values) => {
            if (!busy.current && ink && ready) {
              busy.current = true
              save.mutate(values)
            }
          })(event)
        }
        className="space-y-4"
      >
        <fieldset
          disabled={save.isPending}
          className="grid gap-3 sm:grid-cols-2"
        >
          <FormField label="Signer" htmlFor="signature-type">
            <Select
              id="signature-type"
              {...form.register('signatureType')}
              onChange={(e) => {
                form.setValue(
                  'signatureType',
                  e.target.value as z.infer<
                    typeof signerSchema
                  >['signatureType'],
                )
                clear()
              }}
            >
              {(
                [
                  'PATIENT',
                  'LEGAL_REPRESENTATIVE',
                  'GUARDIAN',
                  'OTHER',
                ] as const
              ).map((value) => (
                <option key={value} value={value}>
                  {billingLabel(value)}
                </option>
              ))}
            </Select>
          </FormField>
          {type !== 'PATIENT' ? (
            <FormField
              label="Signer name"
              htmlFor="signer-name"
              error={form.formState.errors.signerName?.message}
            >
              <Input
                id="signer-name"
                {...form.register('signerName', {
                  onChange: () => form.setValue('confirmed', false),
                })}
              />
            </FormField>
          ) : null}
          {type !== 'PATIENT' ? (
            <FormField
              label="Relationship to patient"
              htmlFor="signer-relationship"
              error={form.formState.errors.signerRelationship?.message}
            >
              <Input
                id="signer-relationship"
                {...form.register('signerRelationship', {
                  onChange: () => form.setValue('confirmed', false),
                })}
              />
            </FormField>
          ) : null}
        </fieldset>
        <p id="signature-keyboard-help" className="text-sm text-slate-600">Draw with a pointer, or focus the drawing area and use the arrow keys. Space lowers or lifts the pen; Escape lifts it. Hold Shift for larger steps. Save only after reviewing the signer and invoice.</p>
        <Button variant="secondary" disabled={!ready || save.isPending} onClick={() => canvas.current?.focus()}>Draw using keyboard</Button>
        <div className="relative overflow-hidden rounded-md border-2 border-dashed border-slate-300 bg-white">
          <canvas
            ref={canvas}
            width={1200}
            height={400}
            aria-label="Signature drawing area"
            role="img"
            tabIndex={0}
            aria-describedby="signature-keyboard-help"
            className="block aspect-[3/1] w-full touch-none focus-visible:outline-2 focus-visible:outline-clinic-blue"
            onFocus={() => setKeyboardFocused(true)}
            onBlur={() => { setKeyboardFocused(false); setKeyboardPen(false) }}
            onKeyDown={(event) => {
              if (busy.current || !ready) return
              if (event.key === ' ') { event.preventDefault(); setKeyboardPen(!keyboardPen); return }
              if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setKeyboardPen(false); return }
              const directions: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
              if (!Object.hasOwn(directions, event.key)) return
              event.preventDefault()
              const direction = directions[event.key]!
              const step = event.shiftKey ? 30 : 10
              const next = { x: Math.max(0, Math.min(1200, keyboardPoint.x + direction[0] * step)), y: Math.max(0, Math.min(400, keyboardPoint.y + direction[1] * step)) }
              if (keyboardPen && (next.x !== keyboardPoint.x || next.y !== keyboardPoint.y)) {
                const context = event.currentTarget.getContext('2d')
                if (!context) { setCanvasError('Signature capture is unavailable in this browser.'); return }
                context.strokeStyle = '#0b1f3a'; context.lineWidth = 3; context.lineCap = 'round'; context.lineJoin = 'round'
                context.beginPath(); context.moveTo(keyboardPoint.x, keyboardPoint.y); context.lineTo(next.x, next.y); context.stroke()
                method.current = 'OTHER'; uploaded.current = null; setInk(true); form.setValue('confirmed', false)
              }
              setKeyboardPoint(next)
            }}
            onPointerDown={(e) => {
              if (busy.current || !ready || drawing.current || e.button !== 0)
                return
              const ctx = e.currentTarget.getContext('2d')
              if (!ctx) {
                setCanvasError(
                  'Signature capture is unavailable in this browser.',
                )
                return
              }
              e.currentTarget.setPointerCapture(e.pointerId)
              setKeyboardFocused(false)
              setKeyboardPen(false)
              drawing.current = point(e)
              if (!ink)
                method.current =
                  e.pointerType === 'pen'
                    ? 'SIGNATURE_PAD'
                    : e.pointerType === 'touch'
                      ? 'TOUCHSCREEN'
                      : 'MOUSE'
            }}
            onPointerMove={(e) => {
              const previous = drawing.current
              if (
                !previous ||
                previous.pointerId !== e.pointerId ||
                busy.current
              )
                return
              const next = point(e)
              const ctx = e.currentTarget.getContext('2d')
              if (
                !ctx ||
                Math.hypot(next.x - previous.x, next.y - previous.y) < 1
              )
                return
              ctx.strokeStyle = '#0b1f3a'
              ctx.lineWidth = 3
              ctx.lineCap = 'round'
              ctx.lineJoin = 'round'
              ctx.beginPath()
              ctx.moveTo(previous.x, previous.y)
              ctx.lineTo(next.x, next.y)
              ctx.stroke()
              drawing.current = next
              uploaded.current = null
              setInk(true)
              form.setValue('confirmed', false)
            }}
            onPointerUp={() => {
              drawing.current = null
            }}
            onPointerCancel={() => {
              drawing.current = null
            }}
            onLostPointerCapture={() => {
              drawing.current = null
            }}
          />
          {keyboardFocused ? <span aria-hidden="true" className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-clinic-blue" style={{ left: `${keyboardPoint.x / 12}%`, top: `${keyboardPoint.y / 4}%` }} /> : null}
        </div>
        {keyboardFocused ? <p role="status" className="text-xs">Keyboard pen: {keyboardPen ? 'down — arrow keys draw' : 'up — press Space to draw'}</p> : null}
        <div className="flex items-center justify-between">
          <span role="status" className="text-sm text-slate-500">
            {ink ? 'Signature captured locally' : 'Signature required'}
          </span>
          <Button variant="secondary" disabled={save.isPending} onClick={clear}>
            <Eraser size={16} />
            Clear
          </Button>
        </div>
        {canvasError ? <p role="alert">{canvasError}</p> : null}
        <label className="flex items-start gap-2 text-sm">
          <Checkbox
            disabled={!ink || save.isPending}
            {...form.register('confirmed')}
          />
          I confirm the invoice and signer details are correct.
        </label>
        {form.formState.errors.confirmed ? (
          <p role="alert" className="text-sm text-clinic-danger">
            {form.formState.errors.confirmed.message}
          </p>
        ) : null}
        <BillingError error={save.error} />
        {save.error instanceof ApiError &&
        ['DOCUMENT_STORAGE_UNAVAILABLE', 'DOCUMENT_STORAGE_NOT_PRIVATE'].includes(save.error.code) ? (
          <p role="status" className="text-sm text-slate-600">
            Your drawing is still in this dialog. Keep it open and retry after the administrator restores storage. Closing or reloading the page will lose the drawing.
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            disabled={save.isPending}
            onClick={close}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={!ready || !ink || save.isPending}>
            <PenLine size={16} />
            {save.isPending ? 'Saving signature...' : 'Save signature'}
          </Button>
        </div>
      </form>
    </Dialog><ConfirmDialog open={discard} title="Discard unsaved signature?" description="The drawing and signer changes have not been saved to this invoice version." confirmLabel="Discard signature" cancelLabel="Keep reviewing" onCancel={() => setDiscard(false)} onConfirm={onClose} /></>
  )
}
