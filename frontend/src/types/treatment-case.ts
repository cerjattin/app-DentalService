import type { EntityId } from './core'
export type TreatmentCaseStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
export interface TreatmentCase {
  id: EntityId
  organizationId: EntityId
  patientId: EntityId
  treatmentId: string | null
  treatmentType: string | null
  description: string | null
  status: TreatmentCaseStatus
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
  isEditable: boolean
}
export interface TreatmentCaseInput { treatmentId: string; treatmentType?: string | null; description?: string | null }
export interface TreatmentCaseFilters { q?: string; status?: TreatmentCaseStatus; page: number; pageSize: number }
