import { apiFetch } from '../../api'
import { z } from 'zod'
import type { SvbPilotReadiness } from '../../types/svb-readiness'

export const svbReadinessKeys = { all: ['svb-pilot-readiness'] as const }
const pilotSchema = z.object({
  contract: z.literal('NEG-FINAL-06'), status: z.literal('BLOCKED'), realSubmissionEnabled: z.literal(false),
  manualPortalRecordingEnabled: z.boolean().optional(), manualEntryRequiresFile: z.boolean().optional(),
  sourceSheet: z.null(), destinationFormat: z.null(),
  enabledServiceCodes: z.array(z.string()), enabledCaseTypes: z.array(z.string()),
  unresolvedFields: z.array(z.enum(['NumberOfTreatments', 'Assistance', 'PoliClinic', 'ReferralEvidence'])),
  issues: z.array(z.object({ field: z.enum(['SourceSheet', 'DestinationFormat']), code: z.enum(['SVB_SOURCE_RULES_NOT_CONFIGURED', 'SVB_DESTINATION_FORMAT_NOT_VERIFIED']) })),
})
export const getSvbPilotReadiness = async (signal?: AbortSignal): Promise<SvbPilotReadiness> => pilotSchema.parse(await apiFetch<unknown>('/svb-pilot/readiness', { signal }))
