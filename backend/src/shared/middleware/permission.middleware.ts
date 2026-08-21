import type { RequestHandler } from "express";

import { AppError } from "../errors/app-error.js";

export function requirePermission(permission: string): RequestHandler {
  return (req, _res, next): void => {
    if (!req.auth) {
      next(
        new AppError(
          401,
          "AUTHENTICATION_REQUIRED",
          "Authentication is required",
        ),
      );

      return;
    }

    if (!req.auth.permissions.includes(permission)) {
      next(
        new AppError(
          403,
          "PERMISSION_DENIED",
          "You do not have permission to perform this action",
          {
            requiredPermission: permission,
          },
        ),
      );

      return;
    }

    next();
  };
}
