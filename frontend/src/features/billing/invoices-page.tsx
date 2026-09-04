import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { getApiErrorMessage } from '../../api'
import { PermissionGuard } from '../../auth/permission-guard'
import { PageHeader } from '../../components/app-shell/page-header'
import { DataTable } from '../../components/data-table/data-table'
import { ErrorState } from '../../components/feedback/error-state'
import { LoadingState } from '../../components/feedback/loading-state'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Select } from '../../components/ui/select'
import { formatBusinessDateTime } from '../../lib/timezone'
import type { InvoiceStatus } from '../../types/billing'
import { AccessDeniedPage } from '../auth/access-denied-page'
import { invoiceKeys, listInvoices } from './billing-api'
import { BillingStatus } from './billing-ui'
import { billingLabel } from './billing-model'

export function InvoicesPage() {
  return (
    <PermissionGuard allOf={['invoice.read']} fallback={<AccessDeniedPage />}>
      <InvoiceList />
    </PermissionGuard>
  )
}
function InvoiceList() {
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<InvoiceStatus | ''>('')
  const [page, setPage] = useState(1)
  const filters = {
    page,
    pageSize: 20,
    ...(q ? { q } : {}),
    ...(status ? { status } : {}),
  }
  const query = useQuery({
    queryKey: invoiceKeys.list(filters),
    queryFn: ({ signal }) => listInvoices(filters, signal),
  })
  return (
    <div className="mx-auto max-w-350">
      <PageHeader
        title="Invoices"
        description="Billing and signed invoice documents"
      />
      <form
        className="mb-5 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          setQ(search.trim())
          setPage(1)
        }}
      >
        <label className="min-w-0 flex-1 text-sm">
          Search invoices
          <Input
            className="mt-1"
            placeholder="Invoice, patient or insured ID"
            value={search}
            maxLength={120}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Status
          <Select
            className="mt-1"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as InvoiceStatus | '')
              setPage(1)
            }}
          >
            <option value="">All statuses</option>
            {(
              [
                'DRAFT',
                'PENDING_SIGNATURE',
                'SIGNED',
                'CLOSED',
                'DECLARED',
                'CORRECTION_REQUIRED',
                'CANCELLED',
              ] as const
            ).map((s) => (
              <option key={s} value={s}>
                {billingLabel(s)}
              </option>
            ))}
          </Select>
        </label>
        <Button type="submit" variant="secondary">
          <Search size={16} />
          Search
        </Button>
        {q || status ? (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch('')
              setQ('')
              setStatus('')
              setPage(1)
            }}
          >
            Clear filters
          </Button>
        ) : null}
      </form>
      {query.isPending ? (
        <LoadingState label="Loading invoices" />
      ) : query.isError ? (
        <ErrorState
          title="Unable to load invoices"
          description={getApiErrorMessage(query.error)}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <>
          <DataTable
            rows={query.data.data}
            getRowKey={(row) => row.id}
            emptyMessage="No invoices found"
            columns={[
              {
                key: 'number',
                header: 'Invoice',
                render: (row) => (
                  <Link
                    className="font-medium text-clinic-blue hover:underline"
                    to={`/invoices/${row.id}`}
                  >
                    {row.invoiceNumber ?? row.id}
                  </Link>
                ),
              },
              {
                key: 'patient',
                header: 'Patient',
                render: (row) => (
                  <div>
                    <span className="font-medium">
                      {[
                        row.patient.firstName,
                        row.patient.middleName,
                        row.patient.lastName,
                        row.patient.secondLastName,
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    </span>
                    <p className="text-xs text-slate-500">
                      {row.patient.patientNumber}
                    </p>
                  </div>
                ),
              },
              {
                key: 'appointment',
                header: 'Appointment',
                render: (row) => row.appointment.appointmentNumber,
              },
              {
                key: 'version',
                header: 'Version',
                render: (row) =>
                  row.currentVersion
                    ? `v${row.currentVersion.versionNumber} - ${billingLabel(row.currentVersion.versionType)}`
                    : 'Unavailable',
              },
              {
                key: 'status',
                header: 'Status',
                render: (row) => <BillingStatus status={row.status} />,
              },
              {
                key: 'total',
                header: 'Total',
                render: (row) => (
                  <span className="whitespace-nowrap font-mono">
                    {row.currentVersion
                      ? `${row.currentVersion.currencyCode} ${row.currentVersion.totalAmount}`
                      : 'Unavailable'}
                  </span>
                ),
              },
              {
                key: 'created',
                header: 'Created',
                render: (row) => formatBusinessDateTime(row.createdAt),
              },
            ]}
          />
          <div className="mt-4 flex items-center justify-end gap-3 text-sm">
            <Button
              variant="secondary"
              aria-label="Previous page"
              disabled={page <= 1 || query.isFetching}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft size={16} />
            </Button>
            <span>
              Page {page} of {Math.max(1, query.data.meta?.totalPages ?? 1)}
            </span>
            <Button
              variant="secondary"
              aria-label="Next page"
              disabled={
                page >= (query.data.meta?.totalPages ?? 1) || query.isFetching
              }
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
