import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { getApiErrorMessage } from '../../api'
import { useAuth } from '../../auth/use-auth'
import { hasPermission } from '../../auth/permissions'
import { ErrorState } from '../../components/feedback/error-state'
import { LoadingState } from '../../components/feedback/loading-state'
import { FormField } from '../../components/forms/form-field'
import { Card } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Select } from '../../components/ui/select'
import { formatBusinessDate } from '../../lib/timezone'
import type { Provider } from '../../types/appointment'
import type { DashboardFilters, ReportMoney } from '../../types/reporting'
import { dashboardKeys, getDashboardReport, listReportProviders } from './dashboard-api'
import { dashboardFilterSchema } from './dashboard-model'

function Money({ rows }: { rows: ReportMoney[] }) {
  return rows.length ? <>{rows.map((r) => <p key={r.currencyCode} className="font-mono tabular-nums">{r.currencyCode} {r.amount}</p>)}</> : <span>No amounts recorded</span>
}
function Kpi({ label, children }: { label: string; children: ReactNode }) {
  return <Card className="min-w-0 p-4"><p className="text-xs font-medium text-slate-500">{label}</p><div className="mt-2 break-words text-lg font-semibold text-slate-900">{children}</div></Card>
}
export function DashboardReport() {
  const { permissions } = useAuth()
  const [filters, setFilters] = useState<DashboardFilters>(() => { const today = formatBusinessDate(new Date()); return { from: today, to: today } })
  const { register, control, handleSubmit, formState: { errors } } = useForm<DashboardFilters>({
    resolver: zodResolver(dashboardFilterSchema), defaultValues: { ...filters, providerId: '' },
  })
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null)
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  useEffect(() => { const t = window.setTimeout(() => setQ(search.trim()), 300); return () => window.clearTimeout(t) }, [search])
  const canReadProviders = hasPermission(permissions, 'provider.read')
  const providers = useQuery({ queryKey: dashboardKeys.providers(q), queryFn: ({ signal }) => listReportProviders(q, signal), enabled: canReadProviders })
  const providerChoices = providers.data?.data ?? []
  const providerOptions = selectedProvider && !providerChoices.some((provider) => provider.id === selectedProvider.id)
    ? [selectedProvider, ...providerChoices]
    : providerChoices
  const report = useQuery({ queryKey: dashboardKeys.report(filters), queryFn: ({ signal }) => getDashboardReport(filters, signal) })
  return <section aria-label="Dashboard reporting" className="mb-6 space-y-4">
    <form noValidate className="grid gap-3 rounded-lg border border-clinic-border bg-white p-4 sm:grid-cols-2 xl:grid-cols-5" onSubmit={handleSubmit(({ from, to, providerId }) => {
      setFilters({ from, to, ...(canReadProviders && providerId ? { providerId } : {}) })
    })}>
      <FormField label="From" htmlFor="dashboard-from" error={errors.from?.message}><Input id="dashboard-from" type="date" {...register('from')} /></FormField>
      <FormField label="To" htmlFor="dashboard-to" error={errors.to?.message}><Input id="dashboard-to" type="date" {...register('to')} /></FormField>
      {canReadProviders ? <>
        <label className="text-sm">Find provider<Input className="mt-1" maxLength={120} value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <Controller name="providerId" control={control} render={({ field }) => (
          <FormField label="Provider" htmlFor="dashboard-provider" error={errors.providerId?.message}>
            <Select {...field} id="dashboard-provider" value={field.value ?? ''} disabled={providers.isFetching || search.trim() !== q} onChange={(event) => {
              field.onChange(event)
              setSelectedProvider(providerOptions.find((provider) => provider.id === event.target.value) ?? null)
            }}>
              <option value="">All providers</option>
              {providerOptions.map((provider) => <option key={provider.id} value={provider.id}>{provider.firstName} {provider.lastName}{provider.isActive ? '' : ' (Inactive)'}</option>)}
            </Select>
          </FormField>
        )} />
      </> : null}
      <div className="flex items-end"><Button type="submit">Apply filters</Button></div>
    </form>
    {canReadProviders && providers.isFetching ? <p role="status" className="text-sm text-slate-500">Loading providers...</p> : null}
    {canReadProviders && providers.isSuccess && !providerChoices.length ? <p role="status" className="text-sm text-slate-500">No providers match this search.</p> : null}
    {canReadProviders && providers.isError ? <ErrorState title="Unable to load provider filter" description={getApiErrorMessage(providers.error)} onRetry={() => void providers.refetch()} /> : null}
    {(providers.data?.meta?.total ?? 0) > 100 ? <p className="text-xs text-slate-500">Showing up to 100 providers. Refine the provider search.</p> : null}
    {report.isPending ? <LoadingState label="Loading dashboard report" /> : report.isError ? <ErrorState title="Unable to load dashboard report" description={getApiErrorMessage(report.error)} onRetry={() => void report.refetch()} /> : <div className="space-y-4">
      <p className="text-xs text-slate-500">{report.data.period.from} → {report.data.period.to} · {report.data.period.timezone}</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Production"><Money rows={report.data.kpis.production} /></Kpi>
        <Kpi label="SVB Billed"><Money rows={report.data.kpis.svbBilled} /></Kpi>
        <Kpi label="Patients Seen">{report.data.kpis.patientsSeen}</Kpi>
        <Kpi label="Appointments">{report.data.kpis.appointments}</Kpi>
        {report.data.kpis.completedAttentions !== undefined ? <Kpi label="Completed Attentions">{report.data.kpis.completedAttentions}</Kpi> : null}
        <Kpi label="Pending Signatures">{report.data.kpis.pendingSignatures}</Kpi>
        <Kpi label="Closed Invoices">{report.data.kpis.closedInvoices}</Kpi>
        <Kpi label="To Declare">{report.data.kpis.toDeclare}</Kpi>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="min-w-0 p-4"><h3 className="mb-3 font-semibold">Production timeline</h3>{report.data.productionTimeline.length ? <ul className="space-y-3">{report.data.productionTimeline.map((r) => <li key={r.date + r.currencyCode}><div className="flex flex-wrap justify-between gap-2 text-sm"><span>{r.date}</span><span className="font-mono">{r.currencyCode} {r.amount}</span></div><meter aria-label={r.date + ' ' + r.currencyCode} className="h-3 w-full" min={0} max={100} value={r.chartPercent} /></li>)}</ul> : <p className="text-sm text-slate-500">No production in this period.</p>}</Card>
        <Card className="min-w-0 p-4"><h3 className="mb-3 font-semibold">Production by Provider</h3>{report.data.productionByProvider.length ? <ul className="space-y-3">{report.data.productionByProvider.map((r) => <li key={r.providerId + r.currencyCode}><div className="flex flex-wrap justify-between gap-2 text-sm"><span>{r.providerName}</span><span className="font-mono">{r.currencyCode} {r.amount}</span></div><meter aria-label={r.providerName + ' ' + r.currencyCode} className="h-3 w-full" min={0} max={100} value={r.chartPercent} /></li>)}</ul> : <p className="text-sm text-slate-500">No provider production in this period.</p>}</Card>
      </div>
      {report.data.serviceVolumeByProvider ? (
        <Card className="p-4">
          <h3 className="mb-3 font-semibold">Service Activity by Provider</h3>
          {report.data.serviceVolumeByProvider.length ? (
            <ul className="divide-y divide-clinic-border text-sm">
              {report.data.serviceVolumeByProvider.map((row) => (
                <li key={row.providerId} className="flex flex-wrap justify-between gap-2 py-2">
                  <span>{row.providerName}</span>
                  <span>{row.attentions} completed · {row.units} service units</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-slate-500">No completed service attention in this period.</p>}
        </Card>
      ) : null}
      <p className="text-xs text-slate-500">Completed Attentions and Service Activity use the attention start date in Curaçao and count completed attention and appointments with performed services, including services awaiting pricing. Service units retain their recorded decimal quantities.</p>
      <p className="text-xs text-slate-500">Production shows valued performed services by performance date; unpriced services have no monetary amount. SVB Billed shows closed SVB invoice snapshots by service date, not submission, acceptance or payment. Invoice counts also use service dates.</p>
      <p className="text-xs text-slate-500">Patients Seen counts each patient once per day. Amounts are shown separately by currency. To Declare counts closed invoices with unassigned SVB items. Declaration validation determines readiness.</p>
    </div>}
  </section>
}
