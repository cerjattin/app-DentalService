import { authStore } from '../auth/auth-store'
import { ApiError, type BackendErrorEnvelope } from './api-error'
import { notifyUnauthorized } from './unauthorized-handler'

interface SuccessEnvelope<T> {
  success: true
  data: T
  meta?: unknown
}

export interface ApiResult<T, TMeta = unknown> {
  data: T
  meta?: TMeta
}

type ApiEnvelope<T> = SuccessEnvelope<T> | BackendErrorEnvelope

interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  signal?: AbortSignal
  skipUnauthorizedHandler?: boolean
  rawBody?: Blob
  responseType?: 'json' | 'blob'
}

export function normalizeApiBaseUrl(value: string | undefined) {
  const candidate = value?.trim()
  if (!candidate) {
    throw new Error('VITE_API_BASE_URL is required.')
  }

  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    throw new Error('VITE_API_BASE_URL must be a valid absolute URL.')
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.search || url.hash) {
    throw new Error(
      'VITE_API_BASE_URL must be an HTTP(S) URL without a query or fragment.',
    )
  }

  return candidate.replace(/\/+$/, '')
}

const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL)

function resolveUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${normalizedPath}`
}

function isJsonResponse(response: Response) {
  return response.headers.get('content-type')?.includes('application/json')
}

async function request<T, TMeta = unknown>(
  path: string,
  {
    body,
    headers,
    signal,
    skipUnauthorizedHandler = false,
    rawBody,
    responseType = 'json',
    ...init
  }: ApiRequestOptions = {},
): Promise<ApiResult<T, TMeta>> {
  const token = authStore.getAccessToken()
  const requestHeaders = new Headers(headers)

  if (body !== undefined && !requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json')
  }

  if (token) {
    requestHeaders.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(resolveUrl(path), {
    ...init,
    body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
    headers: requestHeaders,
    signal,
  })

  const payload = isJsonResponse(response)
    ? ((await response.json()) as ApiEnvelope<T>)
    : null

  if (!response.ok || payload?.success === false) {
    const backendError = payload?.success === false ? payload.error : null
    const code = backendError?.code ?? 'HTTP_ERROR'
    const status = response.status

    if (
      !skipUnauthorizedHandler &&
      status === 401 &&
      code === 'AUTHENTICATION_REQUIRED' &&
      authStore.getAccessToken()
    ) {
      notifyUnauthorized()
    }

    throw new ApiError({
      code,
      message: backendError?.message ?? response.statusText,
      status,
      details: backendError?.details,
      correlationId: backendError?.correlationId,
    })
  }

  if (payload?.success === true) {
    return {
      data: payload.data,
      ...(payload.meta !== undefined ? { meta: payload.meta as TMeta } : {}),
    }
  }

  if (responseType === 'blob') return { data: (await response.blob()) as T }

  return { data: undefined as T }
}

export function apiDownload(path: string, signal?: AbortSignal) {
  return apiFetch<Blob>(path, { signal, responseType: 'blob' })
}

export async function apiFetch<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const result = await request<T>(path, options)
  return result.data
}

export function apiFetchResult<T, TMeta = unknown>(
  path: string,
  options: ApiRequestOptions = {},
) {
  return request<T, TMeta>(path, options)
}
