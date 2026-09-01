import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { getApiErrorMessage } from '../../api'
import { FormField } from '../../components/forms/form-field'
import { Button } from '../../components/ui/button'
import { Checkbox } from '../../components/ui/checkbox'
import { Dialog } from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { Select } from '../../components/ui/select'
import type {
  InsuranceWriteDto,
  PatientInsurance,
  Payer,
} from '../../types/patient'

const schema = z
  .object({
    payerId: z.string().regex(/^[1-9]\d*$/, 'Select a payer.'),
    insuredId: z.string().trim().min(1, 'Insured ID is required.').max(80),
    validFrom: z.string(),
    validTo: z.string(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'EXPIRED', 'SUSPENDED']),
    isPrimary: z.boolean(),
  })
  .refine(
    (values) =>
      !values.validFrom || !values.validTo || values.validTo >= values.validFrom,
    { path: ['validTo'], message: 'End date must be on or after start date.' },
  )

type Values = z.infer<typeof schema>

function defaults(insurance?: PatientInsurance): Values {
  return {
    payerId: insurance?.payerId ?? '',
    insuredId: insurance?.insuredId ?? '',
    validFrom: insurance?.validFrom ?? '',
    validTo: insurance?.validTo ?? '',
    status: insurance?.status ?? 'ACTIVE',
    isPrimary: insurance?.isPrimary ?? false,
  }
}

export function InsuranceFormDialog({
  open,
  onOpenChange,
  insurance,
  payers,
  onSubmit,
  isPending,
  error,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  insurance?: PatientInsurance
  payers: Payer[]
  onSubmit: (values: InsuranceWriteDto) => void
  isPending: boolean
  error?: unknown
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults(insurance) })

  useEffect(() => {
    if (open) reset(defaults(insurance))
  }, [insurance, open, reset])

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={insurance ? 'Edit insurance' : 'Add insurance'}
      description="Record coverage exactly as confirmed by the payer."
    >
      <form
        className="space-y-4"
        onSubmit={handleSubmit((values) =>
          onSubmit({
            ...values,
            validFrom: values.validFrom || null,
            validTo: values.validTo || null,
          }),
        )}
      >
        <FormField label="Payer" htmlFor="payerId" error={errors.payerId?.message}>
          <Select id="payerId" autoFocus {...register('payerId')}>
            <option value="">Select payer</option>
            {payers.map((payer) => (
              <option key={payer.id} value={payer.id}>
                {payer.name} ({payer.code})
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Insured ID" htmlFor="insuredId" error={errors.insuredId?.message}>
          <Input id="insuredId" {...register('insuredId')} />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Valid from" htmlFor="validFrom" error={errors.validFrom?.message}>
            <Input id="validFrom" type="date" {...register('validFrom')} />
          </FormField>
          <FormField label="Valid to" htmlFor="validTo" error={errors.validTo?.message}>
            <Input id="validTo" type="date" {...register('validTo')} />
          </FormField>
        </div>
        <FormField label="Coverage status" htmlFor="insuranceStatus" error={errors.status?.message}>
          <Select id="insuranceStatus" {...register('status')}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="EXPIRED">Expired</option>
            <option value="SUSPENDED">Suspended</option>
          </Select>
        </FormField>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <Checkbox {...register('isPrimary')} />
          Primary insurance
        </label>
        {error ? (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-clinic-danger">
            {getApiErrorMessage(error)}
          </p>
        ) : null}
        <div className="flex justify-end gap-2 border-t border-clinic-border pt-4">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending || payers.length === 0}>
            {isPending ? 'Saving...' : insurance ? 'Save changes' : 'Add insurance'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
