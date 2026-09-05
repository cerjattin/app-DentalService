import type { DocumentMetadata } from './billing'
import type { DecimalString, EntityId } from './core'

export type DeclarationStatus =
  | 'DRAFT'
  | 'READY'
  | 'EXPORTED'
  | 'SUBMITTED'
  | 'ACCEPTED'
  | 'PARTIALLY_REJECTED'
  | 'REJECTED'
  | 'CANCELLED'

export type DeclarationExportFormat = 'CSV' | 'TXT' | 'JSON' | 'XML'
export type DeclarationSubmissionStatus =
  | 'SUBMITTED'
  | 'ACCEPTED'
  | 'PARTIALLY_REJECTED'
  | 'REJECTED'

export interface DeclarationItem {
  id: EntityId
  declarationBatchId: EntityId
  invoiceItemId: EntityId
  sequenceNumber: number
  lineStatus: string
  declarantIdSnapshot: string
  invoiceNumberSnapshot: string
  detailInvoiceNumberSnapshot: string
  providerIdSnapshot: string
  serviceDateSnapshot: string
  insuredIdSnapshot: string
  accidentFormNumberSnapshot: string | null
  treatmentIdSnapshot: string | null
  amountSnapshot: DecimalString
  authorizationIdSnapshot: string | null
  numberOfTreatmentsSnapshot: number | null
  assistanceSnapshot: string | null
  referrerIdSnapshot: string | null
  diagnosticCodeSnapshot: string | null
  policlinicSnapshot: string | null
  additionalNoteSnapshot: string | null
  responseCode: string | null
  responseMessage: string | null
  createdAt: string
  updatedAt: string
}

export interface DeclarationExport {
  id: EntityId
  declarationBatchId: EntityId
  documentId: EntityId
  format: DeclarationExportFormat
  schemaVersion: string
  adapterVersion: string
  recordCount: number
  exportedByUserId: EntityId
  exportedAt: string
  metadata: unknown
  document: DocumentMetadata
}

export interface DeclarationSubmission {
  id: EntityId
  declarationBatchId: EntityId
  declarationExportId: EntityId | null
  attemptNumber: number
  channel: 'PORTAL_UPLOAD' | 'API' | 'MANUAL' | 'OTHER'
  status: DeclarationSubmissionStatus
  externalReference: string | null
  requestMetadata: unknown
  responseMetadata: unknown
  submittedByUserId: EntityId
  submittedAt: string
  respondedAt: string | null
}

export interface Declaration {
  id: EntityId
  organizationId: EntityId
  payerId: EntityId
  declarationNumber: string | null
  status: DeclarationStatus
  periodStart: string | null
  periodEnd: string | null
  declarantIdSnapshot: string | null
  submissionReference: string | null
  notes: string | null
  createdByUserId: EntityId
  readyAt: string | null
  exportedAt: string | null
  submittedAt: string | null
  acceptedAt: string | null
  rejectedAt: string | null
  createdAt: string
  updatedAt: string
  payer: { id: EntityId; code: string; name: string; payerType: string }
  items: DeclarationItem[]
  exports: DeclarationExport[]
  submissions: DeclarationSubmission[]
}

export interface DeclarationFilters {
  page: number
  pageSize: number
  q?: string
  payerId?: EntityId
  status?: DeclarationStatus
  periodStart?: string
  periodEnd?: string
}

export interface CreateDeclarationDto {
  payerId: EntityId
  periodStart?: string | null
  periodEnd?: string | null
  declarantIdSnapshot?: string | null
  notes?: string | null
}

export interface SubmissionResultDto {
  status: Exclude<DeclarationSubmissionStatus, 'SUBMITTED'>
  externalReference?: string | null
  responseMetadata?: Record<string, unknown> | null
}
