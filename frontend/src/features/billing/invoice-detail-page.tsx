import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, LockKeyhole, PenLine, Pencil } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { getApiErrorMessage } from '../../api'
import { PermissionGuard } from '../../auth/permission-guard'
import { PageHeader } from '../../components/app-shell/page-header'
import { DataTable } from '../../components/data-table/data-table'
import { ErrorState } from '../../components/feedback/error-state'
import { LoadingState } from '../../components/feedback/loading-state'
import { Button } from '../../components/ui/button'
import { Dialog } from '../../components/ui/dialog'
import { Select } from '../../components/ui/select'
import { formatBusinessDateTime } from '../../lib/timezone'
import type { Invoice, InvoiceItem, InvoiceVersion } from '../../types/billing'
import { AccessDeniedPage } from '../auth/access-denied-page'
import { formatDateOnly } from '../patients/patient-formatters'
import {
  getInvoice,
  getInvoiceVersion,
  invoiceKeys,
  invoiceVersionKeys,
  listSignatures,
  signatureKeys,
  transitionInvoice,
  type InvoiceOperation,
} from './billing-api'
import {
  BillingError,
  BillingField,
  BillingSection,
  BillingStatus,
} from './billing-ui'
import { billingLabel } from './billing-model'
import { InvoiceDocuments } from './invoice-documents'
import { SignatureDialog } from './signature-dialog'
import { CorrectionWorkflow } from './correction-workflow'
import { CorrectionItemDialog } from './correction-item-dialog'

export function InvoiceDetailPage() {
  const { invoiceId = '' } = useParams()
  return (
    <PermissionGuard allOf={['invoice.read']} fallback={<AccessDeniedPage />}>
      <InvoiceDetail key={invoiceId} id={invoiceId} />
    </PermissionGuard>
  )
}
function InvoiceDetail({ id }: { id: string }) {
  const [selected, setSelected] = useState('')
  const query = useQuery({
    queryKey: invoiceKeys.detail(id),
    queryFn: ({ signal }) => getInvoice(id, signal),
  })
  const selectedId = selected || query.data?.currentVersionId || ''
  const historical = Boolean(
    selectedId && selectedId !== query.data?.currentVersionId,
  )
  const oldVersion = useQuery({
    queryKey: invoiceVersionKeys.detail(id, selectedId),
    queryFn: ({ signal }) => getInvoiceVersion(id, selectedId, signal),
    enabled: historical,
  })
  if (query.isPending) return <LoadingState label="Loading invoice" />
  if (query.isError)
    return (
      <ErrorState
        title="Unable to load invoice"
        description={getApiErrorMessage(query.error)}
        onRetry={() => void query.refetch()}
      />
    )
  const invoice = query.data
  const version = historical ? oldVersion.data : invoice.currentVersion
  return (
    <div className="mx-auto max-w-[1400px]">
      <Link to="/invoices" className="text-sm text-clinic-blue hover:underline">
        Invoices
      </Link>
      <PageHeader
        title={invoice.invoiceNumber ?? `Invoice ${invoice.id}`}
        description={`${invoice.patient.firstName} ${invoice.patient.lastName} / ${invoice.appointment.appointmentNumber}`}
        actions={<BillingStatus status={invoice.status} />}
      />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <label className="min-w-0 max-w-full text-sm">
          Invoice version
          <Select
            className="mt-1"
            value={selectedId}
            onChange={(e) => setSelected(e.target.value)}
          >
            {invoice.versions.map((v) => (
              <option key={v.id} value={v.id}>
                Version {v.versionNumber} - {billingLabel(v.versionType)} -{' '}
                {billingLabel(v.status)}
              </option>
            ))}
          </Select>
        </label>
        <PermissionGuard allOf={['appointment.read']}>
          <Link
            className="text-sm text-clinic-blue"
            to={`/appointments/${invoice.appointmentId}`}
          >
            Open appointment
          </Link>
        </PermissionGuard>
      </div>
      <CorrectionWorkflow invoice={invoice} />
      {historical && oldVersion.isPending ? (
        <LoadingState label="Loading version" />
      ) : historical && oldVersion.isError ? (
        <ErrorState
          title="Unable to load version"
          description={getApiErrorMessage(oldVersion.error)}
          onRetry={() => void oldVersion.refetch()}
        />
      ) : version ? (
        <VersionWorkspace
          key={version.id}
          invoice={invoice}
          version={version}
        />
      ) : (
        <p>No invoice version available.</p>
      )}
    </div>
  )
}
function VersionWorkspace({
  invoice,
  version,
}: {
  invoice: Invoice
  version: InvoiceVersion
}) {
  const client = useQueryClient()
  const [operation, setOperation] = useState<InvoiceOperation | null>(null)
  const [capture, setCapture] = useState(false)
  const [editingItem, setEditingItem] = useState<InvoiceItem | null>(null)
  const [notice, setNotice] = useState('')
  const signatures = useQuery({
    queryKey: signatureKeys.list(invoice.id, version.id),
    queryFn: ({ signal }) => listSignatures(invoice.id, version.id, signal),
  })
  const valid = signatures.data?.some(
    (row) =>
      row.status === 'VALID' && row.signedContentHash === version.contentHash,
  )
  const current = invoice.currentVersionId === version.id
  const draft =
    current &&
    version.status === 'DRAFT' &&
    ((version.versionType === 'ORIGINAL' && invoice.status === 'DRAFT') ||
      (version.versionType === 'CORRECTION' &&
        invoice.status === 'CORRECTION_REQUIRED'))
  const pending =
    current &&
    invoice.status === 'PENDING_SIGNATURE' &&
    version.status === 'PENDING_SIGNATURE'
  const signed =
    current &&
    invoice.status === 'SIGNED' &&
    version.status === 'SIGNED'
  const correctionEditable =
    current &&
    version.versionType === 'CORRECTION' &&
    version.status === 'DRAFT' &&
    invoice.status === 'CORRECTION_REQUIRED'
  const operationAllowed =
    operation === 'prepare-signature'
      ? draft
      : operation === 'sign'
        ? pending && valid
        : signed
  const operationPermission =
    operation === 'prepare-signature'
      ? 'invoice.prepare_signature'
      : operation === 'sign'
        ? 'invoice.sign'
        : 'invoice.close'
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: invoiceKeys.detail(invoice.id) }),
      client.invalidateQueries({ queryKey: invoiceKeys.lists() }),
      client.invalidateQueries({
        queryKey: invoiceVersionKeys.invoice(invoice.id),
      }),
      client.invalidateQueries({
        queryKey: signatureKeys.version(invoice.id, version.id),
      }),
    ])
  }
  const transition = useMutation({
    mutationFn: (op: InvoiceOperation) =>
      transitionInvoice(invoice.id, version.id, op),
    onSuccess: async (updated, op) => {
      client.setQueryData(invoiceKeys.detail(invoice.id), updated)
      setOperation(null)
      setNotice(
        op === 'prepare-signature'
          ? 'Invoice prepared for signature.'
          : op === 'sign'
            ? 'Invoice signed.'
            : 'Invoice closed.',
      )
      await refresh()
    },
    onError: refresh,
  })
  const descriptions: Record<InvoiceOperation, string> = {
    'prepare-signature':
      'The invoice content will be locked for signature. Review the patient, items and total before continuing.',
    sign: 'Confirm this invoice version as signed using the saved signature evidence.',
    close:
      'Close this signed invoice version permanently. Its historical content cannot be edited.',
  }
  return (
    <>
      {notice ? (
        <p
          role="status"
          className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-800"
        >
          {notice}
        </p>
      ) : null}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold">
            Version {version.versionNumber} -{' '}
            {billingLabel(version.versionType)}
          </h2>
          <BillingStatus status={version.status} />
        </div>
        <div className="flex flex-wrap gap-2">
          {draft ? (
            <PermissionGuard allOf={['invoice.prepare_signature']}>
              <Button
                onClick={() => {
                  transition.reset()
                  setOperation('prepare-signature')
                }}
              >
                <LockKeyhole size={16} />
                Prepare for signature
              </Button>
            </PermissionGuard>
          ) : null}
          {pending && signatures.isSuccess && !valid ? (
            <PermissionGuard allOf={['signature.capture', 'document.upload']}>
              <Button onClick={() => setCapture(true)}>
                <PenLine size={16} />
                Capture signature
              </Button>
            </PermissionGuard>
          ) : null}
          {pending && valid ? (
            <PermissionGuard allOf={['invoice.sign']}>
              <Button
                onClick={() => {
                  transition.reset()
                  setOperation('sign')
                }}
              >
                <CheckCircle2 size={16} />
                Confirm signed
              </Button>
            </PermissionGuard>
          ) : null}
          {signed ? (
            <PermissionGuard allOf={['invoice.close']}>
              <Button
                onClick={() => {
                  transition.reset()
                  setOperation('close')
                }}
              >
                <LockKeyhole size={16} />
                Close invoice
              </Button>
            </PermissionGuard>
          ) : null}
        </div>
      </div>
      {!draft ? (
        <p className="mb-4 text-sm text-slate-500">
          This version is read only.
        </p>
      ) : null}
      <BillingSection title="Invoice snapshot">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <BillingField label="Patient">
            {version.patientNameSnapshot}
          </BillingField>
          <BillingField label="Document">
            {version.patientDocumentNumberSnapshot}
          </BillingField>
          <BillingField label="Insured ID">
            {version.insuredIdSnapshot}
          </BillingField>
          <BillingField label="Declarant ID">
            {version.declarantIdSnapshot}
          </BillingField>
          <BillingField label="Invoice date">
            {formatDateOnly(version.invoiceDate)}
          </BillingField>
          <BillingField label="Payer">
            {invoice.patientInsurance.payer.name}
          </BillingField>
          <BillingField label="Signed at">
            {version.signedAt
              ? formatBusinessDateTime(version.signedAt)
              : 'Not signed'}
          </BillingField>
          <BillingField label="Closed at">
            {version.closedAt
              ? formatBusinessDateTime(version.closedAt)
              : 'Not closed'}
          </BillingField>
          <BillingField label="Supersedes version ID">
            {version.supersedesVersionId}
          </BillingField>
        </dl>
      </BillingSection>
      <BillingSection title="Invoice items">
        <DataTable
          rows={version.items}
          getRowKey={(item) => item.id}
          emptyMessage="No invoice items"
          columns={[
            { key: 'line', header: 'Line', render: (item) => item.lineNumber },
            {
              key: 'date',
              header: 'Service date',
              render: (item) => formatDateOnly(item.serviceDateSnapshot),
            },
            {
              key: 'procedure',
              header: 'Procedure',
              render: (item) => (
                <div className="min-w-44">
                  <p className="font-mono font-medium text-clinic-blue">
                    {item.procedureCodeSnapshot}
                  </p>
                  <p>{item.procedureDescriptionSnapshot}</p>
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer text-clinic-blue">
                      Snapshot details
                    </summary>
                    <dl className="mt-2 space-y-2">
                      <BillingField label="Detail invoice number">
                        {item.detailInvoiceNumber}
                      </BillingField>
                      <BillingField label="Provider ID">
                        {item.providerIdSnapshot}
                      </BillingField>
                      <BillingField label="Insured ID">
                        {item.insuredIdSnapshot}
                      </BillingField>
                      <BillingField label="Diagnosis">
                        {item.diagnosticCodeSnapshot}
                      </BillingField>
                      <BillingField label="Treatment ID">
                        {item.treatmentIdSnapshot}
                      </BillingField>
                      <BillingField label="Policlinic">
                        {item.policlinicSnapshot}
                      </BillingField>
                      <BillingField label="Number of treatments">
                        {item.numberOfTreatmentsSnapshot}
                      </BillingField>
                      <BillingField label="Assistance">
                        {item.assistanceSnapshot}
                      </BillingField>
                      <BillingField label="Referrer ID">
                        {item.referrerIdSnapshot}
                      </BillingField>
                      <BillingField label="Accident form">
                        {item.accidentFormNumberSnapshot}
                      </BillingField>
                      <BillingField label="Note">
                        {item.additionalNote}
                      </BillingField>
                    </dl>
                  </details>
                </div>
              ),
            },
            {
              key: 'authorization',
              header: 'Authorization',
              render: (item) => item.authorizationIdSnapshot ?? 'Not recorded',
            },
            {
              key: 'quantity',
              header: 'Quantity',
              render: (item) => item.quantity,
            },
            {
              key: 'tariff',
              header: 'Unit tariff',
              render: (item) => (
                <span className="whitespace-nowrap font-mono">
                  {item.currencyCodeSnapshot} {item.unitTariffSnapshot}
                </span>
              ),
            },
            {
              key: 'amount',
              header: 'Amount',
              render: (item) => (
                <span className="whitespace-nowrap font-mono">
                  {item.currencyCodeSnapshot} {item.amount}
                </span>
              ),
            },
            {
              key: 'actions',
              header: '',
              render: (item) =>
                correctionEditable ? (
                  <PermissionGuard allOf={['invoice.apply_correction']}>
                    <Button
                      variant="secondary"
                      onClick={() => setEditingItem(item)}
                    >
                      <Pencil size={16} />
                      Edit item
                    </Button>
                  </PermissionGuard>
                ) : null,
            },
          ]}
        />
        <p className="mt-4 text-right font-semibold">
          Total{' '}
          <span className="ml-4 font-mono">
            {version.currencyCode} {version.totalAmount}
          </span>
        </p>
      </BillingSection>
      <BillingSection title="Signatures">
        {signatures.isPending ? (
          <LoadingState label="Loading signatures" />
        ) : signatures.isError ? (
          <>
            <BillingError error={signatures.error} />
            <Button
              variant="secondary"
              onClick={() => void signatures.refetch()}
            >
              Retry signatures
            </Button>
          </>
        ) : signatures.data.length ? (
          <ul className="space-y-3">
            {signatures.data.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {s.signerName} / {billingLabel(s.signatureType)}
                  </p>
                  <p className="text-slate-500">
                    {formatBusinessDateTime(s.signedAt)} /{' '}
                    {billingLabel(s.captureMethod)}
                    {s.signerRelationship ? ` / ${s.signerRelationship}` : ''}
                  </p>
                </div>
                <BillingStatus status={s.status} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">
            No signature recorded for this version.
          </p>
        )}
      </BillingSection>
      <InvoiceDocuments invoice={invoice} version={version} />
      {editingItem && correctionEditable ? (
        <PermissionGuard allOf={['invoice.apply_correction']}>
          <CorrectionItemDialog
            invoiceId={invoice.id}
            item={editingItem}
            close={() => setEditingItem(null)}
            saved={() => setNotice('Correction item updated.')}
          />
        </PermissionGuard>
      ) : null}
      {capture && pending && !valid ? (
        <PermissionGuard allOf={['signature.capture', 'document.upload']}>
          <SignatureDialog
            invoiceId={invoice.id}
            version={version}
            onClose={() => setCapture(false)}
            onCaptured={async () => {
              setCapture(false)
              setNotice(
                'Signature saved. Confirm the signed state to continue.',
              )
              await refresh()
            }}
            onReconcile={refresh}
          />
        </PermissionGuard>
      ) : null}
      {operation && operationAllowed ? (
        <PermissionGuard allOf={[operationPermission]}>
          <Dialog
            open
            title={
              operation === 'prepare-signature'
                ? 'Prepare for signature?'
                : operation === 'sign'
                  ? 'Confirm signed invoice?'
                  : 'Close invoice?'
            }
            description={descriptions[operation]}
            onOpenChange={(open) => {
              if (!open && !transition.isPending) setOperation(null)
            }}
          >
            <BillingError error={transition.error} />
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                disabled={transition.isPending}
                onClick={() => setOperation(null)}
              >
                Cancel
              </Button>
              <Button
                disabled={transition.isPending}
                onClick={() => transition.mutate(operation)}
              >
                {transition.isPending ? 'Saving...' : 'Confirm'}
              </Button>
            </div>
          </Dialog>
        </PermissionGuard>
      ) : null}
    </>
  )
}
