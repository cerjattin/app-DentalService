import type { Prisma } from "../../generated/prisma/client.js";

import { prisma } from "../../infrastructure/database/prisma.js";

export const providerDetailSelect = {
  id: true,
  organizationId: true,
  userId: true,
  svbProviderId: true,
  firstName: true,
  lastName: true,
  licenseNumber: true,
  specialty: true,
  email: true,
  phone: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  archivedAt: true,

  user: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      status: true,
    },
  },
} satisfies Prisma.ProviderSelect;

export type ProviderDetailRecord = Prisma.ProviderGetPayload<{
  select: typeof providerDetailSelect;
}>;

export class ProviderRepository {
  findById(
    providerId: bigint,
    organizationId: bigint,
    client: Prisma.TransactionClient | typeof prisma = prisma,
  ) {
    return client.provider.findFirst({
      where: {
        id: providerId,
        organizationId,
      },

      select: providerDetailSelect,
    });
  }

  findBySvbProviderId(
    organizationId: bigint,
    svbProviderId: string,
    client: Prisma.TransactionClient | typeof prisma = prisma,
  ) {
    return client.provider.findFirst({
      where: {
        organizationId,
        svbProviderId,
      },

      select: {
        id: true,
      },
    });
  }

  findByUserId(
    userId: bigint,
    client: Prisma.TransactionClient | typeof prisma = prisma,
  ) {
    return client.provider.findUnique({
      where: {
        userId,
      },

      select: {
        id: true,
        organizationId: true,
      },
    });
  }
}

export const providerRepository = new ProviderRepository();
