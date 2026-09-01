import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { getApiErrorMessage } from '../../api'
import { hasPermission } from '../../auth/permissions'
import { useAuth } from '../../auth/use-auth'
import { EmptyState } from '../../components/feedback/empty-state'
import { ErrorState } from '../../components/feedback/error-state'
import { LoadingState } from '../../components/feedback/loading-state'
import { StatusBadge } from '../../components/feedback/status-badge'
import { Button } from '../../components/ui/button'
import { ConfirmDialog } from '../../components/ui/confirm-dialog'
import { Dialog } from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { Select } from '../../components/ui/select'
import { Textarea } from '../../components/ui/textarea'
import type {
  EncounterDiagnosis,
  EncounterProcedure,
  SvbProcedure,
} from '../../types/clinical'
import type { PatientInsurance } from '../../types/patient'
import {
  addEncounterProcedure,
  authorizationKeys,
  getApplicableTariff,
  listAuthorizations,
  listEncounterProcedures,
  performedProcedureKeys,
  removeEncounterProcedure,
  searchSvbProcedures,
  svbProcedureKeys,
  updateEncounterProcedure,
} from './clinical-api'

export function ProcedureSection({
  encounterId,
  patientId,
  serviceDate,
  insurance,
  diagnoses,
  editable,
}: {
  encounterId: string
  patientId: string
  serviceDate: string
  insurance: PatientInsurance[]
  diagnoses: EncounterDiagnosis[]
  editable: boolean
}) {
  const { permissions } = useAuth()
  const queryClient = useQueryClient()
  const canRead = hasPermission(permissions, 'procedure.read')
  const canUpdate = editable && hasPermission(permissions, 'procedure.update')
  const canSearchCatalog = hasPermission(permissions, 'svb_procedure.read')
  const canReadTariff = hasPermission(permissions, 'svb_tariff.read')
  const canReadAuthorizations = hasPermission(permissions, 'authorization.read')
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<EncounterProcedure>()
  const [removeTarget, setRemoveTarget] = useState<EncounterProcedure>()
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [selectedProcedure, setSelectedProcedure] = useState<SvbProcedure>()
  const [insuranceId, setInsuranceId] = useState('')
  const [diagnosisId, setDiagnosisId] = useState('')
  const [authorizationItemId, setAuthorizationItemId] = useState('')
  const [quantity, setQuantity] = useState('1.00')
  const [note, setNote] = useState('')

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => window.clearTimeout(timeout)
  }, [searchInput])

  const proceduresQuery = useQuery({
    queryKey: performedProcedureKeys.encounter(encounterId),
    queryFn: ({ signal }) => listEncounterProcedures(encounterId, signal),
    enabled: canRead,
  })
  const catalogQuery = useQuery({
    queryKey: svbProcedureKeys.search(search, serviceDate),
    queryFn: ({ signal }) => searchSvbProcedures(search, serviceDate, signal),
    enabled: addOpen && canSearchCatalog,
  })
  const tariffQuery = useQuery({
    queryKey: svbProcedureKeys.tariff(selectedProcedure?.id ?? '', serviceDate),
    queryFn: ({ signal }) => getApplicableTariff(selectedProcedure?.id ?? '', serviceDate, signal),
    enabled: Boolean(selectedProcedure) && canReadTariff,
    retry: false,
  })
  const authorizationsQuery = useQuery({
    queryKey: authorizationKeys.patient(patientId, serviceDate),
    queryFn: ({ signal }) => listAuthorizations(patientId, serviceDate, signal),
    enabled: canReadAuthorizations,
  })

  const authorizationItems = useMemo(
    () => (authorizationsQuery.data?.data ?? []).flatMap((authorization) =>
      authorization.items.map((item) => ({ ...item, authorization })),
    ),
    [authorizationsQuery.data],
  )
  const matchingAuthorizationItems = authorizationItems.filter((item) =>
    !selectedProcedure || item.svbProcedureId === null || item.svbProcedureId === selectedProcedure.id,
  )

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: performedProcedureKeys.encounter(encounterId) }),
      queryClient.invalidateQueries({ queryKey: authorizationKeys.patient(patientId, serviceDate) }),
    ])
  }
  const addMutation = useMutation({
    mutationFn: () => {
      if (!selectedProcedure) throw new Error('No procedure selected')
      return addEncounterProcedure(encounterId, {
        patientInsuranceId: insuranceId,
        svbProcedureId: selectedProcedure.id,
        authorizationItemId: authorizationItemId || null,
        diagnosisId: diagnosisId || null,
        quantity,
        additionalNote: note || null,
      })
    },
    onSuccess: async () => {
      setAddOpen(false)
      await refresh()
    },
  })
  const editMutation = useMutation({
    mutationFn: () => {
      if (!editTarget) throw new Error('No procedure selected')
      return updateEncounterProcedure(encounterId, editTarget.id, {
        diagnosisId: diagnosisId || null,
        additionalNote: note || null,
      })
    },
    onSuccess: async () => {
      setEditTarget(undefined)
      await refresh()
    },
  })
  const removeMutation = useMutation({
    mutationFn: () => {
      if (!removeTarget) throw new Error('No procedure selected')
      return removeEncounterProcedure(encounterId, removeTarget.id)
    },
    onSuccess: async () => {
      setRemoveTarget(undefined)
      await refresh()
    },
  })

  function openAdd() {
    setSearchInput('')
    setSelectedProcedure(undefined)
    setInsuranceId(insurance.find((item) => item.isPrimary)?.id ?? insurance[0]?.id ?? '')
    setDiagnosisId(diagnoses.find((item) => item.isPrimary)?.id ?? '')
    setAuthorizationItemId('')
    setQuantity('1.00')
    setNote('')
    addMutation.reset()
    setAddOpen(true)
  }
  function openEdit(procedure: EncounterProcedure) {
    setDiagnosisId(procedure.diagnosisId ?? '')
    setNote(procedure.additionalNote ?? '')
    editMutation.reset()
    setEditTarget(procedure)
  }

  const addDisabled =
    addMutation.isPending ||
    !selectedProcedure ||
    !insuranceId ||
    !/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(quantity) ||
    quantity === '0' ||
    (selectedProcedure.requiresAuthorization && !authorizationItemId)

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div><h3 className="font-semibold text-slate-900">Performed procedures</h3><p className="mt-0.5 text-sm text-slate-500">Backend-resolved tariffs and clinical snapshots.</p></div>
        {canUpdate && canSearchCatalog ? <Button onClick={openAdd}><Plus size={16} />Add procedure</Button> : null}
      </div>
      {!canRead ? <ErrorState title="Procedure access unavailable" description="Procedure read permission is required." /> : proceduresQuery.isPending ? <LoadingState label="Loading performed procedures" /> : proceduresQuery.isError ? <ErrorState title="Unable to load procedures" description={getApiErrorMessage(proceduresQuery.error)} /> : proceduresQuery.data.length === 0 ? <EmptyState title="No procedures recorded" description="No performed procedures are attached to this encounter." /> : (
        <div className="space-y-3">
          {proceduresQuery.data.map((procedure) => (
            <div key={procedure.id} className="rounded-lg border border-clinic-border bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-semibold text-clinic-blue">{procedure.procedureCodeSnapshot}</span><StatusBadge tone={procedure.status === 'PERFORMED' ? 'success' : 'neutral'}>{procedure.status.charAt(0) + procedure.status.slice(1).toLowerCase()}</StatusBadge>{procedure.svbProcedure.requiresAuthorization ? <StatusBadge tone="warning">Authorization required</StatusBadge> : null}</div><p className="mt-1 text-sm font-medium text-slate-800">{procedure.procedureDescriptionSnapshot}</p></div>
                {canUpdate && procedure.status === 'PERFORMED' ? <div className="flex gap-2"><Button variant="secondary" className="h-8 px-2.5 text-xs" onClick={() => openEdit(procedure)}><Pencil size={14} />Edit</Button><Button variant="ghost" className="h-8 px-2.5 text-xs text-clinic-danger" onClick={() => setRemoveTarget(procedure)}><Trash2 size={14} />Remove</Button></div> : null}
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div><dt className="text-xs text-slate-500">Quantity</dt><dd className="mt-1 font-mono">{procedure.quantity}</dd></div>
                <div><dt className="text-xs text-slate-500">Authoritative tariff</dt><dd className="mt-1 font-mono">{procedure.currencyCodeSnapshot} {procedure.unitTariffSnapshot}</dd></div>
                <div><dt className="text-xs text-slate-500">Backend amount</dt><dd className="mt-1 font-mono">{procedure.currencyCodeSnapshot} {procedure.amount}</dd></div>
                <div><dt className="text-xs text-slate-500">Authorization</dt><dd className="mt-1">{procedure.authorizationIdSnapshot ?? 'Not linked'}</dd></div>
                <div><dt className="text-xs text-slate-500">Diagnosis</dt><dd className="mt-1">{procedure.diagnosticCodeSnapshot ?? 'Not linked'}</dd></div>
                <div><dt className="text-xs text-slate-500">Treatment ID</dt><dd className="mt-1">{procedure.treatmentIdSnapshot ?? 'Not available'}</dd></div>
                <div><dt className="text-xs text-slate-500">Policlinic</dt><dd className="mt-1">{procedure.policlinicSnapshot ?? 'Not available'}</dd></div>
                <div><dt className="text-xs text-slate-500">Insured ID</dt><dd className="mt-1 font-mono">{procedure.insuredIdSnapshot}</dd></div>
              </dl>
              {procedure.additionalNote ? <p className="mt-3 text-sm text-slate-600">{procedure.additionalNote}</p> : null}
            </div>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen} title="Add performed procedure" description="The backend resolves and snapshots the applicable ANG tariff." size="wide">
        <div className="space-y-4">
          <div className="relative"><Search className="absolute left-3 top-2.5 text-slate-400" size={16} /><Input aria-label="Search SVB procedures" className="pl-9" placeholder="Search procedure code or description" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /></div>
          <div className="max-h-48 overflow-y-auto rounded-md border border-clinic-border">
            {catalogQuery.isPending ? <p className="p-3 text-sm text-slate-500">Loading SVB procedures...</p> : (catalogQuery.data?.data ?? []).map((procedure) => <button key={procedure.id} type="button" className={`w-full border-b border-clinic-border px-3 py-2 text-left last:border-0 ${selectedProcedure?.id === procedure.id ? 'bg-clinic-blue-soft' : 'hover:bg-slate-50'}`} onClick={() => { setSelectedProcedure(procedure); setAuthorizationItemId('') }}><span className="font-mono text-xs font-semibold text-clinic-blue">{procedure.code}</span><span className="ml-2 text-sm text-slate-700">{procedure.description}</span>{procedure.requiresAuthorization ? <span className="ml-2 text-xs text-amber-700">Authorization required</span> : null}</button>)}
          </div>
          {selectedProcedure ? <div className="rounded-md bg-slate-50 p-3 text-sm"><div className="font-medium">{selectedProcedure.code} - {selectedProcedure.description}</div><div className="mt-1 text-slate-600">Tariff: {tariffQuery.isPending ? 'Resolving...' : tariffQuery.data ? `${tariffQuery.data.currencyCode} ${tariffQuery.data.amount}` : canReadTariff ? 'Unavailable' : 'Tariff read permission required'}</div></div> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label htmlFor="procedureInsurance" className="mb-1.5 block text-sm font-medium text-slate-700">Patient insurance</label><Select id="procedureInsurance" value={insuranceId} onChange={(event) => setInsuranceId(event.target.value)}><option value="">Select insurance</option>{insurance.map((item) => <option key={item.id} value={item.id}>{item.payer.name} - {item.insuredId} ({item.status})</option>)}</Select></div>
            <div><label htmlFor="procedureDiagnosis" className="mb-1.5 block text-sm font-medium text-slate-700">Diagnosis</label><Select id="procedureDiagnosis" value={diagnosisId} onChange={(event) => setDiagnosisId(event.target.value)}><option value="">No linked diagnosis</option>{diagnoses.map((item) => <option key={item.id} value={item.id}>{item.codeSnapshot} - {item.descriptionSnapshot}</option>)}</Select></div>
            <div><label htmlFor="procedureQuantity" className="mb-1.5 block text-sm font-medium text-slate-700">Quantity</label><Input id="procedureQuantity" inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></div>
            <div><label htmlFor="procedureAuthorization" className="mb-1.5 block text-sm font-medium text-slate-700">Authorization item</label><Select id="procedureAuthorization" value={authorizationItemId} disabled={!canReadAuthorizations} onChange={(event) => setAuthorizationItemId(event.target.value)}><option value="">No authorization item</option>{matchingAuthorizationItems.map((item) => <option key={item.id} value={item.id}>{item.authorization.authorizationId} - {item.procedureCodeSnapshot ?? 'General'} - remaining {item.remainingQuantity ?? 'unlimited'}</option>)}</Select></div>
          </div>
          <div><label htmlFor="procedureNote" className="mb-1.5 block text-sm font-medium text-slate-700">Additional note</label><Textarea id="procedureNote" value={note} onChange={(event) => setNote(event.target.value)} /></div>
          {addMutation.isError ? <p role="alert" className="text-sm text-clinic-danger">{getApiErrorMessage(addMutation.error)}</p> : null}
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button><Button disabled={addDisabled} onClick={() => addMutation.mutate()}>{addMutation.isPending ? 'Adding...' : 'Add performed procedure'}</Button></div>
        </div>
      </Dialog>

      <Dialog open={Boolean(editTarget)} onOpenChange={(open) => { if (!open) setEditTarget(undefined) }} title="Edit performed procedure">
        <div className="space-y-4">
          <div><label htmlFor="editProcedureDiagnosis" className="mb-1.5 block text-sm font-medium text-slate-700">Diagnosis</label><Select id="editProcedureDiagnosis" value={diagnosisId} onChange={(event) => setDiagnosisId(event.target.value)}><option value="">No linked diagnosis</option>{diagnoses.map((item) => <option key={item.id} value={item.id}>{item.codeSnapshot} - {item.descriptionSnapshot}</option>)}</Select></div>
          <div><label htmlFor="editProcedureNote" className="mb-1.5 block text-sm font-medium text-slate-700">Additional note</label><Textarea id="editProcedureNote" value={note} onChange={(event) => setNote(event.target.value)} /></div>
          {editMutation.isError ? <p role="alert" className="text-sm text-clinic-danger">{getApiErrorMessage(editMutation.error)}</p> : null}
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setEditTarget(undefined)}>Cancel</Button><Button disabled={editMutation.isPending} onClick={() => editMutation.mutate()}>{editMutation.isPending ? 'Saving...' : 'Save changes'}</Button></div>
        </div>
      </Dialog>
      <ConfirmDialog open={Boolean(removeTarget)} title="Remove performed procedure" description="Remove this procedure from the open encounter? Linked authorization usage will be handled by the backend." confirmLabel={removeMutation.isPending ? 'Removing...' : 'Remove'} onCancel={() => setRemoveTarget(undefined)} onConfirm={() => removeMutation.mutate()} />
    </section>
  )
}
