import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'
import { FormField } from '../../components/forms/form-field'
import { Button } from '../../components/ui/button'
import { Dialog } from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { Textarea } from '../../components/ui/textarea'
import type { InvoiceItem, UpdateCorrectionInvoiceItemDto } from '../../types/billing'
import { correctionKeys, invoiceKeys, invoiceVersionKeys, updateCorrectionItem } from './billing-api'
import { correctionItemSchema } from './billing-model'
import { BillingError } from './billing-ui'

type Values = z.infer<typeof correctionItemSchema>
const nullable = (value: string) => value || null

export function CorrectionItemDialog({ invoiceId, item, close, saved }: { invoiceId: string; item: InvoiceItem; close: () => void; saved: () => void }) {
  const client = useQueryClient()
  const form = useForm<Values>({
    resolver: zodResolver(correctionItemSchema),
    defaultValues: {
      detailInvoiceNumber: item.detailInvoiceNumber ?? '', serviceDateSnapshot: item.serviceDateSnapshot ?? '', procedureCodeSnapshot: item.procedureCodeSnapshot,
      procedureDescriptionSnapshot: item.procedureDescriptionSnapshot, providerIdSnapshot: item.providerIdSnapshot, insuredIdSnapshot: item.insuredIdSnapshot,
      unitTariffSnapshot: item.unitTariffSnapshot, currencyCodeSnapshot: item.currencyCodeSnapshot, quantity: item.quantity,
      authorizationIdSnapshot: item.authorizationIdSnapshot ?? '', diagnosticCodeSnapshot: item.diagnosticCodeSnapshot ?? '', treatmentIdSnapshot: item.treatmentIdSnapshot ?? '',
      accidentFormNumberSnapshot: item.accidentFormNumberSnapshot ?? '', numberOfTreatmentsSnapshot: item.numberOfTreatmentsSnapshot?.toString() ?? '', assistanceSnapshot: item.assistanceSnapshot ?? '',
      referrerIdSnapshot: item.referrerIdSnapshot ?? '', policlinicSnapshot: item.policlinicSnapshot ?? '', additionalNote: item.additionalNote ?? '',
    },
  })
  const mutation = useMutation({
    mutationFn: (values: Values) => {
      const body: UpdateCorrectionInvoiceItemDto = {
        ...values,
        authorizationIdSnapshot: nullable(values.authorizationIdSnapshot), diagnosticCodeSnapshot: nullable(values.diagnosticCodeSnapshot), treatmentIdSnapshot: nullable(values.treatmentIdSnapshot),
        accidentFormNumberSnapshot: nullable(values.accidentFormNumberSnapshot), numberOfTreatmentsSnapshot: values.numberOfTreatmentsSnapshot ? (JSON.parse(values.numberOfTreatmentsSnapshot) as number) : null,
        assistanceSnapshot: nullable(values.assistanceSnapshot), referrerIdSnapshot: nullable(values.referrerIdSnapshot), policlinicSnapshot: nullable(values.policlinicSnapshot), additionalNote: nullable(values.additionalNote),
      }
      return updateCorrectionItem(invoiceId, item.invoiceVersionId, item.id, body)
    },
    onSuccess: async () => {
      saved(); close()
      await Promise.all([
        client.invalidateQueries({ queryKey: invoiceKeys.detail(invoiceId) }),
        client.invalidateQueries({ queryKey: invoiceVersionKeys.invoice(invoiceId) }),
        client.invalidateQueries({ queryKey: correctionKeys.invoice(invoiceId) }),
      ])
    },
  })
  const field = (name: keyof Values, label: string, type = 'text') => (
    <FormField label={label} htmlFor={`correction-item-${name}`} error={form.formState.errors[name]?.message}>
      <Input id={`correction-item-${name}`} type={type} {...form.register(name)} />
    </FormField>
  )
  return (
    <Dialog open size="wide" title={`Edit correction item ${item.lineNumber}`} description="Changes apply only to this draft replacement version. The source version remains unchanged." onOpenChange={(open) => { if (!open && !mutation.isPending) close() }}>
      <form className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <div className="grid gap-4 sm:grid-cols-2">
          {field('detailInvoiceNumber', 'Detail invoice number')}{field('serviceDateSnapshot', 'Service date', 'date')}{field('procedureCodeSnapshot', 'Procedure code')}{field('procedureDescriptionSnapshot', 'Procedure description')}
          {field('providerIdSnapshot', 'Provider ID')}{field('insuredIdSnapshot', 'Insured ID')}{field('unitTariffSnapshot', 'Unit tariff')}{field('currencyCodeSnapshot', 'Currency')}{field('quantity', 'Quantity')}
          {field('authorizationIdSnapshot', 'Authorization ID')}{field('diagnosticCodeSnapshot', 'Diagnosis code')}{field('treatmentIdSnapshot', 'Treatment ID')}{field('accidentFormNumberSnapshot', 'Accident form number')}
          {field('numberOfTreatmentsSnapshot', 'Number of treatments')}{field('assistanceSnapshot', 'Assistance')}{field('referrerIdSnapshot', 'Referrer ID')}{field('policlinicSnapshot', 'Policlinic')}
        </div>
        <FormField label="Additional note" htmlFor="correction-item-additionalNote" error={form.formState.errors.additionalNote?.message}>
          <Textarea id="correction-item-additionalNote" {...form.register('additionalNote')} />
        </FormField>
        <BillingError error={mutation.error} />
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" disabled={mutation.isPending} onClick={close}>Cancel</Button><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving...' : 'Save correction item'}</Button></div>
      </form>
    </Dialog>
  )
}
