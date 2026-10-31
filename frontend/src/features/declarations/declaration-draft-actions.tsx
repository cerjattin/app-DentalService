import { zodResolver } from '@hookform/resolvers/zod'
import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { getApiErrorMessage } from '../../api'
import { useAuth } from '../../auth/use-auth'
import { hasPermission } from '../../auth/permissions'
import { Dialog } from '../../components/ui/dialog'
import { Button } from '../../components/ui/button'
import { Textarea } from '../../components/ui/textarea'
import { FormField } from '../../components/forms/form-field'
import type { Declaration, DeclarationItem } from '../../types/declaration'
import { cancelDraftDeclaration, declarationKeys, removeDeclarationItem } from './declaration-api'
import { refreshDeclarationResources } from './declaration-cache'
import { declarationReasonSchema } from './declaration-model'

export function DeclarationDraftAction({ declaration, item }: { declaration: Declaration; item?: DeclarationItem }) {
  const { permissions } = useAuth()
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const busy = useIsMutating({ mutationKey: ['declaration-write', declaration.id] }) > 0
  const form = useForm({ resolver: zodResolver(declarationReasonSchema), defaultValues: { reason: '' } })
  const mutation = useMutation({ mutationKey: ['declaration-write', declaration.id], mutationFn: ({ reason }: { reason: string }) => item ? removeDeclarationItem(declaration.id, item.id, reason) : cancelDraftDeclaration(declaration.id, reason), onSuccess: async (updated) => {
    client.setQueryData(declarationKeys.detail(updated.id), updated)
    client.setQueryData(declarationKeys.items(updated.id), updated.items)
    setOpen(false); form.reset()
    await refreshDeclarationResources(client, updated.id)
  } })
  if (declaration.status !== 'DRAFT' || !hasPermission(permissions, 'declaration.update')) return null
  const title = item ? 'Remove item' : 'Cancel draft declaration'
  return <>
    <Button variant={item ? 'secondary' : 'danger'} disabled={busy} aria-label={item ? `Remove item ${item.id}` : title} onClick={() => { mutation.reset(); form.reset({ reason: '' }); setOpen(true) }}>{title}</Button>
    {open ? <Dialog open title={title} description={item ? `Release declaration item ${item.id} (invoice item ${item.invoiceItemId}) from ${declaration.declarationNumber ?? declaration.id}, invoice ${item.invoiceNumberSnapshot}. The invoice, signature and documents are retained.` : `Cancel the entire draft ${declaration.declarationNumber ?? declaration.id}. Its number, items and snapshots remain in history. This does not transmit anything to SVB.`} onOpenChange={(next) => { if (!next && !mutation.isPending) { setOpen(false); form.reset(); mutation.reset() } }}>
      <form className="space-y-4" onSubmit={form.handleSubmit((v) => { if (!mutation.isPending) mutation.mutate(v) })}>
        <FormField label="Reason" htmlFor={`draft-reason-${item?.id ?? 'cancel'}`} error={form.formState.errors.reason?.message}><Textarea id={`draft-reason-${item?.id ?? 'cancel'}`} autoFocus maxLength={500} disabled={mutation.isPending} {...form.register('reason')} /></FormField>
        {mutation.error ? <div role="alert" className="text-sm text-clinic-danger"><p>{getApiErrorMessage(mutation.error)}</p><Button variant="secondary" onClick={() => void refreshDeclarationResources(client, declaration.id)}>Refresh declaration</Button></div> : null}
        <div className="flex justify-end gap-2"><Button variant="secondary" disabled={mutation.isPending} onClick={() => { setOpen(false); form.reset(); mutation.reset() }}>Keep draft</Button><Button type="submit" variant="danger" disabled={mutation.isPending}>{mutation.isPending ? 'Saving...' : title}</Button></div>
      </form>
    </Dialog> : null}
  </>
}
