import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Pencil, Plus } from 'lucide-react'
import { PermissionGuard } from '../../auth/permission-guard'
import { Button } from '../../components/ui/button'
import { Dialog } from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { Select } from '../../components/ui/select'
import { Textarea } from '../../components/ui/textarea'
import { FormField } from '../../components/forms/form-field'
import { LoadingState } from '../../components/feedback/loading-state'
import { StatusBadge } from '../../components/feedback/status-badge'
import type {
  Authorization,
  AuthorizationItem,
  AuthorizationUpdateDto,
} from '../../types/clinical'
import type { PatientInsurance } from '../../types/patient'
import { formatDateOnly } from '../patients/patient-formatters'
import {
  authorizationKeys,
  encounterKeys,
  createAuthorization,
  createAuthorizationItem,
  listAuthorizations,
  updateAuthorization,
  updateAuthorizationItem,
} from './clinical-api'
import { CatalogueSearch } from './catalogue-search'
import { ClinicalSection, MutationError, Pager } from './clinical-ui'
import {
  clinicalLabel,
  entityIdSchema,
  notesSchema,
  optionalDateSchema,
  quantitySchema,
  useSearch,
} from './clinical-model'

const schema = z.object({
  patientInsuranceId: entityIdSchema,
  authorizationId: z
    .string()
    .trim()
    .min(1, 'Enter the authorization reference.')
    .max(80),
  status: z.enum(['', 'PENDING', 'APPROVED', 'EXPIRED', 'CANCELLED']),
  validFrom: optionalDateSchema,
  validTo: optionalDateSchema,
  issuedAt: z.union([z.literal(''), z.iso.datetime({ offset: true })]),
  notes: notesSchema,
})
type Values = z.infer<typeof schema>
const itemSchema = z.object({
  authorizedQuantity: z.union([z.literal(''), quantitySchema]),
  validFrom: optionalDateSchema,
  validTo: optionalDateSchema,
  notes: notesSchema,
})
type ItemValues = z.infer<typeof itemSchema>

export function AuthorizationSection({
  patientId,
  encounterId,
  insurance,
  serviceDate,
  readOnly,
}: {
  patientId: string
  encounterId: string
  insurance: PatientInsurance[]
  serviceDate: string
  readOnly: boolean
}) {
  const client = useQueryClient()
  const search = useSearch()
  const query = useQuery({
    queryKey: authorizationKeys.list(patientId, search.page, search.q),
    queryFn: ({ signal }) =>
      listAuthorizations(patientId, search.page, search.q, signal),
  })
  const [editing, setEditing] = useState<Authorization | 'new' | null>(null)
  const [itemEdit, setItemEdit] = useState<{
    authorization: Authorization
    item?: AuthorizationItem
  } | null>(null)
  const [notice, setNotice] = useState('')
  const saved = async () => {
    setEditing(null)
    setItemEdit(null)
    setNotice('Authorization saved.')
    await client.invalidateQueries({
      queryKey: authorizationKeys.patient(patientId),
    })
    await client.invalidateQueries({
      queryKey: encounterKeys.procedures(encounterId),
    })
  }
  return (
    <ClinicalSection
      title="Authorizations"
      actions={
        !readOnly ? (
          <PermissionGuard allOf={['authorization.create', 'insurance.read']}>
            <Button
              variant="secondary"
              disabled={!insurance.length}
              onClick={() => setEditing('new')}
            >
              <Plus size={16} />
              Add authorization
            </Button>
          </PermissionGuard>
        ) : null
      }
    >
      <FormField label="Search authorizations" htmlFor="authorization-search">
        <Input
          id="authorization-search"
          maxLength={120}
          value={search.text}
          onChange={(e) => search.setText(e.target.value)}
        />
      </FormField>
      {notice ? (
        <p role="status" className="mt-3 text-sm text-green-700">
          {notice}
        </p>
      ) : null}
      {query.isPending ? (
        <LoadingState label="Loading authorizations" />
      ) : query.isError ? (
        <>
          <MutationError error={query.error} />
          <Button onClick={() => void query.refetch()}>Retry</Button>
        </>
      ) : (
        <>
          {query.data.data.length === 0 ? (
            <p className="py-4 text-sm text-slate-500">
              No authorizations found.
            </p>
          ) : (
            query.data.data.map((row) => (
              <details
                key={row.id}
                className="border-b border-clinic-border py-3"
              >
                <summary className="cursor-pointer py-2 text-sm font-medium">
                  {row.authorizationId}{' '}
                  <StatusBadge>{clinicalLabel(row.status)}</StatusBadge>
                  <span className="ml-2 text-slate-500">
                    {row.patientInsurance.insuredId}
                  </span>
                </summary>
                <div className="space-y-3 py-3">
                  <p className="text-sm text-slate-500">
                    {row.patientInsurance.payer.name} ·{' '}
                    {formatDateOnly(row.validFrom)} -{' '}
                    {formatDateOnly(row.validTo)}
                  </p>
                  <p className="whitespace-pre-wrap break-words text-sm">
                    {row.notes}
                  </p>
                  {!readOnly ? (
                    <PermissionGuard allOf={['authorization.update']}>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => setEditing(row)}
                        >
                          <Pencil size={16} />
                          Edit authorization
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => setItemEdit({ authorization: row })}
                        >
                          <Plus size={16} />
                          Add authorization item
                        </Button>
                      </div>
                    </PermissionGuard>
                  ) : null}
                  {row.items.map((item) => (
                    <div
                      className="flex flex-wrap items-start justify-between gap-3 border-t border-clinic-border py-3"
                      key={item.id}
                    >
                      <div className="text-sm">
                        <p className="font-medium">
                          {item.procedureCodeSnapshot ?? 'Any procedure'}
                        </p>
                        <p>
                          Authorized: {item.authorizedQuantity ?? 'Unlimited'} ·
                          Used: {item.usedQuantity} · Remaining:{' '}
                          {item.remainingQuantity ?? 'Unlimited'}
                        </p>
                        <p className="text-slate-500">
                          {formatDateOnly(item.validFrom)} -{' '}
                          {formatDateOnly(item.validTo)}
                        </p>
                        <p className="whitespace-pre-wrap break-words">
                          {item.notes}
                        </p>
                      </div>
                      {!readOnly ? (
                        <PermissionGuard allOf={['authorization.update']}>
                          <Button
                            variant="ghost"
                            aria-label={`Edit authorization item ${item.id}`}
                            title="Edit authorization item"
                            onClick={() =>
                              setItemEdit({ authorization: row, item })
                            }
                          >
                            <Pencil size={16} />
                          </Button>
                        </PermissionGuard>
                      ) : null}
                    </div>
                  ))}
                </div>
              </details>
            ))
          )}
          <Pager
            page={search.page}
            meta={query.data.meta}
            onChange={search.setPage}
            disabled={query.isFetching || search.settling}
          />
        </>
      )}
      {editing && !readOnly ? (
        <AuthorizationForm
          initial={editing}
          patientId={patientId}
          insurance={insurance}
          onClose={() => setEditing(null)}
          onSaved={saved}
        />
      ) : null}
      {itemEdit && !readOnly ? (
        <AuthorizationItemForm
          {...itemEdit}
          serviceDate={serviceDate}
          onClose={() => setItemEdit(null)}
          onSaved={saved}
        />
      ) : null}
    </ClinicalSection>
  )
}
function AuthorizationForm({
  initial,
  patientId,
  insurance,
  onClose,
  onSaved,
}: {
  initial: Authorization | 'new'
  patientId: string
  insurance: PatientInsurance[]
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const existing = initial === 'new' ? null : initial
  const editableStatus =
    existing &&
    ['PENDING', 'APPROVED', 'EXPIRED', 'CANCELLED'].includes(existing.status)
      ? (existing.status as Values['status'])
      : ''
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      patientInsuranceId: existing?.patientInsuranceId ?? '',
      authorizationId: existing?.authorizationId ?? '',
      status: existing ? editableStatus : 'PENDING',
      validFrom: existing?.validFrom ?? '',
      validTo: existing?.validTo ?? '',
      issuedAt: existing?.issuedAt ?? '',
      notes: existing?.notes ?? '',
    },
  })
  const mutation = useMutation({
    mutationFn: (values: Values) => {
      const body: AuthorizationUpdateDto = {
        ...(values.status ? { status: values.status } : {}),
        validFrom: values.validFrom || null,
        validTo: values.validTo || null,
        issuedAt: values.issuedAt || null,
        notes: values.notes || null,
      }
      return existing
        ? updateAuthorization(existing.id, body)
        : createAuthorization({
            ...body,
            patientId,
            patientInsuranceId: values.patientInsuranceId,
            authorizationId: values.authorizationId,
          })
    },
    onSuccess: onSaved,
  })
  return (
    <Dialog
      open
      title={existing ? 'Edit authorization' : 'Add authorization'}
      description="Record the authorization supplied by the payer."
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose()
      }}
    >
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
      >
        {!existing ? (
          <>
            <FormField
              label="Insurance"
              htmlFor="auth-insurance"
              error={form.formState.errors.patientInsuranceId?.message}
            >
              <Select
                id="auth-insurance"
                {...form.register('patientInsuranceId')}
              >
                <option value="">Select insurance</option>
                {insurance.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.payer.name} - {row.insuredId}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField
              label="Authorization reference"
              htmlFor="auth-reference"
              error={form.formState.errors.authorizationId?.message}
            >
              <Input
                id="auth-reference"
                {...form.register('authorizationId')}
              />
            </FormField>
          </>
        ) : (
          <p className="text-sm font-medium">{existing.authorizationId}</p>
        )}
        <FormField label="Authorization status" htmlFor="auth-status">
          <Select id="auth-status" {...form.register('status')}>
            {existing ? (
              <option value="">
                Keep current status ({clinicalLabel(existing.status)})
              </option>
            ) : null}
            {['PENDING', 'APPROVED', 'EXPIRED', 'CANCELLED'].map((value) => (
              <option key={value} value={value}>
                {clinicalLabel(value)}
              </option>
            ))}
          </Select>
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          {(['validFrom', 'validTo'] as const).map((key) => (
            <FormField
              key={key}
              label={key === 'validFrom' ? 'Valid from' : 'Valid to'}
              htmlFor={`auth-${key}`}
              error={form.formState.errors[key]?.message}
            >
              <Input id={`auth-${key}`} type="date" {...form.register(key)} />
            </FormField>
          ))}
        </div>
        <FormField
          label="Issued at (ISO timestamp with timezone, optional)"
          htmlFor="auth-issued"
          error={form.formState.errors.issuedAt?.message}
        >
          <Input id="auth-issued" {...form.register('issuedAt')} />
        </FormField>
        <FormField
          label="Authorization notes"
          htmlFor="auth-notes"
          error={form.formState.errors.notes?.message}
        >
          <Textarea id="auth-notes" {...form.register('notes')} />
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
            {mutation.isPending ? 'Saving...' : 'Save authorization'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
function AuthorizationItemForm({
  authorization,
  item,
  serviceDate,
  onClose,
  onSaved,
}: {
  authorization: Authorization
  item?: AuthorizationItem
  serviceDate: string
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [selection, setSelection] = useState<{
    id: string
    code: string
  } | null>(
    item?.svbProcedureId
      ? {
          id: item.svbProcedureId,
          code: item.procedureCodeSnapshot ?? item.svbProcedureId,
        }
      : null,
  )
  const [choosing, setChoosing] = useState(false)
  const used = item ? /[1-9]/.test(item.usedQuantity) : false
  const form = useForm<ItemValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      authorizedQuantity: item?.authorizedQuantity ?? '',
      validFrom: item?.validFrom ?? '',
      validTo: item?.validTo ?? '',
      notes: item?.notes ?? '',
    },
  })
  const mutation = useMutation({
    mutationFn: (values: ItemValues) => {
      const body = {
        ...(!used ? { svbProcedureId: selection?.id ?? null } : {}),
        authorizedQuantity: values.authorizedQuantity || null,
        validFrom: values.validFrom || null,
        validTo: values.validTo || null,
        notes: values.notes || null,
      }
      return item
        ? updateAuthorizationItem(authorization.id, item.id, body)
        : createAuthorizationItem(authorization.id, body)
    },
    onSuccess: onSaved,
  })
  return (
    <Dialog
      open
      title={item ? 'Edit authorization item' : 'Add authorization item'}
      description={authorization.authorizationId}
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose()
      }}
    >
      {choosing ? (
        <CatalogueSearch
          kind="procedure"
          serviceDate={serviceDate}
          onSelect={(row) => {
            setSelection(row)
            setChoosing(false)
          }}
        />
      ) : (
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <p className="text-sm">
            Procedure: {selection?.code ?? 'Any procedure'}
          </p>
          {!used ? (
            <PermissionGuard allOf={['svb_procedure.read']}>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setChoosing(true)}>
                  Select procedure
                </Button>
                <Button variant="ghost" onClick={() => setSelection(null)}>
                  Any procedure
                </Button>
              </div>
            </PermissionGuard>
          ) : null}
          <FormField
            label="Authorized quantity (empty for unlimited)"
            htmlFor="item-quantity"
            error={form.formState.errors.authorizedQuantity?.message}
          >
            <Input
              id="item-quantity"
              inputMode="decimal"
              {...form.register('authorizedQuantity')}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            {(['validFrom', 'validTo'] as const).map((key) => (
              <FormField
                key={key}
                label={
                  key === 'validFrom' ? 'Item valid from' : 'Item valid to'
                }
                htmlFor={`item-${key}`}
                error={form.formState.errors[key]?.message}
              >
                <Input id={`item-${key}`} type="date" {...form.register(key)} />
              </FormField>
            ))}
          </div>
          <FormField
            label="Item notes"
            htmlFor="item-notes"
            error={form.formState.errors.notes?.message}
          >
            <Textarea id="item-notes" {...form.register('notes')} />
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
              {mutation.isPending ? 'Saving...' : 'Save item'}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  )
}
