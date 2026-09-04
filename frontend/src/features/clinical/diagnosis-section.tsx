import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { PermissionGuard } from '../../auth/permission-guard'
import { Button } from '../../components/ui/button'
import { Checkbox } from '../../components/ui/checkbox'
import { Dialog } from '../../components/ui/dialog'
import { Textarea } from '../../components/ui/textarea'
import { FormField } from '../../components/forms/form-field'
import { LoadingState } from '../../components/feedback/loading-state'
import { StatusBadge } from '../../components/feedback/status-badge'
import type {
  ClinicalEncounter,
  EncounterDiagnosis,
} from '../../types/clinical'
import {
  addDiagnosis,
  encounterKeys,
  listDiagnoses,
  removeDiagnosis,
  updateDiagnosis,
} from './clinical-api'
import { CatalogueSearch } from './catalogue-search'
import { ClinicalConfirm, ClinicalSection, MutationError } from './clinical-ui'
import { notesSchema } from './clinical-model'

const schema = z.object({ isPrimary: z.boolean(), notes: notesSchema })
type Values = z.infer<typeof schema>
export function DiagnosisSection({
  encounter,
  serviceDate,
}: {
  encounter: ClinicalEncounter
  serviceDate: string
}) {
  const client = useQueryClient()
  const [editing, setEditing] = useState<EncounterDiagnosis | 'new' | null>(
    null,
  )
  const [removing, setRemoving] = useState<EncounterDiagnosis | null>(null)
  const [notice, setNotice] = useState('')
  const query = useQuery({
    queryKey: encounterKeys.diagnoses(encounter.id),
    queryFn: ({ signal }) => listDiagnoses(encounter.id, signal),
  })
  const refresh = async () => {
    await client.invalidateQueries({
      queryKey: encounterKeys.diagnoses(encounter.id),
    })
    await client.invalidateQueries({
      queryKey: encounterKeys.procedures(encounter.id),
    })
  }
  const remove = useMutation({
    mutationFn: () => removeDiagnosis(encounter.id, removing!.id),
    onSuccess: async () => {
      setRemoving(null)
      setNotice('Diagnosis removed.')
      await refresh()
    },
  })
  return (
    <ClinicalSection
      title="Diagnoses"
      actions={
        encounter.status === 'OPEN' ? (
          <PermissionGuard allOf={['diagnosis.assign']}>
            <Button variant="secondary" onClick={() => setEditing('new')}>
              <Plus size={16} />
              Add diagnosis
            </Button>
          </PermissionGuard>
        ) : null
      }
    >
      {notice ? (
        <p role="status" className="mb-3 text-sm text-green-700">
          {notice}
        </p>
      ) : null}
      {query.isPending ? (
        <LoadingState label="Loading diagnoses" />
      ) : query.isError ? (
        <>
          <MutationError error={query.error} />
          <Button onClick={() => void query.refetch()}>Retry</Button>
        </>
      ) : query.data.length ? (
        <ul className="divide-y divide-clinic-border">
          {query.data.map((row) => (
            <li
              className="flex items-start justify-between gap-3 py-3"
              key={row.id}
            >
              <div className="min-w-0">
                <p className="break-words text-sm">
                  <span className="mr-2 font-mono text-clinic-blue">
                    {row.codeSnapshot}
                  </span>
                  {row.descriptionSnapshot}
                </p>
                {row.isPrimary ? (
                  <StatusBadge tone="info">Primary</StatusBadge>
                ) : null}
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-500">
                  {row.notes}
                </p>
              </div>
              {encounter.status === 'OPEN' ? (
                <PermissionGuard allOf={['diagnosis.assign']}>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      title="Edit diagnosis"
                      aria-label={`Edit diagnosis ${row.codeSnapshot}`}
                      onClick={() => setEditing(row)}
                    >
                      <Pencil size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      title="Remove diagnosis"
                      aria-label={`Remove diagnosis ${row.codeSnapshot}`}
                      onClick={() => {
                        remove.reset()
                        setRemoving(row)
                      }}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </PermissionGuard>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">No diagnoses recorded.</p>
      )}
      {editing && encounter.status === 'OPEN' ? (
        <DiagnosisForm
          encounter={encounter}
          initial={editing}
          serviceDate={serviceDate}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null)
            setNotice('Diagnosis saved.')
            await refresh()
          }}
        />
      ) : null}
      {removing && encounter.status === 'OPEN' ? (
        <ClinicalConfirm
          title="Remove diagnosis?"
          description="This removes the diagnosis from this encounter. Related procedures may prevent removal."
          onClose={() => setRemoving(null)}
          onConfirm={() => remove.mutate()}
          pending={remove.isPending}
          error={remove.error}
        />
      ) : null}
    </ClinicalSection>
  )
}
function DiagnosisForm({
  encounter,
  initial,
  serviceDate,
  onClose,
  onSaved,
}: {
  encounter: ClinicalEncounter
  initial: EncounterDiagnosis | 'new'
  serviceDate: string
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [selected, setSelected] = useState(
    initial === 'new' ? null : initial.diagnosisCode,
  )
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      isPrimary: initial === 'new' ? false : initial.isPrimary,
      notes: initial === 'new' ? '' : (initial.notes ?? ''),
    },
  })
  const mutation = useMutation({
    mutationFn: (values: Values) =>
      initial === 'new'
        ? addDiagnosis(encounter.id, {
            diagnosisCodeId: selected!.id,
            isPrimary: values.isPrimary,
            notes: values.notes || null,
          })
        : updateDiagnosis(encounter.id, initial.id, {
            isPrimary: values.isPrimary,
            notes: values.notes || null,
          }),
    onSuccess: onSaved,
  })
  return (
    <Dialog
      open
      title={initial === 'new' ? 'Add diagnosis' : 'Edit diagnosis'}
      description="Record the diagnosis and optional clinical notes."
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose()
      }}
    >
      {initial === 'new' && !selected ? (
        <CatalogueSearch
          kind="diagnosis"
          serviceDate={serviceDate}
          onSelect={(row) => {
            if ('codeSystem' in row) setSelected(row)
          }}
        />
      ) : (
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <p className="text-sm font-medium">
            {selected?.code} {selected?.description}
          </p>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <Checkbox {...form.register('isPrimary')} />
            Primary diagnosis
          </label>
          <FormField
            label="Diagnosis notes"
            htmlFor="diagnosis-notes"
            error={form.formState.errors.notes?.message}
          >
            <Textarea id="diagnosis-notes" {...form.register('notes')} />
          </FormField>
          <MutationError error={mutation.error} />
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              disabled={mutation.isPending}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving...' : 'Save diagnosis'}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  )
}
