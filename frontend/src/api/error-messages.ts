import { ApiError } from './api-error'

const apiErrorMessages: Record<string, string> = {
  DENTALINK_RESOURCE_NOT_FOUND: 'This import resource is unavailable. Refresh the account and history.',
  DENTALINK_MAPPING_TARGET_NOT_FOUND: 'Select an active provider or location in this organization.',
  DENTALINK_ACCOUNT_EXISTS: 'This external account is already configured. Review the account list.',
  DENTALINK_ACCOUNT_DISABLED: 'This logical account is disabled.',
  DENTALINK_NOT_CONFIGURED: 'No Dentalink reader is configured. A logical account does not establish a real connection.',
  DENTALINK_SYNTHETIC_QA_ONLY: 'The synthetic reader is restricted to an isolated local QA environment.',
  DENTALINK_CONCURRENT_CHANGE: 'Import data changed. Refresh the account and review the recorded outcome.',
  DENTALINK_PREVIEW_NOT_READY: 'Read all source pages and review the completed preview before confirming.',
  DENTALINK_PREVIEW_CHANGED: 'The preview or mappings changed. Prepare and review a new preview.',
  DENTALINK_PAGE_CHANGED: 'This source page changed concurrently. Refresh the import review.',
  DENTALINK_SOURCE_ACCOUNT_MISMATCH: 'The source account does not match the configured account. Contact the administrator.',
  DENTALINK_PAGE_INCOMPLETE: 'The reader returned an incomplete page. Retry the same source page.',
  DENTALINK_CURSOR_NOT_ADVANCING: 'The reader did not advance. Contact the administrator before continuing.',
  DENTALINK_PREVIEW_LIMIT: 'This preview reached its preparation limit. Review a smaller import period.',
  DENTALINK_SOURCE_CHANGED: 'Source content changed during reading. Prepare a new preview after review.',
  DENTALINK_INVALID_PAGE: 'The reader returned an invalid page. No rows from that page were applied.',
  DENTALINK_READ_FAILED: 'The source page could not be read. Recover the recorded run and retry the same page.',
  DENTALINK_IMPORT_FAILED: 'The import failed. The server rolled back local changes; review the recorded outcome before retrying.',
  NUMBER_SEQUENCE_NOT_CONFIGURED: 'The organization numbering is incomplete. Ask an administrator to configure it, then review and retry the operation.',
  ATTENTION_SERVICES_REQUIRED: 'Add at least one service before completing attention.',
  ATTENTION_CHANGED: 'The attention changed while you were working. Refresh and review the services.',
  APPOINTMENT_RESCHEDULE_NOT_ALLOWED: 'Reschedule the appointment before service attention begins.',
  INVOICE_INSURANCE_SELECTION_REQUIRED: 'Choose the insurance coverage for this invoice.',
  INVOICE_CURRENCY_SELECTION_REQUIRED: 'Enter the currency code for this invoice.',
  INVOICE_SERVICE_PRICING_INCOMPLETE: 'Review the billing details for the services on this appointment.',
  SVB_PRESENTATION_DEFERRED: 'SVB submission pending — file specification not confirmed.',
  MANUAL_ENTRY_SINGLE_INVOICE_REQUIRED: 'Use one complete invoice version per declaration. Split mixed invoices before preparing a manual entry.',
  MANUAL_ENTRY_INCOMPLETE_INVOICE: 'Include every item of the closed invoice version. Resolve other Draft assignments, add the missing items and review the full invoice before preparing again.',
  MANUAL_ENTRY_NOT_FOUND: 'The manual preparation could not be found. Refresh this declaration.',
  MANUAL_ENTRY_NOT_ALLOWED: 'This declaration or preparation cannot perform this action. Refresh its current state.',
  MANUAL_ENTRY_LOCKED: 'This declaration has an active manual preparation. Resolve it before changing items.',
  MANUAL_ENTRY_UNCERTAIN: 'The portal outcome is uncertain. Verify the portal and preserve evidence before releasing this preparation.',
  INVOICE_MANUAL_PRESENTATION_LOCKED: 'This invoice has a manual presentation in progress or recorded. Resolve it before attempting a correction.',
  MANUAL_ENTRY_CONCURRENT_CONFLICT: 'Another operator changed this preparation. Refresh and review it before retrying.',
  IDEMPOTENCY_KEY_CONFLICT: 'This request key belongs to different content. Review the recorded history before continuing.',
  MANUAL_SOURCE_NOT_CURRENT: 'The dossier requires current, closed invoice versions. Refresh and review the invoice.',
  MANUAL_SOURCE_INCONSISTENT: 'Frozen invoice identity, amount or signature hash requires reconciliation. Do not replace historical values.',
  MANUAL_CONTENT_CHANGED: 'The frozen dossier changed. Resolve the discrepancy before recording the presentation.',
  MANUAL_ENTRY_RESOLUTION_EVIDENCE_REQUIRED: 'Attach portal verification evidence before releasing an uncertain preparation.',
  MANUAL_EVIDENCE_TYPE_INVALID: 'Upload the external evidence as a supporting document or other document.',
  MANUAL_EVIDENCE_INVALID: 'The stored evidence could not be verified. Review or replace the evidence before recording.',
  INVALID_EXTERNAL_TIMESTAMP: 'Use the actual external date and time; it cannot be in the future or before the presentation.',
  MANUAL_RESULT_LINES_MISMATCH: 'Provide exactly one result for each submitted line.',
  MANUAL_RESULT_STATUS_MISMATCH: 'The overall result must match the outcomes of all submitted lines.',
  MANUAL_RESULT_REJECTION_REASON_REQUIRED: 'Each rejected line needs the external rejection code or explanation.',
  SVB_REAL_PRESENTATION_NOT_ENABLED: 'Real SVB presentation is blocked until the clinic source rules and destination format are approved.',
  SVB_REFERRAL_FLOW_NOT_SUPPORTED: 'This service requires authorized referral evidence. Referral capture is not yet supported.',
  ACCIDENT_CASE_NOT_FOUND: 'The accident case could not be found for this patient.',
  ACCIDENT_INSURANCE_CONTEXT_MISMATCH: 'The accident case does not match the insurance used for this service.',
  ORGANIZATION_NOT_FOUND: 'The session organization is unavailable.',
  ORGANIZATION_VERSION_CONFLICT: 'Organization settings changed. Compare the current settings before saving again.',
  DECLARANT_ID_ALREADY_EXISTS: 'This Declarant ID is already configured. Choose the authorized value for this organization.',
  DECLARATION_DECLARANT_SERVER_MANAGED: 'The Declarant ID is assigned by the server from invoice snapshots.',
  DECLARATION_DECLARANT_MISMATCH: 'This invoice has a different frozen Declarant ID. Use a separate declaration.',
  DECLARATION_LEGACY_DATA_CONFLICT: 'This draft has inconsistent historical identity data. Review it before adding items or validating.',
  DECLARATION_ITEM_ASSIGNED: 'This item was assigned to another active declaration. Refresh and select another item.',
  DECLARATION_ITEM_NOT_FOUND: 'This declaration item could not be found. Refresh the declaration.',
  DECLARATION_HAS_EXPORTS_OR_SUBMISSIONS: 'This draft has export or submission evidence and cannot be changed through this workflow.',
  TREATMENT_CASE_NOT_FOUND: 'The treatment case could not be found for this patient.',
  TREATMENT_ID_ALREADY_EXISTS: 'This external treatment ID already exists for this patient.',
  TREATMENT_CASE_NOT_EDITABLE: 'Only an unused planned treatment case can be edited. Refresh the record.',
  TREATMENT_CASE_NOT_ASSIGNABLE: 'Select a planned or active treatment case for this patient.',
  APPOINTMENT_CLINICAL_CONTEXT_LOCKED: 'This appointment already has clinical procedure history. Its treatment reference cannot be changed here.',
  INVOICE_VERSION_CONFLICT: 'The invoice version changed. Reload the invoice and try again.',
  INVOICE_ENCOUNTER_NOT_REOPENABLE: 'Only a completed encounter with an eligible current invoice can return to clinical care.',
  INVOICE_DECLARATION_ASSIGNED: 'This invoice belongs to an active declaration. Resolve that declaration before returning to clinical care.',
  INVOICE_REBILLING_CONTEXT_MISMATCH: 'Keep the same insurance and currency when rebuilding this invoice.',
  INVALID_REPORT_PERIOD: 'Choose valid start and end dates, in order, covering at most 366 days.',
  USER_NOT_FOUND: 'The user could not be found.',
  USER_EMAIL_ALREADY_EXISTS: 'A user with this email already exists.',
  INVALID_ROLE: 'One or more selected roles are invalid or inactive.',
  SELF_DEACTIVATION_NOT_ALLOWED: 'You cannot deactivate your current account.',
  SELF_ADMIN_ROLE_REMOVAL_NOT_ALLOWED:
    'You cannot remove the administrator role from your current account.',
  LAST_ADMIN_REQUIRED:
    'The organization must retain at least one active administrator.',
  USER_ALREADY_LINKED_TO_PROVIDER:
    'This user is already linked to another provider.',
  PROVIDER_SVB_ID_ALREADY_EXISTS:
    'This SVB provider ID is already assigned to another provider.',
  INVALID_DECLARATION_PERIOD:
    'The declaration end date must be on or after its start date.',
  DECLARATION_NOT_FOUND: 'The declaration could not be found.',
  DECLARATION_ITEM_ALREADY_EXISTS:
    'This invoice item is already included in the declaration.',
  DECLARATION_ITEM_NOT_ELIGIBLE:
    'This item is not from the current closed invoice version.',
  DECLARATION_ITEM_WRONG_ORGANIZATION:
    'This invoice item belongs to another organization.',
  DECLARATION_ITEM_WRONG_PAYER:
    'This invoice item does not match the declaration payer.',
  DECLARATION_NOT_EDITABLE: 'Only draft declarations can be edited.',
  DECLARATION_EMPTY: 'Add at least one invoice item before continuing.',
  DECLARATION_NOT_READY:
    'This declaration is not ready for the requested export operation.',
  DECLARATION_NOT_SUBMITTABLE:
    'Generate an export before submitting this declaration.',
  DECLARATION_SVB_DATA_INCOMPLETE:
    'Required SVB snapshot data is missing. Review the source invoice version.',
  DECLARATION_SVB_DATA_INVALID:
    'SVB snapshot data is invalid. Review the source invoice version.',
  UNSUPPORTED_EXPORT_FORMAT: 'This export format is not supported.',
  DECLARATION_EXPORT_NOT_FOUND: 'No declaration export could be found.',
  DECLARATION_EXPORT_INVALID:
    'The declaration export failed its integrity check.',
  SUBMISSION_ADAPTER_NOT_CONFIGURED:
    'Declaration submission is unavailable because no Backend adapter is configured.',
  DECLARATION_ALREADY_SUBMITTED:
    'This declaration already has an active submission.',
  DECLARATION_SUBMISSION_FAILED:
    'The Backend submission adapter could not submit the declaration.',
  DECLARATION_SUBMISSION_NOT_FOUND:
    'The declaration submission could not be found.',
  DECLARATION_SUBMISSION_RESULT_NOT_ALLOWED:
    'A result can only be recorded for an active submitted declaration.',
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
  SVB_PROCEDURE_CODE_ALREADY_EXISTS: 'A service with this code already exists.',
  INVALID_SVB_PROCEDURE_PERIOD: 'The service end date must be on or after its start date.',
  SVB_TARIFF_ALREADY_EXISTS: 'A tariff with this currency and start date already exists.',
  INVALID_SVB_TARIFF_PERIOD: 'The tariff end date must be on or after its start date.',
  SVB_TARIFF_PERIOD_OVERLAP: 'This period overlaps another active tariff for the same service and currency.',
  SVB_PROCEDURE_NOT_FOUND: 'The SVB procedure could not be found.',
  SVB_PROCEDURE_INACTIVE: 'This SVB procedure is inactive.',
  SVB_PROCEDURE_NOT_VALID: 'This procedure is not valid for the service date.',
  SVB_TARIFF_NOT_FOUND:
    'The tariff could not be found, or no tariff applies to the selected service date and currency.',
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
