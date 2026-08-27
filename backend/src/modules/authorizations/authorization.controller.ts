import type { RequestHandler } from "express";

import { AppError } from "../../shared/errors/app-error.js";
import { successResponse } from "../../shared/http/api-response.js";
import { parseBigIntId } from "../../shared/utils/parse-bigint-id.js";
import type { RequestSecurityMetadata } from "../auth/auth.types.js";

import {
  createAuthorizationItemSchema,
  createAuthorizationSchema,
  listAuthorizationsQuerySchema,
  updateAuthorizationItemSchema,
  updateAuthorizationSchema,
} from "./authorization.schemas.js";
import { authorizationService } from "./authorization.service.js";

function requireAuth(req: Parameters<RequestHandler>[0]) {
  if (!req.auth) {
    throw new AppError(
      401,
      "AUTHENTICATION_REQUIRED",
      "Authentication is required",
    );
  }

  return req.auth;
}

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

export const listAuthorizations: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);
  const query = listAuthorizationsQuerySchema.parse(req.query);
  const result = await authorizationService.list(query, actor);

  res
    .status(200)
    .json(successResponse(result.authorizations, result.pagination));
};

export const getAuthorization: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);
  const authorizationId = parseBigIntId(req.params.id, "authorizationId");
  const result = await authorizationService.getById(authorizationId, actor);

  res.status(200).json(successResponse(result));
};

export const createAuthorization: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);
  const input = createAuthorizationSchema.parse(req.body);
  const result = await authorizationService.create(
    input,
    actor,
    securityMetadata(req, res),
  );

  res.status(201).json(successResponse(result));
};

export const updateAuthorization: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);
  const authorizationId = parseBigIntId(req.params.id, "authorizationId");
  const input = updateAuthorizationSchema.parse(req.body);
  const result = await authorizationService.update(
    authorizationId,
    input,
    actor,
    securityMetadata(req, res),
  );

  res.status(200).json(successResponse(result));
};

export const listAuthorizationItems: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);
  const authorizationId = parseBigIntId(
    req.params.authorizationId,
    "authorizationId",
  );
  const result = await authorizationService.listItems(authorizationId, actor);

  res.status(200).json(successResponse(result));
};

export const createAuthorizationItem: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);
  const authorizationId = parseBigIntId(
    req.params.authorizationId,
    "authorizationId",
  );
  const input = createAuthorizationItemSchema.parse(req.body);
  const result = await authorizationService.createItem(
    authorizationId,
    input,
    actor,
    securityMetadata(req, res),
  );

  res.status(201).json(successResponse(result));
};

export const updateAuthorizationItem: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);
  const authorizationId = parseBigIntId(
    req.params.authorizationId,
    "authorizationId",
  );
  const itemId = parseBigIntId(req.params.itemId, "authorizationItemId");
  const input = updateAuthorizationItemSchema.parse(req.body);
  const result = await authorizationService.updateItem(
    authorizationId,
    itemId,
    input,
    actor,
    securityMetadata(req, res),
  );

  res.status(200).json(successResponse(result));
};
