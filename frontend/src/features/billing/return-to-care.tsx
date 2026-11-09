import { useMutation, useQueryClient } from '@tanstack/react-query'
import { RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { PermissionGuard } from '../../auth/permission-guard'
import { FormField } from '../../components/forms/form-field'
import { Button } from '../../components/ui/button'
import { Dialog } from '../../components/ui/dialog'
import { Textarea } from '../../components/ui/textarea'
import type { Invoice } from '../../types/billing'
import { encounterKeys } from '../clinical/clinical-api'
import { refreshAppointmentWorkflow } from '../appointments/appointment-workflow-cache'
import { dashboardKeys } from '../dashboard/dashboard-api'
import { correctionKeys, invoiceHistoryKeys, invoiceKeys, invoiceVersionKeys, returnInvoiceToCare } from './billing-api'
import { BillingError } from './billing-ui'
import { DeclarationAssignments } from './declaration-assignments'

export function ReturnToCare({ invoice }: { invoice: Invoice }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const client = useQueryClient()
  const navigate = useNavigate()
  const mutation = useMutation({
    mutationFn: () => returnInvoiceToCare(invoice.id, { reason: reason.trim(), expectedVersionId: invoice.currentVersionId! }),
    onSuccess: async (updated) => {
      client.setQueryData(invoiceKeys.detail(invoice.id), updated)
      await Promise.all([
        client.invalidateQueries({ queryKey: invoiceKeys.lists() }),
        client.invalidateQueries({ queryKey: invoiceVersionKeys.invoice(invoice.id) }),
        client.invalidateQueries({ queryKey: correctionKeys.invoice(invoice.id) }),
        client.invalidateQueries({ queryKey: invoiceHistoryKeys.invoice(invoice.id) }),
        client.invalidateQueries({ queryKey: ['clinical-encounter'] }),
        client.invalidateQueries({ queryKey: encounterKeys.appointment(invoice.appointmentId) }),
        client.invalidateQueries({ queryKey: dashboardKeys.all }),
        refreshAppointmentWorkflow(client, invoice.appointmentId),
      ])
      navigate(`/clinical/${invoice.appointmentId}`)
    },
  })
  if (!invoice.currentVersionId || !['DRAFT', 'PENDING_SIGNATURE', 'SIGNED', 'CLOSED'].includes(invoice.status)) return null
  return (
    <PermissionGuard allOf={['invoice.apply_correction', 'encounter.update', 'procedure.update', 'encounter.read', 'appointment.read']}>
      <Button variant="secondary" onClick={() => { mutation.reset(); setReason(''); setOpen(true) }}>
        <RotateCcw size={16} />Return to clinical care
      </Button>
      {open ? (
        <Dialog open title="Return invoice to clinical care?" description="Reopen the encounter to remove or add services, complete care, then rebuild this invoice. A new version and signature are required. Previous invoice versions, signatures and documents remain in history." onOpenChange={(value) => { if (!value && !mutation.isPending) setOpen(false) }}>
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (reason.trim()) mutation.mutate() }}>
            <FormField label="Reason for returning to care" htmlFor="return-care-reason">
              <Textarea id="return-care-reason" autoFocus required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
            </FormField>
            <BillingError error={mutation.error} />
            <DeclarationAssignments error={mutation.error} invoiceId={invoice.id} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" disabled={mutation.isPending} onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={!reason.trim() || mutation.isPending}>{mutation.isPending ? 'Returning...' : 'Return to care'}</Button>
            </div>
          </form>
        </Dialog>
      ) : null}
    </PermissionGuard>
  )
}
