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

import type { CreateUserInput, ListUsersQuery } from "./user.schemas.js";

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
