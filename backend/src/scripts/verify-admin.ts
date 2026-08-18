import "dotenv/config";
import * as argon2 from "argon2";

import { prisma } from "../lib/prisma.js";

const ADMIN_EMAIL =
  process.env.VERIFY_ADMIN_EMAIL?.trim().toLowerCase() ??
  "admin@odonthoservices.com";

const ADMIN_PASSWORD = process.env.VERIFY_ADMIN_PASSWORD;

async function main() {
  if (!ADMIN_PASSWORD) {
    throw new Error("VERIFY_ADMIN_PASSWORD is required.");
  }

  const user = await prisma.user.findUnique({
    where: {
      email: ADMIN_EMAIL,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      status: true,
      passwordHash: true,
    },
  });

  if (!user) {
    throw new Error(`ADMIN user ${ADMIN_EMAIL} was not found.`);
  }

  const passwordValid = await argon2.verify(user.passwordHash, ADMIN_PASSWORD);

  if (!passwordValid) {
    throw new Error("ADMIN password verification failed.");
  }

  const userRoles = await prisma.userRole.findMany({
    where: {
      userId: user.id,
    },
    include: {
      role: {
        include: {
          rolePermissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  });

  const roles = userRoles.map((item) => item.role.code);

  const permissions = [
    ...new Set(
      userRoles.flatMap((item) =>
        item.role.rolePermissions.map(
          (rolePermission) => rolePermission.permission.code,
        ),
      ),
    ),
  ].sort();

  if (!roles.includes("ADMIN")) {
    throw new Error("User does not have ADMIN role.");
  }

  console.log("\n=== ADMIN VERIFICATION ===");

  console.log({
    id: user.id.toString(),
    email: user.email,
    name: `${user.firstName} ${user.lastName}`,
    status: user.status,
    passwordValid,
    roles,
    permissionCount: permissions.length,
  });

  console.log("\n✅ Password hash verified");
  console.log("✅ ADMIN role verified");
  console.log("✅ RBAC permissions loaded");
}

main()
  .catch((error) => {
    console.error("\n❌ ADMIN verification failed");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
