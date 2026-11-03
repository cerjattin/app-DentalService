export interface RealSvbPresentationReadiness {
  status: 'BLOCKED'
  realSubmissionEnabled: false
  issues: Array<{
    field: 'SourceSheet' | 'DestinationFormat'
    code: 'SVB_SOURCE_RULES_NOT_CONFIGURED' | 'SVB_DESTINATION_FORMAT_NOT_VERIFIED'
  }>
}

export interface SvbPilotReadiness extends RealSvbPresentationReadiness {
  contract: 'NEG-FINAL-06'
  manualPortalRecordingEnabled?: boolean
  manualEntryRequiresFile?: boolean
  sourceSheet: null
  destinationFormat: null
  enabledServiceCodes: string[]
  enabledCaseTypes: string[]
  unresolvedFields: Array<'NumberOfTreatments' | 'Assistance' | 'PoliClinic' | 'ReferralEvidence'>
}
