export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    correlationId?: string;
  };
}

export function successResponse<T>(
  data: T,
  meta?: Record<string, unknown>,
): ApiSuccessResponse<T> {
  if (meta) {
    return {
      success: true,
      data,
      meta,
    };
  }

  return {
    success: true,
    data,
  };
}
