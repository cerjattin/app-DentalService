import "dotenv/config";

import { prisma } from "../src/lib/prisma.js";

async function main() {
  const organization = await prisma.organization.findFirstOrThrow({
    where: { legalName: "Odontho Services B.V." },
    select: {
      id: true,
      legalName: true,
      declarantId: true,
    },
  });

  const [location, payer, permissionCount, roles, sequences, settings] =
    await Promise.all([
      prisma.clinicLocation.findUnique({
        where: {
          organizationId_code: {
            organizationId: organization.id,
            code: "MAIN",
          },
        },
        select: {
          code: true,
          name: true,
          policlinicCode: true,
        },
      }),
      prisma.payer.findUnique({
        where: { code: "SVB" },
        select: {
          code: true,
          name: true,
          payerType: true,
        },
      }),
      prisma.permission.count(),
      prisma.role.findMany({
        where: {
          code: { in: ["ADMIN", "RECEPTION", "PROVIDER"] },
        },
        select: {
          code: true,
          _count: {
            select: {
              rolePermissions: true,
            },
          },
        },
        orderBy: { code: "asc" },
      }),
      prisma.numberSequence.findMany({
        where: {
          organizationId: organization.id,
        },
        select: {
          sequenceType: true,
          sequenceYear: true,
          prefix: true,
          currentValue: true,
          padding: true,
        },
        orderBy: [
          { sequenceType: "asc" },
          { sequenceYear: "asc" },
        ],
      }),
      prisma.systemSetting.findMany({
        where: {
          organizationId: organization.id,
        },
        select: {
          settingKey: true,
          settingValue: true,
        },
        orderBy: {
          settingKey: "asc",
        },
      }),
    ]);

  console.log("=== ODONTHO PRISMA SEED VERIFY ===");
  console.log({
    organization: {
      id: organization.id.toString(),
      legalName: organization.legalName,
      declarantId: organization.declarantId,
    },
    location,
    payer,
    permissionCount,
    roles: roles.map((role) => ({
      code: role.code,
      permissionCount: role._count.rolePermissions,
    })),
    sequences: sequences.map((sequence) => ({
      ...sequence,
      currentValue: sequence.currentValue.toString(),
    })),
    settings,
  });

  const admin = roles.find((role) => role.code === "ADMIN");
  const reception = roles.find((role) => role.code === "RECEPTION");
  const provider = roles.find((role) => role.code === "PROVIDER");

  if (permissionCount !== 68) {
    throw new Error(`Expected 68 permissions, found ${permissionCount}.`);
  }

  if (admin?._count.rolePermissions !== 68) {
    throw new Error(
      `Expected ADMIN to have 68 permissions, found ${admin?._count.rolePermissions}.`,
    );
  }

  if (reception?._count.rolePermissions !== 35) {
    throw new Error(
      `Expected RECEPTION to have 35 permissions, found ${reception?._count.rolePermissions}.`,
    );
  }

  if (provider?._count.rolePermissions !== 29) {
    throw new Error(
      `Expected PROVIDER to have 29 permissions, found ${provider?._count.rolePermissions}.`,
    );
  }

  console.log("✅ Seed verification passed.");
}

main()
  .catch((error) => {
    console.error("❌ Seed verification failed.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
