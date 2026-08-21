import type { RequestHandler } from "express";

import { AppError } from "../errors/app-error.js";

import { accessTokenService } from "../../modules/auth/access-token.service.js";

import { authRepository } from "../../modules/auth/auth.repository.js";

import { buildAuthContext } from "../../modules/auth/auth.types.js";

export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const authorization = req.header("authorization");

    if (!authorization || !authorization.startsWith("Bearer ")) {
      throw new AppError(
        401,
        "AUTHENTICATION_REQUIRED",
        "Authentication is required",
      );
    }

    const token = authorization.slice("Bearer ".length).trim();

    if (!token) {
      throw new AppError(
        401,
        "AUTHENTICATION_REQUIRED",
        "Authentication is required",
      );
    }

    const claims = await accessTokenService.verify(token);

    const user = await authRepository.findById(claims.userId);

    if (!user || user.status !== "ACTIVE" || user.archivedAt !== null) {
      throw new AppError(
        401,
        "AUTHENTICATION_REQUIRED",
        "Authentication is required",
      );
    }

    if (user.organizationId !== claims.organizationId) {
      throw new AppError(
        401,
        "INVALID_ACCESS_TOKEN",
        "Access token is invalid or expired",
      );
    }

    req.auth = buildAuthContext(user);

    next();
  } catch (error) {
    next(error);
  }
};
