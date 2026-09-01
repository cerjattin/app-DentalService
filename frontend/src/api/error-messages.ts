import { ApiError } from './api-error'

const authErrorMessages: Record<string, string> = {
  AUTHENTICATION_REQUIRED: 'Please sign in to continue.',
  INVALID_CREDENTIALS: 'Invalid credentials.',
  ACCOUNT_LOCKED: 'This account is locked. Contact an administrator.',
  PERMISSION_DENIED: "You don't have permission to access this area.",
  VALIDATION_ERROR: 'Check the highlighted fields and try again.',
}

export function getApiErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return authErrorMessages[error.code] ?? 'Unexpected backend error.'
  }

  return 'Backend unavailable. Check the connection and try again.'
}
