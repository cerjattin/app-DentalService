import type { DecimalString, EntityId } from './core'
import type { AppointmentProvider } from './appointment'

export interface ClinicalEncounter {
  id: EntityId
  appointmentId: EntityId
  providerId: EntityId
  status: 'OPEN' | 'COMPLETED' | 'VOID'
  startedAt: string
  completedAt: string | null
  chiefComplaint: string | null
  clinicalNotes: string | null
  appointment: {
    id: EntityId
    appointmentNumber: string
    scheduledStartAt: string
    scheduledEndAt: string
    status: string
  }
  patient: {
    id: EntityId
    patientNumber: string
    firstName: string
    middleName: string | null
    lastName: string
    secondLastName: string | null
  }
  provider: AppointmentProvider
  createdByUserId: EntityId
  createdAt: string
  updatedAt: string
}
export interface EncounterWriteDto {
  chiefComplaint?: string | null
  clinicalNotes?: string | null
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
export interface DiagnosisWriteDto {
  diagnosisCodeId: EntityId
  isPrimary: boolean
  notes: string | null
}
export type DiagnosisUpdateDto = Pick<DiagnosisWriteDto, 'isPrimary' | 'notes'>
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
export interface TariffResolution {
  procedure: SvbProcedure
  tariff: SvbTariff
  serviceDate: string
}
export type AuthorizationStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'PARTIALLY_USED'
  | 'EXHAUSTED'
  | 'EXPIRED'
  | 'CANCELLED'
export type AuthorizationAdminStatus =
  'PENDING' | 'APPROVED' | 'EXPIRED' | 'CANCELLED'
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
  svbProcedure?: Pick<
    SvbProcedure,
    'id' | 'code' | 'description' | 'requiresAuthorization'
  > | null
  createdAt?: string
  updatedAt?: string
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
  createdAt: string
  updatedAt: string
  patient: {
    id: EntityId
    patientNumber: string
    firstName: string
    lastName: string
  }
  patientInsurance: {
    id: EntityId
    insuredId: string
    status: string
    payer: { id: EntityId; code: string; name: string }
  }
  items: AuthorizationItem[]
}
export interface AuthorizationUpdateDto {
  status?: AuthorizationAdminStatus
  validFrom?: string | null
  validTo?: string | null
  issuedAt?: string | null
  notes?: string | null
}
export interface AuthorizationWriteDto extends AuthorizationUpdateDto {
  patientId: EntityId
  patientInsuranceId: EntityId
  authorizationId: string
}
export interface AuthorizationItemWriteDto {
  svbProcedureId?: EntityId | null
  authorizedQuantity: DecimalString | null
  validFrom: string | null
  validTo: string | null
  notes: string | null
}
export interface EncounterProcedure {
  id: EntityId
  encounterId: EntityId
  patientInsuranceId: EntityId
  svbProcedureId: EntityId
  svbTariffId: EntityId
  authorizationItemId: EntityId | null
  diagnosisId: EntityId | null
  referrerId: EntityId | null
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
  numberOfTreatmentsSnapshot: number | null
  assistanceSnapshot: string | null
  referrerIdSnapshot: string | null
  policlinicSnapshot: string | null
  performedAt: string | null
  additionalNote: string | null
  status: 'PERFORMED' | 'BILLED' | 'VOID'
  createdByUserId: EntityId
  createdAt: string
  updatedAt: string
  svbProcedure: Pick<
    SvbProcedure,
    'id' | 'code' | 'description' | 'requiresAuthorization' | 'requiresReferral'
  >
  svbTariff: Pick<
    SvbTariff,
    'id' | 'amount' | 'currencyCode' | 'validFrom' | 'validTo'
  >
  patientInsurance: {
    id: EntityId
    patientId: EntityId
    insuredId: string
    status: string
    validFrom: string | null
    validTo: string | null
    payer: { id: EntityId; code: string; name: string }
  }
  authorizationItem:
    | (Omit<AuthorizationItem, 'notes'> & {
        externalAuthorizationId: string
        status: AuthorizationStatus
      })
    | null
  diagnosis: Pick<
    EncounterDiagnosis,
    'id' | 'codeSnapshot' | 'descriptionSnapshot' | 'isPrimary'
  > | null
  performedByProvider: Pick<
    AppointmentProvider,
    'id' | 'svbProviderId' | 'firstName' | 'lastName'
  >
}
export interface ProcedureWriteDto {
  patientInsuranceId: EntityId
  svbProcedureId: EntityId
  quantity: DecimalString
  authorizationItemId: EntityId | null
  diagnosisId: EntityId | null
  additionalNote: string | null
}
export type ProcedureUpdateDto = Pick<
  ProcedureWriteDto,
  'diagnosisId' | 'additionalNote'
>
