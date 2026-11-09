import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getApiErrorMessage } from '../../api'
import { hasPermission } from '../../auth/permissions'
import { useAuth } from '../../auth/use-auth'
import { PageHeader } from '../../components/app-shell/page-header'
import { ErrorState } from '../../components/feedback/error-state'
import { LoadingState } from '../../components/feedback/loading-state'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Card } from '../../components/ui/card'
import {
  appointmentKeys,
  listClinicLocations,
  searchAppointmentProviders,
} from '../appointments/appointment-api'
import {
  createDentalinkAccount,
  createDentalinkPreview,
  dentalinkKeys,
  enableDentalinkAccount,
  getDentalinkMappings,
  getDentalinkStatus,
  listDentalinkAccounts,
  listDentalinkRuns,
  saveDentalinkMapping,
  validExternalId,
  type DentalinkMapping,
  type PreviewRequest,
} from './dentalink-api'
import { DentalinkPagination, DentalinkRunView } from './dentalink-run'

const selectClass = 'h-9 rounded-md border border-clinic-border bg-white px-2 text-sm'
export function DentalinkPage() {
  const { permissions } = useAuth()
  const canManage = hasPermission(permissions, 'dentalink.manage')
  const client = useQueryClient()
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState('')
  const [externalId, setExternalId] = useState('')
  const [label, setLabel] = useState('')
  const accounts = useQuery({
    queryKey: [...dentalinkKeys.all, 'accounts', page],
    queryFn: ({ signal }) => listDentalinkAccounts(page, signal),
  })
  const create = useMutation({
    mutationFn: () => createDentalinkAccount({ externalAccountId: externalId, label }),
    onSuccess: async (account) => {
      setSelected(account.id)
      setExternalId('')
      setLabel('')
      await client.invalidateQueries({ queryKey: dentalinkKeys.all })
    },
  })
  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <PageHeader
        title="Dentalink import preparation"
        description="Review administrative patients and appointments before a local import."
      />
      <Card className="p-4">
        <p className="font-semibold">Real connection not verified</p>
        <p className="mt-1 text-sm text-slate-600">
          The clinic API is not enabled. Account configuration does not establish a connection. This
          module does not send changes to Dentalink. Credentials stay on the server.
        </p>
      </Card>
      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">Accounts</h2>
        {accounts.isPending ? (
          <LoadingState label="Loading import accounts" />
        ) : accounts.isError ? (
          <ErrorState
            title="Unable to load import accounts"
            description={getApiErrorMessage(accounts.error)}
            onRetry={() => void accounts.refetch()}
          />
        ) : (
          <>
            {accounts.data.data.length ? (
              <div className="flex flex-wrap gap-2">
                {accounts.data.data.map((account) => (
                  <Button
                    key={account.id}
                    variant={selected === account.id ? 'primary' : 'secondary'}
                    onClick={() => setSelected(account.id)}
                  >
                    {account.label} · {account.externalAccountId}
                  </Button>
                ))}
              </div>
            ) : (
              <p>No import accounts configured.</p>
            )}
            <DentalinkPagination
              label="accounts"
              page={page}
              pages={accounts.data.meta?.totalPages}
              busy={accounts.isFetching || create.isPending}
              onPage={setPage}
            />
          </>
        )}
        {canManage ? (
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              if (validExternalId(externalId) && validExternalId(label)) create.mutate()
            }}
          >
            <label className="text-sm">
              External account ID
              <Input
                value={externalId}
                maxLength={255}
                onChange={(event) => setExternalId(event.target.value)}
                disabled={create.isPending}
                required
              />
            </label>
            <label className="text-sm">
              Account label
              <Input
                value={label}
                maxLength={120}
                onChange={(event) => setLabel(event.target.value)}
                disabled={create.isPending}
                required
              />
            </label>
            <Button
              type="submit"
              disabled={create.isPending || !validExternalId(externalId) || !validExternalId(label)}
            >
              Create disabled account
            </Button>
            {create.isError ? <p role="alert">{getApiErrorMessage(create.error)}</p> : null}
          </form>
        ) : null}
      </Card>
      {selected ? (
        <AccountWorkspace key={selected} accountId={selected} />
      ) : (
        <p>Select an account to review its status, mappings and import history.</p>
      )}
    </div>
  )
}
function AccountWorkspace({ accountId }: { accountId: string }) {
  const { permissions } = useAuth()
  const canManage = hasPermission(permissions, 'dentalink.manage')
  const canPreview = ['dentalink.import', 'patient.read', 'appointment.read'].every((code) =>
    hasPermission(permissions, code),
  )
  const client = useQueryClient()
  const [historyPage, setHistoryPage] = useState(1)
  const [runId, setRunId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const attempt = useRef<PreviewRequest | null>(null)
  const [unresolved, setUnresolved] = useState(false)
  const status = useQuery({
    queryKey: [...dentalinkKeys.account(accountId), 'status'],
    queryFn: ({ signal }) => getDentalinkStatus(accountId, signal),
  })
  const canStartPreview = status.isSuccess && status.data.canPreview
  const history = useQuery({
    queryKey: [...dentalinkKeys.account(accountId), 'history', historyPage],
    queryFn: ({ signal }) => listDentalinkRuns(accountId, historyPage, signal),
  })
  const refresh = () => client.invalidateQueries({ queryKey: dentalinkKeys.account(accountId) })
  const enable = useMutation({
    mutationFn: (enabled: boolean) => enableDentalinkAccount(accountId, enabled),
    onSuccess: async () => {
      await Promise.all([
        refresh(),
        client.invalidateQueries({ queryKey: [...dentalinkKeys.all, 'accounts'] }),
      ])
    },
    onError: refresh,
  })
  const preview = useMutation({
    mutationFn: () => createDentalinkPreview(accountId, attempt.current!),
    onSuccess: async (run) => {
      setRunId(run.id)
      setUnresolved(false)
      attempt.current = null
      await refresh()
    },
    onError: async () => {
      setUnresolved(true)
      await refresh()
    },
  })
  const offset = /(?:Z|[+-]\d{2}:\d{2})$/
  const validPeriod =
    (!from && !to) ||
    (offset.test(from) &&
      offset.test(to) &&
      Number.isFinite(Date.parse(from)) &&
      Number.isFinite(Date.parse(to)) &&
      Date.parse(to) > Date.parse(from))
  return (
    <div className="space-y-5">
      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">Account status</h2>
        {status.isPending ? (
          <LoadingState label="Loading connection status" />
        ) : status.isError ? (
          <ErrorState
            title="Unable to load connection status"
            description={getApiErrorMessage(status.error)}
            onRetry={() => void status.refetch()}
          />
        ) : (
          <>
            <p>
              {status.data.account.label} · {status.data.state}
            </p>
            <p className="text-sm text-slate-600">
              {status.data.state === 'SYNTHETIC_QA' ? 'Synthetic QA adapter only. ' : ''}
              {!status.data.canPreview ? 'Preview unavailable. ' : ''}Enabling this logical account
              does not configure or verify a real connection.
            </p>
            {canManage ? (
              <Button
                variant="secondary"
                disabled={enable.isPending}
                onClick={() => enable.mutate(!status.data.account.enabled)}
              >
                {status.data.account.enabled ? 'Disable logical account' : 'Enable logical account'}
              </Button>
            ) : null}
          </>
        )}
        {enable.isError ? <p role="alert">{getApiErrorMessage(enable.error)}</p> : null}
      </Card>
      <MappingWorkspace accountId={accountId} />
      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">Prepare preview</h2>
        <p className="text-sm text-slate-600">
          Optional appointment start period [from, to). Enter both ISO timestamps with an explicit
          offset, or leave both empty. Patient rows are administrative records; this is not a
          clinical import.
        </p>
        {canPreview ? (
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              if (!validPeriod || (!unresolved && !canStartPreview)) return
              if (!attempt.current)
                attempt.current = {
                  idempotencyKey: crypto.randomUUID(),
                  ...(from && to ? { from, to } : {}),
                }
              preview.mutate()
            }}
          >
            <label className="text-sm">
              From (ISO with offset)
              <Input
                placeholder="2026-11-08T00:00:00-04:00"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                disabled={preview.isPending || unresolved}
              />
            </label>
            <label className="text-sm">
              To (ISO with offset)
              <Input
                placeholder="2026-11-09T00:00:00-04:00"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                disabled={preview.isPending || unresolved}
              />
            </label>
            <Button
              type="submit"
              disabled={
                (!unresolved && !canStartPreview) ||
                status.isFetching ||
                preview.isPending ||
                !validPeriod
              }
            >
              {unresolved ? 'Recover preview with original request' : 'Prepare preview'}
            </Button>
            {!validPeriod ? (
              <p role="alert">
                Use two valid timestamps with explicit offsets, with To after From.
              </p>
            ) : null}
          </form>
        ) : (
          <p>
            Import, patient read and appointment read permissions are required to prepare a preview.
          </p>
        )}
        {preview.isError ? (
          <p role="alert">
            {getApiErrorMessage(preview.error)} Check the history or recover with the original
            request. Its period and key are retained until resolved; no automatic second import is
            started.
          </p>
        ) : null}
      </Card>
      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Import history</h2>
          <Button variant="secondary" disabled={history.isFetching} onClick={() => void refresh()}>
            Refresh account and history
          </Button>
        </div>
        {history.isPending ? (
          <LoadingState label="Loading import history" />
        ) : history.isError ? (
          <ErrorState
            title="Unable to load import history"
            description={getApiErrorMessage(history.error)}
            onRetry={() => void history.refetch()}
          />
        ) : (
          <>
            {!history.data.data.length ? (
              <p>No import runs recorded.</p>
            ) : (
              <ul className="space-y-2">
                {history.data.data.map((run) => (
                  <li key={run.id}>
                    <Button variant="secondary" onClick={() => setRunId(run.id)}>
                      Review #{run.id} · {run.state}
                    </Button>
                    <span className="ml-2 text-xs text-slate-500">
                      {run.createdAt} · {run.sourceMode}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <DentalinkPagination
              label="import history"
              page={historyPage}
              pages={history.data.meta?.totalPages}
              busy={history.isFetching}
              onPage={setHistoryPage}
            />
          </>
        )}
      </Card>
      {runId ? <DentalinkRunView key={runId} accountId={accountId} runId={runId} /> : null}
    </div>
  )
}
function MappingWorkspace({ accountId }: { accountId: string }) {
  const { permissions } = useAuth()
  const canManage = hasPermission(permissions, 'dentalink.manage')
  const [kind, setKind] = useState<DentalinkMapping['kind']>('PROVIDER')
  const [externalId, setExternalId] = useState('')
  const [localId, setLocalId] = useState('')
  const [providerSearch, setProviderSearch] = useState('')
  const client = useQueryClient()
  const mappings = useQuery({
    queryKey: [...dentalinkKeys.account(accountId), 'mappings'],
    queryFn: ({ signal }) => getDentalinkMappings(accountId, signal),
  })
  const canProviders = canManage && hasPermission(permissions, 'provider.read')
  const canLocations = canManage && hasPermission(permissions, 'clinic_location.read')
  const providers = useQuery({
    queryKey: appointmentKeys.providerChoices(providerSearch),
    queryFn: ({ signal }) => searchAppointmentProviders(providerSearch, signal),
    enabled: canProviders && kind === 'PROVIDER',
  })
  const locations = useQuery({
    queryKey: appointmentKeys.locations(),
    queryFn: ({ signal }) => listClinicLocations(signal),
    enabled: canLocations && kind === 'LOCATION',
  })
  const save = useMutation({
    mutationFn: () => saveDentalinkMapping(accountId, { kind, externalId, localId }),
    onSuccess: async () => {
      setExternalId('')
      setLocalId('')
      await client.invalidateQueries({ queryKey: dentalinkKeys.account(accountId) })
    },
  })
  const lookup = kind === 'PROVIDER' ? providers : locations
  const canLookup = kind === 'PROVIDER' ? canProviders : canLocations
  return (
    <Card className="space-y-3 p-4">
      <h2 className="font-semibold">Provider and location mappings</h2>
      <p className="text-sm text-slate-600">
        Use exact external IDs from an authorized source. Changing mappings requires a new preview
        before confirmation.
      </p>
      {mappings.isPending ? (
        <LoadingState label="Loading mappings" />
      ) : mappings.isError ? (
        <ErrorState
          title="Unable to load mappings"
          description={getApiErrorMessage(mappings.error)}
          onRetry={() => void mappings.refetch()}
        />
      ) : mappings.data.length ? (
        <ul className="text-sm">
          {mappings.data.map((map) => (
            <li key={map.id}>
              {map.kind} · {map.externalId} → local #{map.localId}
            </li>
          ))}
        </ul>
      ) : (
        <p>No mappings configured.</p>
      )}
      {canManage ? (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            if (validExternalId(externalId) && localId && canLookup && !lookup.isError)
              save.mutate()
          }}
        >
          <label className="grid gap-1 text-sm">
            Mapping type
            <select
              className={selectClass}
              value={kind}
              disabled={save.isPending}
              onChange={(event) => {
                setKind(event.target.value as DentalinkMapping['kind'])
                setLocalId('')
              }}
            >
              <option value="PROVIDER">Provider</option>
              <option value="LOCATION">Location</option>
            </select>
          </label>
          <label className="text-sm">
            External record ID
            <Input
              value={externalId}
              maxLength={255}
              disabled={save.isPending}
              onChange={(event) => setExternalId(event.target.value)}
              required
            />
          </label>
          {kind === 'PROVIDER' && canProviders ? (
            <label className="text-sm">
              Find active provider
              <Input
                value={providerSearch}
                disabled={save.isPending}
                onChange={(event) => {
                  setProviderSearch(event.target.value)
                  setLocalId('')
                }}
              />
            </label>
          ) : null}
          <label className="grid gap-1 text-sm">
            Local destination
            <select
              className={selectClass}
              value={localId}
              disabled={save.isPending || !canLookup || lookup.isPending || lookup.isError}
              onChange={(event) => setLocalId(event.target.value)}
              required
            >
              <option value="">
                Select active {kind === 'PROVIDER' ? 'provider' : 'location'}
              </option>
              {kind === 'PROVIDER'
                ? providers.data?.data.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.firstName} {provider.lastName}
                    </option>
                  ))
                : locations.data?.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
            </select>
          </label>
          <Button
            type="submit"
            disabled={
              save.isPending ||
              !canLookup ||
              lookup.isPending ||
              lookup.isError ||
              !localId ||
              !validExternalId(externalId)
            }
          >
            Save mapping
          </Button>
          {!canLookup ? (
            <p>Read permission for the selected destination is required.</p>
          ) : lookup.isError ? (
            <ErrorState
              title="Unable to load mapping destinations"
              description={getApiErrorMessage(lookup.error)}
              onRetry={() => void lookup.refetch()}
            />
          ) : null}
          {kind === 'PROVIDER' && (providers.data?.meta?.total ?? 0) > 100 ? (
            <p>Refine the provider search to see additional active providers.</p>
          ) : null}
          {save.isError ? <p role="alert">{getApiErrorMessage(save.error)}</p> : null}
        </form>
      ) : null}
    </Card>
  )
}
