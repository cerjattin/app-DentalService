import type { AppointmentStatus } from './appointment'
import type { DecimalString, EntityId } from './core'

export type EncounterStatus = 'OPEN' | 'COMPLETED' | 'VOID'

export interface ClinicalEncounter {
  id: EntityId
  appointmentId: EntityId
  providerId: EntityId
  status: EncounterStatus
  startedAt: string
  completedAt: string | null
  chiefComplaint: string | null
  clinicalNotes: string | null
  appointment: {
    id: EntityId
    appointmentNumber: string
    scheduledStartAt: string
    scheduledEndAt: string
    status: AppointmentStatus
  }
  patient: {
    id: EntityId
    patientNumber: string
    firstName: string
    middleName: string | null
    lastName: string
    secondLastName: string | null
  }
  provider: {
    id: EntityId
    svbProviderId: string | null
    firstName: string
    lastName: string
    isActive: boolean
  }
  createdByUserId: EntityId
  createdAt: string
  updatedAt: string
}

export interface DiagnosisCode {
  id: EntityId
  codeSystem: string
  code: string
  description: string
  isActive: boolean
  validFrom: string | null
  validTo: string | null
  createdAt: string
  updatedAt: string
}

export interface EncounterDiagnosis {
  id: EntityId
  encounterId: EntityId
  diagnosisCodeId: EntityId
  isPrimary: boolean
  codeSnapshot: string
  descriptionSnapshot: string
  notes: string | null
  createdByUserId: EntityId
  createdAt: string
  diagnosisCode: DiagnosisCode
}

export interface SvbProcedure {
  id: EntityId
  code: string
  description: string
  category: string | null
  unit: string | null
  requiresAuthorization: boolean
  requiresReferral: boolean
  isActive: boolean
  validFrom: string | null
  validTo: string | null
  createdAt: string
  updatedAt: string
}

export interface SvbTariff {
  id: EntityId
  svbProcedureId: EntityId
  amount: DecimalString
  currencyCode: string
  validFrom: string | null
  validTo: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type AuthorizationStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'PARTIALLY_USED'
  | 'EXHAUSTED'
  | 'EXPIRED'
  | 'CANCELLED'

export interface AuthorizationItem {
  id: EntityId
  authorizationId: EntityId
  svbProcedureId: EntityId | null
  procedureCodeSnapshot: string | null
  authorizedQuantity: DecimalString | null
  usedQuantity: DecimalString
  remainingQuantity: DecimalString | null
  validFrom: string | null
  validTo: string | null
  notes: string | null
  svbProcedure?: {
    id: EntityId
    code: string
    description: string
    requiresAuthorization: boolean
  } | null
}

export interface Authorization {
  id: EntityId
  patientId: EntityId
  patientInsuranceId: EntityId
  authorizationId: string
  status: AuthorizationStatus
  validFrom: string | null
  validTo: string | null
  issuedAt: string | null
  notes: string | null
  createdByUserId: EntityId
  patient: { id: EntityId; patientNumber: string; firstName: string; lastName: string }
  patientInsurance: {
    id: EntityId
    insuredId: string
    status: string
    payer: { id: EntityId; code: string; name: string }
  }
  items: AuthorizationItem[]
  createdAt: string
  updatedAt: string
}

export interface EncounterProcedure {
  id: EntityId
  encounterId: EntityId
  patientInsuranceId: EntityId
  svbProcedureId: EntityId
  svbTariffId: EntityId
  authorizationItemId: EntityId | null
  diagnosisId: EntityId | null
  performedByProviderId: EntityId
  procedureCodeSnapshot: string
  procedureDescriptionSnapshot: string
  providerIdSnapshot: string | null
  insuredIdSnapshot: string
  unitTariffSnapshot: DecimalString
  currencyCodeSnapshot: string
  quantity: DecimalString
  amount: DecimalString
  authorizationIdSnapshot: string | null
  diagnosticCodeSnapshot: string | null
  treatmentIdSnapshot: string | null
  accidentFormNumberSnapshot: string | null
  numberOfTreatmentsSnapshot: string | null
  assistanceSnapshot: string | null
  policlinicSnapshot: string | null
  performedAt: string | null
  additionalNote: string | null
  status: string
  createdByUserId: EntityId
  createdAt: string
  updatedAt: string
  svbProcedure: Pick<SvbProcedure, 'id' | 'code' | 'description' | 'requiresAuthorization' | 'requiresReferral'>
  svbTariff: Pick<SvbTariff, 'id' | 'amount' | 'currencyCode' | 'validFrom' | 'validTo'>
  patientInsurance: {
    id: EntityId
    patientId: EntityId
    insuredId: string
    status: string
    validFrom: string | null
    validTo: string | null
    payer: { id: EntityId; code: string; name: string }
  }
  authorizationItem: {
    id: EntityId
    authorizationId: EntityId
    externalAuthorizationId: string
    status: AuthorizationStatus
    svbProcedureId: EntityId | null
    procedureCodeSnapshot: string | null
    authorizedQuantity: DecimalString | null
    usedQuantity: DecimalString
    remainingQuantity: DecimalString | null
    validFrom: string | null
    validTo: string | null
  } | null
  diagnosis: {
    id: EntityId
    codeSnapshot: string
    descriptionSnapshot: string
    isPrimary: boolean
  } | null
  performedByProvider: {
    id: EntityId
    svbProviderId: string | null
    firstName: string
    lastName: string
  }
}

export interface EncounterProcedureCreateDto {
  patientInsuranceId: EntityId
  svbProcedureId: EntityId
  authorizationItemId?: EntityId | null
  diagnosisId?: EntityId | null
  quantity: DecimalString
  additionalNote?: string | null
}
