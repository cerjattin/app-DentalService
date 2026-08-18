import { prisma } from "../lib/prisma.js";

async function main() {
  console.log("=== ODONTHO DATABASE SMOKE TEST ===");

  const [organizations, clinicLocations, roles, permissions, payers] =
    await Promise.all([
      prisma.organization.findMany({
        select: {
          id: true,
          legalName: true,
          declarantId: true,
          isActive: true,
        },
      }),

      prisma.clinicLocation.findMany({
        select: {
          id: true,
          code: true,
          name: true,
          policlinicCode: true,
          isActive: true,
        },
      }),

      prisma.role.findMany({
        select: {
          id: true,
          code: true,
          name: true,
        },
        orderBy: {
          code: "asc",
        },
      }),

      prisma.permission.count(),

      prisma.payer.findMany({
        select: {
          id: true,
          code: true,
          name: true,
          isActive: true,
        },
      }),
    ]);

  console.log("\nOrganizations:");
  console.dir(organizations, { depth: null });

  console.log("\nClinic locations:");
  console.dir(clinicLocations, { depth: null });

  console.log("\nRoles:");
  console.dir(roles, { depth: null });

  console.log("\nPermission count:");
  console.log(permissions);

  console.log("\nPayers:");
  console.dir(payers, { depth: null });

  console.log("\n✅ Prisma → MySQL connection OK");
}

main()
  .catch((error) => {
    console.error("\n❌ DATABASE SMOKE TEST FAILED");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
