import type { RequestHandler } from "express";

import { AppError } from "../../shared/errors/app-error.js";

import { successResponse } from "../../shared/http/api-response.js";

import { parseBigIntId } from "../../shared/utils/parse-bigint-id.js";

import {
  createUserSchema,
  listUsersQuerySchema,
  replaceUserRolesSchema,
  updateUserSchema,
  updateUserStatusSchema,
} from "./user.schemas.js";

import { userService } from "./user.service.js";

import type { RequestSecurityMetadata } from "../auth/auth.types.js";

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

export const listUsers: RequestHandler = async (req, res) => {
  if (!req.auth) {
    throw new AppError(
      401,
      "AUTHENTICATION_REQUIRED",
      "Authentication is required",
    );
  }

  const query = listUsersQuerySchema.parse(req.query);

  const result = await userService.list(query, req.auth);

  res.status(200).json(successResponse(result.users, result.pagination));
};

export const getUser: RequestHandler = async (req, res) => {
  if (!req.auth) {
    throw new AppError(
      401,
      "AUTHENTICATION_REQUIRED",
      "Authentication is required",
    );
  }

  const userId = parseBigIntId(req.params.id, "userId");

  const result = await userService.getById(userId, req.auth);

  res.status(200).json(successResponse(result));
};

export const createUser: RequestHandler = async (req, res) => {
  if (!req.auth) {
    throw new AppError(
      401,
      "AUTHENTICATION_REQUIRED",
      "Authentication is required",
    );
  }

  const input = createUserSchema.parse(req.body);

  const result = await userService.create(
    input,
    req.auth,
    securityMetadata(req, res),
  );

  res.status(201).json(successResponse(result));
};

export const updateUser: RequestHandler = async (req, res) => {
  if (!req.auth) {
    throw new AppError(
      401,
      "AUTHENTICATION_REQUIRED",
      "Authentication is required",
    );
  }

  const userId = parseBigIntId(req.params.id, "userId");

  const input = updateUserSchema.parse(req.body);

  const result = await userService.update(
    userId,
    input,
    req.auth,
    securityMetadata(req, res),
  );

  res.status(200).json(successResponse(result));
};
export const changeUserStatus: RequestHandler = async (req, res) => {
  if (!req.auth) {
    throw new AppError(
      401,
      "AUTHENTICATION_REQUIRED",
      "Authentication is required",
    );
  }

  const userId = parseBigIntId(req.params.id, "userId");

  const input = updateUserStatusSchema.parse(req.body);

  const result = await userService.changeStatus(
    userId,
    input,
    req.auth,
    securityMetadata(req, res),
  );

  res.status(200).json(successResponse(result));
};
export const replaceUserRoles: RequestHandler = async (req, res) => {
  if (!req.auth) {
    throw new AppError(
      401,
      "AUTHENTICATION_REQUIRED",
      "Authentication is required",
    );
  }

  const userId = parseBigIntId(req.params.id, "userId");

  const input = replaceUserRolesSchema.parse(req.body);

  const result = await userService.replaceRoles(
    userId,
    input,
    req.auth,
    securityMetadata(req, res),
  );

  res.status(200).json(successResponse(result));
};
