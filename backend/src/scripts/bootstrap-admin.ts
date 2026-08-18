import "dotenv/config";
import * as argon2 from "argon2";
import { prisma } from "../lib/prisma.js";

const ADMIN_EMAIL = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
const ADMIN_PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD;
const ADMIN_FIRST_NAME = process.env.BOOTSTRAP_ADMIN_FIRST_NAME?.trim();
const ADMIN_LAST_NAME = process.env.BOOTSTRAP_ADMIN_LAST_NAME?.trim();

function requireValue(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

async function main() {
  const email = requireValue(ADMIN_EMAIL, "BOOTSTRAP_ADMIN_EMAIL");
  const password = requireValue(ADMIN_PASSWORD, "BOOTSTRAP_ADMIN_PASSWORD");
  const firstName = requireValue(
    ADMIN_FIRST_NAME,
    "BOOTSTRAP_ADMIN_FIRST_NAME",
  );
  const lastName = requireValue(ADMIN_LAST_NAME, "BOOTSTRAP_ADMIN_LAST_NAME");

  if (password.length < 12) {
    throw new Error(
      "BOOTSTRAP_ADMIN_PASSWORD must contain at least 12 characters.",
    );
  }

  const organization = await prisma.organization.findFirst({
    where: {
      legalName: "Odontho Services B.V.",
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  if (!organization) {
    throw new Error("Odontho Services B.V. organization was not found.");
  }

  const adminRole = await prisma.role.findUnique({
    where: {
      code: "ADMIN",
    },
    select: {
      id: true,
      isActive: true,
    },
  });

  if (!adminRole || !adminRole.isActive) {
    throw new Error("Active ADMIN role was not found.");
  }

  const existingUser = await prisma.user.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
    },
  });

  if (existingUser) {
    throw new Error(`User ${email} already exists.`);
  }

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
  });

  const admin = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        organizationId: organization.id,
        email,
        passwordHash,
        firstName,
        lastName,
        status: "ACTIVE",
        passwordChangedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
      },
    });

    await tx.userRole.create({
      data: {
        userId: user.id,
        roleId: adminRole.id,
        assignedByUserId: null,
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: organization.id,
        actorUserId: null,
        action: "BOOTSTRAP_ADMIN_CREATED",
        entityType: "User",
        entityId: user.id,
        entityKey: user.email,
        newValues: {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          status: user.status,
          role: "ADMIN",
        },
        reason: "Initial system administrator bootstrap.",
        metadata: {
          source: "bootstrap-admin.ts",
        },
      },
    });

    return user;
  });

  console.log("\n✅ Initial ADMIN created successfully");
  console.log({
    id: admin.id.toString(),
    email: admin.email,
    firstName: admin.firstName,
    lastName: admin.lastName,
    status: admin.status,
    role: "ADMIN",
  });
}

main()
  .catch((error) => {
    console.error("\n❌ ADMIN bootstrap failed");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
