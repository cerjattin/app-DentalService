export interface BackendErrorEnvelope {
  success: false
  error: {
    code: string
    message: string
    details?: unknown
    correlationId?: string
  }
}

export class ApiError extends Error {
  readonly code: string
  readonly status: number
  readonly details: unknown
  readonly correlationId?: string

  constructor({
    code,
    message,
    status,
    details,
    correlationId,
  }: {
    code: string
    message: string
    status: number
    details?: unknown
    correlationId?: string
  }) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.details = details
    this.correlationId = correlationId
  }
}
