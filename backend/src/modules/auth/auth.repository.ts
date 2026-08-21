import type { Prisma } from "../../generated/prisma/client.js";

import { prisma } from "../../infrastructure/database/prisma.js";

export const authUserSelect = {
  id: true,
  organizationId: true,

  email: true,
  passwordHash: true,

  firstName: true,
  lastName: true,

  status: true,

  lastLoginAt: true,
  failedLoginAttempts: true,
  lockedUntil: true,

  archivedAt: true,

  userRoles: {
    select: {
      role: {
        select: {
          code: true,
          isActive: true,

          rolePermissions: {
            select: {
              permission: {
                select: {
                  code: true,
                },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.UserSelect;

export type AuthUserRecord = Prisma.UserGetPayload<{
  select: typeof authUserSelect;
}>;

export class AuthRepository {
  findByEmail(email: string): Promise<AuthUserRecord | null> {
    return prisma.user.findUnique({
      where: {
        email,
      },

      select: authUserSelect,
    });
  }

  findById(userId: bigint): Promise<AuthUserRecord | null> {
    return prisma.user.findUnique({
      where: {
        id: userId,
      },

      select: authUserSelect,
    });
  }
}

export const authRepository = new AuthRepository();
