import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { getApiErrorMessage } from '../../../api'
import { FormField } from '../../../components/forms/form-field'
import { Button } from '../../../components/ui/button'
import { Checkbox } from '../../../components/ui/checkbox'
import { Dialog } from '../../../components/ui/dialog'
import { Input } from '../../../components/ui/input'
import { Textarea } from '../../../components/ui/textarea'
import type { ServiceWriteDto, SvbProcedure, SvbTariff, TariffWriteDto } from '../../../types/svb-catalog'
import { historyNote, serviceSchema, tariffSchema, type ServiceValues, type TariffValues } from './service-model'

export function MutationError({ error }: { error: unknown }) {
  return error ? <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-clinic-danger">{getApiErrorMessage(error)}</p> : null
}
export function ServiceFormDialog({ open, service, pending, error, onClose, onSubmit }: {
  open: boolean; service?: SvbProcedure; pending: boolean; error: unknown; onClose: () => void; onSubmit: (body: ServiceWriteDto) => void
}) {
  const { register, reset, handleSubmit, formState: { errors } } = useForm<ServiceValues>({ resolver: zodResolver(serviceSchema) })
  useEffect(() => {
    if (open) reset({ code: service?.code ?? '', description: service?.description ?? '', category: service?.category ?? '', unit: service?.unit ?? '', requiresAuthorization: service?.requiresAuthorization ?? false, requiresReferral: service?.requiresReferral ?? false, isActive: service?.isActive ?? true, validFrom: service?.validFrom ?? '', validTo: service?.validTo ?? '' })
  }, [open, service, reset])
  const close = () => { if (!pending) onClose() }
  return <Dialog open={open} onOpenChange={(next) => !next && close()} title={service ? 'Edit service' : 'Create service'} description="Maintain the SVB service used in clinical care." size="wide">
    <form className="space-y-4" onSubmit={handleSubmit((v) => onSubmit({ code: v.code, description: v.description, category: v.category || null, unit: v.unit || null, requiresAuthorization: v.requiresAuthorization, requiresReferral: v.requiresReferral, validFrom: v.validFrom || null, validTo: v.validTo || null, ...(!service ? { isActive: v.isActive } : {}) }))}>
      <fieldset disabled={pending} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Service code / SKU" htmlFor="service-code" error={errors.code?.message}><Input id="service-code" maxLength={50} {...register('code')} /></FormField>
          <FormField label="Category" htmlFor="service-category" error={errors.category?.message}><Input id="service-category" maxLength={120} {...register('category')} /></FormField>
        </div>
        <FormField label="Description" htmlFor="service-description" error={errors.description?.message}><Textarea id="service-description" rows={3} maxLength={500} {...register('description')} /></FormField>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Unit" htmlFor="service-unit" error={errors.unit?.message}><Input id="service-unit" maxLength={50} {...register('unit')} /></FormField>
          <FormField label="Valid from" htmlFor="service-from" error={errors.validFrom?.message} hint="Optional; an empty date has no lower bound."><Input id="service-from" type="date" {...register('validFrom')} /></FormField>
          <FormField label="Valid to" htmlFor="service-to" error={errors.validTo?.message} hint="Optional; an empty date is open-ended."><Input id="service-to" type="date" {...register('validTo')} /></FormField>
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-slate-700">
          <label className="flex items-center gap-2"><Checkbox {...register('requiresAuthorization')} />Requires authorization</label>
          <label className="flex items-center gap-2"><Checkbox {...register('requiresReferral')} />Requires referral</label>
          {!service ? <label className="flex items-center gap-2"><Checkbox {...register('isActive')} />Active service</label> : null}
        </div>
      </fieldset>
      <p className="text-xs text-slate-500">{historyNote}</p>
      <MutationError error={error} />
      <div className="flex justify-end gap-2"><Button variant="secondary" onClick={close} disabled={pending}>Cancel</Button><Button type="submit" disabled={pending}>{pending ? 'Saving...' : service ? 'Save changes' : 'Create service'}</Button></div>
    </form>
  </Dialog>
}
export function TariffFormDialog({ open, tariff, pending, error, onClose, onSubmit }: {
  open: boolean; tariff?: SvbTariff; pending: boolean; error: unknown; onClose: () => void; onSubmit: (body: TariffWriteDto) => void
}) {
  const { register, reset, handleSubmit, formState: { errors } } = useForm<TariffValues>({ resolver: zodResolver(tariffSchema) })
  useEffect(() => { if (open) reset({ amount: tariff?.amount ?? '', currencyCode: tariff?.currencyCode ?? '', validFrom: tariff?.validFrom ?? '', validTo: tariff?.validTo ?? '', isActive: tariff?.isActive ?? true }) }, [open, tariff, reset])
  const close = () => { if (!pending) onClose() }
  return <Dialog open={open} onOpenChange={(next) => !next && close()} title={tariff ? 'Edit tariff' : 'Add tariff'} description="Maintain tariff history. The server checks overlapping active periods.">
    <form className="space-y-4" onSubmit={handleSubmit((v) => onSubmit({ ...v, currencyCode: v.currencyCode.toUpperCase(), validTo: v.validTo || null }))}>
      <fieldset disabled={pending} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Amount" htmlFor="tariff-amount" error={errors.amount?.message}><Input id="tariff-amount" inputMode="decimal" placeholder="88.80" {...register('amount')} /></FormField>
          <FormField label="Currency code" htmlFor="tariff-currency" error={errors.currencyCode?.message} hint="Enter the currency explicitly, e.g. ANG."><Input id="tariff-currency" maxLength={3} placeholder="e.g. ANG" {...register('currencyCode')} /></FormField>
          <FormField label="Valid from" htmlFor="tariff-from" error={errors.validFrom?.message}><Input id="tariff-from" type="date" {...register('validFrom')} /></FormField>
          <FormField label="Valid to" htmlFor="tariff-to" error={errors.validTo?.message} hint="Leave empty for an open-ended period."><Input id="tariff-to" type="date" {...register('validTo')} /></FormField>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700"><Checkbox {...register('isActive')} />Active tariff</label>
      </fieldset>
      <MutationError error={error} />
      <div className="flex justify-end gap-2"><Button variant="secondary" disabled={pending} onClick={close}>Cancel</Button><Button type="submit" disabled={pending}>{pending ? 'Saving...' : tariff ? 'Save tariff' : 'Add tariff'}</Button></div>
    </form>
  </Dialog>
}
