import type { DecimalString, EntityId } from './core'

export type InvoiceStatus =
  | 'DRAFT'
  | 'PENDING_SIGNATURE'
  | 'SIGNED'
  | 'CLOSED'
  | 'DECLARED'
  | 'CORRECTION_REQUIRED'
  | 'CANCELLED'
export type VersionStatus =
  'DRAFT' | 'PENDING_SIGNATURE' | 'SIGNED' | 'CLOSED' | 'SUPERSEDED' | 'VOID'
export interface InvoiceItem {
  id: EntityId
  invoiceVersionId: EntityId
  lineNumber: number
  detailInvoiceNumber: string | null
  encounterProcedureId: EntityId
  sourceInvoiceItemId: EntityId | null
  svbProcedureId: EntityId
  svbTariffId: EntityId
  serviceDateSnapshot: string | null
  procedureCodeSnapshot: string
  procedureDescriptionSnapshot: string
  providerIdSnapshot: string
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
  additionalNote: string | null
  createdAt: string
  updatedAt: string
}
export interface InvoiceVersion {
  id: EntityId
  invoiceId: EntityId
  versionNumber: number
  versionType: 'ORIGINAL' | 'CORRECTION'
  supersedesVersionId: EntityId | null
  status: VersionStatus
  invoiceDate: string | null
  currencyCode: string
  totalAmount: DecimalString
  declarantIdSnapshot: string | null
  patientNameSnapshot: string
  patientDocumentTypeSnapshot: string | null
  patientDocumentNumberSnapshot: string | null
  insuredIdSnapshot: string
  contentHash: string | null
  preparedByUserId: EntityId
  lockedAt: string | null
  signedAt: string | null
  closedAt: string | null
  supersededAt: string | null
  createdAt: string
  updatedAt: string
  items: InvoiceItem[]
}
export type CorrectionStatus =
  | 'REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'APPLIED'
export type InvoiceVersionSummary = Pick<
  InvoiceVersion,
  | 'id'
  | 'versionNumber'
  | 'versionType'
  | 'status'
  | 'totalAmount'
  | 'createdAt'
>
export interface InvoiceCorrection {
  id: EntityId
  invoiceId: EntityId
  sourceVersionId: EntityId
  replacementVersionId: EntityId | null
  reasonCode: string
  reasonText: string
  status: CorrectionStatus
  requestedByUserId: EntityId
  requestedAt: string
  approvedByUserId: EntityId | null
  approvedAt: string | null
  resolvedByUserId: EntityId | null
  resolvedAt: string | null
  metadata: unknown
  createdAt: string
  updatedAt: string
  sourceVersion: InvoiceVersionSummary | null
  replacementVersion: InvoiceVersionSummary | null
}
export interface InvoiceStatusHistory {
  id: EntityId
  invoiceId: EntityId
  invoiceVersionId: EntityId | null
  oldStatus: InvoiceStatus | null
  newStatus: InvoiceStatus
  reason: string | null
  changedByUserId: EntityId
  changedAt: string
  metadata: unknown
}
export interface RequestInvoiceCorrectionDto {
  reasonCode: string
  reasonText: string
}
export interface ResolveInvoiceCorrectionDto {
  reason?: string
}
export interface UpdateCorrectionInvoiceItemDto {
  detailInvoiceNumber?: string
  serviceDateSnapshot?: string
  procedureCodeSnapshot?: string
  procedureDescriptionSnapshot?: string
  providerIdSnapshot?: string
  insuredIdSnapshot?: string
  unitTariffSnapshot?: DecimalString
  currencyCodeSnapshot?: string
  quantity?: DecimalString
  authorizationIdSnapshot?: string | null
  diagnosticCodeSnapshot?: string | null
  treatmentIdSnapshot?: string | null
  accidentFormNumberSnapshot?: string | null
  numberOfTreatmentsSnapshot?: number | null
  assistanceSnapshot?: string | null
  referrerIdSnapshot?: string | null
  policlinicSnapshot?: string | null
  additionalNote?: string | null
}
export interface Invoice {
  id: EntityId
  organizationId: EntityId
  appointmentId: EntityId
  patientId: EntityId
  patientInsuranceId: EntityId
  invoiceNumber: string | null
  status: InvoiceStatus
  currentVersionId: EntityId | null
  createdByUserId: EntityId
  cancelledByUserId: EntityId | null
  cancelledAt: string | null
  cancellationReason: string | null
  createdAt: string
  updatedAt: string
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
    documentType: string | null
    documentNumber: string | null
  }
  patientInsurance: {
    id: EntityId
    insuredId: string
    status: string
    payer: { id: EntityId; code: string; name: string }
  }
  currentVersion: InvoiceVersion | null
  versions: InvoiceVersionSummary[]
}
export interface InvoiceFilters {
  page: number
  pageSize: number
  q?: string
  status?: InvoiceStatus
  appointmentId?: EntityId
}
export interface DocumentMetadata {
  id: EntityId
  organizationId: EntityId
  documentType: string
  storageProvider: string
  originalFilename: string
  mimeType: string
  sizeBytes: string
  sha256: string
  metadata: unknown
  createdByUserId: EntityId | null
  createdAt: string
}
export interface InvoiceDocument {
  id: EntityId
  invoiceVersionId: EntityId
  documentId: EntityId
  documentRole: string
  createdAt: string
  document: DocumentMetadata
}
export type SignatureType =
  'PATIENT' | 'LEGAL_REPRESENTATIVE' | 'GUARDIAN' | 'OTHER'
export type CaptureMethod =
  'SIGNATURE_PAD' | 'TOUCHSCREEN' | 'MOUSE' | 'UPLOADED' | 'OTHER'
export interface CaptureSignatureDto {
  signatureDocumentId: EntityId
  signatureType: SignatureType
  captureMethod: CaptureMethod
  expectedContentHash: string
  signerName?: string
  signerRelationship?: string
}
export interface InvoiceSignature {
  id: EntityId
  invoiceVersionId: EntityId
  patientId: EntityId
  signatureDocumentId: EntityId
  signatureType: SignatureType
  signerName: string
  signerRelationship: string | null
  captureMethod: CaptureMethod
  signedContentHash: string
  signatureHash: string
  status: 'VALID' | 'VOID'
  signedAt: string
  capturedByUserId: EntityId
  document: Pick<
    DocumentMetadata,
    | 'id'
    | 'documentType'
    | 'originalFilename'
    | 'mimeType'
    | 'sizeBytes'
    | 'sha256'
    | 'createdAt'
  >
}
export interface SignatureContent {
  schema: string
  contentHash: string
  lockedAt: string
  content: {
    schema: string
    invoice: {
      invoiceNumber: string
      versionNumber: number
      versionType: string
      invoiceDate: string | null
      currencyCode: string
      totalAmount: DecimalString
      declarantId: string | null
      patientName: string
      patientDocumentType: string | null
      patientDocumentNumber: string | null
      insuredId: string
    }
    items: {
      lineNumber: number
      detailInvoiceNumber: string | null
      serviceDate: string | null
      procedureCode: string
      procedureDescription: string
      quantity: DecimalString
      unitTariff: DecimalString
      amount: DecimalString
      currencyCode: string
      providerId: string
      insuredId: string
      authorizationId: string | null
      diagnosticCode: string | null
      treatmentId: string | null
      policlinic: string | null
      numberOfTreatments: number | null
      assistance: string | null
      accidentFormNumber: string | null
      referrerId: string | null
      additionalNote: string | null
    }[]
  }
}
