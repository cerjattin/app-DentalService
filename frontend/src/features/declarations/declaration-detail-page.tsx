import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Download, FileOutput, Plus, ShieldCheck } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { getApiErrorMessage } from '../../api'
import { hasPermission } from '../../auth/permissions'
import { useAuth } from '../../auth/use-auth'
import { PageHeader } from '../../components/app-shell/page-header'
import { DataTable } from '../../components/data-table/data-table'
import { ErrorState } from '../../components/feedback/error-state'
import { LoadingState } from '../../components/feedback/loading-state'
import { StatusBadge } from '../../components/feedback/status-badge'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import { ConfirmDialog } from '../../components/ui/confirm-dialog'
import { Select } from '../../components/ui/select'
import { formatBusinessDateTime } from '../../lib/timezone'
import { saveBlob } from '../../lib/download'
import type { DeclarationExportFormat, DeclarationItem } from '../../types/declaration'
import {
  addDeclarationItem,
  createDeclarationExport,
  declarationKeys,
  downloadDeclarationExport,
  getDeclaration,
  listDeclarationExports,
  listDeclarationItems,
  listDeclarationSubmissions,
  markDeclarationReady,
} from './declaration-api'
import { AddDeclarationItemDialog } from './declaration-dialogs'
import { declarationLabel, declarationTone, type AddItemValues } from './declaration-model'
import { DeclarationDraftAction } from './declaration-draft-actions'
import { refreshDeclarationResources } from './declaration-cache'
import { DeclarationSnapshotReview } from './svb-data-review'
import { SvbPilotNotice } from '../svb-readiness/svb-pilot-notice'
import { ManualPortalWorkflow } from './manual-portal-workflow'

const formats: DeclarationExportFormat[] = ['CSV', 'TXT', 'JSON', 'XML']

export function DeclarationDetailPage() {
  const { declarationId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const returnInvoiceId = searchParams.get('returnInvoiceId') ?? ''
  const { permissions } = useAuth()
  const client = useQueryClient()
  const busy = useIsMutating({ mutationKey: ['declaration-write', declarationId] }) > 0
  const [addOpen, setAddOpen] = useState(false)
  const [reviewItem, setReviewItem] = useState<DeclarationItem | null>(null)
  const [readyOpen, setReadyOpen] = useState(false)
  const [format, setFormat] = useState<DeclarationExportFormat>('CSV')
  const detail = useQuery({ queryKey: declarationKeys.detail(declarationId), queryFn: ({ signal }) => getDeclaration(declarationId, signal), enabled: Boolean(declarationId) })
  const items = useQuery({ queryKey: declarationKeys.items(declarationId), queryFn: ({ signal }) => listDeclarationItems(declarationId, signal), enabled: Boolean(declarationId) })
  const exportsQuery = useQuery({ queryKey: declarationKeys.exports(declarationId), queryFn: ({ signal }) => listDeclarationExports(declarationId, signal), enabled: Boolean(declarationId) })
  const submissions = useQuery({ queryKey: declarationKeys.submissions(declarationId), queryFn: ({ signal }) => listDeclarationSubmissions(declarationId, signal), enabled: Boolean(declarationId) })
  const refresh = async () => { await Promise.all([
    refreshDeclarationResources(client, declarationId),
    client.invalidateQueries({ queryKey: declarationKeys.detail(declarationId) }),
    client.invalidateQueries({ queryKey: declarationKeys.items(declarationId) }),
    client.invalidateQueries({ queryKey: declarationKeys.exports(declarationId) }),
    client.invalidateQueries({ queryKey: declarationKeys.submissions(declarationId) }),
    client.invalidateQueries({ queryKey: declarationKeys.lists() }),
  ]) }
  const add = useMutation({ mutationKey: ['declaration-write', declarationId], mutationFn: (values: AddItemValues) => addDeclarationItem(declarationId, values.invoiceItemId), onSuccess: async () => { setAddOpen(false); await refreshDeclarationResources(client, declarationId) }, onError: () => { void refreshDeclarationResources(client, declarationId) } })
  const ready = useMutation({ mutationKey: ['declaration-write', declarationId], mutationFn: () => markDeclarationReady(declarationId), onSuccess: async () => { setReadyOpen(false); await refreshDeclarationResources(client, declarationId) } })
  const generate = useMutation({ mutationFn: () => createDeclarationExport(declarationId, format), onSuccess: refresh })
  const download = useMutation({ mutationFn: async ({ documentId, filename }: { documentId: string; filename: string }) => ({ blob: await downloadDeclarationExport(documentId), filename }), onSuccess: ({ blob, filename }) => saveBlob(blob, filename) })

  if (detail.isPending) return <LoadingState label="Loading declaration" />
  if (detail.isError) return <ErrorState title="Unable to load declaration" description={getApiErrorMessage(detail.error)} onRetry={() => void detail.refetch()} />
  const declaration = detail.data
  const mutationError = add.error ?? ready.error ?? generate.error ?? download.error
  return <div className="mx-auto max-w-350">
    <Link to="/declarations" className="mb-3 inline-flex items-center gap-2 text-sm text-clinic-blue hover:underline"><ArrowLeft size={16} />Back to declarations</Link>
    <PageHeader title={declaration.declarationNumber ?? `Declaration ${declaration.id}`} description={`${declaration.payer.code} - ${declaration.payer.name}`} actions={<StatusBadge tone={declarationTone(declaration.status)}>{declarationLabel(declaration.status)}</StatusBadge>} />
    <Card className="mb-5 grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
      <Field label="Period">{declaration.periodStart || declaration.periodEnd ? `${declaration.periodStart ?? 'Open'} - ${declaration.periodEnd ?? 'Open'}` : 'Not specified'}</Field>
      <Field label="Declarant ID">{declaration.declarantIdSnapshot ?? 'Not assigned — set by the first invoice item'}</Field>
      <Field label="Submission reference">{declaration.submissionReference ?? 'No reference recorded'}</Field>
      <Field label="Created">{formatBusinessDateTime(declaration.createdAt)}</Field>
    </Card>
    {mutationError ? <p role="alert" className="mb-4 rounded-md bg-red-50 p-3 text-sm text-clinic-danger">{getApiErrorMessage(mutationError)}</p> : null}
    <SvbPilotNotice readiness={declaration.realPresentationReadiness} />
    <ManualPortalWorkflow declaration={declaration} items={items.data ?? []} exports={exportsQuery.data ?? []} />

    <Section title="Declaration items" actions={declaration.status === 'DRAFT' ? <div className="flex gap-2">{hasPermission(permissions, 'declaration.update') ? <><Button variant="secondary" disabled={busy || !hasPermission(permissions, 'invoice.read')} title="Invoice read permission is required to select candidates." onClick={() => setAddOpen(true)}><Plus size={16} />Add item</Button><Button disabled={busy || !items.data?.length} onClick={() => setReadyOpen(true)}><ShieldCheck size={16} />Validate and mark ready</Button></> : null}</div> : null}>
      <p className="mb-3 text-sm text-slate-500">Items are immutable snapshots of the exact invoice version accepted by the Backend.</p>
      {items.isPending ? <LoadingState label="Loading declaration items" /> : items.isError ? <ErrorState title="Unable to load declaration items" description={getApiErrorMessage(items.error)} onRetry={() => void items.refetch()} /> : <DataTable rows={items.data} getRowKey={(row) => row.id} emptyMessage="No declaration items" columns={[
        { key: 'sequence', header: '#', render: (row) => row.sequenceNumber },
        { key: 'invoice', header: 'Invoice', render: (row) => <div><span className="font-medium">{row.invoiceNumberSnapshot}</span><p className="text-xs text-slate-500">Item {row.invoiceItemId}</p></div> },
        { key: 'service', header: 'Service date', render: (row) => row.serviceDateSnapshot },
        { key: 'insured', header: 'Insured ID', render: (row) => row.insuredIdSnapshot },
        { key: 'treatment', header: 'Treatment ID', render: (row) => row.treatmentIdSnapshot ?? 'Not provided' },
        { key: 'amount', header: 'Amount', render: (row) => <span className="font-mono">{row.amountSnapshot}</span> },
        { key: 'status', header: 'Line status', render: (row) => <StatusBadge tone={row.lineStatus === 'ACCEPTED' ? 'success' : row.lineStatus === 'REJECTED' ? 'danger' : 'neutral'}>{declarationLabel(row.lineStatus)}</StatusBadge> },
        { key: 'actions', header: 'Actions', render: (row) => <div className="flex flex-wrap gap-2"><Button variant="secondary" aria-label={`Review SVB snapshot line ${row.sequenceNumber}`} onClick={() => setReviewItem(row)}>Review SVB data</Button><DeclarationDraftAction declaration={declaration} item={row} /></div> },
      ]} />}
    </Section>

    <Section title="Exports" actions={['READY', 'EXPORTED'].includes(declaration.status) && hasPermission(permissions, 'declaration.export') ? <div className="flex gap-2"><Select aria-label="Export format" className="w-28" value={format} onChange={(event) => setFormat(event.target.value as DeclarationExportFormat)}>{formats.map((value) => <option key={value}>{value}</option>)}</Select><Button disabled={generate.isPending} onClick={() => generate.mutate()}><FileOutput size={16} />{generate.isPending ? 'Generating...' : 'Generate export'}</Button></div> : null}>
      <p className="mb-3 text-sm text-slate-600">Exports generated here are for technical review. They are not verified files for real SVB presentation.</p>
      {exportsQuery.isPending ? <LoadingState label="Loading exports" /> : exportsQuery.isError ? <ErrorState title="Unable to load exports" description={getApiErrorMessage(exportsQuery.error)} onRetry={() => void exportsQuery.refetch()} /> : exportsQuery.data.length ? <DataTable rows={exportsQuery.data} getRowKey={(row) => row.id} emptyMessage="No exports" columns={[
        { key: 'format', header: 'Format', render: (row) => row.format },
        { key: 'file', header: 'File', render: (row) => row.document.originalFilename },
        { key: 'records', header: 'Records', render: (row) => row.recordCount },
        { key: 'generated', header: 'Generated', render: (row) => formatBusinessDateTime(row.exportedAt) },
        { key: 'download', header: '', render: (row) => hasPermission(permissions, 'document.read') ? <Button variant="secondary" disabled={download.isPending} onClick={() => download.mutate({ documentId: row.documentId, filename: row.document.originalFilename })}><Download size={16} />Download technical file</Button> : 'Permission required' },
      ]} /> : <p className="text-sm text-slate-500">No export has been generated.</p>}
    </Section>

    <Section title="Submission history">
      <p className="mb-3 text-sm text-slate-500">Recorded history is shown below. Manual portal actions and external results must be supported by their own evidence.</p>
      {submissions.isPending ? <LoadingState label="Loading submissions" /> : submissions.isError ? <ErrorState title="Unable to load submissions" description={getApiErrorMessage(submissions.error)} onRetry={() => void submissions.refetch()} /> : submissions.data.length ? <DataTable rows={submissions.data} getRowKey={(row) => row.id} emptyMessage="No submissions" columns={[
        { key: 'attempt', header: 'Attempt', render: (row) => row.attemptNumber },
        { key: 'channel', header: 'Channel', render: (row) => declarationLabel(row.channel) },
        { key: 'status', header: 'Status', render: (row) => <StatusBadge tone={declarationTone(row.status)}>{declarationLabel(row.status)}</StatusBadge> },
        { key: 'reference', header: 'Reference', render: (row) => row.externalReference ?? 'Not provided' },
        { key: 'submitted', header: 'Submitted', render: (row) => formatBusinessDateTime(row.submittedAt) },
      ]} /> : <p className="text-sm text-slate-500">No submission attempts recorded.</p>}
    </Section>

    {addOpen ? <AddDeclarationItemDialog declaration={declaration} pending={add.isPending} error={add.error ? getApiErrorMessage(add.error) : undefined} onClose={() => { setAddOpen(false); add.reset() }} onSubmit={(values) => { if (!add.isPending) add.mutate(values) }} /> : null}
    {reviewItem ? <DeclarationSnapshotReview item={reviewItem} onClose={() => setReviewItem(null)} /> : null}
    <div className="my-4 flex flex-wrap gap-3"><DeclarationDraftAction declaration={declaration} />{/^[1-9]\d*$/.test(returnInvoiceId) && hasPermission(permissions, 'invoice.read') ? <Link className="text-clinic-blue underline" to={`/invoices/${returnInvoiceId}`}>Back to invoice</Link> : null}</div>
    <ConfirmDialog open={readyOpen} title="Validate declaration" description="This is technical review only. All frozen SVB data must pass validation before READY. Technical READY does not authorize real SVB presentation." confirmLabel={ready.isPending ? 'Validating...' : 'Validate and mark ready'} pending={ready.isPending} error={ready.error ? getApiErrorMessage(ready.error) : undefined} onCancel={() => { setReadyOpen(false); ready.reset() }} onConfirm={() => ready.mutate()} />
  </div>
}

function Section({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return <section className="border-t border-clinic-border py-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold text-slate-900">{title}</h2>{actions}</div>{children}</section>
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <dl><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm text-slate-900">{children}</dd></dl>
}
