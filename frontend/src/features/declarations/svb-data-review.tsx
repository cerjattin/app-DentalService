import { Button } from '../../components/ui/button'
import { Dialog } from '../../components/ui/dialog'
import type { DeclarationCandidate, DeclarationItem } from '../../types/declaration'
import { svbFieldGuidance, svbIssueDescription } from './svb-data-guidance'

export function SvbIssueList({ issues }: { issues: DeclarationCandidate['issues'] }) {
  if (!issues.length) return null
  return <ul aria-label="SVB snapshot issues" className="mt-2 space-y-2 text-xs">{issues.map((issue, index) => <li key={`${issue.field}-${index}`}>
    <p className="font-medium text-clinic-danger">{issue.field}: {svbIssueDescription(issue.code)}</p>
    <p className="mt-0.5 text-slate-600">{Object.hasOwn(svbFieldGuidance, issue.field) ? svbFieldGuidance[issue.field] : 'Review the source record through the authorized correction workflow.'}</p>
  </li>)}</ul>
}

export function DeclarationSnapshotReview({ item, onClose }: { item: DeclarationItem; onClose: () => void }) {
  const fields = [
    ['Declarant ID', item.declarantIdSnapshot], ['Invoice number', item.invoiceNumberSnapshot],
    ['Detail invoice number', item.detailInvoiceNumberSnapshot], ['Provider SVB ID', item.providerIdSnapshot],
    ['Service date', item.serviceDateSnapshot], ['Insured ID', item.insuredIdSnapshot],
    ['External treatment ID', item.treatmentIdSnapshot], ['Accident form number', item.accidentFormNumberSnapshot],
    ['Authorization reference', item.authorizationIdSnapshot], ['Diagnosis code', item.diagnosticCodeSnapshot],
    ['Amount', item.amountSnapshot], ['Number of treatments', item.numberOfTreatmentsSnapshot],
    ['Assistance', item.assistanceSnapshot], ['Referrer ID', item.referrerIdSnapshot],
    ['Policlinic', item.policlinicSnapshot], ['Additional note', item.additionalNoteSnapshot],
  ] as const
  return <Dialog open size="wide" title={`SVB snapshot — line ${item.sequenceNumber}`} description="Frozen declaration values from the invoice version. These values cannot be edited here." onOpenChange={(open) => { if (!open) onClose() }}>
    <p className="mb-4 text-sm text-slate-600">Required fields and accepted values are checked when you validate the declaration. This view does not determine whether a service is enabled for the pilot.</p>
    <dl className="grid gap-3 sm:grid-cols-2">{fields.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-words whitespace-pre-wrap text-sm">{value === null || value === '' ? 'Not recorded' : value}</dd></div>)}</dl>
    <div className="mt-4 space-y-2 border-t border-clinic-border pt-3 text-sm text-slate-600">
      <p>{svbFieldGuidance.NumberOfTreatments} {svbFieldGuidance.Assistance}</p>
      <p>Correct source records for future captures. Existing invoice content requires the authorized correction workflow and a new signature. Changing a master record does not update this snapshot.</p>
    </div>
    <div className="mt-4 flex justify-end"><Button variant="secondary" onClick={onClose}>Close snapshot</Button></div>
  </Dialog>
}
