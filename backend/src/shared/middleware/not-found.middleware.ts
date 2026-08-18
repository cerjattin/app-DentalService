import type { RequestHandler } from "express";

import { AppError } from "../errors/app-error.js";

export const notFoundMiddleware: RequestHandler = (req, _res, next): void => {
  next(
    new AppError(
      404,
      "ROUTE_NOT_FOUND",
      `Route ${req.method} ${req.originalUrl} not found`,
    ),
  );
};
