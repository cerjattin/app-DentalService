import { formatDateOnly } from "../../shared/utils/date-only.js";

import type {
  DiagnosisCodeRecord,
  EncounterDiagnosisRecord,
} from "./diagnosis.repository.js";

export function toDiagnosisCodeResponse(diagnosisCode: DiagnosisCodeRecord) {
  return {
    id: diagnosisCode.id.toString(),

    codeSystem: diagnosisCode.codeSystem,

    code: diagnosisCode.code,

    description: diagnosisCode.description,

    isActive: diagnosisCode.isActive,

    validFrom: formatDateOnly(diagnosisCode.validFrom),

    validTo: formatDateOnly(diagnosisCode.validTo),

    createdAt: diagnosisCode.createdAt.toISOString(),

    updatedAt: diagnosisCode.updatedAt.toISOString(),
  };
}

export function toEncounterDiagnosisResponse(
  encounterDiagnosis: EncounterDiagnosisRecord,
) {
  return {
    id: encounterDiagnosis.id.toString(),

    encounterId: encounterDiagnosis.encounterId.toString(),

    diagnosisCodeId: encounterDiagnosis.diagnosisCodeId.toString(),

    isPrimary: encounterDiagnosis.isPrimary,

    codeSnapshot: encounterDiagnosis.codeSnapshot,

    descriptionSnapshot: encounterDiagnosis.descriptionSnapshot,

    notes: encounterDiagnosis.notes,

    createdByUserId: encounterDiagnosis.createdByUserId.toString(),

    createdAt: encounterDiagnosis.createdAt.toISOString(),

    diagnosisCode: toDiagnosisCodeResponse(encounterDiagnosis.diagnosisCode),
  };
}
