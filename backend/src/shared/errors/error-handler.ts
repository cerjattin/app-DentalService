import type { ErrorRequestHandler } from "express";

import { ZodError } from "zod";

import { logger } from "../../infrastructure/logging/logger.js";
import { AppError } from "./app-error.js";

function isPayloadTooLarge(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    error.type === "entity.too.large"
  );
}

function isBodySyntaxError(error: unknown) {
  return (
    error instanceof SyntaxError &&
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    error.status === 400 &&
    "body" in error
  );
}

export const errorHandler: ErrorRequestHandler = (
  error,
  req,
  res,
  next,
): void => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const correlationId = res.locals.correlationId ?? req.id ?? "unknown";

  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",

        details: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
          code: issue.code,
        })),

        correlationId,
      },
    });

    return;
  }

  if (isPayloadTooLarge(error)) {
    logger.warn(
      {
        correlationId,
        errorCode: "PAYLOAD_TOO_LARGE",
        statusCode: 413,
        method: req.method,
        url: req.originalUrl,
      },
      "Request payload is too large",
    );

    res.status(413).json({
      success: false,
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "Request payload is too large",
        correlationId,
      },
    });

    return;
  }

  if (isBodySyntaxError(error)) {
    logger.warn(
      {
        correlationId,
        errorCode: "INVALID_JSON",
        statusCode: 400,
        method: req.method,
        url: req.originalUrl,
      },
      "Request body contains invalid JSON",
    );

    res.status(400).json({
      success: false,
      error: {
        code: "INVALID_JSON",
        message: "Request body contains invalid JSON",
        correlationId,
      },
    });

    return;
  }

  if (error instanceof AppError) {
    logger.warn(
      {
        correlationId,
        errorCode: error.code,
        statusCode: error.statusCode,
        method: req.method,
        url: req.originalUrl,
      },
      error.message,
    );

    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        correlationId,
      },
    });

    return;
  }

  logger.error(
    {
      err: error,
      correlationId,
      method: req.method,
      url: req.originalUrl,
    },
    "Unhandled application error",
  );

  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected server error occurred",
      correlationId,
    },
  });
};
