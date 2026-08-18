import { randomUUID } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

export const CORRELATION_ID_HEADER = "x-correlation-id";

export function requestContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const incomingCorrelationId = req.header(CORRELATION_ID_HEADER)?.trim();

  const correlationId = incomingCorrelationId || randomUUID();

  res.locals.correlationId = correlationId;

  req.headers[CORRELATION_ID_HEADER] = correlationId;

  res.setHeader(CORRELATION_ID_HEADER, correlationId);

  next();
}
