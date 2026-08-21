import argon2 from "argon2";

import { prisma } from "../../infrastructure/database/prisma.js";

import { auditService, auditTechnicalFields } from "../audit/audit.service.js";

import { AppError } from "../../shared/errors/app-error.js";
import type { Prisma } from "../../generated/prisma/client.js";
import type {
  AuthenticatedRequestContext,
  RequestSecurityMetadata,
} from "../auth/auth.types.js";

import { userRepository, publicUserSelect } from "./user.repository.js";

import { toPublicUser } from "./user.types.js";

import type {
  CreateUserInput,
  ListUsersQuery,
  ReplaceUserRolesInput,
  UpdateUserInput,
  UpdateUserStatusInput,
} from "./user.schemas.js";

export class UserService {
  async create(
    input: CreateUserInput,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    const email = input.email.trim().toLowerCase();

    const existing = await userRepository.findByEmail(email);

    if (existing) {
      throw new AppError(
        409,
        "USER_EMAIL_ALREADY_EXISTS",
        "A user with this email already exists",
      );
    }

    const roles = await prisma.role.findMany({
      where: {
        code: {
          in: input.roleCodes,
        },

        isActive: true,
      },

      select: {
        id: true,
        code: true,
      },
    });

    if (roles.length !== new Set(input.roleCodes).size) {
      throw new AppError(
        400,
        "INVALID_ROLE",
        "One or more roles are invalid or inactive",
      );
    }

    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
    });

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          organizationId: actor.organizationId,

          email,

          passwordHash,

          firstName: input.firstName.trim(),

          lastName: input.lastName.trim(),

          status: "ACTIVE",

          passwordChangedAt: new Date(),
        },

        select: {
          id: true,
        },
      });

      await tx.userRole.createMany({
        data: roles.map((role) => ({
          userId: user.id,

          roleId: role.id,

          assignedByUserId: actor.userId,
        })),
      });

      await auditService.writeWithinTransaction(tx, {
        organizationId: actor.organizationId,

        actorUserId: actor.userId,

        action: "USER_CREATE",

        entityType: "USER",

        entityId: user.id,

        entityKey: email,

        metadata: {
          email,

          firstName: input.firstName,

          lastName: input.lastName,

          roles: roles.map((role) => role.code),
        },

        ...auditTechnicalFields(metadata),
      });

      return tx.user.findUniqueOrThrow({
        where: {
          id: user.id,
        },

        select: publicUserSelect,
      });
    });

    return toPublicUser(created);
  }
  async getById(userId: bigint, actor: AuthenticatedRequestContext) {
    const user = await userRepository.findById(userId, actor.organizationId);

    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }

    return toPublicUser(user);
  }

  async changeStatus(
    userId: bigint,
    input: UpdateUserStatusInput,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    const current = await userRepository.findById(userId, actor.organizationId);

    if (!current) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }

    /*
     * Evitamos que un administrador
     * se desactive a sí mismo.
     */
    if (userId === actor.userId && input.status === "INACTIVE") {
      throw new AppError(
        409,
        "SELF_DEACTIVATION_NOT_ALLOWED",
        "You cannot deactivate your own user account",
      );
    }

    /*
     * Protegemos al último ADMIN activo.
     */
    const isAdmin = current.userRoles.some(({ role }) => role.code === "ADMIN");

    if (input.status === "INACTIVE" && isAdmin) {
      const remainingAdmins = await prisma.user.count({
        where: {
          organizationId: actor.organizationId,

          id: {
            not: userId,
          },

          status: "ACTIVE",

          archivedAt: null,

          userRoles: {
            some: {
              role: {
                code: "ADMIN",
                isActive: true,
              },
            },
          },
        },
      });

      if (remainingAdmins === 0) {
        throw new AppError(
          409,
          "LAST_ADMIN_REQUIRED",
          "The last active administrator cannot be deactivated",
        );
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.user.update({
        where: {
          id: userId,
        },

        data: {
          status: input.status,

          /*
           * Al activar limpiamos cualquier
           * bloqueo temporal previo.
           */
          ...(input.status === "ACTIVE"
            ? {
                failedLoginAttempts: 0,
                lockedUntil: null,
              }
            : {}),
        },

        select: publicUserSelect,
      });

      await auditService.writeWithinTransaction(tx, {
        organizationId: actor.organizationId,

        actorUserId: actor.userId,

        action: input.status === "ACTIVE" ? "USER_ACTIVATE" : "USER_DEACTIVATE",

        entityType: "USER",

        entityId: userId,

        entityKey: result.email,

        ...(input.reason !== undefined
          ? {
              reason: input.reason,
            }
          : {}),

        oldValues: {
          status: current.status,
        },

        newValues: {
          status: result.status,
        },

        ...auditTechnicalFields(metadata),
      });

      return result;
    });

    return toPublicUser(updated);
  }

  async replaceRoles(
    userId: bigint,
    input: ReplaceUserRolesInput,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    const current = await userRepository.findById(userId, actor.organizationId);

    if (!current) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }

    const roles = await prisma.role.findMany({
      where: {
        code: {
          in: input.roleCodes,
        },

        isActive: true,
      },

      select: {
        id: true,
        code: true,
      },
    });

    if (roles.length !== input.roleCodes.length) {
      throw new AppError(
        400,
        "INVALID_ROLE",
        "One or more roles are invalid or inactive",
      );
    }

    const oldRoleCodes = current.userRoles.map(({ role }) => role.code);

    const removingAdmin =
      oldRoleCodes.includes("ADMIN") && !input.roleCodes.includes("ADMIN");

    /*
     * No permitimos que el usuario actual
     * se quite su propio rol ADMIN.
     */
    if (userId === actor.userId && removingAdmin) {
      throw new AppError(
        409,
        "SELF_ADMIN_ROLE_REMOVAL_NOT_ALLOWED",
        "You cannot remove your own ADMIN role",
      );
    }

    if (removingAdmin) {
      const remainingAdmins = await prisma.user.count({
        where: {
          organizationId: actor.organizationId,

          id: {
            not: userId,
          },

          status: "ACTIVE",

          archivedAt: null,

          userRoles: {
            some: {
              role: {
                code: "ADMIN",
                isActive: true,
              },
            },
          },
        },
      });

      if (remainingAdmins === 0) {
        throw new AppError(
          409,
          "LAST_ADMIN_REQUIRED",
          "The last administrator role cannot be removed",
        );
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({
        where: {
          userId,
        },
      });

      await tx.userRole.createMany({
        data: roles.map((role) => ({
          userId,

          roleId: role.id,

          assignedByUserId: actor.userId,
        })),
      });

      await auditService.writeWithinTransaction(tx, {
        organizationId: actor.organizationId,

        actorUserId: actor.userId,

        action: "USER_ROLES_REPLACE",

        entityType: "USER",

        entityId: userId,

        entityKey: current.email,

        oldValues: {
          roles: oldRoleCodes,
        },

        newValues: {
          roles: roles.map((role) => role.code),
        },

        ...auditTechnicalFields(metadata),
      });

      return tx.user.findUniqueOrThrow({
        where: {
          id: userId,
        },

        select: publicUserSelect,
      });
    });

    return toPublicUser(updated);
  }

  async update(
    userId: bigint,
    input: UpdateUserInput,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    const current = await userRepository.findById(userId, actor.organizationId);

    if (!current) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }

    const email =
      input.email !== undefined ? input.email.trim().toLowerCase() : undefined;

    if (email !== undefined && email !== current.email) {
      const existing = await userRepository.findByEmail(email);

      if (existing && existing.id !== userId) {
        throw new AppError(
          409,
          "USER_EMAIL_ALREADY_EXISTS",
          "A user with this email already exists",
        );
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.user.update({
        where: {
          id: userId,
        },

        data: {
          ...(email !== undefined ? { email } : {}),

          ...(input.firstName !== undefined
            ? {
                firstName: input.firstName.trim(),
              }
            : {}),

          ...(input.lastName !== undefined
            ? {
                lastName: input.lastName.trim(),
              }
            : {}),
        },

        select: publicUserSelect,
      });

      await auditService.writeWithinTransaction(tx, {
        organizationId: actor.organizationId,

        actorUserId: actor.userId,

        action: "USER_UPDATE",

        entityType: "USER",

        entityId: userId,

        entityKey: result.email,

        oldValues: {
          email: current.email,
          firstName: current.firstName,
          lastName: current.lastName,
        },

        newValues: {
          email: result.email,
          firstName: result.firstName,
          lastName: result.lastName,
        },

        ...auditTechnicalFields(metadata),
      });

      return result;
    });

    return toPublicUser(updated);
  }

  async list(query: ListUsersQuery, actor: AuthenticatedRequestContext) {
    const skip = (query.page - 1) * query.pageSize;

    const where: Prisma.UserWhereInput = {
      organizationId: actor.organizationId,

      ...(query.status !== undefined
        ? {
            status: query.status,
          }
        : {}),

      ...(query.q !== undefined
        ? {
            OR: [
              {
                email: {
                  contains: query.q,
                },
              },
              {
                firstName: {
                  contains: query.q,
                },
              },
              {
                lastName: {
                  contains: query.q,
                },
              },
            ],
          }
        : {}),

      ...(query.role !== undefined
        ? {
            userRoles: {
              some: {
                role: {
                  code: query.role,
                },
              },
            },
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        where,

        select: publicUserSelect,

        orderBy: [
          {
            lastName: "asc",
          },
          {
            firstName: "asc",
          },
        ],

        skip,

        take: query.pageSize,
      }),

      prisma.user.count({
        where,
      }),
    ]);

    return {
      users: rows.map(toPublicUser),

      pagination: {
        page: query.page,

        pageSize: query.pageSize,

        total,

        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }
}

export const userService = new UserService();
