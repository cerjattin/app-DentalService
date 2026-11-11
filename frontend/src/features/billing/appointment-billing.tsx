import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ApiError } from '../../api'
import { PermissionGuard } from '../../auth/permission-guard'
import { hasPermission } from '../../auth/permissions'
import { useAuth } from '../../auth/use-auth'
import { FormField } from '../../components/forms/form-field'
import { Button } from '../../components/ui/button'
import { Dialog } from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { Select } from '../../components/ui/select'
import { LoadingState } from '../../components/feedback/loading-state'
import { formatBusinessDate } from '../../lib/timezone'
import type { Appointment } from '../../types/appointment'
import { listPatientInsurance, patientKeys } from '../patients/patient-api'
import { refreshAppointmentWorkflow } from '../appointments/appointment-workflow-cache'
import { createInvoice, invoiceKeys, listInvoices } from './billing-api'
import { BillingError, BillingSection } from './billing-ui'
import { useInvoiceTariffReview } from './use-invoice-tariff-review'

export function AppointmentBilling({
  appointment,
}: {
  appointment: Appointment
}) {
  return (
    <PermissionGuard allOf={['invoice.read']}>
      <BillingEntry appointment={appointment} />
    </PermissionGuard>
  )
}
function BillingEntry({ appointment }: { appointment: Appointment }) {
  const [confirm, setConfirm] = useState(false)
  const [patientInsuranceId, setPatientInsuranceId] = useState('')
  const [currencyCode, setCurrencyCode] = useState('')
  const { permissions } = useAuth()
  const client = useQueryClient()
  const navigate = useNavigate()
  const filters = { appointmentId: appointment.id, page: 1, pageSize: 1 }
  const query = useQuery({
    queryKey: invoiceKeys.list(filters),
    queryFn: ({ signal }) => listInvoices(filters, signal),
  })
  const create = useMutation({
    mutationFn: () => createInvoice(appointment.id, patientInsuranceId || currencyCode ? {
      ...(patientInsuranceId ? { patientInsuranceId } : {}),
      ...(currencyCode ? { currencyCode } : {}),
    } : undefined),
    onSuccess: async (invoice) => {
      client.setQueryData(invoiceKeys.detail(invoice.id), invoice)
      await refreshAppointmentWorkflow(client, appointment.id)
      navigate(`/invoices/${invoice.id}`)
    },
    onError: () => Promise.all([
      refreshAppointmentWorkflow(client, appointment.id),
      client.invalidateQueries({ queryKey: patientKeys.insurance(appointment.patientId) }),
    ]),
  })
  const existing = query.data?.data[0]
  const rebuild = existing?.status === 'CORRECTION_REQUIRED' &&
    existing.currentVersion?.status === 'DRAFT' && existing.currentVersion.items.length === 0
  const insurance = useQuery({
    queryKey: patientKeys.insurance(appointment.patientId),
    queryFn: ({ signal }) => listPatientInsurance(appointment.patientId, signal),
    enabled: confirm && !rebuild && hasPermission(permissions, 'insurance.read'),
  })
  const serviceDate = formatBusinessDate(appointment.scheduledStart)
  const tariffReview = useInvoiceTariffReview(
    appointment.id, serviceDate,
    rebuild ? existing?.currentVersion?.currencyCode ?? '' : currencyCode,
    confirm,
  )
  return (
    <BillingSection title="Billing">
      {query.isPending ? (
        <LoadingState label="Checking invoice" />
      ) : query.isError ? (
        <>
          <BillingError error={query.error} />
          <Button variant="secondary" onClick={() => void query.refetch()}>
            Retry invoice lookup
          </Button>
        </>
      ) : existing && !rebuild ? (
        <Link
          className="text-sm font-medium text-clinic-blue hover:underline"
          to={`/invoices/${existing.id}`}
        >
          Open invoice {existing.invoiceNumber ?? existing.id}
        </Link>
      ) : appointment.status === 'COMPLETED' ? (
        <PermissionGuard
          allOf={['invoice.create']}
          fallback={
            <p className="text-sm text-slate-500">No invoice recorded.</p>
          }
        >
          <Button onClick={() => { create.reset(); setPatientInsuranceId(''); setCurrencyCode(''); setConfirm(true) }}>
            <FileText size={16} />
            {rebuild ? 'Rebuild invoice from corrected services' : 'Create invoice'}
          </Button>
        </PermissionGuard>
      ) : (
        <p className="text-sm text-slate-500">
          Complete service attention before billing.
        </p>
      )}
      {confirm && (!existing || rebuild) ? (
        <Dialog
          open
          title={rebuild ? 'Rebuild invoice?' : 'Create invoice?'}
          description={rebuild ? 'Use the corrected services in the new invoice version. The invoice number and prior history are retained. A new signature is required.' : `Create the invoice from the services recorded for appointment ${appointment.appointmentNumber}.`}
          onOpenChange={(open) => {
            if (!open && !create.isPending) setConfirm(false)
          }}
        >
          <p className="mb-3 text-sm">Appointment {appointment.appointmentNumber} · Service date {formatBusinessDate(appointment.scheduledStart)}</p>
          {create.error instanceof ApiError && create.error.code === 'INSURANCE_NOT_VALID' ? <p role="alert" className="mb-3 text-sm text-clinic-danger">No valid coverage was found for this appointment's service date. Review the invoice coverage.</p> : <BillingError error={create.error} />}
          {!rebuild ? <div className="mb-4 space-y-3">
            {hasPermission(permissions, 'insurance.read') ? (
              <FormField label="Insurance" htmlFor="invoice-coverage" hint="Automatic uses the coverage already recorded or the only eligible coverage.">
                <Select id="invoice-coverage" value={patientInsuranceId} disabled={create.isPending || insurance.isPending}
                  onChange={(event) => setPatientInsuranceId(event.target.value)}>
                  <option value="">Automatic</option>
                  {insurance.data?.filter((item) => item.status === 'ACTIVE').map((item) => (
                    <option key={item.id} value={item.id}>{item.payer.name} · {item.insuredId}</option>
                  ))}
                </Select>
              </FormField>
            ) : null}
            <BillingError error={insurance.error} />
            {hasPermission(permissions, 'insurance.read') ? <Button variant="secondary" disabled={create.isPending || insurance.isFetching || tariffReview.busy} onClick={() => void Promise.all([insurance.refetch(), tariffReview.refresh()])}>{insurance.isError ? 'Retry insurance lookup' : 'Refresh billing choices'}</Button> : null}
            {create.error ? <div className="space-y-2 text-sm">
              <p>Keep this dialog open while reviewing the billing data in another tab, then refresh the choices and retry. Contact an administrator if you cannot maintain coverage or service tariffs.</p>
              <div className="flex flex-wrap gap-3">
                {hasPermission(permissions, 'patient.read') && hasPermission(permissions, 'insurance.read') ? <a className="text-clinic-blue underline" href={`/patients/${appointment.patientId}`} target="_blank" rel="noopener noreferrer">Review patient coverage</a> : null}
                {hasPermission(permissions, 'svb_procedure.read') ? <a className="text-clinic-blue underline" href="/admin/services" target="_blank" rel="noopener noreferrer">Review services and tariffs</a> : null}
              </div>
            </div> : null}
            <p className="text-sm text-slate-600">If billing details are missing, the recorded services remain available. Review coverage and tariffs, then retry here.</p>
            <FormField label="Currency code" htmlFor="invoice-currency" hint="Leave blank to use the recorded or uniquely available currency." error={currencyCode && !/^[A-Z]{3}$/.test(currencyCode) ? 'Enter a three-letter currency code or leave blank for automatic selection.' : undefined}>
              <Input id="invoice-currency" maxLength={3} value={currencyCode} disabled={create.isPending}
                onChange={(event) => setCurrencyCode(event.target.value.trim().toUpperCase())} />
            </FormField>
          </div> : null}
          {tariffReview.enabled ? <section aria-label="Service tariff review" className="mb-4 space-y-3 rounded-md border border-clinic-border p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Service tariff review</h3><Button variant="secondary" disabled={create.isPending || tariffReview.busy} onClick={() => void tariffReview.refresh()}>Refresh tariffs</Button></div>
            <p>Active tariffs for {serviceDate}{currencyCode ? ` in ${currencyCode}` : ''}. Tariffs are checked again when the invoice is created.</p>
            {tariffReview.busy ? <p role="status">Checking service tariffs…</p> : null}
            <BillingError error={tariffReview.error} />
            <ul className="space-y-3">{tariffReview.rows.map(row => <li key={row.id}>
              <p className="font-medium">{row.code} · {row.description}</p>
              {row.query.isSuccess ? row.query.data.data.length === 0 ? <p className="text-clinic-danger">No active tariff for this service date{currencyCode ? ` in ${currencyCode}` : ''}. Review its status, validity period and currency.</p> : <p className="text-slate-600">Available currencies: {[...new Set(row.query.data.data.map(tariff => tariff.currencyCode))].join(', ')}.</p> : null}
              {hasPermission(permissions, 'svb_procedure.read') ? <a className="text-clinic-blue underline" href={`/admin/services/${row.id}`} target="_blank" rel="noopener noreferrer">Review tariffs for {row.code}</a> : null}
            </li>)}</ul>
            {tariffReview.blocked ? <p role="alert">Activate or record the authorized tariff for each listed service, then refresh tariffs before creating the invoice.</p> : null}
            {tariffReview.error ? <p>Tariff review is unavailable. Refresh to review the current catalogue; invoice creation will still validate billing.</p> : null}
          </section> : null}
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              disabled={create.isPending}
              onClick={() => setConfirm(false)}
            >
              Cancel
            </Button>
            <Button disabled={create.isPending || tariffReview.busy || tariffReview.blocked || Boolean(currencyCode && !/^[A-Z]{3}$/.test(currencyCode))} onClick={() => create.mutate()}>
              {create.isPending ? 'Creating...' : rebuild ? 'Confirm rebuild' : 'Confirm creation'}
            </Button>
          </div>
        </Dialog>
      ) : null}
    </BillingSection>
  )
}
