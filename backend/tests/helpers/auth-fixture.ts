import argon2 from "argon2";

import { prisma } from "../../src/infrastructure/database/prisma.js";

export const AUTH_TEST_EMAIL = "auth.integration@local.invalid";

export const AUTH_TEST_PASSWORD = "Test-Auth-Password-2026!";

export interface AuthFixture {
  userId: bigint;
  organizationId: bigint;
  email: string;
  password: string;
}

export async function createAuthFixture(
  roleCode: "ADMIN" | "RECEPTION" | "PROVIDER" = "RECEPTION",
): Promise<AuthFixture> {
  /*
   * Limpiamos cualquier fixture abandonada
   * por una ejecución anterior.
   */
  await cleanupAuthFixture();

  const organization = await prisma.organization.findFirstOrThrow({
    where: {
      legalName: "Odontho Services B.V.",

      isActive: true,
    },

    select: {
      id: true,
    },
  });

  const role = await prisma.role.findUniqueOrThrow({
    where: {
      code: roleCode,
    },

    select: {
      id: true,
    },
  });

  const passwordHash = await argon2.hash(AUTH_TEST_PASSWORD, {
    type: argon2.argon2id,
  });

  const user = await prisma.user.create({
    data: {
      organizationId: organization.id,

      email: AUTH_TEST_EMAIL,

      passwordHash,

      firstName: "Auth",

      lastName: "Integration",

      status: "ACTIVE",
    },

    select: {
      id: true,
    },
  });

  await prisma.userRole.create({
    data: {
      userId: user.id,

      roleId: role.id,
    },
  });

  return {
    userId: user.id,

    organizationId: organization.id,

    email: AUTH_TEST_EMAIL,

    password: AUTH_TEST_PASSWORD,
  };
}

export async function cleanupAuthFixture(): Promise<void> {
  const user = await prisma.user.findUnique({
    where: {
      email: AUTH_TEST_EMAIL,
    },

    select: {
      id: true,
    },
  });

  if (!user) {
    return;
  }

  /*
   * Test-only cleanup.
   *
   * Login exitoso puede generar audit_logs
   * con FK actor_user_id -> users.
   */
  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        {
          actorUserId: user.id,
        },

        {
          entityType: "USER",

          entityId: user.id,
        },

        {
          entityKey: AUTH_TEST_EMAIL,
        },
      ],
    },
  });

  await prisma.userRole.deleteMany({
    where: {
      userId: user.id,
    },
  });

  await prisma.user.delete({
    where: {
      id: user.id,
    },
  });
}
