import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { getApiErrorMessage } from '../../api'
import { useAuth } from '../../auth/use-auth'
import { hasPermission } from '../../auth/permissions'
import { PermissionGuard } from '../../auth/permission-guard'
import { PageHeader } from '../../components/app-shell/page-header'
import { ErrorState } from '../../components/feedback/error-state'
import { LoadingState } from '../../components/feedback/loading-state'
import { FormField } from '../../components/forms/form-field'
import { UnsavedChanges } from '../../components/forms/unsaved-changes'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Textarea } from '../../components/ui/textarea'
import { ConfirmDialog } from '../../components/ui/confirm-dialog'
import type { OrganizationSettings, OrganizationPatch } from '../../types/administration'
import { AccessDeniedPage } from '../auth/access-denied-page'
import { invoiceKeys } from '../billing/billing-api'
import { dashboardKeys } from '../dashboard/dashboard-api'
import { declarationKeys } from '../declarations/declaration-api'
import { getOrganization, updateOrganization, organizationKeys } from './administration-api'
import { organizationSchema, type OrganizationValues } from './administration-model'

const fields = ['legalName', 'tradeName', 'declarantId', 'email', 'phone'] as const
const labels = { legalName: 'Legal name', tradeName: 'Trade name', declarantId: 'Declarant ID', email: 'Email', phone: 'Phone' }
const defaults = (record: OrganizationSettings): OrganizationValues => ({ legalName: record.legalName, tradeName: record.tradeName ?? '', declarantId: record.declarantId ?? '', email: record.email ?? '', phone: record.phone ?? '', reason: '' })

export function AdminSettingsPage() {
  const { permissions } = useAuth()
  const allowed = hasPermission(permissions, 'organization.read')
  const query = useQuery({ queryKey: organizationKeys.all, queryFn: ({ signal }) => getOrganization(signal), enabled: allowed })
  return <PermissionGuard allOf={['organization.read']} fallback={<AccessDeniedPage />}>
    <div className="mx-auto max-w-4xl"><PageHeader title="Settings" description="Organization configuration" />
      {query.isPending ? <LoadingState label="Loading organization" /> : query.isError ? <ErrorState title="Unable to load organization" description={getApiErrorMessage(query.error)} onRetry={() => void query.refetch()} /> : <OrganizationForm initial={query.data} />}
    </div>
  </PermissionGuard>
}

function OrganizationForm({ initial }: { initial: OrganizationSettings }) {
  const { permissions } = useAuth()
  const canEdit = hasPermission(permissions, 'organization.update')
  const client = useQueryClient()
  const [baseline, setBaseline] = useState(initial)
  const [comparison, setComparison] = useState<OrganizationSettings | null>(null)
  const [identityChange, setIdentityChange] = useState<OrganizationValues | null>(null)
  const [discard, setDiscard] = useState(false)
  const [notice, setNotice] = useState('')
  const form = useForm<OrganizationValues>({ resolver: zodResolver(organizationSchema), defaultValues: defaults(initial) })
  const values = useWatch({ control: form.control })
  const changed = fields.some((key) => (values[key] ?? '').trim() !== (baseline[key] ?? ''))
  const mutation = useMutation({ mutationFn: (input: OrganizationValues) => {
    const patch: OrganizationPatch = { expectedRevision: baseline.revision, reason: input.reason }
    for (const key of fields) if (input[key] !== (baseline[key] ?? '')) Object.assign(patch, { [key]: key === 'legalName' ? input[key] : input[key] || null })
    return updateOrganization(patch)
  }, onSuccess: async (updated) => {
    setBaseline(updated); setComparison(null); setIdentityChange(null); form.reset(defaults(updated)); setNotice('Organization settings saved.')
    client.setQueryData(organizationKeys.all, updated)
    await Promise.all([client.invalidateQueries({ queryKey: organizationKeys.all }), client.invalidateQueries({ queryKey: invoiceKeys.lists() }), client.invalidateQueries({ queryKey: declarationKeys.lists() }), client.invalidateQueries({ queryKey: dashboardKeys.all })])
  } })
  const submit = (input: OrganizationValues) => {
    setNotice(''); mutation.reset()
    if (input.declarantId !== (baseline.declarantId ?? '')) setIdentityChange(input)
    else mutation.mutate(input)
  }
  return <>
    <UnsavedChanges active={canEdit && form.formState.isDirty && !mutation.isPending} />
    <p className="mb-4 text-sm text-slate-600">Changes apply to this organization. Existing invoice and declaration snapshots remain unchanged.</p>
    <p className="mb-4 text-sm">Business timezone: {baseline.timezone}</p>
    <form className="space-y-4 rounded-lg border border-clinic-border bg-white p-4" onSubmit={form.handleSubmit(submit)}>
      <fieldset disabled={!canEdit || mutation.isPending} className="grid gap-4 sm:grid-cols-2">
        {fields.map((key) => <FormField key={key} label={labels[key]} htmlFor={`organization-${key}`} error={form.formState.errors[key]?.message} hint={key === 'declarantId' ? '1–5 digits. Leading zeros are retained. Empty means not configured.' : undefined}><Input id={`organization-${key}`} maxLength={key === 'email' ? 320 : key === 'phone' ? 40 : key === 'declarantId' ? 5 : 200} {...form.register(key)} /></FormField>)}
      </fieldset>
      {canEdit ? <FormField label="Reason for change" htmlFor="organization-reason" error={form.formState.errors.reason?.message}><Textarea id="organization-reason" maxLength={500} disabled={mutation.isPending} {...form.register('reason')} /></FormField> : <p className="text-sm text-slate-500">Organization settings are read only with your permissions.</p>}
      {mutation.error ? <div role="alert" className="space-y-2 text-sm text-clinic-danger"><p>{getApiErrorMessage(mutation.error)}</p><Button variant="secondary" disabled={mutation.isPending} onClick={() => { void getOrganization().then(setComparison).catch(() => setNotice('Unable to reload organization. Your edits have been retained.')) }}>Compare current settings</Button></div> : null}
      {notice ? <p role="status" className="text-sm">{notice}</p> : null}
      {canEdit ? <div className="flex flex-wrap justify-end gap-2"><Button variant="secondary" disabled={!form.formState.isDirty || mutation.isPending} onClick={() => setDiscard(true)}>Discard changes</Button><Button type="submit" disabled={!changed || mutation.isPending}>{mutation.isPending ? 'Saving...' : 'Save settings'}</Button></div> : null}
    </form>
    {comparison ? <section aria-label="Current server settings" className="mt-4 rounded-lg border border-clinic-border bg-white p-4"><h2 className="mb-3 font-semibold">Current server settings</h2><dl>{fields.map((key) => <div className="mb-2" key={key}><dt className="text-sm text-slate-500">{labels[key]}</dt><dd>{comparison[key] ?? 'Not configured'}</dd></div>)}</dl><p className="mb-3 text-sm">Your edits are still in the form. Loading this revision discards them; it does not save automatically.</p><Button variant="secondary" onClick={() => setDiscard(true)}>Use current settings</Button></section> : null}
    <ConfirmDialog open={discard} title="Discard unsaved changes?" description="Replace your edits with the displayed server settings. Nothing will be saved." confirmLabel="Discard changes" onCancel={() => setDiscard(false)} onConfirm={() => { const source = comparison ?? baseline; setBaseline(source); form.reset(defaults(source)); setComparison(null); mutation.reset(); setDiscard(false) }} />
    <ConfirmDialog open={Boolean(identityChange)} title="Change Declarant ID?" description={`Change the organization Declarant ID from ${baseline.declarantId ?? 'not configured'} to ${identityChange?.declarantId || 'not configured'}? Existing signed content will retain its original identity.`} confirmLabel="Confirm settings change" pending={mutation.isPending} error={mutation.error ? getApiErrorMessage(mutation.error) : undefined} onCancel={() => setIdentityChange(null)} onConfirm={() => { if (identityChange && !mutation.isPending) mutation.mutate(identityChange) }} />
  </>
}
