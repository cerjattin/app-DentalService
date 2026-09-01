import type { EntityId } from './core'

export type PatientSex = 'FEMALE' | 'MALE' | 'OTHER' | 'UNKNOWN'
export type PatientStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED'
export type InsuranceStatus = 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'SUSPENDED'

export interface Payer {
  id: EntityId
  code: string
  name: string
  payerType: string
}

export interface PatientInsuranceSummary {
  id: EntityId
  insuredId: string
  status: InsuranceStatus
  isPrimary: boolean
  validFrom: string | null
  validTo: string | null
  payer: Pick<Payer, 'id' | 'code' | 'name'>
}

export interface Patient {
  id: EntityId
  organizationId: EntityId
  patientNumber: string
  firstName: string
  middleName: string | null
  lastName: string
  secondLastName: string | null
  dateOfBirth: string | null
  sex: PatientSex | null
  documentType: string | null
  documentNumber: string | null
  email: string | null
  phone: string | null
  mobilePhone: string | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  countryCode: string | null
  status: PatientStatus
  archivedAt: string | null
  createdAt: string
  updatedAt: string
  insuranceCoverages: PatientInsuranceSummary[]
}

export interface PatientInsurance {
  id: EntityId
  patientId: EntityId
  payerId: EntityId
  insuredId: string
  validFrom: string | null
  validTo: string | null
  status: InsuranceStatus
  isPrimary: boolean
  verifiedAt: string | null
  verificationSource: string | null
  verifiedBy: {
    id: EntityId
    firstName: string
    lastName: string
    email: string
  } | null
  payer: Payer
  createdAt: string
  updatedAt: string
}

export interface PatientListFilters {
  q?: string
  status?: PatientStatus
  page: number
  pageSize: number
}

export interface PaginationMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface PatientWriteDto {
  firstName: string
  middleName?: string | null
  lastName: string
  secondLastName?: string | null
  dateOfBirth?: string | null
  sex?: PatientSex | null
  documentType?: string | null
  documentNumber?: string | null
  email?: string | null
  phone?: string | null
  mobilePhone?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  countryCode?: string | null
}

export type PatientUpdateDto = Partial<PatientWriteDto>

export interface InsuranceWriteDto {
  payerId: EntityId
  insuredId: string
  validFrom?: string | null
  validTo?: string | null
  status?: InsuranceStatus
  isPrimary?: boolean
}

export type InsuranceUpdateDto = Partial<InsuranceWriteDto>
