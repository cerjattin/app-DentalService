import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { PermissionGuard } from '../../auth/permission-guard'
import { hasPermission } from '../../auth/permissions'
import { useAuth } from '../../auth/use-auth'
import { DataTable } from '../../components/data-table/data-table'
import { LoadingState } from '../../components/feedback/loading-state'
import { FormField } from '../../components/forms/form-field'
import { Button } from '../../components/ui/button'
import { Dialog } from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import type { ClinicalEncounter, EncounterProcedure, SvbProcedure } from '../../types/clinical'
import { refreshAppointmentWorkflow } from '../appointments/appointment-workflow-cache'
import { CatalogueSearch } from './catalogue-search'
import { addProcedure, encounterKeys, listProcedures, removeProcedure } from './clinical-api'
import { positiveQuantitySchema } from './clinical-model'
import { ClinicalConfirm, ClinicalSection, MutationError } from './clinical-ui'

export function ProcedureSection({ encounter, serviceDate, disabled }: {
  encounter: ClinicalEncounter
  serviceDate: string
  disabled: boolean
}) {
  const client = useQueryClient()
  const { permissions } = useAuth()
  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState<SvbProcedure | null>(null)
  const [quantity, setQuantity] = useState('1')
  const [removing, setRemoving] = useState<EncounterProcedure | null>(null)
  const [notice, setNotice] = useState('')
  const [reviewNeeded, setReviewNeeded] = useState(false)
  const addTrigger = useRef<HTMLButtonElement>(null)
  const serviceList = useRef<HTMLDivElement>(null)
  const restoreAfterSave = useRef(false)
  const key = encounterKeys.procedures(encounter.id)
  const query = useQuery({ queryKey: key, queryFn: ({ signal }) => listProcedures(encounter.id, signal),
    enabled: hasPermission(permissions, 'procedure.read') })
  const refresh = () => refreshAppointmentWorkflow(client, encounter.appointmentId, encounter.id)
  const add = useMutation({
    mutationKey: key,
    mutationFn: (input: { svbProcedureId: string; quantity: string }) => addProcedure(encounter.id, input),
    onSuccess: async () => {
      restoreAfterSave.current = true
      setAdding(false)
      setNotice('Service recorded.')
      await refresh()
    },
    onError: async () => {
      setReviewNeeded(true)
      await refresh()
    },
  })
  const remove = useMutation({
    mutationKey: key,
    mutationFn: (id: string) => removeProcedure(encounter.id, id),
    onSuccess: async () => {
      restoreAfterSave.current = true
      setRemoving(null)
      setNotice('Service removed.')
      await refresh()
    },
    onError: refresh,
  })
  const editable = encounter.status === 'OPEN' && !disabled
  const busy = add.isPending || remove.isPending
  useEffect(() => {
    if (!busy && !adding && !removing && restoreAfterSave.current) {
      restoreAfterSave.current = false
      const destination = addTrigger.current ?? serviceList.current
      destination?.focus()
    }
  }, [busy, adding, removing])
  const validQuantity = positiveQuantitySchema.safeParse(quantity)
  const rows = query.data?.filter((row) => row.status === 'PERFORMED' || row.status === 'BILLED') ?? []

  return (
    <PermissionGuard allOf={['procedure.read']}>
      <ClinicalSection title="Services provided" actions={editable ? (
        <PermissionGuard allOf={['procedure.update', 'svb_procedure.read']}>
          <Button ref={addTrigger} disabled={busy} onClick={() => { setNotice(''); setReviewNeeded(false); setSelected(null); setQuantity('1'); add.reset(); setAdding(true) }}>
            <Plus size={16} /> Add service
          </Button>
        </PermissionGuard>
      ) : null}>
        {notice ? <p role="status" className="mb-3 text-sm text-green-800">{notice}</p> : null}
        {query.isPending ? <LoadingState label="Loading services" /> : query.isError ? (
          <><MutationError error={query.error} /><Button variant="secondary" onClick={() => void query.refetch()}>Retry</Button></>
        ) : (
          <div ref={serviceList} tabIndex={-1} aria-label="Saved service list"><DataTable rows={rows} getRowKey={(row) => row.id} emptyMessage="No services recorded."
            columns={[
              { key: 'service', header: 'Service', render: (row) => (
                <><span className="mr-2 font-mono text-clinic-blue">{row.procedureCodeSnapshot}</span>{row.procedureDescriptionSnapshot}</>
              ) },
              { key: 'quantity', header: 'Quantity', render: (row) => row.quantity },
              { key: 'actions', header: 'Actions', render: (row) => editable ? (
                <PermissionGuard allOf={['procedure.update']}>
                  <Button variant="ghost" disabled={busy} aria-label={`Remove service ${row.procedureCodeSnapshot}`}
                    onClick={() => { setNotice(''); remove.reset(); setRemoving(row) }}><Trash2 size={16} /></Button>
                </PermissionGuard>
              ) : null },
            ]} /></div>
        )}
      </ClinicalSection>
      {adding && encounter.status === 'OPEN' ? (
        <Dialog open title="Add service" onOpenChange={(open) => { if (!open && !add.isPending) setAdding(false) }}>
          <form className="space-y-4" onSubmit={(event) => {
            event.preventDefault()
            if (editable && selected && validQuantity.success && !busy && !reviewNeeded) {
              add.mutate({ svbProcedureId: selected.id, quantity: validQuantity.data })
            }
          }}>
            <CatalogueSearch kind="procedure" serviceDate={serviceDate} onSelect={(row) => {
              if (!busy && 'requiresAuthorization' in row) setSelected(row)
            }} />
            {selected ? <p className="text-sm font-medium">{selected.code} · {selected.description}</p> : null}
            <FormField label="Quantity" htmlFor="service-quantity" error={validQuantity.success ? undefined : 'Enter a positive quantity with up to two decimal places.'}>
              <Input id="service-quantity" inputMode="decimal" maxLength={11} value={quantity} disabled={busy} onChange={(event) => setQuantity(event.target.value)} />
            </FormField>
            <MutationError error={add.error} />
            {add.error ? <div className="space-y-2 rounded border border-amber-200 bg-amber-50 p-3 text-sm">
              <p>The response did not confirm this save. Review the current services before adding another; the first request may already be recorded. Your selection and quantity are retained.</p>
              <Button type="button" variant="secondary" disabled={query.isFetching} onClick={async () => {
                const result = await query.refetch()
                if (result.isSuccess) setReviewNeeded(false)
              }}>Refresh saved services</Button>
              {query.isError ? <MutationError error={query.error} /> : <ul aria-label="Current saved services">{rows.map((row) => <li key={row.id}>{row.procedureCodeSnapshot} · {row.quantity}</li>)}</ul>}
            </div> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" disabled={busy} onClick={() => setAdding(false)}>Cancel</Button>
              <Button type="submit" disabled={!editable || !selected || !validQuantity.success || busy || reviewNeeded}>{add.error ? 'Save another service' : 'Save service'}</Button>
            </div>
          </form>
        </Dialog>
      ) : null}
      {removing ? <ClinicalConfirm title="Remove service?"
        description="Remove this service from the current attention."
        pending={remove.isPending} error={remove.error} onClose={() => setRemoving(null)}
        onConfirm={() => { if (editable) remove.mutate(removing.id) }} /> : null}
    </PermissionGuard>
  )
}
