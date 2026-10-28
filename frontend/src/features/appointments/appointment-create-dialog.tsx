import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { getApiErrorMessage } from '../../api'
import { PermissionGuard } from '../../auth/permission-guard'
import { hasAllPermissions } from '../../auth/permissions'
import { useAuth } from '../../auth/use-auth'
import { FormField } from '../../components/forms/form-field'
import { Button } from '../../components/ui/button'
import { Dialog } from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { Select } from '../../components/ui/select'
import { Textarea } from '../../components/ui/textarea'
import { businessDateTimeInputToIso } from '../../lib/timezone'
import { listPatients, patientKeys } from '../patients/patient-api'
import { dashboardKeys } from '../dashboard/dashboard-api'
import { appointmentKeys, receptionKeys, createAppointment, listClinicLocations, searchAppointmentProviders } from './appointment-api'

import { appointmentCreateSchema, type Values } from './appointment-create-model'

const requiredLookups = ['patient.read', 'provider.read', 'clinic_location.read']
export function AppointmentCreateAction() {
  const { permissions } = useAuth()
  const [open, setOpen] = useState(false)
  const [created, setCreated] = useState<{ id: string; appointmentNumber: string } | null>(null)
  const allowed = hasAllPermissions(permissions, requiredLookups)
  return <PermissionGuard allOf={['appointment.create']}><div className="space-y-1">
    <Button disabled={!allowed} title={allowed ? 'Create appointment' : 'Patient, provider and clinic location lookup permissions are required.'} onClick={() => { setCreated(null); setOpen(true) }}><Plus size={16} />Create appointment</Button>
    {created ? <p role="status" className="text-xs text-clinic-success">Created <Link className="underline" to={`/appointments/${created.id}`}>{created.appointmentNumber}</Link></p> : null}
    {open && allowed ? <AppointmentCreateDialog onClose={() => setOpen(false)} onCreated={(record) => { setCreated(record); setOpen(false) }} /> : null}
  </div></PermissionGuard>
}
export function AppointmentCreateDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (record: { id: string; appointmentNumber: string }) => void }) {
  const client = useQueryClient()
  const [patientSearch, setPatientSearch] = useState('')
  const [providerSearch, setProviderSearch] = useState('')
  const [patientQ, setPatientQ] = useState('')
  const [providerQ, setProviderQ] = useState('')
  useEffect(() => { const timer = window.setTimeout(() => setPatientQ(patientSearch.trim()), 300); return () => window.clearTimeout(timer) }, [patientSearch])
  useEffect(() => { const timer = window.setTimeout(() => setProviderQ(providerSearch.trim()), 300); return () => window.clearTimeout(timer) }, [providerSearch])
  const { register, handleSubmit, resetField, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(appointmentCreateSchema), defaultValues: { patientId: '', providerId: '', clinicLocationId: '', scheduledStart: '', scheduledEnd: '', reason: '', notes: '' },
  })
  const patientsFilter = { q: patientQ, status: 'ACTIVE' as const, page: 1, pageSize: 100 }
  const patients = useQuery({ queryKey: patientKeys.list(patientsFilter), queryFn: ({ signal }) => listPatients(patientsFilter, signal) })
  const providers = useQuery({ queryKey: appointmentKeys.providerChoices(providerQ), queryFn: ({ signal }) => searchAppointmentProviders(providerQ, signal) })
  const locations = useQuery({ queryKey: appointmentKeys.locations(), queryFn: ({ signal }) => listClinicLocations(signal) })
  const mutation = useMutation({ mutationFn: (v: Values) => createAppointment({
    patientId: v.patientId, providerId: v.providerId, clinicLocationId: v.clinicLocationId,
    scheduledStart: businessDateTimeInputToIso(v.scheduledStart), scheduledEnd: businessDateTimeInputToIso(v.scheduledEnd),
    reason: v.reason || null, notes: v.notes || null,
  }), onSuccess: async (record) => {
    client.setQueryData(appointmentKeys.detail(record.id), record)
    await Promise.all([client.invalidateQueries({ queryKey: appointmentKeys.lists() }), client.invalidateQueries({ queryKey: receptionKeys.all }), client.invalidateQueries({ queryKey: dashboardKeys.all })])
    onCreated(record)
  } })
  const busy = mutation.isPending
  const loading = patients.isPending || providers.isPending || locations.isPending
  const lookupError = patients.error ?? providers.error ?? locations.error
  const empty = !loading && !lookupError && (!patients.data?.data.length || !providers.data?.data.length || !locations.data?.length)
  return <Dialog open onOpenChange={(next) => { if (!next && !busy) onClose() }} title="Create appointment" description="Select a patient, provider and clinic location. Times use America/Curacao." size="wide">
    <form className="space-y-4" onSubmit={handleSubmit((v) => mutation.mutate(v))}>
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">Search patients<Input className="mt-1" maxLength={120} value={patientSearch} onChange={(event) => { setPatientSearch(event.target.value); resetField('patientId') }} /></label>
        <label className="text-sm">Search providers<Input className="mt-1" maxLength={120} value={providerSearch} onChange={(event) => { setProviderSearch(event.target.value); resetField('providerId') }} /></label>
        <FormField label="Patient" htmlFor="create-patient" error={errors.patientId?.message} hint={(patients.data?.meta?.total ?? 0) > 100 ? 'Showing 100 matches. Refine your search.' : undefined}><Select id="create-patient" disabled={patients.isFetching || patientSearch.trim() !== patientQ} {...register('patientId')}><option value="">Select patient</option>{patients.data?.data.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName} — {p.patientNumber}</option>)}</Select></FormField>
        <FormField label="Provider" htmlFor="create-provider" error={errors.providerId?.message} hint={(providers.data?.meta?.total ?? 0) > 100 ? 'Showing 100 matches. Refine your search.' : undefined}><Select id="create-provider" disabled={providers.isFetching || providerSearch.trim() !== providerQ} {...register('providerId')}><option value="">Select provider</option>{providers.data?.data.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}</Select></FormField>
        <FormField label="Clinic location" htmlFor="create-location" error={errors.clinicLocationId?.message}><Select id="create-location" {...register('clinicLocationId')}><option value="">Select clinic location</option>{locations.data?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></FormField>
        <div />
        <FormField label="Scheduled start" htmlFor="create-start" error={errors.scheduledStart?.message}><Input id="create-start" type="datetime-local" {...register('scheduledStart')} /></FormField>
        <FormField label="Scheduled end" htmlFor="create-end" error={errors.scheduledEnd?.message}><Input id="create-end" type="datetime-local" {...register('scheduledEnd')} /></FormField>
        <FormField label="Reason" htmlFor="create-reason" error={errors.reason?.message}><Input id="create-reason" {...register('reason')} /></FormField>
        <FormField label="Notes" htmlFor="create-notes" error={errors.notes?.message}><Textarea id="create-notes" rows={3} {...register('notes')} /></FormField>
      </fieldset>
      {loading ? <p role="status">Loading appointment choices...</p> : null}
      {lookupError ? <div role="alert"><p>{getApiErrorMessage(lookupError)}</p><Button variant="secondary" onClick={() => { void patients.refetch(); void providers.refetch(); void locations.refetch() }}>Retry choices</Button></div> : null}
      {empty ? <p role="status">No matching patients, providers or clinic locations. Refine the search or contact an administrator.</p> : null}
      {mutation.error ? <p role="alert" className="text-sm text-clinic-danger">{getApiErrorMessage(mutation.error)}</p> : null}
      <div className="flex justify-end gap-2"><Button variant="secondary" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy || loading || Boolean(lookupError) || empty}>{busy ? 'Creating...' : 'Create appointment'}</Button></div>
    </form>
  </Dialog>
}
