import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { getApiErrorMessage } from '../../api'
import { useAuth } from '../../auth/use-auth'
import { hasPermission } from '../../auth/permissions'
import { ErrorState } from '../../components/feedback/error-state'
import { LoadingState } from '../../components/feedback/loading-state'
import { Card } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Select } from '../../components/ui/select'
import { formatBusinessDate } from '../../lib/timezone'
import type { DashboardFilters, ReportMoney } from '../../types/reporting'
import { dashboardKeys, getDashboardReport, listReportProviders } from './dashboard-api'

function Money({ rows }: { rows: ReportMoney[] }) {
  return rows.length ? <>{rows.map((r) => <p key={r.currencyCode} className="font-mono tabular-nums">{r.currencyCode} {r.amount}</p>)}</> : <span>No amounts recorded</span>
}
function Kpi({ label, children }: { label: string; children: ReactNode }) {
  return <Card className="min-w-0 p-4"><p className="text-xs font-medium text-slate-500">{label}</p><div className="mt-2 break-words text-lg font-semibold text-slate-900">{children}</div></Card>
}
export function DashboardReport() {
  const { permissions } = useAuth()
  const [filters, setFilters] = useState<DashboardFilters>(() => { const today = formatBusinessDate(new Date()); return { from: today, to: today } })
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  useEffect(() => { const t = window.setTimeout(() => setQ(search.trim()), 300); return () => window.clearTimeout(t) }, [search])
  const canReadProviders = hasPermission(permissions, 'provider.read')
  const providers = useQuery({ queryKey: dashboardKeys.providers(q), queryFn: ({ signal }) => listReportProviders(q, signal), enabled: canReadProviders })
  const report = useQuery({ queryKey: dashboardKeys.report(filters), queryFn: ({ signal }) => getDashboardReport(filters, signal) })
  return <section aria-label="Dashboard reporting" className="mb-6 space-y-4">
    <form className="grid gap-3 rounded-lg border border-clinic-border bg-white p-4 sm:grid-cols-2 xl:grid-cols-5" onSubmit={(event) => {
      event.preventDefault(); const data = new FormData(event.currentTarget)
      const providerId = String(data.get('providerId') ?? '')
      setFilters({ from: String(data.get('from')), to: String(data.get('to')), ...(providerId ? { providerId } : {}) })
    }}>
      <label className="text-sm">From<Input className="mt-1" type="date" name="from" required defaultValue={filters.from} /></label>
      <label className="text-sm">To<Input className="mt-1" type="date" name="to" required defaultValue={filters.to} /></label>
      {canReadProviders ? <><label className="text-sm">Find provider<Input className="mt-1" maxLength={120} value={search} onChange={(event) => setSearch(event.target.value)} /></label><div className="text-sm"><label htmlFor="dashboard-provider">Provider</label><Select id="dashboard-provider" className="mt-1" name="providerId" disabled={providers.isFetching}><option value="">All providers</option>{providers.data?.data.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}{p.isActive ? '' : ' (Inactive)'}</option>)}</Select></div></> : null}
      <div className="flex items-end"><Button type="submit">Apply filters</Button></div>
    </form>
    {canReadProviders && providers.isError ? <ErrorState title="Unable to load provider filter" description={getApiErrorMessage(providers.error)} onRetry={() => void providers.refetch()} /> : null}
    {(providers.data?.meta?.total ?? 0) > 100 ? <p className="text-xs text-slate-500">Showing up to 100 providers. Refine the provider search.</p> : null}
    {report.isPending ? <LoadingState label="Loading dashboard report" /> : report.isError ? <ErrorState title="Unable to load dashboard report" description={getApiErrorMessage(report.error)} onRetry={() => void report.refetch()} /> : <div className="space-y-4">
      <p className="text-xs text-slate-500">{report.data.period.from} → {report.data.period.to} · {report.data.period.timezone}</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Production"><Money rows={report.data.kpis.production} /></Kpi>
        <Kpi label="SVB Billed"><Money rows={report.data.kpis.svbBilled} /></Kpi>
        <Kpi label="Patients Seen">{report.data.kpis.patientsSeen}</Kpi>
        <Kpi label="Appointments">{report.data.kpis.appointments}</Kpi>
        <Kpi label="Pending Signatures">{report.data.kpis.pendingSignatures}</Kpi>
        <Kpi label="Closed Invoices">{report.data.kpis.closedInvoices}</Kpi>
        <Kpi label="To Declare">{report.data.kpis.toDeclare}</Kpi>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="min-w-0 p-4"><h3 className="mb-3 font-semibold">Production timeline</h3>{report.data.productionTimeline.length ? <ul className="space-y-3">{report.data.productionTimeline.map((r) => <li key={r.date + r.currencyCode}><div className="flex flex-wrap justify-between gap-2 text-sm"><span>{r.date}</span><span className="font-mono">{r.currencyCode} {r.amount}</span></div><meter aria-label={r.date + ' ' + r.currencyCode} className="h-3 w-full" min={0} max={100} value={r.chartPercent} /></li>)}</ul> : <p className="text-sm text-slate-500">No production in this period.</p>}</Card>
        <Card className="min-w-0 p-4"><h3 className="mb-3 font-semibold">Production by Provider</h3>{report.data.productionByProvider.length ? <ul className="space-y-3">{report.data.productionByProvider.map((r) => <li key={r.providerId + r.currencyCode}><div className="flex flex-wrap justify-between gap-2 text-sm"><span>{r.providerName}</span><span className="font-mono">{r.currencyCode} {r.amount}</span></div><meter aria-label={r.providerName + ' ' + r.currencyCode} className="h-3 w-full" min={0} max={100} value={r.chartPercent} /></li>)}</ul> : <p className="text-sm text-slate-500">No provider production in this period.</p>}</Card>
      </div>
      <p className="text-xs text-slate-500">Patients Seen counts each patient once per day. Amounts are shown separately by currency. To Declare counts closed invoices with unassigned SVB items; declaration validation determines readiness.</p>
    </div>}
  </section>
}
