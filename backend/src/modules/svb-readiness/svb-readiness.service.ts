import { AppError } from "../../shared/errors/app-error.js";
import { env } from "../../config/env.js";

export function assertManualSvbRecordingEnabled() {
  if (!env.SVB_MANUAL_RECORDING_ENABLED)
    throw new AppError(
      409,
      "SVB_PRESENTATION_DEFERRED",
      "SVB submission pending — file specification not confirmed.",
    );
}

export type SvbPresentationPurpose = "TECHNICAL" | "REAL_SVB";
export const realSvbBlockerCodes = [
  "SVB_SOURCE_RULES_NOT_CONFIGURED",
  "SVB_DESTINATION_FORMAT_NOT_VERIFIED",
] as const;

// No source sheet or portal format has been approved. This is an explicit empty
// pilot, not a fallback catalogue. Enabling it requires a subsequent source-based
// implementation; callers cannot override it with an ID, env flag or a snapshot.
export function realSvbPresentationReadiness() {
  return {
    status: "BLOCKED" as const,
    realSubmissionEnabled: false as const,
    issues: [
      { field: "SourceSheet" as const, code: realSvbBlockerCodes[0] },
      { field: "DestinationFormat" as const, code: realSvbBlockerCodes[1] },
    ],
  };
}

export function getSvbPilotReadiness() {
  return {
    contract: "NEG-FINAL-06" as const,
    manualPortalRecordingEnabled: env.SVB_MANUAL_RECORDING_ENABLED,
    manualEntryRequiresFile: false,
    ...realSvbPresentationReadiness(),
    sourceSheet: null,
    destinationFormat: null,
    enabledServiceCodes: [] as string[],
    enabledCaseTypes: [] as string[],
    unresolvedFields: [
      "NumberOfTreatments",
      "Assistance",
      "PoliClinic",
      "ReferralEvidence",
    ] as const,
  };
}

export function assertSvbPresentationPurpose(purpose: SvbPresentationPurpose) {
  if (purpose === "REAL_SVB") {
    throw new AppError(
      409,
      "SVB_REAL_PRESENTATION_NOT_ENABLED",
      "Real SVB presentation requires approved source rules and a verified destination format",
      realSvbPresentationReadiness(),
    );
  }
}

export function assertSupportedReferralFlow(requiresReferral: boolean) {
  if (requiresReferral) {
    throw new AppError(
      409,
      "SVB_REFERRAL_FLOW_NOT_SUPPORTED",
      "This service requires referral evidence; the authorized referral workflow is not configured",
    );
  }
}
