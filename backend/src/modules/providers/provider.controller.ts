import type { RequestHandler } from "express";

import { AppError } from "../../shared/errors/app-error.js";

import { successResponse } from "../../shared/http/api-response.js";

import { parseBigIntId } from "../../shared/utils/parse-bigint-id.js";

import type { RequestSecurityMetadata } from "../auth/auth.types.js";

import {
  createProviderSchema,
  listProvidersQuerySchema,
  updateProviderSchema,
} from "./provider.schemas.js";

import { providerService } from "./provider.service.js";

function securityMetadata(
  req: Parameters<RequestHandler>[0],
  res: Parameters<RequestHandler>[1],
): RequestSecurityMetadata {
  const correlationId =
    typeof res.locals.correlationId === "string"
      ? res.locals.correlationId
      : undefined;

  const ipAddress = req.ip;

  const userAgent = req.get("user-agent");

  return {
    ...(correlationId !== undefined ? { correlationId } : {}),

    ...(ipAddress !== undefined ? { ipAddress } : {}),

    ...(userAgent !== undefined ? { userAgent } : {}),
  };
}

export const listProviders: RequestHandler = async (req, res) => {
  if (!req.auth) {
    throw new AppError(
      401,
      "AUTHENTICATION_REQUIRED",
      "Authentication is required",
    );
  }

  const query = listProvidersQuerySchema.parse(req.query);

  const result = await providerService.list(query, req.auth);

  res.status(200).json(successResponse(result.providers, result.pagination));
};

export const getProvider: RequestHandler = async (req, res) => {
  if (!req.auth) {
    throw new AppError(
      401,
      "AUTHENTICATION_REQUIRED",
      "Authentication is required",
    );
  }

  const providerId = parseBigIntId(req.params.id, "providerId");

  const result = await providerService.getById(providerId, req.auth);

  res.status(200).json(successResponse(result));
};

export const createProvider: RequestHandler = async (req, res) => {
  if (!req.auth) {
    throw new AppError(
      401,
      "AUTHENTICATION_REQUIRED",
      "Authentication is required",
    );
  }

  const input = createProviderSchema.parse(req.body);

  const result = await providerService.create(
    input,
    req.auth,
    securityMetadata(req, res),
  );

  res.status(201).json(successResponse(result));
};

export const updateProvider: RequestHandler = async (req, res) => {
  if (!req.auth) {
    throw new AppError(
      401,
      "AUTHENTICATION_REQUIRED",
      "Authentication is required",
    );
  }

  const providerId = parseBigIntId(req.params.id, "providerId");

  const input = updateProviderSchema.parse(req.body);

  const result = await providerService.update(
    providerId,
    input,
    req.auth,
    securityMetadata(req, res),
  );

  res.status(200).json(successResponse(result));
};
