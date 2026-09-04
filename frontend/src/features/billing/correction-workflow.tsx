import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, FilePlus2, RotateCcw, X } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'
import { PermissionGuard } from '../../auth/permission-guard'
import { Button } from '../../components/ui/button'
import { Dialog } from '../../components/ui/dialog'
import { FormField } from '../../components/forms/form-field'
import { Input } from '../../components/ui/input'
import { Textarea } from '../../components/ui/textarea'
import { formatBusinessDateTime } from '../../lib/timezone'
import type { Invoice, InvoiceCorrection } from '../../types/billing'
import {
  correctionKeys,
  createCorrectionReplacement,
  invoiceHistoryKeys,
  invoiceKeys,
  invoiceVersionKeys,
  listInvoiceCorrections,
  listInvoiceStatusHistory,
  requestInvoiceCorrection,
  resolveInvoiceCorrection,
  type CorrectionResolution,
} from './billing-api'
import {
  billingLabel,
  correctionRequestSchema,
  correctionResolutionSchema,
} from './billing-model'
import {
  BillingError,
  BillingSection,
  BillingStatus,
} from './billing-ui'

type RequestValues = z.infer<typeof correctionRequestSchema>
type ResolutionValues = z.infer<typeof correctionResolutionSchema>
type Action = 'request' | 'approve' | 'reject' | 'cancel' | 'replacement'

export function CorrectionWorkflow({ invoice }: { invoice: Invoice }) {
  const client = useQueryClient()
  const [action, setAction] = useState<Action | null>(null)
  const [selected, setSelected] = useState<InvoiceCorrection | null>(null)
  const [notice, setNotice] = useState('')
  const corrections = useQuery({
    queryKey: correctionKeys.invoice(invoice.id),
    queryFn: ({ signal }) => listInvoiceCorrections(invoice.id, signal),
  })
  const history = useQuery({
    queryKey: invoiceHistoryKeys.invoice(invoice.id),
    queryFn: ({ signal }) => listInvoiceStatusHistory(invoice.id, signal),
  })
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: correctionKeys.invoice(invoice.id) }),
      client.invalidateQueries({ queryKey: invoiceHistoryKeys.invoice(invoice.id) }),
      client.invalidateQueries({ queryKey: invoiceKeys.detail(invoice.id) }),
      client.invalidateQueries({ queryKey: invoiceKeys.lists() }),
      client.invalidateQueries({ queryKey: invoiceVersionKeys.invoice(invoice.id) }),
    ])
  }
  const open = (next: Action, correction?: InvoiceCorrection) => {
    setSelected(correction ?? null)
    setAction(next)
  }
  const canRequest =
    invoice.status === 'CLOSED' && invoice.currentVersion?.status === 'CLOSED'
  return (
    <>
      <BillingSection
        title="Corrections and version history"
        actions={
          canRequest ? (
            <PermissionGuard allOf={['invoice.request_correction']}>
              <Button variant="secondary" onClick={() => open('request')}>
                <RotateCcw size={16} />
                Request correction
              </Button>
            </PermissionGuard>
          ) : null
        }
      >
        {notice ? <p role="status" className="mb-3 text-sm text-green-700">{notice}</p> : null}
        {corrections.isPending ? (
          <p className="text-sm text-slate-500">Loading corrections...</p>
        ) : corrections.isError ? (
          <BillingError error={corrections.error} />
        ) : corrections.data.length ? (
          <ul className="space-y-3">
            {corrections.data.map((correction) => (
              <li key={correction.id} className="rounded-md border border-clinic-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{correction.reasonCode}</p>
                    <p className="mt-1 text-sm text-slate-600">{correction.reasonText}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Requested {formatBusinessDateTime(correction.requestedAt)} / source version{' '}
                      {correction.sourceVersion?.versionNumber ?? correction.sourceVersionId}
                      {correction.replacementVersion
                        ? ` / replacement version ${correction.replacementVersion.versionNumber}`
                        : ''}
                    </p>
                  </div>
                  <BillingStatus status={correction.status} />
                </div>
                <CorrectionActions correction={correction} open={open} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No correction history.</p>
        )}
        {history.data?.length ? (
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-medium text-clinic-blue">Invoice status history</summary>
            <ol className="mt-3 space-y-2 border-l border-clinic-border pl-4">
              {history.data.map((entry) => (
                <li key={entry.id}>
                  <span className="font-medium">{entry.oldStatus ? billingLabel(entry.oldStatus) : 'Created'} to {billingLabel(entry.newStatus)}</span>
                  <span className="ml-2 text-slate-500">{formatBusinessDateTime(entry.changedAt)}</span>
                  {entry.reason ? <p className="text-slate-600">{entry.reason}</p> : null}
                </li>
              ))}
            </ol>
          </details>
        ) : null}
      </BillingSection>
      {action === 'request' ? (
        <CorrectionRequestDialog invoice={invoice} close={() => setAction(null)} refresh={refresh} notice={setNotice} />
      ) : action && selected ? (
        <CorrectionActionDialog invoice={invoice} correction={selected} action={action} close={() => setAction(null)} refresh={refresh} notice={setNotice} />
      ) : null}
    </>
  )
}

function CorrectionActions({ correction, open }: { correction: InvoiceCorrection; open: (action: Action, correction: InvoiceCorrection) => void }) {
  if (correction.status === 'REQUESTED')
    return (
      <PermissionGuard allOf={['invoice.apply_correction']}>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => open('approve', correction)}><Check size={16} />Approve</Button>
          <Button variant="secondary" onClick={() => open('reject', correction)}><X size={16} />Reject</Button>
          <Button variant="ghost" onClick={() => open('cancel', correction)}>Cancel request</Button>
        </div>
      </PermissionGuard>
    )
  if (correction.status === 'APPROVED' && !correction.replacementVersionId)
    return (
      <PermissionGuard allOf={['invoice.apply_correction']}>
        <div className="mt-3"><Button onClick={() => open('replacement', correction)}><FilePlus2 size={16} />Create replacement version</Button></div>
      </PermissionGuard>
    )
  return null
}

function CorrectionRequestDialog({ invoice, close, refresh, notice }: { invoice: Invoice; close: () => void; refresh: () => Promise<void>; notice: (value: string) => void }) {
  const form = useForm<RequestValues>({ resolver: zodResolver(correctionRequestSchema), defaultValues: { reasonCode: '', reasonText: '' } })
  const mutation = useMutation({
    mutationFn: requestInvoiceCorrection.bind(null, invoice.id),
    onSuccess: async () => { notice('Correction requested.'); close(); await refresh() },
  })
  return (
    <Dialog open title="Request correction" description="The closed version remains unchanged. An approved request creates a replacement version." onOpenChange={(open) => { if (!open && !mutation.isPending) close() }}>
      <form className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <FormField label="Reason code" htmlFor="correction-code" error={form.formState.errors.reasonCode?.message}>
          <Input id="correction-code" autoFocus {...form.register('reasonCode')} />
        </FormField>
        <FormField label="Correction reason" htmlFor="correction-text" error={form.formState.errors.reasonText?.message}>
          <Textarea id="correction-text" {...form.register('reasonText')} />
        </FormField>
        <BillingError error={mutation.error} />
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" disabled={mutation.isPending} onClick={close}>Cancel</Button><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Requesting...' : 'Request correction'}</Button></div>
      </form>
    </Dialog>
  )
}

function CorrectionActionDialog({ invoice, correction, action, close, refresh, notice }: { invoice: Invoice; correction: InvoiceCorrection; action: Exclude<Action, 'request'>; close: () => void; refresh: () => Promise<void>; notice: (value: string) => void }) {
  const form = useForm<ResolutionValues>({ resolver: zodResolver(correctionResolutionSchema), defaultValues: { reason: '' } })
  const mutation = useMutation({
    mutationFn: (values: ResolutionValues) =>
      action === 'replacement'
        ? createCorrectionReplacement(invoice.id, correction.id)
        : resolveInvoiceCorrection(invoice.id, correction.id, action as CorrectionResolution, values.reason ? values : undefined),
    onSuccess: async () => { notice(action === 'replacement' ? 'Replacement version created.' : `Correction ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'cancelled'}.`); close(); await refresh() },
  })
  const title = action === 'replacement' ? 'Create replacement version?' : `${action[0]?.toUpperCase()}${action.slice(1)} correction?`
  return (
    <Dialog open title={title} description={action === 'replacement' ? 'Backend will copy the closed source into a new draft correction version.' : 'This transition is recorded in invoice history.'} onOpenChange={(open) => { if (!open && !mutation.isPending) close() }}>
      <form className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        {action === 'reject' || action === 'cancel' ? (
          <FormField label="Resolution note (optional)" htmlFor="resolution-reason" error={form.formState.errors.reason?.message}>
            <Textarea id="resolution-reason" autoFocus {...form.register('reason')} />
          </FormField>
        ) : null}
        <BillingError error={mutation.error} />
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" disabled={mutation.isPending} onClick={close}>Cancel</Button><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving...' : 'Confirm'}</Button></div>
      </form>
    </Dialog>
  )
}
