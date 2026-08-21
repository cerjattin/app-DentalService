import argon2 from "argon2";

import { env } from "../../config/env.js";

import { prisma } from "../../infrastructure/database/prisma.js";
import { logger } from "../../infrastructure/logging/logger.js";

import { auditService, auditTechnicalFields } from "../audit/audit.service.js";

import { AppError } from "../../shared/errors/app-error.js";

import { accessTokenService } from "./access-token.service.js";

import { authRepository, type AuthUserRecord } from "./auth.repository.js";

import {
  buildAuthContext,
  toPublicAuthUser,
  type LoginInput,
  type LoginResult,
  type RequestSecurityMetadata,
} from "./auth.types.js";

export class AuthService {
  async login(
    input: LoginInput,
    metadata: RequestSecurityMetadata,
  ): Promise<LoginResult> {
    const email = input.email.trim().toLowerCase();

    let user = await authRepository.findByEmail(email);

    /*
     * Evitamos retornar inmediatamente para
     * usuarios inexistentes.
     */
    if (!user) {
      await argon2.hash(input.password, {
        type: argon2.argon2id,
      });

      logger.warn(
        {
          correlationId: metadata.correlationId,
        },
        "Authentication failed",
      );

      throw this.invalidCredentials();
    }

    user = await this.unlockExpiredLock(user);

    if (user.status === "INACTIVE" || user.archivedAt !== null) {
      await this.auditFailedLogin(user, metadata, "ACCOUNT_INACTIVE");

      throw this.invalidCredentials();
    }

    if (user.status === "LOCKED") {
      await this.auditFailedLogin(user, metadata, "ACCOUNT_LOCKED");

      throw new AppError(423, "ACCOUNT_LOCKED", "Account is locked");
    }

    const passwordMatches = await argon2.verify(
      user.passwordHash,
      input.password,
    );

    if (!passwordMatches) {
      await this.handleFailedPassword(user, metadata);

      throw this.invalidCredentials();
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: {
          id: user.id,
        },

        data: {
          failedLoginAttempts: 0,

          lockedUntil: null,

          status: "ACTIVE",

          lastLoginAt: new Date(),
        },
      });

      await auditService.writeWithinTransaction(tx, {
        organizationId: user.organizationId,

        actorUserId: user.id,

        action: "AUTH_LOGIN_SUCCESS",

        entityType: "USER",

        entityId: user.id,

        entityKey: user.email,

        metadata: {
          outcome: "SUCCESS",
        },

        ...auditTechnicalFields(metadata),
      });
    });

    /*
     * Recargamos autorización después del
     * login para que roles/permisos sean
     * los actuales.
     */
    const refreshedUser = await authRepository.findById(user.id);

    if (!refreshedUser) {
      throw new AppError(401, "AUTHENTICATION_FAILED", "Authentication failed");
    }

    const context = buildAuthContext(refreshedUser);

    const accessToken = await accessTokenService.sign(
      context.userId,
      context.organizationId,
    );

    return {
      accessToken,

      tokenType: "Bearer",

      expiresIn: env.ACCESS_TOKEN_TTL,

      user: toPublicAuthUser(context),
    };
  }

  private async unlockExpiredLock(
    user: AuthUserRecord,
  ): Promise<AuthUserRecord> {
    if (
      user.status !== "LOCKED" ||
      !user.lockedUntil ||
      user.lockedUntil > new Date()
    ) {
      return user;
    }

    await prisma.user.update({
      where: {
        id: user.id,
      },

      data: {
        status: "ACTIVE",

        failedLoginAttempts: 0,

        lockedUntil: null,
      },
    });

    const refreshed = await authRepository.findById(user.id);

    if (!refreshed) {
      throw this.invalidCredentials();
    }

    return refreshed;
  }

  private async handleFailedPassword(
    user: AuthUserRecord,
    metadata: RequestSecurityMetadata,
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: {
          id: user.id,
        },

        data: {
          failedLoginAttempts: {
            increment: 1,
          },
        },

        select: {
          failedLoginAttempts: true,
        },
      });

      const shouldLock =
        updated.failedLoginAttempts >= env.AUTH_MAX_FAILED_ATTEMPTS;

      if (shouldLock) {
        const lockedUntil = new Date(
          Date.now() + env.AUTH_LOCK_MINUTES * 60_000,
        );

        await tx.user.update({
          where: {
            id: user.id,
          },

          data: {
            status: "LOCKED",

            lockedUntil,
          },
        });
      }

      await auditService.writeWithinTransaction(tx, {
        organizationId: user.organizationId,

        action: "AUTH_LOGIN_FAILED",

        entityType: "USER",

        entityId: user.id,

        entityKey: user.email,

        reason: shouldLock
          ? "INVALID_PASSWORD_ACCOUNT_LOCKED"
          : "INVALID_PASSWORD",

        metadata: {
          outcome: "FAILED",

          failedLoginAttempts: updated.failedLoginAttempts,

          accountLocked: shouldLock,
        },

        ...auditTechnicalFields(metadata),
      });
    });
  }

  private async auditFailedLogin(
    user: AuthUserRecord,
    metadata: RequestSecurityMetadata,
    reason: string,
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await auditService.writeWithinTransaction(tx, {
        organizationId: user.organizationId,

        action: "AUTH_LOGIN_FAILED",

        entityType: "USER",

        entityId: user.id,

        entityKey: user.email,

        reason,

        metadata: {
          outcome: "FAILED",
        },

        ...auditTechnicalFields(metadata),
      });
    });
  }

  private invalidCredentials(): AppError {
    return new AppError(
      401,
      "INVALID_CREDENTIALS",
      "Invalid email or password",
    );
  }
}

export const authService = new AuthService();
