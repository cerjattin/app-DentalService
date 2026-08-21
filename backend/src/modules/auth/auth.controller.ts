import type { RequestHandler } from "express";

import { successResponse } from "../../shared/http/api-response.js";

import { AppError } from "../../shared/errors/app-error.js";

import { loginSchema } from "./auth.schemas.js";

import { authService } from "./auth.service.js";

import {
  toPublicAuthUser,
  type RequestSecurityMetadata,
} from "./auth.types.js";

export const login: RequestHandler = async (req, res) => {
  const input = loginSchema.parse(req.body);

  const correlationId =
    typeof res.locals.correlationId === "string"
      ? res.locals.correlationId
      : undefined;

  const ipAddress = req.ip;

  const userAgent = req.get("user-agent");

  const metadata: RequestSecurityMetadata = {
    ...(correlationId !== undefined
      ? {
          correlationId,
        }
      : {}),

    ...(ipAddress !== undefined
      ? {
          ipAddress,
        }
      : {}),

    ...(userAgent !== undefined
      ? {
          userAgent,
        }
      : {}),
  };

  const result = await authService.login(input, metadata);

  res.status(200).json(successResponse(result));
};

export const me: RequestHandler = async (req, res) => {
  if (!req.auth) {
    throw new AppError(
      401,
      "AUTHENTICATION_REQUIRED",
      "Authentication is required",
    );
  }

  res.status(200).json(successResponse(toPublicAuthUser(req.auth)));
};
