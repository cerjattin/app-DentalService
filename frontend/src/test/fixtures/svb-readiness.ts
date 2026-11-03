import type { SvbPilotReadiness } from '../../types/svb-readiness'

export function syntheticReadiness(enabled = true): SvbPilotReadiness {
  return { contract: 'NEG-FINAL-06', status: 'BLOCKED', realSubmissionEnabled: false, manualPortalRecordingEnabled: enabled, manualEntryRequiresFile: false, sourceSheet: null, destinationFormat: null, enabledServiceCodes: [], enabledCaseTypes: [], unresolvedFields: ['NumberOfTreatments', 'Assistance'], issues: [{ field: 'SourceSheet', code: 'SVB_SOURCE_RULES_NOT_CONFIGURED' }, { field: 'DestinationFormat', code: 'SVB_DESTINATION_FORMAT_NOT_VERIFIED' }] }
}
