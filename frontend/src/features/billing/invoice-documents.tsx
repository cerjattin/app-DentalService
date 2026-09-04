import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, FileText } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { PermissionGuard } from '../../auth/permission-guard'
import { hasPermission } from '../../auth/permissions'
import { useAuth } from '../../auth/use-auth'
import { LoadingState } from '../../components/feedback/loading-state'
import { Button } from '../../components/ui/button'
import { Dialog } from '../../components/ui/dialog'
import type { Invoice, InvoiceVersion } from '../../types/billing'
import {
  downloadDocument,
  generateInvoicePdf,
  invoiceDocumentKeys,
  listInvoiceDocuments,
} from './billing-api'
import { BillingError, BillingSection } from './billing-ui'

export function InvoiceDocuments({
  invoice,
  version,
}: {
  invoice: Invoice
  version: InvoiceVersion
}) {
  const { permissions } = useAuth()
  const client = useQueryClient()
  const canRead = hasPermission(permissions, 'document.read')
  const documents = useQuery({
    queryKey: invoiceDocumentKeys.invoice(invoice.id),
    queryFn: ({ signal }) => listInvoiceDocuments(invoice.id, signal),
    enabled: canRead,
  })
  const generate = useMutation({
    mutationFn: () => generateInvoicePdf(invoice.id, version.id),
    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: invoiceDocumentKeys.invoice(invoice.id),
      })
    },
  })
  const [preview, setPreview] = useState(false)
  const file = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const blob = await downloadDocument(id)
      if (blob.type !== 'application/pdf')
        throw new Error('Unexpected document format')
      return { blob, name }
    },
  })
  const pdfs =
    documents.data?.filter(
      (row) =>
        row.invoiceVersionId === version.id &&
        row.documentRole === 'SIGNED_INVOICE_PDF',
    ) ?? []
  const generatable =
    invoice.currentVersionId === version.id &&
    invoice.status === 'CLOSED' &&
    version.status === 'CLOSED'
  return (
    <BillingSection
      title="Documents"
      actions={
        generatable ? (
          <PermissionGuard allOf={['document.generate']}>
            <Button
              variant="secondary"
              disabled={
                generate.isPending ||
                (canRead && (documents.isPending || documents.isError))
              }
              onClick={() => generate.mutate()}
            >
              <FileText size={16} />
              {generate.isPending ? 'Generating...' : 'Generate PDF'}
            </Button>
          </PermissionGuard>
        ) : null
      }
    >
      <BillingError error={generate.error ?? file.error} />
      {generate.isSuccess ? (
        <p role="status" className="mb-3 text-sm text-green-700">
          PDF generated.
        </p>
      ) : null}
      {!canRead ? (
        <p className="text-sm text-slate-500">
          Document access requires permission.
        </p>
      ) : documents.isPending ? (
        <LoadingState label="Loading documents" />
      ) : documents.isError ? (
        <>
          <BillingError error={documents.error} />
          <Button variant="secondary" onClick={() => void documents.refetch()}>
            Retry documents
          </Button>
        </>
      ) : pdfs.length ? (
        <ul className="space-y-3">
          {pdfs.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 text-sm"
            >
              <span className="break-all">{row.document.originalFilename}</span>
              <Button
                variant="secondary"
                disabled={file.isPending}
                onClick={() => {
                  setPreview(true)
                  file.mutate({
                    id: row.documentId,
                    name: row.document.originalFilename,
                  })
                }}
              >
                <Download size={16} />
                {file.isPending ? 'Loading PDF...' : 'View / download PDF'}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">
          {invoice.currentVersionId !== version.id
            ? 'No PDF document available for this historical version.'
            : version.status === 'CLOSED'
              ? 'No PDF document generated yet.'
              : 'PDF is available after signing and closing the invoice.'}
        </p>
      )}
      {preview ? (
        <Dialog
          open
          title="Invoice PDF"
          description={file.data?.name ?? 'Loading the selected document.'}
          onOpenChange={(open) => {
            if (!open) {
              setPreview(false)
              file.reset()
            }
          }}
        >
          {file.isPending ? (
            <LoadingState label="Loading PDF" />
          ) : file.isError ? (
            <BillingError error={file.error} />
          ) : file.data ? (
            <PdfActions blob={file.data.blob} name={file.data.name} />
          ) : null}
        </Dialog>
      ) : null}
    </BillingSection>
  )
}

function PdfActions({ blob, name }: { blob: Blob; name: string }) {
  const view = useRef<HTMLAnchorElement>(null)
  const link = useRef<HTMLAnchorElement>(null)
  useEffect(() => {
    const url = URL.createObjectURL(blob)
    if (view.current) view.current.href = url
    if (link.current) link.current.href = url
    return () => URL.revokeObjectURL(url)
  }, [blob])
  return (
    <>
      <p className="mb-4 text-sm text-slate-600">PDF document ready.</p>
      <div className="mb-3 flex flex-wrap justify-end gap-2">
        {navigator.pdfViewerEnabled ? (
          <a
            ref={view}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-clinic-border px-3 py-2 text-sm text-clinic-blue"
          >
            <FileText size={16} />
            View PDF
          </a>
        ) : null}
        <a
          ref={link}
          download={name}
          className="inline-flex items-center gap-2 rounded-md bg-clinic-blue px-3 py-2 text-sm text-white"
        >
          <Download size={16} />
          Download PDF
        </a>
      </div>
      {!navigator.pdfViewerEnabled ? (
        <p className="py-6 text-sm text-slate-600">
          PDF preview is unavailable in this browser.
        </p>
      ) : null}
    </>
  )
}
