import type { PublicUserRecord } from "./user.repository.js";

export function toPublicUser(user: PublicUserRecord) {
  return {
    id: user.id.toString(),

    organizationId: user.organizationId.toString(),

    email: user.email,

    firstName: user.firstName,

    lastName: user.lastName,

    status: user.status,

    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,

    passwordChangedAt: user.passwordChangedAt?.toISOString() ?? null,

    failedLoginAttempts: user.failedLoginAttempts,

    lockedUntil: user.lockedUntil?.toISOString() ?? null,

    archivedAt: user.archivedAt?.toISOString() ?? null,

    createdAt: user.createdAt.toISOString(),

    updatedAt: user.updatedAt.toISOString(),

    roles: user.userRoles.map(({ role, assignedAt }) => ({
      id: role.id.toString(),

      code: role.code,

      name: role.name,

      isActive: role.isActive,

      assignedAt: assignedAt.toISOString(),
    })),
  };
}
