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
            {hasPermission(permissions, 'insurance.read') ? <Button variant="secondary" disabled={create.isPending || insurance.isFetching} onClick={() => void insurance.refetch()}>{insurance.isError ? 'Retry insurance lookup' : 'Refresh billing choices'}</Button> : null}
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
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              disabled={create.isPending}
              onClick={() => setConfirm(false)}
            >
              Cancel
            </Button>
            <Button disabled={create.isPending || Boolean(currencyCode && !/^[A-Z]{3}$/.test(currencyCode))} onClick={() => create.mutate()}>
              {create.isPending ? 'Creating...' : rebuild ? 'Confirm rebuild' : 'Confirm creation'}
            </Button>
          </div>
        </Dialog>
      ) : null}
    </BillingSection>
  )
}
