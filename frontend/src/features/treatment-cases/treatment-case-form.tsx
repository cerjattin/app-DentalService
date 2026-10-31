import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { getApiErrorMessage } from '../../api'
import { FormField } from '../../components/forms/form-field'
import { UnsavedChanges } from '../../components/forms/unsaved-changes'
import { Button } from '../../components/ui/button'
import { ConfirmDialog } from '../../components/ui/confirm-dialog'
import { Dialog } from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { Textarea } from '../../components/ui/textarea'
import type { TreatmentCase } from '../../types/treatment-case'
import { appointmentKeys } from '../appointments/appointment-api'
import { patientKeys } from '../patients/patient-api'
import { createTreatmentCase, updateTreatmentCase, treatmentCaseKeys } from './treatment-case-api'
import { treatmentCaseSchema, type TreatmentCaseValues } from './treatment-case-model'

export function TreatmentCaseForm({ patientId, record, onClose }: { patientId: string; record?: TreatmentCase | undefined; onClose: () => void }) {
  const client = useQueryClient()
  const [discard, setDiscard] = useState(false)
  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<TreatmentCaseValues>({ resolver: zodResolver(treatmentCaseSchema), defaultValues: { treatmentId: record?.treatmentId ?? '', treatmentType: record?.treatmentType ?? '', description: record?.description ?? '' } })
  const mutation = useMutation({ mutationFn: (values: TreatmentCaseValues) => {
    const body = { treatmentId: values.treatmentId, treatmentType: values.treatmentType || null, description: values.description || null }
    return record ? updateTreatmentCase(patientId, record.id, body) : createTreatmentCase(patientId, body)
  }, onSuccess: async (saved) => {
    client.setQueryData(treatmentCaseKeys.detail(patientId, saved.id), saved)
    onClose()
    await Promise.all([client.invalidateQueries({ queryKey: treatmentCaseKeys.patient(patientId) }), client.invalidateQueries({ queryKey: patientKeys.detail(patientId) }), client.invalidateQueries({ queryKey: appointmentKeys.lists() })])
  } })
  const close = () => { if (!mutation.isPending) { if (isDirty) setDiscard(true); else onClose() } }
  return <><UnsavedChanges active={isDirty && !mutation.isPending} /><Dialog open title={record ? 'Edit treatment case' : 'Create treatment case'} description="The external treatment ID is recorded as entered, including leading zeros. Linked cases cannot be edited." onOpenChange={(next) => { if (!next) close() }}>
    <form className="space-y-4" onSubmit={handleSubmit((values) => { if (!mutation.isPending) mutation.mutate(values) })}>
      <fieldset disabled={mutation.isPending} className="space-y-4">
        <FormField label="External treatment ID" htmlFor="case-external-id" error={errors.treatmentId?.message}><Input id="case-external-id" maxLength={7} {...register('treatmentId')} /></FormField>
        <FormField label="Treatment type" htmlFor="case-type" error={errors.treatmentType?.message}><Input id="case-type" maxLength={100} {...register('treatmentType')} /></FormField>
        <FormField label="Description" htmlFor="case-description" error={errors.description?.message}><Textarea id="case-description" maxLength={5000} {...register('description')} /></FormField>
      </fieldset>
      {mutation.error ? <p role="alert" className="text-sm text-clinic-danger">{getApiErrorMessage(mutation.error)}</p> : null}
      <div className="flex justify-end gap-2"><Button variant="secondary" disabled={mutation.isPending} onClick={close}>Cancel</Button><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving...' : 'Save treatment case'}</Button></div>
    </form>
  </Dialog><ConfirmDialog open={discard} title="Discard treatment case changes?" description="Your changes have not been saved." confirmLabel="Discard changes" cancelLabel="Keep editing" onCancel={() => setDiscard(false)} onConfirm={onClose} /></>
}
