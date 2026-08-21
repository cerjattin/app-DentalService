import type { Prisma } from "../../generated/prisma/client.js";

import { prisma } from "../../infrastructure/database/prisma.js";

export const publicUserSelect = {
  id: true,
  organizationId: true,
  email: true,
  firstName: true,
  lastName: true,
  status: true,
  lastLoginAt: true,
  passwordChangedAt: true,
  failedLoginAttempts: true,
  lockedUntil: true,
  createdAt: true,
  updatedAt: true,
  archivedAt: true,

  userRoles: {
    select: {
      assignedAt: true,

      role: {
        select: {
          id: true,
          code: true,
          name: true,
          isActive: true,
        },
      },
    },
  },
} satisfies Prisma.UserSelect;

export type PublicUserRecord = Prisma.UserGetPayload<{
  select: typeof publicUserSelect;
}>;

export class UserRepository {
  findById(
    id: bigint,
    organizationId: bigint,
  ): Promise<PublicUserRecord | null> {
    return prisma.user.findFirst({
      where: {
        id,
        organizationId,
      },

      select: publicUserSelect,
    });
  }

  findByEmail(email: string) {
    return prisma.user.findUnique({
      where: {
        email,
      },

      select: {
        id: true,
      },
    });
  }
}

export const userRepository = new UserRepository();
