import type { DecimalString, EntityId } from './core'
export interface DashboardFilters { from: string; to: string; providerId?: EntityId }
export interface ReportMoney { currencyCode: string; amount: DecimalString }
export interface DashboardReportData {
  period: { from: string; to: string; timezone: string }
  providerId: EntityId | null
  kpis: { production: ReportMoney[]; svbBilled: ReportMoney[]; patientsSeen: number; appointments: number; pendingSignatures: number; closedInvoices: number; toDeclare: number }
  productionTimeline: (ReportMoney & { date: string; chartPercent: number })[]
  productionByProvider: (ReportMoney & { providerId: EntityId; providerName: string; chartPercent: number })[]
}
