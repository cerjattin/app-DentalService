import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { PermissionGuard } from '../../auth/permission-guard'
import { Button } from '../../components/ui/button'
import { Dialog } from '../../components/ui/dialog'
import { LoadingState } from '../../components/feedback/loading-state'
import type { Appointment } from '../../types/appointment'
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
  const client = useQueryClient()
  const navigate = useNavigate()
  const filters = { appointmentId: appointment.id, page: 1, pageSize: 1 }
  const query = useQuery({
    queryKey: invoiceKeys.list(filters),
    queryFn: ({ signal }) => listInvoices(filters, signal),
  })
  const create = useMutation({
    mutationFn: () => createInvoice(appointment.id),
    onSuccess: async (invoice) => {
      client.setQueryData(invoiceKeys.detail(invoice.id), invoice)
      await client.invalidateQueries({ queryKey: invoiceKeys.lists() })
      navigate(`/invoices/${invoice.id}`)
    },
    onError: () => {
      void client.invalidateQueries({ queryKey: invoiceKeys.list(filters) })
    },
  })
  const existing = query.data?.data[0]
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
      ) : existing ? (
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
          <Button onClick={() => setConfirm(true)}>
            <FileText size={16} />
            Create invoice
          </Button>
        </PermissionGuard>
      ) : (
        <p className="text-sm text-slate-500">
          Complete the appointment and clinical encounter before billing.
        </p>
      )}
      {confirm && !existing ? (
        <Dialog
          open
          title="Create invoice?"
          description={`Create one invoice from the billable procedures for appointment ${appointment.appointmentNumber}.`}
          onOpenChange={(open) => {
            if (!open && !create.isPending) setConfirm(false)
          }}
        >
          <BillingError error={create.error} />
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              disabled={create.isPending}
              onClick={() => setConfirm(false)}
            >
              Cancel
            </Button>
            <Button disabled={create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? 'Creating...' : 'Confirm creation'}
            </Button>
          </div>
        </Dialog>
      ) : null}
    </BillingSection>
  )
}
