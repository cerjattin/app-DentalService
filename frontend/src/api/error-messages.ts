import { ApiError } from './api-error'

const apiErrorMessages: Record<string, string> = {
  INVOICE_NOT_FOUND: 'The invoice could not be found.',
  INVOICE_VERSION_NOT_FOUND: 'The invoice version could not be found.',
  INVOICE_ALREADY_EXISTS:
    'This appointment already has an invoice. Open the existing invoice.',
  APPOINTMENT_NOT_BILLABLE:
    'Complete the appointment before creating its invoice.',
  CLINICAL_ENCOUNTER_REQUIRED:
    'A completed clinical encounter is required for billing.',
  CLINICAL_ENCOUNTER_NOT_COMPLETED:
    'Complete the clinical encounter before billing.',
  CLINICAL_ENCOUNTER_NOT_BILLABLE: 'This clinical encounter cannot be billed.',
  INVOICE_NO_BILLABLE_PROCEDURES:
    'No billable procedures were found for this appointment.',
  INVOICE_MULTIPLE_INSURANCES:
    'The procedures reference different insurance records. Request a billing review.',
  INVOICE_MIXED_CURRENCIES:
    'The procedures reference different currencies. Request a billing review.',
  INVOICE_INSURANCE_PATIENT_MISMATCH:
    'The insurance snapshots do not match this patient. Request a billing review.',
  INVOICE_ITEM_WRONG_APPOINTMENT:
    'A procedure does not belong to this appointment. Request a billing review.',
  INVOICE_ITEM_TARIFF_PROCEDURE_MISMATCH:
    'A procedure tariff does not match. Request a billing review.',
  INVOICE_ITEM_AMOUNT_MISMATCH:
    'An item amount does not match its snapshot. Request a billing review.',
  INVOICE_TOTAL_MISMATCH:
    'The invoice total does not match its items. Request a billing review.',
  INVOICE_CURRENCY_MISMATCH: 'The invoice and item currencies do not match.',
  INVOICE_NOT_PREPARABLE:
    'This invoice is not ready for signature preparation. Review its items and status.',
  INVOICE_DECLARANT_ID_REQUIRED:
    'The declarant ID snapshot is missing. Contact an administrator.',
  INVOICE_INSURED_ID_REQUIRED:
    'The insured ID snapshot is missing. Request a billing review.',
  INVOICE_PROVIDER_SNAPSHOT_REQUIRED:
    'A provider SVB ID snapshot is missing. Request a billing review.',
  INVOICE_SNAPSHOT_INCOMPLETE:
    'Required invoice snapshots are incomplete. Request a billing review.',
  INVOICE_VERSION_NOT_CURRENT:
    'This is no longer the current invoice version. Refresh the invoice.',
  INVOICE_VERSION_NOT_SIGNATURE_READY:
    'This version is not ready for signature. Refresh the invoice.',
  INVOICE_ALREADY_PREPARED_FOR_SIGNATURE:
    'This invoice is already prepared for signature. Refresh the invoice.',
  INVOICE_CONTENT_INTEGRITY_MISMATCH:
    'The locked invoice content has changed. Stop signing and contact an administrator.',
  SIGNATURE_CONTENT_HASH_MISMATCH:
    'Invoice content changed. Refresh and review before signing.',
  SIGNATURE_DOCUMENT_NOT_FOUND: 'The signature document could not be found.',
  SIGNATURE_DOCUMENT_INVALID:
    'The signature document is invalid. Capture the signature again.',
  SIGNATURE_DOCUMENT_ALREADY_USED:
    'This signature document is already recorded. Refresh the invoice.',
  SIGNATURE_EVIDENCE_INVALID:
    'Signature evidence could not be validated. Contact an administrator.',
  VALID_SIGNATURE_REQUIRED: 'A valid signature is required before continuing.',
  INVOICE_ALREADY_SIGNED:
    'This invoice is already signed. Refresh the invoice.',
  INVOICE_ALREADY_CLOSED:
    'This invoice is already closed. Refresh the invoice.',
  INVOICE_NOT_CLOSABLE: 'Sign the invoice before closing it.',
  INVOICE_SIGNATURE_STATE_INVALID:
    'Signature state is incomplete. Contact an administrator.',
  INVOICE_CONTENT_NOT_LOCKED:
    'The invoice content has not been locked correctly.',
  INVOICE_PDF_NOT_GENERATABLE:
    'PDF generation requires the current closed invoice version.',
  INVOICE_CORRECTION_NOT_FOUND: 'The correction request could not be found.',
  INVOICE_CORRECTION_ALREADY_ACTIVE:
    'This invoice already has an active correction.',
  INVOICE_CORRECTION_NOT_REQUESTABLE:
    'This invoice is not eligible for a correction request.',
  INVOICE_CORRECTION_NOT_APPROVABLE:
    'Only a requested correction can be approved.',
  INVOICE_CORRECTION_NOT_RESOLVABLE:
    'This correction can no longer be rejected or cancelled.',
  INVOICE_CORRECTION_NOT_APPROVED:
    'Approve the correction before creating its replacement version.',
  INVOICE_CORRECTION_REPLACEMENT_ALREADY_EXISTS:
    'A replacement version already exists for this correction.',
  INVOICE_CORRECTION_SOURCE_INVALID:
    'The correction source must remain a closed historical version.',
  INVOICE_CORRECTION_ITEM_NOT_EDITABLE:
    'Only items in the current draft correction version can be edited.',
  INVOICE_ITEM_NOT_FOUND: 'The invoice item could not be found.',
  INVALID_DOCUMENT_FILENAME: 'The document filename is invalid.',
  DOCUMENT_MIME_TYPE_NOT_ALLOWED: 'This document format is not supported.',
  DOCUMENT_EMPTY: 'The signature image is empty. Capture it again.',
  DOCUMENT_TOO_LARGE: 'The document exceeds the allowed upload size.',
  DOCUMENT_NOT_FOUND: 'The document could not be found.',
  DOCUMENT_FILE_NOT_FOUND:
    'The stored document is unavailable. Contact an administrator.',
  DOCUMENT_INTEGRITY_MISMATCH:
    'Document integrity verification failed. Contact an administrator.',
  DOCUMENT_STORAGE_INVALID:
    'Document storage is unavailable. Contact an administrator.',
  DOCUMENT_STORAGE_URI_INVALID:
    'The stored document is unavailable. Contact an administrator.',
  DOCUMENT_STORAGE_UNSUPPORTED:
    'Document storage is unavailable. Contact an administrator.',
  CLINICAL_ENCOUNTER_NOT_FOUND: 'The clinical encounter could not be found.',
  CLINICAL_ENCOUNTER_ALREADY_EXISTS:
    'An encounter already exists. Refresh to resume it.',
  CLINICAL_ENCOUNTER_NOT_EDITABLE:
    'This encounter is read only. Refresh the clinical record.',
  CLINICAL_ENCOUNTER_ALREADY_COMPLETED:
    'This encounter has already been completed.',
  INVALID_CLINICAL_ENCOUNTER_STATUS:
    'This encounter cannot be completed in its current state.',
  INVALID_APPOINTMENT_STATUS:
    'Start the appointment before opening its encounter.',
  DIAGNOSIS_CODE_NOT_FOUND: 'The diagnosis code could not be found.',
  DIAGNOSIS_CODE_INACTIVE: 'This diagnosis code is inactive.',
  DIAGNOSIS_CODE_NOT_VALID:
    'This diagnosis code is not valid for the service date.',
  DIAGNOSIS_ALREADY_ASSIGNED: 'This diagnosis is already recorded.',
  ENCOUNTER_DIAGNOSIS_NOT_FOUND: 'The recorded diagnosis could not be found.',
  SVB_PROCEDURE_NOT_FOUND: 'The SVB procedure could not be found.',
  SVB_PROCEDURE_INACTIVE: 'This SVB procedure is inactive.',
  SVB_PROCEDURE_NOT_VALID: 'This procedure is not valid for the service date.',
  SVB_TARIFF_NOT_FOUND:
    'No tariff is available for this procedure and service date.',
  SVB_TARIFF_AMBIGUOUS:
    'Multiple tariffs apply. Contact the catalogue administrator.',
  PATIENT_INSURANCE_NOT_FOUND: 'The selected insurance could not be found.',
  INSURANCE_NOT_VALID:
    'This insurance is not valid for the procedure service date.',
  INVALID_PROCEDURE_QUANTITY: 'Enter a procedure quantity greater than zero.',
  PROCEDURE_INSURANCE_PATIENT_MISMATCH:
    'Select insurance belonging to this patient.',
  PROCEDURE_DIAGNOSIS_ENCOUNTER_MISMATCH:
    'Select a diagnosis from this encounter.',
  PROCEDURE_AUTHORIZATION_REQUIRED:
    'Select an authorization item for this procedure.',
  ENCOUNTER_PROCEDURE_NOT_FOUND: 'The performed procedure could not be found.',
  ENCOUNTER_PROCEDURE_NOT_EDITABLE: 'This procedure is read only.',
  ENCOUNTER_PROCEDURE_ALREADY_BILLED:
    'This procedure is linked to billing and cannot be removed.',
  AUTHORIZATION_NOT_FOUND: 'The authorization could not be found.',
  AUTHORIZATION_ALREADY_EXISTS:
    'This authorization reference already exists for the insurance.',
  AUTHORIZATION_NOT_USABLE:
    'This authorization cannot be used in its current state.',
  AUTHORIZATION_NOT_VALID:
    'This authorization is not valid for the service date.',
  AUTHORIZATION_ITEM_NOT_FOUND: 'The authorization item could not be found.',
  AUTHORIZATION_ITEM_NOT_VALID:
    'The authorization item is not valid for this operation.',
  AUTHORIZATION_ITEM_AMBIGUOUS: 'Select a specific authorization item.',
  AUTHORIZATION_QUANTITY_EXCEEDED:
    'The quantity exceeds the available authorization balance.',
  AUTHORIZATION_PROCEDURE_MISMATCH:
    'This authorization item does not cover the selected procedure.',
  AUTHORIZATION_PATIENT_MISMATCH:
    'This authorization belongs to another patient.',
  AUTHORIZATION_INSURANCE_MISMATCH:
    'This authorization belongs to another insurance record.',
  AUTHORIZATION_INSURANCE_PATIENT_MISMATCH:
    'The authorization, patient and insurance do not match.',
  INVALID_AUTHORIZATION_PERIOD: 'Check the authorization start and end dates.',
  INVALID_AUTHORIZATION_ITEM_PERIOD:
    'Check the authorization item start and end dates.',
  AUTHENTICATION_REQUIRED: 'Please sign in to continue.',
  INVALID_CREDENTIALS: 'Invalid credentials.',
  ACCOUNT_LOCKED: 'This account is locked. Contact an administrator.',
  PERMISSION_DENIED: "You don't have permission to access this area.",
  VALIDATION_ERROR: 'Check the highlighted fields and try again.',
  INVALID_ID: 'The requested record identifier is invalid.',
  PATIENT_NOT_FOUND: 'The patient could not be found.',
  PATIENT_DOCUMENT_ALREADY_EXISTS:
    'A patient with this document already exists.',
  INSURANCE_NOT_FOUND: 'The insurance record could not be found.',
  INVALID_PAYER: 'Select a valid active payer.',
  INVALID_INSURANCE_PERIOD:
    'The coverage end date must be on or after the start date.',
  INSURANCE_PERIOD_OVERLAP:
    'This coverage period overlaps an existing record for the same payer and insured ID.',
  APPOINTMENT_NOT_FOUND: 'The appointment could not be found.',
  INVALID_DATE: 'Enter a valid appointment date and time.',
  INVALID_APPOINTMENT_PERIOD:
    'The appointment end time must be after its start time.',
  PROVIDER_NOT_FOUND: 'The selected provider could not be found.',
  PROVIDER_INACTIVE: 'The selected provider is inactive.',
  LOCATION_NOT_FOUND: 'The clinic location could not be found.',
  LOCATION_INACTIVE: 'The clinic location is inactive.',
  APPOINTMENT_PROVIDER_OVERLAP:
    'The provider already has an overlapping appointment.',
  INVALID_APPOINTMENT_STATUS_TRANSITION:
    'This appointment status change is no longer valid. Refresh and try again.',
}

export function getApiErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return apiErrorMessages[error.code] ?? 'Unexpected backend error.'
  }

  return 'Backend unavailable. Check the connection and try again.'
}
