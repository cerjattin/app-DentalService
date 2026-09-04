import type { ReactNode } from 'react'
import { getApiErrorMessage } from '../../api'
import { StatusBadge } from '../../components/feedback/status-badge'
import { billingLabel } from './billing-model'
export function BillingStatus({ status }: { status: string }) {
  return (
    <StatusBadge
      tone={
        ['CLOSED', 'SIGNED', 'VALID', 'APPROVED', 'APPLIED'].includes(status)
          ? 'success'
          : ['PENDING_SIGNATURE', 'REQUESTED'].includes(status)
            ? 'warning'
            : ['REJECTED', 'CANCELLED', 'VOID'].includes(status)
              ? 'danger'
            : 'neutral'
      }
    >
      {billingLabel(status)}
    </StatusBadge>
  )
}
export function BillingSection({
  title,
  actions,
  children,
}: {
  title: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="min-w-0 border-t border-clinic-border py-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        {actions}
      </div>
      {children}
    </section>
  )
}
export function BillingError({ error }: { error: unknown }) {
  return error ? (
    <p
      role="alert"
      className="my-3 rounded-md bg-red-50 p-3 text-sm text-clinic-danger"
    >
      {getApiErrorMessage(error)}
    </p>
  ) : null
}
export function BillingField({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm text-slate-900">
        {children ?? 'Not provided'}
      </dd>
    </div>
  )
}
