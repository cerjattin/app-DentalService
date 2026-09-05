import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Download, FileOutput, Plus, Send, ShieldCheck } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
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
import type { DeclarationExportFormat, DeclarationSubmission } from '../../types/declaration'
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
  recordSubmissionResult,
  submitDeclaration,
} from './declaration-api'
import { AddDeclarationItemDialog, SubmissionResultDialog } from './declaration-dialogs'
import { declarationLabel, declarationTone, type AddItemValues, type SubmissionResultValues } from './declaration-model'

const formats: DeclarationExportFormat[] = ['CSV', 'TXT', 'JSON', 'XML']

export function DeclarationDetailPage() {
  const { declarationId = '' } = useParams()
  const { permissions } = useAuth()
  const client = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [readyOpen, setReadyOpen] = useState(false)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [resultFor, setResultFor] = useState<DeclarationSubmission | null>(null)
  const [format, setFormat] = useState<DeclarationExportFormat>('CSV')
  const detail = useQuery({ queryKey: declarationKeys.detail(declarationId), queryFn: ({ signal }) => getDeclaration(declarationId, signal), enabled: Boolean(declarationId) })
  const items = useQuery({ queryKey: declarationKeys.items(declarationId), queryFn: ({ signal }) => listDeclarationItems(declarationId, signal), enabled: Boolean(declarationId) })
  const exportsQuery = useQuery({ queryKey: declarationKeys.exports(declarationId), queryFn: ({ signal }) => listDeclarationExports(declarationId, signal), enabled: Boolean(declarationId) })
  const submissions = useQuery({ queryKey: declarationKeys.submissions(declarationId), queryFn: ({ signal }) => listDeclarationSubmissions(declarationId, signal), enabled: Boolean(declarationId) })
  const refresh = async () => { await Promise.all([
    client.invalidateQueries({ queryKey: declarationKeys.detail(declarationId) }),
    client.invalidateQueries({ queryKey: declarationKeys.items(declarationId) }),
    client.invalidateQueries({ queryKey: declarationKeys.exports(declarationId) }),
    client.invalidateQueries({ queryKey: declarationKeys.submissions(declarationId) }),
    client.invalidateQueries({ queryKey: declarationKeys.lists() }),
  ]) }
  const add = useMutation({ mutationFn: (values: AddItemValues) => addDeclarationItem(declarationId, values.invoiceItemId), onSuccess: async () => { setAddOpen(false); await refresh() } })
  const ready = useMutation({ mutationFn: () => markDeclarationReady(declarationId), onSuccess: async () => { setReadyOpen(false); await refresh() } })
  const generate = useMutation({ mutationFn: () => createDeclarationExport(declarationId, format), onSuccess: refresh })
  const send = useMutation({ mutationFn: () => submitDeclaration(declarationId), onSuccess: async () => { setSubmitOpen(false); await refresh() } })
  const result = useMutation({ mutationFn: (values: SubmissionResultValues) => recordSubmissionResult(declarationId, resultFor?.id ?? '', { status: values.status, ...(values.externalReference ? { externalReference: values.externalReference } : {}) }), onSuccess: async () => { setResultFor(null); await refresh() } })
  const download = useMutation({ mutationFn: async ({ documentId, filename }: { documentId: string; filename: string }) => ({ blob: await downloadDeclarationExport(documentId), filename }), onSuccess: ({ blob, filename }) => saveBlob(blob, filename) })

  if (detail.isPending) return <LoadingState label="Loading declaration" />
  if (detail.isError) return <ErrorState title="Unable to load declaration" description={getApiErrorMessage(detail.error)} onRetry={() => void detail.refetch()} />
  const declaration = detail.data
  const mutationError = add.error ?? ready.error ?? generate.error ?? send.error ?? result.error ?? download.error
  return <div className="mx-auto max-w-350">
    <Link to="/declarations" className="mb-3 inline-flex items-center gap-2 text-sm text-clinic-blue hover:underline"><ArrowLeft size={16} />Back to declarations</Link>
    <PageHeader title={declaration.declarationNumber ?? `Declaration ${declaration.id}`} description={`${declaration.payer.code} - ${declaration.payer.name}`} actions={<StatusBadge tone={declarationTone(declaration.status)}>{declarationLabel(declaration.status)}</StatusBadge>} />
    <Card className="mb-5 grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
      <Field label="Period">{declaration.periodStart || declaration.periodEnd ? `${declaration.periodStart ?? 'Open'} - ${declaration.periodEnd ?? 'Open'}` : 'Not specified'}</Field>
      <Field label="Declarant ID">{declaration.declarantIdSnapshot ?? 'Not provided'}</Field>
      <Field label="Submission reference">{declaration.submissionReference ?? 'Not submitted'}</Field>
      <Field label="Created">{formatBusinessDateTime(declaration.createdAt)}</Field>
    </Card>
    {mutationError ? <p role="alert" className="mb-4 rounded-md bg-red-50 p-3 text-sm text-clinic-danger">{getApiErrorMessage(mutationError)}</p> : null}

    <Section title="Declaration items" actions={declaration.status === 'DRAFT' ? <div className="flex gap-2">{hasPermission(permissions, 'declaration.update') ? <><Button variant="secondary" onClick={() => setAddOpen(true)}><Plus size={16} />Add item</Button><Button disabled={!items.data?.length} onClick={() => setReadyOpen(true)}><ShieldCheck size={16} />Validate and mark ready</Button></> : null}</div> : null}>
      <p className="mb-3 text-sm text-slate-500">Items are immutable snapshots of the exact invoice version accepted by the Backend.</p>
      {items.isPending ? <LoadingState label="Loading declaration items" /> : items.isError ? <ErrorState title="Unable to load declaration items" description={getApiErrorMessage(items.error)} onRetry={() => void items.refetch()} /> : <DataTable rows={items.data} getRowKey={(row) => row.id} emptyMessage="No declaration items" columns={[
        { key: 'sequence', header: '#', render: (row) => row.sequenceNumber },
        { key: 'invoice', header: 'Invoice', render: (row) => <div><span className="font-medium">{row.invoiceNumberSnapshot}</span><p className="text-xs text-slate-500">Item {row.invoiceItemId}</p></div> },
        { key: 'service', header: 'Service date', render: (row) => row.serviceDateSnapshot },
        { key: 'insured', header: 'Insured ID', render: (row) => row.insuredIdSnapshot },
        { key: 'treatment', header: 'Treatment ID', render: (row) => row.treatmentIdSnapshot ?? 'Not provided' },
        { key: 'amount', header: 'Amount', render: (row) => <span className="font-mono">{row.amountSnapshot}</span> },
        { key: 'status', header: 'Line status', render: (row) => <StatusBadge tone={row.lineStatus === 'ACCEPTED' ? 'success' : row.lineStatus === 'REJECTED' ? 'danger' : 'neutral'}>{declarationLabel(row.lineStatus)}</StatusBadge> },
      ]} />}
    </Section>

    <Section title="Exports" actions={['READY', 'EXPORTED'].includes(declaration.status) && hasPermission(permissions, 'declaration.export') ? <div className="flex gap-2"><Select aria-label="Export format" className="w-28" value={format} onChange={(event) => setFormat(event.target.value as DeclarationExportFormat)}>{formats.map((value) => <option key={value}>{value}</option>)}</Select><Button disabled={generate.isPending} onClick={() => generate.mutate()}><FileOutput size={16} />{generate.isPending ? 'Generating...' : 'Generate export'}</Button></div> : null}>
      {exportsQuery.isPending ? <LoadingState label="Loading exports" /> : exportsQuery.isError ? <ErrorState title="Unable to load exports" description={getApiErrorMessage(exportsQuery.error)} onRetry={() => void exportsQuery.refetch()} /> : exportsQuery.data.length ? <DataTable rows={exportsQuery.data} getRowKey={(row) => row.id} emptyMessage="No exports" columns={[
        { key: 'format', header: 'Format', render: (row) => row.format },
        { key: 'file', header: 'File', render: (row) => row.document.originalFilename },
        { key: 'records', header: 'Records', render: (row) => row.recordCount },
        { key: 'generated', header: 'Generated', render: (row) => formatBusinessDateTime(row.exportedAt) },
        { key: 'download', header: '', render: (row) => hasPermission(permissions, 'document.read') ? <Button variant="secondary" disabled={download.isPending} onClick={() => download.mutate({ documentId: row.documentId, filename: row.document.originalFilename })}><Download size={16} />Download</Button> : 'Permission required' },
      ]} /> : <p className="text-sm text-slate-500">No export has been generated.</p>}
    </Section>

    <Section title="Submission history" actions={declaration.status === 'EXPORTED' && hasPermission(permissions, 'declaration.submit') ? <Button disabled={send.isPending} onClick={() => setSubmitOpen(true)}><Send size={16} />Submit declaration</Button> : null}>
      <p className="mb-3 text-sm text-slate-500">Submission transport is performed only by the configured Backend adapter.</p>
      {submissions.isPending ? <LoadingState label="Loading submissions" /> : submissions.isError ? <ErrorState title="Unable to load submissions" description={getApiErrorMessage(submissions.error)} onRetry={() => void submissions.refetch()} /> : submissions.data.length ? <DataTable rows={submissions.data} getRowKey={(row) => row.id} emptyMessage="No submissions" columns={[
        { key: 'attempt', header: 'Attempt', render: (row) => row.attemptNumber },
        { key: 'channel', header: 'Channel', render: (row) => declarationLabel(row.channel) },
        { key: 'status', header: 'Status', render: (row) => <StatusBadge tone={declarationTone(row.status)}>{declarationLabel(row.status)}</StatusBadge> },
        { key: 'reference', header: 'Reference', render: (row) => row.externalReference ?? 'Not provided' },
        { key: 'submitted', header: 'Submitted', render: (row) => formatBusinessDateTime(row.submittedAt) },
        { key: 'result', header: '', render: (row) => row.status === 'SUBMITTED' && declaration.status === 'SUBMITTED' && hasPermission(permissions, 'declaration.submit') ? <Button variant="secondary" onClick={() => setResultFor(row)}>Record result</Button> : null },
      ]} /> : <p className="text-sm text-slate-500">No submission attempts recorded.</p>}
    </Section>

    <AddDeclarationItemDialog open={addOpen} pending={add.isPending} error={add.error ? getApiErrorMessage(add.error) : undefined} onClose={() => { setAddOpen(false); add.reset() }} onSubmit={(values) => add.mutate(values)} />
    <ConfirmDialog open={readyOpen} title="Validate declaration" description="The Backend will validate every SVB snapshot and freeze the declaration in READY state if all requirements pass." confirmLabel={ready.isPending ? 'Validating...' : 'Validate and mark ready'} pending={ready.isPending} onCancel={() => setReadyOpen(false)} onConfirm={() => ready.mutate()} />
    <ConfirmDialog open={submitOpen} title="Submit declaration" description="The configured Backend adapter will transmit or record this exported declaration. No submission is created if no adapter is configured." confirmLabel={send.isPending ? 'Submitting...' : 'Submit declaration'} pending={send.isPending} onCancel={() => setSubmitOpen(false)} onConfirm={() => send.mutate()} />
    <SubmissionResultDialog open={Boolean(resultFor)} pending={result.isPending} error={result.error ? getApiErrorMessage(result.error) : undefined} onClose={() => { setResultFor(null); result.reset() }} onSubmit={(values) => result.mutate(values)} />
  </div>
}

function Section({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return <section className="border-t border-clinic-border py-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold text-slate-900">{title}</h2>{actions}</div>{children}</section>
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <dl><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm text-slate-900">{children}</dd></dl>
}
