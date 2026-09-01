import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getApiErrorMessage } from '../../api'
import { hasPermission } from '../../auth/permissions'
import { useAuth } from '../../auth/use-auth'
import { EmptyState } from '../../components/feedback/empty-state'
import { ErrorState } from '../../components/feedback/error-state'
import { LoadingState } from '../../components/feedback/loading-state'
import { StatusBadge } from '../../components/feedback/status-badge'
import { Button } from '../../components/ui/button'
import { Checkbox } from '../../components/ui/checkbox'
import { ConfirmDialog } from '../../components/ui/confirm-dialog'
import { Dialog } from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { Textarea } from '../../components/ui/textarea'
import type { EncounterDiagnosis } from '../../types/clinical'
import {
  assignDiagnosis,
  diagnosisKeys,
  listEncounterDiagnoses,
  removeDiagnosis,
  searchDiagnosisCodes,
  updateDiagnosis,
} from './clinical-api'

export function DiagnosisSection({ encounterId, editable }: { encounterId: string; editable: boolean }) {
  const { permissions } = useAuth()
  const queryClient = useQueryClient()
  const canRead = hasPermission(permissions, 'diagnosis.read')
  const canAssign = editable && hasPermission(permissions, 'diagnosis.assign')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<EncounterDiagnosis>()
  const [removeTarget, setRemoveTarget] = useState<EncounterDiagnosis>()
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [selectedCodeId, setSelectedCodeId] = useState('')
  const [isPrimary, setIsPrimary] = useState(false)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => window.clearTimeout(timeout)
  }, [searchInput])

  const diagnosesQuery = useQuery({
    queryKey: diagnosisKeys.encounter(encounterId),
    queryFn: ({ signal }) => listEncounterDiagnoses(encounterId, signal),
    enabled: canRead,
  })
  const codeQuery = useQuery({
    queryKey: diagnosisKeys.codes(search),
    queryFn: ({ signal }) => searchDiagnosisCodes(search, signal),
    enabled: dialogOpen && !editing && canRead,
  })

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: diagnosisKeys.encounter(encounterId) })
  }
  const saveMutation = useMutation({
    mutationFn: () => editing
      ? updateDiagnosis(encounterId, editing.id, { isPrimary, notes: notes || null })
      : assignDiagnosis(encounterId, { diagnosisCodeId: selectedCodeId, isPrimary, notes: notes || null }),
    onSuccess: async () => {
      setDialogOpen(false)
      setEditing(undefined)
      await refresh()
    },
  })
  const removeMutation = useMutation({
    mutationFn: () => {
      if (!removeTarget) throw new Error('No diagnosis selected')
      return removeDiagnosis(encounterId, removeTarget.id)
    },
    onSuccess: async () => {
      setRemoveTarget(undefined)
      await refresh()
    },
  })

  function openAdd() {
    setEditing(undefined)
    setSelectedCodeId('')
    setSearchInput('')
    setIsPrimary(false)
    setNotes('')
    saveMutation.reset()
    setDialogOpen(true)
  }
  function openEdit(diagnosis: EncounterDiagnosis) {
    setEditing(diagnosis)
    setIsPrimary(diagnosis.isPrimary)
    setNotes(diagnosis.notes ?? '')
    saveMutation.reset()
    setDialogOpen(true)
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div><h3 className="font-semibold text-slate-900">Diagnoses</h3><p className="mt-0.5 text-sm text-slate-500">Diagnosis snapshots assigned to this encounter.</p></div>
        {canAssign ? <Button onClick={openAdd}><Plus size={16} />Add diagnosis</Button> : null}
      </div>
      {!canRead ? <ErrorState title="Diagnosis access unavailable" description="Diagnosis read permission is required." /> : diagnosesQuery.isPending ? <LoadingState label="Loading diagnoses" /> : diagnosesQuery.isError ? <ErrorState title="Unable to load diagnoses" description={getApiErrorMessage(diagnosesQuery.error)} /> : diagnosesQuery.data.length === 0 ? <EmptyState title="No diagnoses recorded" /> : (
        <div className="divide-y divide-clinic-border rounded-lg border border-clinic-border bg-white">
          {diagnosesQuery.data.map((diagnosis) => (
            <div key={diagnosis.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-semibold text-clinic-blue">{diagnosis.codeSnapshot}</span>{diagnosis.isPrimary ? <StatusBadge tone="info">Primary</StatusBadge> : null}<span className="text-xs text-slate-500">{diagnosis.diagnosisCode.codeSystem}</span></div>
                <p className="mt-1 text-sm text-slate-800">{diagnosis.descriptionSnapshot}</p>
                {diagnosis.notes ? <p className="mt-1 text-xs text-slate-500">{diagnosis.notes}</p> : null}
              </div>
              {canAssign ? <div className="flex gap-2"><Button variant="secondary" className="h-8 px-2.5 text-xs" onClick={() => openEdit(diagnosis)}><Pencil size={14} />Edit</Button><Button variant="ghost" className="h-8 px-2.5 text-xs text-clinic-danger" onClick={() => setRemoveTarget(diagnosis)}><Trash2 size={14} />Remove</Button></div> : null}
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen} title={editing ? 'Edit diagnosis' : 'Add diagnosis'}>
        <div className="space-y-4">
          {!editing ? <>
            <div className="relative"><Search className="absolute left-3 top-2.5 text-slate-400" size={16} /><Input aria-label="Search diagnosis codes" className="pl-9" placeholder="Search code or description" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /></div>
            <div className="max-h-52 overflow-y-auto rounded-md border border-clinic-border">
              {codeQuery.isPending ? <p className="p-3 text-sm text-slate-500">Loading diagnosis codes...</p> : (codeQuery.data?.data ?? []).map((code) => <button key={code.id} type="button" className={`w-full border-b border-clinic-border px-3 py-2 text-left last:border-0 ${selectedCodeId === code.id ? 'bg-clinic-blue-soft' : 'hover:bg-slate-50'}`} onClick={() => setSelectedCodeId(code.id)}><span className="font-mono text-xs font-semibold text-clinic-blue">{code.code}</span><span className="ml-2 text-sm text-slate-700">{code.description}</span></button>)}
            </div>
          </> : <p className="rounded-md bg-slate-50 p-3 text-sm"><span className="font-mono font-semibold">{editing.codeSnapshot}</span> {editing.descriptionSnapshot}</p>}
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700"><Checkbox checked={isPrimary} onChange={(event) => setIsPrimary(event.target.checked)} />Primary diagnosis</label>
          <div><label htmlFor="diagnosisNotes" className="mb-1.5 block text-sm font-medium text-slate-700">Notes</label><Textarea id="diagnosisNotes" value={notes} onChange={(event) => setNotes(event.target.value)} /></div>
          {saveMutation.isError ? <p role="alert" className="text-sm text-clinic-danger">{getApiErrorMessage(saveMutation.error)}</p> : null}
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setDialogOpen(false)}>Cancel</Button><Button disabled={saveMutation.isPending || (!editing && !selectedCodeId)} onClick={() => saveMutation.mutate()}>{saveMutation.isPending ? 'Saving...' : 'Save diagnosis'}</Button></div>
        </div>
      </Dialog>
      <ConfirmDialog open={Boolean(removeTarget)} title="Remove diagnosis" description="Remove this diagnosis from the open encounter?" confirmLabel={removeMutation.isPending ? 'Removing...' : 'Remove'} onCancel={() => setRemoveTarget(undefined)} onConfirm={() => removeMutation.mutate()} />
    </section>
  )
}
