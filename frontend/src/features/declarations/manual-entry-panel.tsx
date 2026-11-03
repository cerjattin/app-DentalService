import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { getApiErrorMessage } from '../../api'
import { ApiError } from '../../api/api-error'
import { hasPermission } from '../../auth/permissions'
import { useAuth } from '../../auth/use-auth'
import { Button } from '../../components/ui/button'
import { ConfirmDialog } from '../../components/ui/confirm-dialog'
import { formatBusinessDateTime } from '../../lib/timezone'
import { saveBlob } from '../../lib/download'
import type { Declaration } from '../../types/declaration'
import { refreshDeclarationResources } from './declaration-cache'
import { downloadDeclarationExport } from './declaration-api'
import { downloadManualDossier, getManualDossier, manualEntryKey, prepareManualEntry } from './manual-entry-api'
import { ManualEntryDialog, type ManualAction } from './manual-entry-dialog'
import { getInvoiceVersion, invoiceVersionKeys } from '../billing/billing-api'
import { getSvbPilotReadiness, svbReadinessKeys } from '../svb-readiness/svb-readiness-api'
import { svbDeferredMessage, useSvbPilotReadiness } from '../svb-readiness/use-svb-pilot-readiness'

export function ManualEntryPanel({ declaration, hasItems }: { declaration: Declaration; hasItems: boolean }) {
  const { permissions } = useAuth()
  const client = useQueryClient()
  const [preparing, setPreparing] = useState(false)
  const [action, setAction] = useState<ManualAction | null>(null)
  const key = useRef(crypto.randomUUID())
  const capability = useSvbPilotReadiness()
  const canRead = hasPermission(permissions, 'invoice.read')
  const canSubmit = hasPermission(permissions, 'declaration.submit')
  const canEvidence = canSubmit && hasPermission(permissions, 'document.upload') && hasPermission(permissions, 'document.read')
  const dossier = useQuery({ queryKey: manualEntryKey(declaration.id), queryFn: ({ signal }) => getManualDossier(declaration.id, signal), enabled: canRead && hasItems && declaration.status !== 'CANCELLED', retry: false })
  const firstLine = dossier.data?.content.items[0]
  const invoiceCount = new Set(dossier.data?.content.items.map((line) => line.invoiceId)).size
  const source = useQuery({ queryKey: invoiceVersionKeys.detail(firstLine?.invoiceId ?? '', firstLine?.invoiceVersionId ?? ''), queryFn: ({ signal }) => getInvoiceVersion(firstLine!.invoiceId, firstLine!.invoiceVersionId, signal), enabled: canRead && declaration.status !== 'CANCELLED' && invoiceCount === 1 && Boolean(firstLine), retry: false })
  const itemIds = new Set(dossier.data?.content.items.map((line) => line.invoiceItemId))
  const wholeInvoice = source.isSuccess && source.data.status === 'CLOSED' && source.data.items.length === itemIds.size && source.data.items.every((item) => itemIds.has(item.id))
  const canPrepare = capability.canRecord && ['DRAFT', 'READY', 'EXPORTED'].includes(declaration.status) && dossier.isSuccess && invoiceCount === 1 && wholeInvoice
  const refresh = async () => { await Promise.all([refreshDeclarationResources(client, declaration.id), client.invalidateQueries({ queryKey: svbReadinessKeys.all })]) }
  const prepare = useMutation({ mutationKey: ['declaration-write', declaration.id], mutationFn: async () => {
    const current = await getSvbPilotReadiness()
    client.setQueryData(svbReadinessKeys.all, current)
    if (current.manualPortalRecordingEnabled !== true) throw new ApiError({ code: 'SVB_PRESENTATION_DEFERRED', status: 409, message: svbDeferredMessage })
    return prepareManualEntry(declaration.id, key.current)
  }, onSuccess: async () => { setPreparing(false); await refresh(); key.current = crypto.randomUUID() }, onError: refresh })
  const download = useMutation({ mutationFn: async () => {
    const blob = await downloadManualDossier(declaration.id)
    const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
    const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
    if (hash !== dossier.data?.contentHash) throw new ApiError({ code: 'MANUAL_CONTENT_CHANGED', message: 'Dossier changed', status: 409 })
    saveBlob(blob, `declaration-${declaration.id}-internal-v1.json`)
  }, onError: refresh })
  const proof = useMutation({ mutationFn: async (id: string) => saveBlob(await downloadDeclarationExport(id), `svb-evidence-${id}`) })
  const entry = dossier.data?.entry
  const locked = entry?.state === 'PREPARED' || entry?.state === 'UNCERTAIN'
  const error = prepare.error ?? download.error ?? proof.error
  return <div className="space-y-3 rounded border border-clinic-border p-3">
    {!capability.canRecord ? <p className="text-sm">{svbDeferredMessage}</p> : <p className="text-sm">Synthetic QA recording only. No external SVB action is performed.</p>}
    {capability.isError ? <p role="alert" className="text-sm text-clinic-danger">Unable to verify SVB recording availability. New records remain disabled. <Button variant="secondary" onClick={() => void capability.refetch()}>Retry SVB availability</Button></p> : null}
    {!canRead ? <p className="text-sm">Invoice read permission is required to review the manual dossier.</p> : !hasItems ? <p className="text-sm">Add the closed invoice's items before preparing a manual entry.</p> : dossier.isPending && dossier.fetchStatus === 'fetching' ? <p role="status">Loading manual dossier…</p> : dossier.isError ? <div role="alert" className="text-sm text-clinic-danger">{getApiErrorMessage(dossier.error)} <Button variant="secondary" onClick={() => void dossier.refetch()}>Retry manual dossier</Button></div> : null}
    {error ? <p role="alert" className="text-sm text-clinic-danger">{getApiErrorMessage(error)} Check the refreshed preparation before retrying.</p> : null}
    {dossier.data ? <>
      <p className="text-sm">Internal dossier · {dossier.data.content.schemaVersion} · {entry ? `Preparation ${entry.id}: ${entry.state}` : 'Not prepared'}</p>
      <p className="break-all font-mono text-xs">SHA-256: {dossier.data.contentHash}</p>
      {dossier.data.content.totalsByCurrency.map((total) => <p className="text-sm" key={total.currencyCode}>Backend total: {total.currencyCode} {total.amount}</p>)}
      <ul className="space-y-1 text-sm">{dossier.data.content.items.map((line) => <li key={line.declarationItemId}>Line {line.sequenceNumber} · <Link className="text-clinic-blue underline" to={`/invoices/${line.invoiceId}?versionId=${line.invoiceVersionId}`}>{line.invoiceNumber} / v{line.versionNumber}</Link> · {line.procedureCode} · {line.procedureDescription} · Quantity {line.quantity} · Tariff {line.unitTariff} · {line.currencyCode} {line.amount}</li>)}</ul>
      {invoiceCount !== 1 ? <p role="alert" className="text-sm text-clinic-danger">Prepare one invoice per declaration for manual entry. This dossier contains {invoiceCount} invoices; split the Draft before continuing.</p> : null}
      {invoiceCount === 1 && declaration.status !== 'CANCELLED' ? source.isPending ? <p role="status">Checking the complete invoice version…</p> : source.isError ? <p role="alert" className="text-sm text-clinic-danger">Unable to verify the complete invoice. {getApiErrorMessage(source.error)} <Button variant="secondary" onClick={() => void source.refetch()}>Retry source invoice</Button></p> : !wholeInvoice ? <p role="alert" className="text-sm text-clinic-danger">Include every item of this closed invoice version in one declaration before preparing or recording its manual presentation. The current dossier contains only {itemIds.size} of {source.data.items.length} items.</p> : null : null}
      {declaration.status === 'CANCELLED' ? <p className="text-sm">This cancelled declaration is historical. Manual preparation is unavailable.</p> : null}
      {entry ? <div className="space-y-1 text-sm"><p>Prepared by user {entry.preparedByUserId} · {formatBusinessDateTime(entry.preparedAt)}</p>{entry.uncertaintyReason ? <p role="alert">Uncertain outcome: {entry.uncertaintyReason}. Check the official portal before repeating any entry.</p> : null}{entry.externalSubmittedAt ? <p>External presentation: {formatBusinessDateTime(entry.externalSubmittedAt)} · Recorded: {entry.recordedAt ? formatBusinessDateTime(entry.recordedAt) : 'Not recorded'}</p> : null}{entry.receiptSha256 ? <p className="break-all text-xs">Receipt SHA-256: {entry.receiptSha256}</p> : null}{entry.result ? <><p>Official result: {entry.result.status} · {formatBusinessDateTime(entry.result.externalRespondedAt)} · Reference {entry.result.externalReference ?? 'None supplied'}</p><p className="break-all text-xs">Result SHA-256: {entry.result.sha256}</p><ul>{entry.result.lines.map((line) => <li key={line.declarationItemId}>Item {line.declarationItemId}: {line.status} {line.responseCode} {line.responseMessage}</li>)}</ul></> : null}</div> : null}
    </> : null}
    <div className="flex flex-wrap gap-2">
      {dossier.data ? <Button variant="secondary" disabled={download.isPending || declaration.status === 'CANCELLED'} onClick={() => download.mutate()}>Download internal dossier</Button> : null}
      {canSubmit ? <>
        <Button variant="secondary" disabled={!canPrepare || Boolean(entry && entry.state !== 'RELEASED') || prepare.isPending} onClick={() => setPreparing(true)}>Prepare manual entry</Button>
        <Button variant="secondary" disabled={!canPrepare || !locked || !canEvidence} onClick={() => setAction('record')}>Record portal entry</Button>
        <Button variant="secondary" disabled={!entry || entry.state !== 'RECORDED' || Boolean(entry.result) || !canEvidence} onClick={() => setAction('result')}>Record SVB result</Button>
        {entry?.state === 'PREPARED' ? <Button variant="secondary" onClick={() => setAction('uncertain')}>Mark outcome uncertain</Button> : null}
        {locked ? <Button variant="secondary" disabled={entry?.state === 'UNCERTAIN' && !canEvidence} onClick={() => setAction('release')}>Release verified preparation</Button> : null}
      </> : null}
      {entry?.receiptDocumentId && hasPermission(permissions, 'document.read') ? <Button variant="secondary" disabled={proof.isPending} onClick={() => proof.mutate(entry.receiptDocumentId!)}>Download receipt evidence</Button> : null}
      {entry?.result && hasPermission(permissions, 'document.read') ? <Button variant="secondary" disabled={proof.isPending} onClick={() => proof.mutate(entry.result!.documentId)}>Download response evidence</Button> : null}
    </div>
    {canSubmit && !canEvidence ? <p className="text-xs text-slate-500">Document upload and read permissions are required to record external evidence.</p> : null}
    <ConfirmDialog open={preparing} title="Prepare manual entry?" description="Freeze this invoice's internal dossier and reserve its synthetic QA preparation. This does not submit anything to SVB or certify external field rules. Server availability is checked again before preparing." confirmLabel={prepare.isPending ? 'Preparing…' : 'Prepare manual entry'} pending={prepare.isPending} error={prepare.error ? getApiErrorMessage(prepare.error) : undefined} onCancel={() => setPreparing(false)} onConfirm={() => { if (!prepare.isPending) prepare.mutate() }} />
    {action && entry && dossier.data ? <ManualEntryDialog action={action} canRecordNew={capability.canRecord} declarationId={declaration.id} entry={entry} lines={dossier.data.content.items} onClose={() => setAction(null)} onSaved={async () => { setAction(null); await refresh() }} onReconcile={refresh} /> : null}
  </div>
}
