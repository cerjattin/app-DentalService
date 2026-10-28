import type { DecimalString, EntityId } from './core'

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
export interface ServiceFilters {
  q?: string
  category?: string
  isActive?: boolean
  requiresAuthorization?: boolean
  requiresReferral?: boolean
  serviceDate?: string
  page: number
  pageSize: number
}
export interface TariffFilters {
  currencyCode?: string
  isActive?: boolean
  serviceDate?: string
  page: number
  pageSize: number
}
export interface ServiceWriteDto {
  code: string
  description: string
  category?: string | null
  unit?: string | null
  requiresAuthorization?: boolean
  requiresReferral?: boolean
  isActive?: boolean
  validFrom?: string | null
  validTo?: string | null
}
export interface TariffWriteDto {
  amount: DecimalString
  currencyCode: string
  validFrom: string
  validTo?: string | null
  isActive?: boolean
}
