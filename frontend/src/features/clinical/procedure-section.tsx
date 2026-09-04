import { zodResolver } from '@hookform/resolvers/zod'
import {
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { PermissionGuard } from '../../auth/permission-guard'
import { useAuth } from '../../auth/use-auth'
import { hasPermission } from '../../auth/permissions'
import { DataTable } from '../../components/data-table/data-table'
import { Button } from '../../components/ui/button'
import { Dialog } from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { Select } from '../../components/ui/select'
import { Textarea } from '../../components/ui/textarea'
import { FormField } from '../../components/forms/form-field'
import { LoadingState } from '../../components/feedback/loading-state'
import { StatusBadge } from '../../components/feedback/status-badge'
import type {
  ClinicalEncounter,
  EncounterProcedure,
  SvbProcedure,
} from '../../types/clinical'
import type { PatientInsurance } from '../../types/patient'
import { CatalogueSearch } from './catalogue-search'
import {
  addProcedure,
  authorizationKeys,
  catalogueKeys,
  encounterKeys,
  getTariff,
  listAuthorizations,
  listDiagnoses,
  listProcedures,
  removeProcedure,
  updateProcedure,
} from './clinical-api'
import {
  ClinicalConfirm,
  ClinicalSection,
  MutationError,
  Pager,
} from './clinical-ui'
import {
  clinicalLabel,
  entityIdSchema,
  notesSchema,
  positiveQuantitySchema,
  useSearch,
} from './clinical-model'

export function ProcedureSection({
  encounter,
  insurance,
  serviceDate,
}: {
  encounter: ClinicalEncounter
  insurance: PatientInsurance[]
  serviceDate: string
}) {
  const client = useQueryClient()
  const [editing, setEditing] = useState<EncounterProcedure | 'new' | null>(
    null,
  )
  const [removing, setRemoving] = useState<EncounterProcedure | null>(null)
  const [notice, setNotice] = useState('')
  const query = useQuery({
    queryKey: encounterKeys.procedures(encounter.id),
    queryFn: ({ signal }) => listProcedures(encounter.id, signal),
  })
  const refresh = async () => {
    await client.invalidateQueries({
      queryKey: encounterKeys.procedures(encounter.id),
    })
    await client.invalidateQueries({
      queryKey: authorizationKeys.patient(encounter.patient.id),
    })
  }
  const remove = useMutation({
    mutationFn: () => removeProcedure(encounter.id, removing!.id),
    onSuccess: async () => {
      setRemoving(null)
      setNotice('Procedure removed.')
      await refresh()
    },
  })
  return (
    <ClinicalSection
      title="Performed procedures"
      actions={
        encounter.status === 'OPEN' ? (
          <PermissionGuard
            allOf={['procedure.update', 'svb_procedure.read', 'insurance.read']}
          >
            <Button
              onClick={() => setEditing('new')}
              disabled={!insurance.length}
            >
              <Plus size={16} />
              Add procedure
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
        <LoadingState label="Loading performed procedures" />
      ) : query.isError ? (
        <>
          <MutationError error={query.error} />
          <Button onClick={() => void query.refetch()}>Retry</Button>
        </>
      ) : (
        <DataTable
          rows={query.data}
          getRowKey={(row) => row.id}
          emptyMessage="No performed procedures recorded."
          columns={[
            {
              key: 'procedure',
              header: 'Procedure',
              render: (row) => (
                <div className="min-w-44 max-w-80 break-words">
                  <span className="font-mono text-clinic-blue">
                    {row.procedureCodeSnapshot}
                  </span>
                  <p>{row.procedureDescriptionSnapshot}</p>
                  <StatusBadge>{clinicalLabel(row.status)}</StatusBadge>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-slate-500">
                    {row.additionalNote}
                  </p>
                </div>
              ),
            },
            {
              key: 'quantity',
              header: 'Quantity / tariff',
              render: (row) => (
                <div className="whitespace-nowrap font-mono text-xs">
                  <p>{row.quantity}</p>
                  <p>
                    {row.currencyCodeSnapshot} {row.unitTariffSnapshot}
                  </p>
                </div>
              ),
            },
            {
              key: 'context',
              header: 'Clinical context',
              render: (row) => (
                <div className="min-w-44 break-words text-xs">
                  <p>
                    Diagnosis: {row.diagnosticCodeSnapshot ?? 'Not recorded'}
                  </p>
                  <p>
                    Authorization:{' '}
                    {row.authorizationIdSnapshot ??
                      (row.svbProcedure.requiresAuthorization
                        ? 'Required; not recorded'
                        : 'Not required')}
                  </p>
                  {row.authorizationItem ? (
                    <p>
                      Remaining:{' '}
                      {row.authorizationItem.remainingQuantity ?? 'Unlimited'}
                    </p>
                  ) : null}
                  <p>
                    TreatmentId: {row.treatmentIdSnapshot ?? 'Not recorded'}
                  </p>
                  <p>Insured ID: {row.insuredIdSnapshot}</p>
                </div>
              ),
            },
            {
              key: 'actions',
              header: 'Actions',
              render: (row) =>
                encounter.status === 'OPEN' && row.status === 'PERFORMED' ? (
                  <PermissionGuard allOf={['procedure.update']}>
                    <div className="flex">
                      <Button
                        title="Edit procedure"
                        aria-label={`Edit procedure ${row.procedureCodeSnapshot}`}
                        variant="ghost"
                        onClick={() => setEditing(row)}
                      >
                        <Pencil size={16} />
                      </Button>
                      <Button
                        title="Remove procedure"
                        aria-label={`Remove procedure ${row.procedureCodeSnapshot}`}
                        variant="ghost"
                        onClick={() => {
                          remove.reset()
                          setRemoving(row)
                        }}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </PermissionGuard>
                ) : (
                  <span className="text-xs text-slate-500">Read only</span>
                ),
            },
          ]}
        />
      )}
      {editing && encounter.status === 'OPEN' ? (
        <ProcedureForm
          encounter={encounter}
          initial={editing}
          insurance={insurance}
          serviceDate={serviceDate}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null)
            setNotice('Procedure saved.')
            await refresh()
          }}
        />
      ) : null}
      {removing && encounter.status === 'OPEN' ? (
        <ClinicalConfirm
          title="Remove performed procedure?"
          description="This permanently removes the procedure record and releases its authorization usage. It cannot be restored here. Billed records cannot be removed."
          onClose={() => setRemoving(null)}
          onConfirm={() => remove.mutate()}
          pending={remove.isPending}
          error={remove.error}
        />
      ) : null}
    </ClinicalSection>
  )
}
const updateSchema = z.object({
  diagnosisId: z.string(),
  additionalNote: notesSchema,
})
const createSchema = updateSchema.extend({
  patientInsuranceId: entityIdSchema,
  quantity: positiveQuantitySchema,
  authorizationItemId: z.string(),
})
type UpdateValues = z.infer<typeof updateSchema>
type CreateValues = z.infer<typeof createSchema>
function ProcedureForm({
  encounter,
  initial,
  insurance,
  serviceDate,
  onClose,
  onSaved,
}: {
  encounter: ClinicalEncounter
  initial: EncounterProcedure | 'new'
  insurance: PatientInsurance[]
  serviceDate: string
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const { permissions } = useAuth()
  const [selected, setSelected] = useState<SvbProcedure | null>(null)
  const pending = useIsMutating() > 0
  const diagnoses = useQuery({
    queryKey: encounterKeys.diagnoses(encounter.id),
    queryFn: ({ signal }) => listDiagnoses(encounter.id, signal),
    enabled: hasPermission(permissions, 'diagnosis.read'),
  })
  return (
    <Dialog
      open
      size="wide"
      title={
        initial === 'new'
          ? 'Add performed procedure'
          : 'Edit performed procedure'
      }
      description="Clinical procedure record. Tariffs and coverage are validated by the backend."
      onOpenChange={(open) => {
        if (!open && !pending) onClose()
      }}
    >
      {initial === 'new' ? (
        selected ? (
          <CreateProcedureForm
            encounter={encounter}
            selected={selected}
            insurance={insurance}
            serviceDate={serviceDate}
            diagnoses={diagnoses.data ?? []}
            onClose={onClose}
            onSaved={onSaved}
          />
        ) : (
          <CatalogueSearch
            kind="procedure"
            serviceDate={serviceDate}
            onSelect={(row) => {
              if ('requiresAuthorization' in row) setSelected(row)
            }}
          />
        )
      ) : (
        <UpdateProcedureForm
          encounter={encounter}
          procedure={initial}
          diagnoses={diagnoses.data ?? []}
          onClose={onClose}
          onSaved={onSaved}
        />
      )}
      {hasPermission(permissions, 'diagnosis.read') && diagnoses.isError ? (
        <MutationError error={diagnoses.error} />
      ) : null}
    </Dialog>
  )
}
type DiagnosisOption = {
  id: string
  codeSnapshot: string
  descriptionSnapshot: string
}
function DiagnosisOptions({ diagnoses }: { diagnoses: DiagnosisOption[] }) {
  return (
    <>
      <option value="">No diagnosis selected</option>
      {diagnoses.map((row) => (
        <option key={row.id} value={row.id}>
          {row.codeSnapshot} - {row.descriptionSnapshot}
        </option>
      ))}
    </>
  )
}
function UpdateProcedureForm({
  encounter,
  procedure,
  diagnoses,
  onClose,
  onSaved,
}: {
  encounter: ClinicalEncounter
  procedure: EncounterProcedure
  diagnoses: DiagnosisOption[]
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const form = useForm<UpdateValues>({
    resolver: zodResolver(updateSchema),
    defaultValues: {
      diagnosisId: procedure.diagnosisId ?? '',
      additionalNote: procedure.additionalNote ?? '',
    },
  })
  const mutation = useMutation({
    mutationFn: (values: UpdateValues) =>
      updateProcedure(encounter.id, procedure.id, {
        diagnosisId: values.diagnosisId || null,
        additionalNote: values.additionalNote || null,
      }),
    onSuccess: onSaved,
  })
  return (
    <form
      className="space-y-4"
      onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
    >
      <p className="font-medium">
        {procedure.procedureCodeSnapshot}{' '}
        {procedure.procedureDescriptionSnapshot}
      </p>
      <PermissionGuard allOf={['diagnosis.read']}>
        <FormField label="Procedure diagnosis" htmlFor="procedure-diagnosis">
          <Select id="procedure-diagnosis" {...form.register('diagnosisId')}>
            <DiagnosisOptions diagnoses={diagnoses} />
          </Select>
        </FormField>
      </PermissionGuard>
      <FormField
        label="Procedure notes"
        htmlFor="procedure-notes"
        error={form.formState.errors.additionalNote?.message}
      >
        <Textarea id="procedure-notes" {...form.register('additionalNote')} />
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
          {mutation.isPending ? 'Saving...' : 'Save procedure'}
        </Button>
      </div>
    </form>
  )
}
function CreateProcedureForm({
  encounter,
  selected,
  insurance,
  serviceDate,
  diagnoses,
  onClose,
  onSaved,
}: {
  encounter: ClinicalEncounter
  selected: SvbProcedure
  insurance: PatientInsurance[]
  serviceDate: string
  diagnoses: DiagnosisOption[]
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const { permissions } = useAuth()
  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      patientInsuranceId: '',
      quantity: '',
      diagnosisId: '',
      authorizationItemId: '',
      additionalNote: '',
    },
  })
  const insuranceId = useWatch({
    control: form.control,
    name: 'patientInsuranceId',
  })
  const authorizationItemId = useWatch({
    control: form.control,
    name: 'authorizationItemId',
  })
  const canReadTariff = hasPermission(permissions, 'svb_tariff.read')
  const tariff = useQuery({
    queryKey: catalogueKeys.tariff(selected.id, serviceDate),
    queryFn: ({ signal }) => getTariff(selected.id, serviceDate, signal),
    enabled: canReadTariff,
  })
  const mutation = useMutation({
    mutationFn: (values: CreateValues) =>
      addProcedure(encounter.id, {
        svbProcedureId: selected.id,
        patientInsuranceId: values.patientInsuranceId,
        quantity: values.quantity,
        diagnosisId: values.diagnosisId || null,
        authorizationItemId: values.authorizationItemId || null,
        additionalNote: values.additionalNote || null,
      }),
    onSuccess: onSaved,
  })
  return (
    <form
      className="space-y-4"
      onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
    >
      <div>
        <p className="font-medium">
          {selected.code} {selected.description}
        </p>
        <p className="text-sm text-slate-500">Service date: {serviceDate}</p>
        {canReadTariff ? (
          tariff.isPending ? (
            <p role="status">Loading tariff...</p>
          ) : tariff.isError ? (
            <>
              <MutationError error={tariff.error} />
              <Button variant="secondary" onClick={() => void tariff.refetch()}>
                Retry tariff
              </Button>
            </>
          ) : (
            <p className="mt-2 font-mono">
              Tariff: {tariff.data.tariff.currencyCode}{' '}
              {tariff.data.tariff.amount}
            </p>
          )
        ) : (
          <p className="text-sm text-slate-500">
            Tariff preview unavailable with your permissions.
          </p>
        )}
        {selected.requiresAuthorization ? (
          <StatusBadge tone="warning">Authorization required</StatusBadge>
        ) : null}
        {selected.requiresReferral ? (
          <p className="text-sm text-amber-700">
            Referral required by catalogue.
          </p>
        ) : null}
      </div>
      <FormField
        label="Procedure insurance"
        htmlFor="procedure-insurance"
        error={form.formState.errors.patientInsuranceId?.message}
      >
        <Select
          id="procedure-insurance"
          {...form.register('patientInsuranceId', {
            onChange: () => form.setValue('authorizationItemId', ''),
          })}
        >
          <option value="">Select insurance</option>
          {insurance.map((row) => (
            <option key={row.id} value={row.id}>
              {row.payer.name} - {row.insuredId} ({clinicalLabel(row.status)})
            </option>
          ))}
        </Select>
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Quantity"
          htmlFor="procedure-quantity"
          error={form.formState.errors.quantity?.message}
        >
          <Input
            id="procedure-quantity"
            inputMode="decimal"
            {...form.register('quantity')}
          />
        </FormField>
        <PermissionGuard allOf={['diagnosis.read']}>
          <FormField label="Procedure diagnosis" htmlFor="procedure-diagnosis">
            <Select id="procedure-diagnosis" {...form.register('diagnosisId')}>
              <DiagnosisOptions diagnoses={diagnoses} />
            </Select>
          </FormField>
        </PermissionGuard>
      </div>
      {insuranceId ? (
        <PermissionGuard
          allOf={['authorization.read']}
          fallback={
            selected.requiresAuthorization ? (
              <p className="text-sm text-amber-700">
                Authorization selection requires additional permission.
              </p>
            ) : null
          }
        >
          <AuthorizationPicker
            key={insuranceId}
            patientId={encounter.patient.id}
            insuranceId={insuranceId}
            procedureId={selected.id}
            value={authorizationItemId}
            onChange={(value) => form.setValue('authorizationItemId', value)}
          />
        </PermissionGuard>
      ) : null}
      <FormField
        label="Procedure notes"
        htmlFor="procedure-notes"
        error={form.formState.errors.additionalNote?.message}
      >
        <Textarea id="procedure-notes" {...form.register('additionalNote')} />
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
        <Button
          type="submit"
          disabled={
            mutation.isPending ||
            (selected.requiresAuthorization && !authorizationItemId) ||
            (canReadTariff && !tariff.isSuccess)
          }
        >
          {mutation.isPending ? 'Saving...' : 'Save procedure'}
        </Button>
      </div>
    </form>
  )
}
function AuthorizationPicker({
  patientId,
  insuranceId,
  procedureId,
  value,
  onChange,
}: {
  patientId: string
  insuranceId: string
  procedureId: string
  value: string
  onChange: (value: string) => void
}) {
  const search = useSearch()
  const query = useQuery({
    queryKey: authorizationKeys.list(patientId, search.page, search.q),
    queryFn: ({ signal }) =>
      listAuthorizations(patientId, search.page, search.q, signal),
  })
  const options =
    query.data?.data
      .filter((row) => row.patientInsuranceId === insuranceId)
      .flatMap((row) =>
        row.items
          .filter(
            (item) =>
              item.svbProcedureId === null ||
              item.svbProcedureId === procedureId,
          )
          .map((item) => ({
            id: item.id,
            label: `${row.authorizationId} - ${clinicalLabel(row.status)} - remaining ${item.remainingQuantity ?? 'unlimited'}`,
          })),
      ) ?? []
  return (
    <div className="space-y-3">
      <FormField label="Find authorization" htmlFor="procedure-auth-search">
        <Input
          id="procedure-auth-search"
          maxLength={120}
          value={search.text}
          onChange={(e) => {
            search.setText(e.target.value)
            onChange('')
          }}
        />
      </FormField>
      <FormField label="Authorization item" htmlFor="procedure-authorization">
        <Select
          id="procedure-authorization"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={query.isFetching || search.settling}
        >
          <option value="">Select authorization item</option>
          {options.map((row) => (
            <option key={row.id} value={row.id}>
              {row.label}
            </option>
          ))}
        </Select>
      </FormField>
      <MutationError error={query.error} />
      {query.isError ? (
        <Button variant="secondary" onClick={() => void query.refetch()}>
          Retry authorizations
        </Button>
      ) : null}
      <Pager
        page={search.page}
        meta={query.data?.meta}
        disabled={query.isFetching || search.settling}
        onChange={(page) => {
          search.setPage(page)
          onChange('')
        }}
      />
    </div>
  )
}
