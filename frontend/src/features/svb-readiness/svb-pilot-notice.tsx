import { getApiErrorMessage } from '../../api'
import { Button } from '../../components/ui/button'
import type { RealSvbPresentationReadiness } from '../../types/svb-readiness'
import { svbDeferredMessage, useSvbPilotReadiness } from './use-svb-pilot-readiness'

const blockerLabels: Record<string, string> = {
  SVB_SOURCE_RULES_NOT_CONFIGURED: 'Clinic-approved source and capture rules are not configured.',
  SVB_DESTINATION_FORMAT_NOT_VERIFIED: 'The destination file format has not been verified for the SVB portal.',
}

export function SvbPilotNotice({ readiness }: { readiness?: RealSvbPresentationReadiness | undefined }) {
  const query = useSvbPilotReadiness()
  const canRead = query.canRead
  const current = query.data ?? readiness
  return <section aria-label="Real SVB presentation" className="mb-3 rounded-md border border-clinic-border bg-slate-50 p-3 text-sm">
    <p className="mb-2 font-medium">{svbDeferredMessage}</p>
    {current?.status === 'BLOCKED' && current.realSubmissionEnabled === false ? <>
      <h3 className="font-medium">{query.data?.manualPortalRecordingEnabled ? 'Certified SVB file/API delivery blocked' : 'Real SVB presentation blocked'}</h3>
      <ul className="mt-1 space-y-1 text-slate-600">{current.issues.map((issue, index) => <li key={`${issue.code}-${index}`}>{Object.hasOwn(blockerLabels, issue.code) ? blockerLabels[issue.code] : 'An unresolved presentation requirement was reported by the server.'}</li>)}</ul>
    </> : <p className="font-medium">Real presentation status unavailable</p>}
    {query.data ? <div className="mt-2 space-y-1 text-slate-600">
      {query.canRecord && query.data.manualEntryRequiresFile === false ? <p>Synthetic QA manual recording is enabled without an upload file. This does not enable real SVB presentation.</p> : <p>New manual preparations and presentation records are unavailable. History and resolution of existing records remain available with permission.</p>}
      <p>Certified SVB services: {query.data.enabledServiceCodes.length ? query.data.enabledServiceCodes.join(', ') : 'None'}</p>
      <p>Certified SVB case types: {query.data.enabledCaseTypes.length ? query.data.enabledCaseTypes.join(', ') : 'None'}</p>
      {query.data.unresolvedFields.length ? <p>Unresolved requirements: {query.data.unresolvedFields.join(', ')}</p> : null}
    </div> : canRead && query.isPending ? <p role="status" className="mt-1 text-slate-600">Loading pilot scope...</p> : !canRead ? <p className="mt-1 text-slate-600">Viewing the approved service and case scope requires catalogue read permission.</p> : null}
    {query.error ? <div className="mt-2 text-clinic-danger" role="alert"><p>{getApiErrorMessage(query.error)}</p><Button variant="secondary" onClick={() => void query.refetch()}>Retry pilot status</Button></div> : null}
    <p className="mt-2 text-slate-600">Clinical workflows remain available according to permissions and supported service requirements. Technical checks and generated exports do not confirm acceptance by the SVB portal. No real presentation is performed here.</p>
  </section>
}
