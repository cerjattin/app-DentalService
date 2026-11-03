import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useId, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { getApiErrorMessage } from '../../api'
import { UnsavedChanges } from '../../components/forms/unsaved-changes'
import { Button } from '../../components/ui/button'
import { ConfirmDialog } from '../../components/ui/confirm-dialog'
import { Dialog } from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { Select } from '../../components/ui/select'
import { businessDateTimeInputToIso } from '../../lib/timezone'
import type { ManualEntry, ManualInvoiceLine, ManualResultInput, ManualSubmissionInput } from '../../types/manual-entry'
import { flagManualUncertainty, recordManualResult, recordManualSubmission, releaseManualEntry, uploadManualEvidence } from './manual-entry-api'
import { svbDeferredMessage } from '../svb-readiness/use-svb-pilot-readiness'

export type ManualAction = 'record' | 'result' | 'uncertain' | 'release'
const titles: Record<ManualAction, string> = { record: 'Record portal entry', result: 'Record SVB result', uncertain: 'Mark outcome uncertain', release: 'Release preparation' }
const schema = z.object({
  reason: z.string().trim().max(500), reference: z.string().trim().max(120), noReference: z.boolean(),
  externalTime: z.string(), confirmed: z.boolean(),
  status: z.enum(['', 'ACCEPTED', 'PARTIALLY_REJECTED', 'REJECTED']),
  lines: z.array(z.object({ declarationItemId: z.string(), status: z.enum(['', 'ACCEPTED', 'REJECTED']), responseCode: z.string().trim().max(80), responseMessage: z.string().trim().max(1000) })),
})
type Values = z.infer<typeof schema>
const evidenceTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp']

export function ManualEntryDialog({ action, canRecordNew = false, declarationId, entry, lines, onClose, onSaved, onReconcile }: { action: ManualAction; canRecordNew?: boolean; declarationId: string; entry: ManualEntry; lines: ManualInvoiceLine[]; onClose: () => void; onSaved: () => Promise<void>; onReconcile: () => Promise<void> }) {
  const fieldPrefix = useId()
  const fileInput = useRef<HTMLInputElement | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState('')
  const [discard, setDiscard] = useState(false)
  const uploaded = useRef<string | null>(null)
  // Retain exactly the same request and key for retries after a lost response.
  const [attempt, setAttempt] = useState<Values | null>(null)
  const key = useRef(crypto.randomUUID())
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { reason: '', reference: '', noReference: false, externalTime: '', confirmed: false, status: '', lines: lines.map((line) => ({ declarationItemId: line.declarationItemId, status: '', responseCode: '', responseMessage: '' })) } })
  const errorProps = (name: keyof Values) => ({ 'aria-invalid': Boolean(form.formState.errors[name]), 'aria-describedby': form.formState.errors[name] ? `${fieldPrefix}-${name}-error` : undefined })
  const needsEvidence = action === 'record' || action === 'result' || (action === 'release' && entry.state === 'UNCERTAIN')
  const official = action === 'record' || action === 'result'
  const blocked = action === 'record' && !canRecordNew && !attempt
  const save = useMutation({
    mutationKey: ['declaration-write', declarationId],
    mutationFn: async (saved: Values) => {
      if (file && !uploaded.current) uploaded.current = (await uploadManualEvidence(file)).id
      if (action === 'uncertain') return flagManualUncertainty(declarationId, entry.id, saved.reason)
      if (action === 'release') return releaseManualEntry(declarationId, entry.id, { reason: saved.reason, confirmation: 'NOT_PRESENTED_VERIFIED', ...(uploaded.current ? { resolutionDocumentId: uploaded.current } : {}) })
      const common = { externalReference: saved.noReference ? null : saved.reference, idempotencyKey: key.current, ...(saved.reason ? { reason: saved.reason } : {}) }
      if (action === 'record') {
        const body: ManualSubmissionInput = { ...common, manualEntryId: entry.id, expectedContentHash: entry.contentHash, submittedAt: businessDateTimeInputToIso(saved.externalTime), receiptDocumentId: uploaded.current!, confirmation: 'ALREADY_ENTERED_IN_OFFICIAL_PORTAL' }
        return recordManualSubmission(declarationId, body)
      }
      const body: ManualResultInput = { ...common, status: saved.status as ManualResultInput['status'], respondedAt: businessDateTimeInputToIso(saved.externalTime), resultDocumentId: uploaded.current!, lines: saved.lines.map((line) => ({ declarationItemId: line.declarationItemId, status: line.status as 'ACCEPTED' | 'REJECTED', ...(line.responseCode ? { responseCode: line.responseCode } : {}), ...(line.responseMessage ? { responseMessage: line.responseMessage } : {}) })) }
      return recordManualResult(declarationId, entry.submissionId!, body)
    },
    onSuccess: onSaved,
    onError: onReconcile,
  })
  const dirty = form.formState.isDirty || Boolean(file) || Boolean(attempt)
  const close = () => { if (!save.isPending) { if (dirty) setDiscard(true); else onClose() } }
  function submit(values: Values) {
    if (save.isPending || blocked) return
    if (attempt) { save.mutate(attempt); return }
    let invalid = false
    function error(name: 'confirmed' | 'reason' | 'reference' | 'externalTime' | 'status' | 'lines', message: string) { form.setError(name, { message }, { shouldFocus: !invalid && name !== 'lines' }); if (name === 'lines' && !invalid) form.setFocus('lines.0.status'); invalid = true }
    if (!values.confirmed) error('confirmed', 'Explicit confirmation is required.')
    if ((!official || values.noReference) && !values.reason) error('reason', 'Enter the reason. Do not invent an external reference.')
    if (official && !values.noReference && !values.reference) error('reference', 'Enter the external reference or confirm none was supplied.')
    if (official && (!values.externalTime || !Number.isFinite(new Date(`${values.externalTime}:00-04:00`).getTime()))) error('externalTime', 'Enter the external date and time in Curaçao.')
    if (needsEvidence && !file) { setFileError('Attach the external evidence before recording.'); if (!invalid) fileInput.current?.focus(); invalid = true }
    if (action === 'result') {
      const accepted = values.lines.filter((line) => line.status === 'ACCEPTED').length
      if (!values.status || (values.status === 'ACCEPTED' && accepted !== values.lines.length) || (values.status === 'REJECTED' && accepted !== 0) || (values.status === 'PARTIALLY_REJECTED' && (!accepted || accepted === values.lines.length))) error('status', 'Overall result must agree with every line.')
      if (values.lines.some((line) => !line.status || (line.status === 'REJECTED' && !line.responseCode && !line.responseMessage))) error('lines', 'Choose every line result and provide the external rejection code or explanation for rejected lines.')
    }
    if (!invalid) { setAttempt(structuredClone(values)); save.mutate(values) }
  }
  return <><UnsavedChanges active={dirty && !save.isPending} /><Dialog open size="wide" title={titles[action]} description="This records an operator action supported by evidence. The application does not submit to SVB." onOpenChange={(open) => { if (!open) close() }}>
    <p className="mb-3 break-all text-xs">Preparation {entry.id} · Frozen SHA-256 {entry.contentHash}</p>
    <form className="space-y-4" onSubmit={(event) => void form.handleSubmit(submit)(event)}>
      {blocked ? <p role="alert" className="text-sm text-clinic-danger">{svbDeferredMessage} Your entries are retained for review. No new record can be submitted.</p> : null}
      {save.error ? <div role="alert" className="rounded bg-red-50 p-3 text-sm text-clinic-danger">{getApiErrorMessage(save.error)}<p className="mt-2">The result may already be recorded. Check the refreshed record. Retry keeps the same request and key; do not repeat the action in the portal.</p></div> : null}
      <fieldset disabled={save.isPending || Boolean(attempt) || blocked} className="space-y-4 disabled:opacity-70">
        {official ? <>
          <label className="block text-sm">External date and time (America/Curacao)<Input type="datetime-local" {...errorProps('externalTime')} {...form.register('externalTime')} /></label>
          <label className="block text-sm">External reference<Input maxLength={120} {...errorProps('reference')} {...form.register('reference')} /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...form.register('noReference')} />The portal or response supplied no reference</label>
        </> : null}
        <label className="block text-sm">Reason / explanation<Input maxLength={500} {...errorProps('reason')} {...form.register('reason')} /></label>
        {action === 'result' ? <>
          <label className="block text-sm">Overall SVB result<Select {...errorProps('status')} {...form.register('status')}><option value="">Select the evidenced result</option><option value="ACCEPTED">Accepted</option><option value="PARTIALLY_REJECTED">Partially rejected</option><option value="REJECTED">Rejected</option></Select></label>
          {lines.map((line, index) => <div key={line.declarationItemId} className="space-y-2 rounded border border-clinic-border p-3"><p className="text-sm">Line {line.sequenceNumber} · Invoice {line.invoiceNumber} · {line.procedureCode} · {line.currencyCode} {line.amount}</p><label className="block text-sm">Line {line.sequenceNumber} result<Select {...errorProps('lines')} {...form.register(`lines.${index}.status`)}><option value="">Select result</option><option value="ACCEPTED">Accepted</option><option value="REJECTED">Rejected</option></Select></label><label className="block text-sm">Line {line.sequenceNumber} response code<Input maxLength={80} {...errorProps('lines')} {...form.register(`lines.${index}.responseCode`)} /></label><label className="block text-sm">Line {line.sequenceNumber} response explanation<Input maxLength={1000} {...errorProps('lines')} {...form.register(`lines.${index}.responseMessage`)} /></label></div>)}
        </> : null}
        {needsEvidence ? <label className="block text-sm">{action === 'record' ? 'Portal receipt' : action === 'result' ? 'Official response evidence' : 'Portal verification evidence'}<Input ref={fileInput} aria-invalid={Boolean(fileError)} aria-describedby={`${fieldPrefix}-file-hint${fileError ? ` ${fieldPrefix}-file-error` : ''}`} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(event) => { const candidate = event.target.files?.[0] ?? null; uploaded.current = null; if (candidate && (!evidenceTypes.includes(candidate.type) || candidate.size === 0 || candidate.size > 4 * 1024 * 1024)) { setFile(null); setFileError('Use a non-empty PDF, PNG, JPEG or WebP up to 4 MB.'); event.target.value = '' } else { setFile(candidate); setFileError('') } }} /><span id={`${fieldPrefix}-file-hint`} className="text-xs text-slate-500">Private evidence is uploaded to this application's backend. It is not sent to SVB.</span></label> : null}
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" {...errorProps('confirmed')} {...form.register('confirmed')} /><span>{action === 'record' ? 'I verified that this invoice was already entered in the official portal and the receipt supports this record.' : action === 'result' ? 'I reviewed the official response and every line outcome. Acceptance does not mean payment.' : action === 'release' ? 'I checked the official portal and verified that this invoice was NOT presented. Releasing permits a new preparation.' : 'The external outcome is uncertain. Keep this invoice locked until the portal is checked.'}</span></label>
      </fieldset>
      {Object.entries(form.formState.errors).map(([name, error]) => <p id={`${fieldPrefix}-${name}-error`} role="alert" key={name} className="text-sm text-clinic-danger">{error && 'message' in error ? String(error.message) : 'Review the line outcomes.'}</p>)}
      {fileError ? <p id={`${fieldPrefix}-file-error`} role="alert" className="text-sm text-clinic-danger">{fileError}</p> : null}
      <div className="flex justify-end gap-2"><Button type="button" variant="secondary" disabled={save.isPending} onClick={close}>Cancel</Button><Button type="submit" disabled={save.isPending || blocked}>{save.isPending ? 'Recording…' : attempt ? 'Retry same record' : titles[action]}</Button></div>
    </form>
  </Dialog><ConfirmDialog open={discard} title="Close this record?" description="Unsaved entries will be discarded. An uncertain server response may already have committed: check the refreshed history before preparing or recording again." confirmLabel="Close and review history" cancelLabel="Keep reviewing" onCancel={() => setDiscard(false)} onConfirm={onClose} /></>
}
