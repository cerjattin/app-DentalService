import { prisma } from "../../infrastructure/database/prisma.js";

export const clinicLocationRepository = {
  list(organizationId: bigint, isActive?: boolean) {
    return prisma.clinicLocation.findMany({
      where: { organizationId, archivedAt: null, ...(isActive === undefined ? {} : { isActive }) },
      select: { id: true, code: true, name: true, isActive: true, policlinicCode: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
  },
};
