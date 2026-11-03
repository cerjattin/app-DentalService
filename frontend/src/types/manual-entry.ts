import type { EntityId, DecimalString } from './core'

export interface ManualLineResult {
  declarationItemId: EntityId
  status: 'ACCEPTED' | 'REJECTED'
  responseCode?: string | null
  responseMessage?: string | null
}
export interface ManualEntry {
  id: EntityId
  declarationId: EntityId
  state: 'PREPARED' | 'UNCERTAIN' | 'RELEASED' | 'RECORDED'
  schemaVersion: string
  entryMode: 'MANUAL_ENTRY'
  contentHash: string
  preparedByUserId: EntityId
  preparedAt: string
  uncertaintyReason: string | null
  releaseReason: string | null
  releasedAt: string | null
  resolutionDocumentId: EntityId | null
  submissionId: EntityId | null
  receiptDocumentId: EntityId | null
  receiptSha256: string | null
  externalSubmittedAt: string | null
  recordedAt: string | null
  result: null | { id: EntityId; status: ManualResultInput['status']; documentId: EntityId; sha256: string; externalReference: string | null; externalRespondedAt: string; recordedAt: string; recordedByUserId: EntityId; lines: ManualLineResult[] }
}
export interface ManualInvoiceLine {
  declarationItemId: EntityId
  sequenceNumber: number
  invoiceItemId: EntityId
  invoiceId: EntityId
  invoiceVersionId: EntityId
  versionNumber: number
  invoiceContentHash: string
  invoiceNumber: string
  procedureCode: string
  procedureDescription: string
  quantity: DecimalString
  unitTariff: DecimalString
  amount: DecimalString
  currencyCode: string
}
export interface ManualDossier {
  content: { schemaVersion: string; entryMode: 'MANUAL_ENTRY'; notOfficialSvbFile: true; officialRulesVerified: false; externalSubmissionPerformedByApplication: false; items: ManualInvoiceLine[]; totalsByCurrency: { currencyCode: string; amount: DecimalString }[] }
  contentHash: string
  entry: ManualEntry | null
}
export interface ManualSubmissionInput {
  manualEntryId: EntityId
  expectedContentHash: string
  externalReference: string | null
  submittedAt: string
  receiptDocumentId: EntityId
  idempotencyKey: string
  confirmation: 'ALREADY_ENTERED_IN_OFFICIAL_PORTAL'
  reason?: string
}
export interface ManualResultInput {
  status: 'ACCEPTED' | 'PARTIALLY_REJECTED' | 'REJECTED'
  externalReference: string | null
  respondedAt: string
  resultDocumentId: EntityId
  idempotencyKey: string
  reason?: string
  lines: ManualLineResult[]
}
