import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { getApiErrorMessage } from '../../api'
import { hasPermission } from '../../auth/permissions'
import { useAuth } from '../../auth/use-auth'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import { ConfirmDialog } from '../../components/ui/confirm-dialog'
import { ErrorState } from '../../components/feedback/error-state'
import { LoadingState } from '../../components/feedback/loading-state'
import { patientKeys } from '../patients/patient-api'
import { appointmentKeys, receptionKeys } from '../appointments/appointment-api'
import { dashboardKeys } from '../dashboard/dashboard-api'
import {
  confirmDentalinkRun,
  dentalinkKeys,
  getDentalinkRun,
  listDentalinkItems,
  readDentalinkNextPage,
  type ConfirmRequest,
  type DentalinkItem,
} from './dentalink-api'

const issueLabels: Record<string, string> = {
  INVALID_NORMALIZED_DATA: 'Invalid source data',
  POSSIBLE_PATIENT_MATCH: 'Possible existing patient — review separately',
  PATIENT_REFERENCE_MISSING: 'Patient reference missing',
  PROVIDER_MAPPING_MISSING: 'Provider mapping missing',
  LOCATION_MAPPING_MISSING: 'Location mapping missing',
  PROVIDER_INACTIVE: 'Provider inactive',
  LOCATION_INACTIVE: 'Location inactive',
  UNSUPPORTED_SOURCE_STATUS: 'Unsupported source appointment status',
  APPOINTMENT_PROVIDER_OVERLAP: 'Provider schedule overlap',
  OUTSIDE_IMPORT_WINDOW: 'Outside the import period',
}
function itemSummary(item: DentalinkItem) {
  const fields =
    item.entityType === 'PATIENT'
      ? ['firstName', 'middleName', 'lastName', 'secondLastName', 'dateOfBirth']
      : [
          'patientExternalId',
          'providerExternalId',
          'locationExternalId',
          'start',
          'end',
          'eligibility',
        ]
  return (
    fields
      .flatMap((key) => (typeof item.data[key] === 'string' ? [`${key}: ${item.data[key]}`] : []))
      .join(' · ') || 'No valid administrative details'
  )
}
export function DentalinkRunView({ accountId, runId }: { accountId: string; runId: string }) {
  const { permissions } = useAuth()
  const allowed = (names: string[]) => names.every((name) => hasPermission(permissions, name))
  const canReadItems = allowed(['dentalink.read', 'patient.read', 'appointment.read'])
  const canReadNext = allowed(['dentalink.import', 'patient.read', 'appointment.read'])
  const canConfirm = allowed([
    'dentalink.import',
    'patient.create',
    'appointment.create',
    'patient.read',
    'appointment.read',
  ])
  const client = useQueryClient()
  const [page, setPage] = useState(1)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [attempt, setAttempt] = useState<ConfirmRequest | null>(null)
  const runKey = [...dentalinkKeys.account(accountId), 'run', runId]
  const run = useQuery({
    queryKey: runKey,
    queryFn: ({ signal }) => getDentalinkRun(accountId, runId, signal),
  })
  const items = useQuery({
    queryKey: [...runKey, 'items', page],
    queryFn: ({ signal }) => listDentalinkItems(accountId, runId, page, signal),
    enabled: canReadItems,
  })
  const refresh = () => client.invalidateQueries({ queryKey: dentalinkKeys.account(accountId) })
  const refreshImportedRecords = () =>
    Promise.all([
      refresh(),
      ...[patientKeys.lists(), appointmentKeys.lists(), receptionKeys.all, dashboardKeys.all].map(
        (queryKey) => client.invalidateQueries({ queryKey }),
      ),
    ])
  const next = useMutation({
    mutationFn: () => readDentalinkNextPage(accountId, runId),
    onSuccess: refresh,
    onError: refresh,
  })
  const confirm = useMutation({
    mutationFn: async () => {
      if (!attempt) throw new Error('Review the preview before confirming.')
      return confirmDentalinkRun(accountId, runId, attempt)
    },
    onSuccess: async () => {
      setConfirmOpen(false)
      await refreshImportedRecords()
    },
    onError: refreshImportedRecords,
  })
  if (run.isPending) return <LoadingState label="Loading import review" />
  if (run.isError)
    return (
      <ErrorState
        title="Unable to load import review"
        description={getApiErrorMessage(run.error)}
        onRetry={() => void run.refetch()}
      />
    )
  const data = run.data
  const busy = next.isPending || confirm.isPending
  return (
    <Card className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">
          Import review #{data.id} · {data.state}
        </h2>
        <Button
          variant="secondary"
          disabled={busy || run.isFetching}
          onClick={() => void refresh()}
        >
          Refresh import review
        </Button>
      </div>
      <p className="text-sm text-slate-600">
        {data.sourceMode === 'SYNTHETIC_QA' || data.sourceMode === 'SYNTHETIC'
          ? 'Synthetic QA data. '
          : ''}
        Real Dentalink connection has not been verified. Preview does not create patients or
        appointments.
      </p>
      <p className="text-sm">
        Period: {data.from ?? 'No lower bound'} / {data.to ?? 'No upper bound'} (timestamps include
        their time zone).
      </p>
      <dl className="flex flex-wrap gap-4 text-sm">
        {(['total', 'ready', 'issues', 'imported', 'skipped', 'pages'] as const).map((key) => (
          <div key={key}>
            <dt className="capitalize text-slate-500">{key}</dt>
            <dd>{data.counts[key] ?? 'Not reported'}</dd>
          </div>
        ))}
      </dl>
      {data.contentHash ? (
        <p className="break-all text-xs text-slate-500">
          Reviewed content SHA-256: {data.contentHash}
        </p>
      ) : null}
      {next.isError ? (
        <p role="alert">
          {getApiErrorMessage(next.error)} Retry reading the same page; the server retains its
          cursor.
        </p>
      ) : null}
      {confirm.isError ? (
        <p role="alert">
          {getApiErrorMessage(confirm.error)} Refresh and review the recorded outcome before
          retrying. The original confirmation key and content hash are retained for this review.
        </p>
      ) : null}
      {data.state === 'READING' && canReadNext ? (
        <Button disabled={busy || run.isFetching} onClick={() => next.mutate()}>
          Read next source page
        </Button>
      ) : null}
      {data.state === 'PREVIEW_READY' &&
      data.contentHash &&
      canConfirm &&
      canReadItems &&
      items.isSuccess ? (
        <Button
          disabled={
            busy ||
            run.isFetching ||
            items.isFetching ||
            (attempt !== null && attempt.expectedContentHash !== data.contentHash)
          }
          onClick={() => {
            if (!attempt)
              setAttempt({
                idempotencyKey: crypto.randomUUID(),
                expectedContentHash: data.contentHash!,
              })
            setConfirmOpen(true)
          }}
        >
          Review local import confirmation
        </Button>
      ) : null}
      {data.state === 'CONFIRMED' ? (
        <p role="status">
          Local import confirmed. Review each row for imported records and remaining issues. New
          appointments require local confirmation.
        </p>
      ) : null}
      {!canReadItems ? (
        <p>Patient and appointment read permissions are required to view private rows.</p>
      ) : items.isPending ? (
        <LoadingState label="Loading private preview rows" />
      ) : items.isError ? (
        <ErrorState
          title="Unable to load preview rows"
          description={getApiErrorMessage(items.error)}
          onRetry={() => void items.refetch()}
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="p-2">Source record</th>
                  <th className="p-2">Administrative details</th>
                  <th className="p-2">Outcome / issues</th>
                  <th className="p-2">Local record</th>
                </tr>
              </thead>
              <tbody>
                {items.data.data.map((item) => (
                  <tr key={item.id} className="border-t border-clinic-border">
                    <td className="p-2">
                      {item.entityType}
                      <br />
                      {item.externalId}
                    </td>
                    <td className="max-w-md break-words p-2">{itemSummary(item)}</td>
                    <td className="p-2">
                      {item.disposition}
                      <ul>
                        {item.issueCodes.map((code) => (
                          <li key={code}>{issueLabels[code] ?? `Review required (${code})`}</li>
                        ))}
                      </ul>
                    </td>
                    <td className="p-2">
                      {item.patientId ? (
                        <Link
                          className="text-clinic-blue underline"
                          to={`/patients/${item.patientId}`}
                        >
                          Open patient
                        </Link>
                      ) : item.appointmentId ? (
                        <Link
                          className="text-clinic-blue underline"
                          to={`/appointments/${item.appointmentId}`}
                        >
                          Open appointment
                        </Link>
                      ) : (
                        'Not linked'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {items.data.data.length === 0 ? <p>No preview rows on this page.</p> : null}
          <DentalinkPagination
            label="preview rows"
            page={page}
            pages={items.data.meta?.totalPages}
            busy={items.isFetching || busy}
            onPage={setPage}
          />
        </>
      )}
      <ConfirmDialog
        open={confirmOpen && data.state === 'PREVIEW_READY'}
        title="Confirm local import?"
        description={`Import eligible rows from review #${data.id} into this organization. Business issues may remain after revalidation. New appointments are scheduled locally. Existing records will not be merged or updated. Nothing is sent to Dentalink.`}
        confirmLabel="Confirm local import"
        pending={confirm.isPending}
        error={confirm.isError ? getApiErrorMessage(confirm.error) : undefined}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          if (data.state === 'PREVIEW_READY' && data.contentHash === attempt?.expectedContentHash)
            confirm.mutate()
        }}
      />
    </Card>
  )
}
export function DentalinkPagination({
  label,
  page,
  pages,
  busy,
  onPage,
}: {
  label: string
  page: number
  pages?: number
  busy: boolean
  onPage: (page: number) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <Button
        variant="secondary"
        aria-label={`Previous ${label} page`}
        disabled={busy || page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Previous
      </Button>
      <span className="text-sm">
        Page {page} / {pages === undefined ? 'Unknown' : Math.max(1, pages)}
      </span>
      <Button
        variant="secondary"
        aria-label={`Next ${label} page`}
        disabled={busy || pages === undefined || page >= pages}
        onClick={() => onPage(page + 1)}
      >
        Next
      </Button>
    </div>
  )
}
