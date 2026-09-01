import { ApiError } from './api-error'

const apiErrorMessages: Record<string, string> = {
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
  CLINICAL_ENCOUNTER_NOT_FOUND: 'No clinical encounter exists for this appointment.',
  CLINICAL_ENCOUNTER_ALREADY_EXISTS: 'A clinical encounter already exists for this appointment.',
  INVALID_APPOINTMENT_STATUS: 'The appointment must be in progress before opening an encounter.',
  CLINICAL_ENCOUNTER_NOT_EDITABLE: 'This clinical encounter is read-only.',
  CLINICAL_ENCOUNTER_ALREADY_COMPLETED: 'This clinical encounter is already completed.',
  INVALID_CLINICAL_ENCOUNTER_STATUS: 'The clinical encounter is not in a valid state for this action.',
  DIAGNOSIS_CODE_NOT_FOUND: 'The selected diagnosis code could not be found.',
  DIAGNOSIS_CODE_INACTIVE: 'The selected diagnosis code is inactive.',
  DIAGNOSIS_CODE_NOT_VALID: 'The selected diagnosis is not valid for the appointment date.',
  DIAGNOSIS_ALREADY_ASSIGNED: 'This diagnosis is already assigned to the encounter.',
  ENCOUNTER_DIAGNOSIS_NOT_FOUND: 'The encounter diagnosis could not be found.',
  SVB_PROCEDURE_NOT_FOUND: 'The selected SVB procedure could not be found.',
  SVB_PROCEDURE_INACTIVE: 'The selected SVB procedure is inactive.',
  SVB_PROCEDURE_NOT_VALID: 'The selected SVB procedure is not valid for the service date.',
  SVB_TARIFF_NOT_FOUND: 'No applicable SVB tariff was found.',
  SVB_TARIFF_AMBIGUOUS: 'Multiple SVB tariffs apply. The procedure cannot be recorded.',
  INVALID_PROCEDURE_QUANTITY: 'Procedure quantity must be greater than zero.',
  PROCEDURE_AUTHORIZATION_REQUIRED: 'This procedure requires a valid authorization item.',
  PATIENT_INSURANCE_NOT_FOUND: 'The selected patient insurance record could not be found.',
  PROCEDURE_INSURANCE_PATIENT_MISMATCH: 'The selected insurance does not belong to this patient.',
  INSURANCE_NOT_VALID: 'The selected insurance is not valid for performed procedures.',
  PROCEDURE_DIAGNOSIS_ENCOUNTER_MISMATCH: 'The selected diagnosis does not belong to this encounter.',
  ENCOUNTER_PROCEDURE_NOT_FOUND: 'The performed procedure could not be found.',
  ENCOUNTER_PROCEDURE_NOT_EDITABLE: 'This performed procedure is read-only.',
  ENCOUNTER_PROCEDURE_ALREADY_BILLED: 'This procedure is already linked to billing and cannot be removed.',
  AUTHORIZATION_ITEM_NOT_FOUND: 'The selected authorization item could not be found.',
  AUTHORIZATION_NOT_USABLE: 'The selected authorization is not usable.',
  AUTHORIZATION_NOT_VALID: 'The selected authorization is not valid for the service date.',
  AUTHORIZATION_ITEM_NOT_VALID: 'The selected authorization item is not valid for the service date.',
  AUTHORIZATION_PROCEDURE_MISMATCH: 'The authorization does not apply to this procedure.',
  AUTHORIZATION_INSURANCE_PATIENT_MISMATCH: 'The authorization does not match this patient and insurance.',
  AUTHORIZATION_QUANTITY_EXCEEDED: 'The requested quantity exceeds the remaining authorization quantity.',
}

export function getApiErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return apiErrorMessages[error.code] ?? 'Unexpected backend error.'
  }

  return 'Backend unavailable. Check the connection and try again.'
}
