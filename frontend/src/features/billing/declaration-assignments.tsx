import { parseDeclarationAssignments } from './declaration-assignment-model'
import { Link } from 'react-router'
import { ApiError } from '../../api'
import { useAuth } from '../../auth/use-auth'
import { hasPermission } from '../../auth/permissions'

export function DeclarationAssignments({ error, invoiceId }: { error: unknown; invoiceId: string }) {
  const { permissions } = useAuth()
  if (!(error instanceof ApiError) || error.code !== 'INVOICE_DECLARATION_ASSIGNED' || !hasPermission(permissions, 'declaration.read')) return null
  const assignments = parseDeclarationAssignments(error.details)
  return assignments.length ? <section aria-label="Blocking declarations" className="space-y-3 rounded-md border border-clinic-border p-3 text-sm"><p>Resolve all active assignments before trying again. Resolving a declaration does not reopen clinical care.</p>{assignments.map((assignment) => <div key={assignment.declarationId}><p className="font-semibold">{assignment.declarationNumber ?? `Declaration ${assignment.declarationId}`} · {assignment.status}</p><p>{assignment.items.length} assigned item(s). {assignment.status === 'DRAFT' ? 'Remove every assigned line from this invoice, or cancel the whole draft if appropriate.' : 'This state cannot be changed through the Draft resolution workflow.'}</p><Link className="text-clinic-blue underline" to={`/declarations/${assignment.declarationId}?returnInvoiceId=${invoiceId}`}>Open declaration</Link></div>)}</section> : null
}
