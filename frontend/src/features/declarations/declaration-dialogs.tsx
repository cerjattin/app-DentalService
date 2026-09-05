import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { FormField } from '../../components/forms/form-field'
import { Button } from '../../components/ui/button'
import { Dialog } from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { Select } from '../../components/ui/select'
import { Textarea } from '../../components/ui/textarea'
import { listPayers, patientKeys } from '../patients/patient-api'
import {
  addItemSchema,
  createDeclarationSchema,
  submissionResultSchema,
  type AddItemValues,
  type CreateDeclarationValues,
  type SubmissionResultValues,
} from './declaration-model'

export function CreateDeclarationDialog({
  open,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean
  pending: boolean
  error?: string
  onClose: () => void
  onSubmit: (values: CreateDeclarationValues) => void
}) {
  const payers = useQuery({ queryKey: patientKeys.payers(), queryFn: ({ signal }) => listPayers(signal), enabled: open })
  const { register, handleSubmit, formState: { errors } } = useForm<CreateDeclarationValues>({
    resolver: zodResolver(createDeclarationSchema),
    defaultValues: { payerId: '', periodStart: '', periodEnd: '', declarantIdSnapshot: '', notes: '' },
  })
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()} title="Create declaration" description="Create a draft batch for one payer and an optional service period.">
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <FormField label="Payer" htmlFor="declaration-payer" error={errors.payerId?.message}>
          <Select id="declaration-payer" {...register('payerId')} disabled={payers.isPending || pending}>
            <option value="">Select payer</option>
            {payers.data?.map((payer) => <option key={payer.id} value={payer.id}>{payer.code} - {payer.name}</option>)}
          </Select>
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Period start" htmlFor="declaration-start"><Input id="declaration-start" type="date" {...register('periodStart')} /></FormField>
          <FormField label="Period end" htmlFor="declaration-end" error={errors.periodEnd?.message}><Input id="declaration-end" type="date" {...register('periodEnd')} /></FormField>
        </div>
        <FormField label="Declarant ID" htmlFor="declarant-id" error={errors.declarantIdSnapshot?.message} hint="Optional snapshot used by the Backend export validator.">
          <Input id="declarant-id" maxLength={64} {...register('declarantIdSnapshot')} />
        </FormField>
        <FormField label="Notes" htmlFor="declaration-notes" error={errors.notes?.message}>
          <Textarea id="declaration-notes" maxLength={5000} rows={3} {...register('notes')} />
        </FormField>
        {payers.isError ? <p role="alert" className="text-sm text-clinic-danger">Unable to load payers.</p> : null}
        {error ? <p role="alert" className="text-sm text-clinic-danger">{error}</p> : null}
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" disabled={pending || payers.isPending}>{pending ? 'Creating...' : 'Create declaration'}</Button></div>
      </form>
    </Dialog>
  )
}

export function AddDeclarationItemDialog({ open, pending, error, onClose, onSubmit }: { open: boolean; pending: boolean; error?: string; onClose: () => void; onSubmit: (values: AddItemValues) => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<AddItemValues>({ resolver: zodResolver(addItemSchema), defaultValues: { invoiceItemId: '' } })
  return <Dialog open={open} onOpenChange={(next) => !next && onClose()} title="Add invoice item" description="Enter an invoice item ID. The Backend accepts only an item from the current eligible invoice version.">
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <FormField label="Invoice item ID" htmlFor="invoice-item-id" error={errors.invoiceItemId?.message} hint="Superseded and otherwise ineligible versions are rejected by the Backend."><Input id="invoice-item-id" inputMode="numeric" {...register('invoiceItemId')} /></FormField>
      {error ? <p role="alert" className="text-sm text-clinic-danger">{error}</p> : null}
      <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" disabled={pending}>{pending ? 'Adding...' : 'Add item'}</Button></div>
    </form>
  </Dialog>
}

export function SubmissionResultDialog({ open, pending, error, onClose, onSubmit }: { open: boolean; pending: boolean; error?: string; onClose: () => void; onSubmit: (values: SubmissionResultValues) => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<SubmissionResultValues>({ resolver: zodResolver(submissionResultSchema), defaultValues: { status: 'ACCEPTED', externalReference: '' } })
  return <Dialog open={open} onOpenChange={(next) => !next && onClose()} title="Record submission result" description="Record the immutable result returned through the supported submission process.">
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <FormField label="Result" htmlFor="submission-result"><Select id="submission-result" {...register('status')}><option value="ACCEPTED">Accepted</option><option value="PARTIALLY_REJECTED">Partially rejected</option><option value="REJECTED">Rejected</option></Select></FormField>
      <FormField label="External reference" htmlFor="external-reference" error={errors.externalReference?.message}><Input id="external-reference" maxLength={120} {...register('externalReference')} /></FormField>
      {error ? <p role="alert" className="text-sm text-clinic-danger">{error}</p> : null}
      <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" disabled={pending}>{pending ? 'Recording...' : 'Record result'}</Button></div>
    </form>
  </Dialog>
}
