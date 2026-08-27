import type { Prisma } from "../../generated/prisma/client.js";

import { prisma } from "../../infrastructure/database/prisma.js";

export const svbProcedureSelect = {
  id: true,
  code: true,
  description: true,
  category: true,
  unit: true,
  requiresAuthorization: true,
  requiresReferral: true,
  isActive: true,
  validFrom: true,
  validTo: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SvbProcedureSelect;

export type SvbProcedureRecord = Prisma.SvbProcedureGetPayload<{
  select: typeof svbProcedureSelect;
}>;

export const svbTariffSelect = {
  id: true,
  svbProcedureId: true,
  amount: true,
  currencyCode: true,
  validFrom: true,
  validTo: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SvbTariffSelect;

export type SvbTariffRecord = Prisma.SvbTariffGetPayload<{
  select: typeof svbTariffSelect;
}>;

export class SvbCatalogRepository {
  findProcedureById(
    svbProcedureId: bigint,
    client: Prisma.TransactionClient | typeof prisma = prisma,
  ) {
    return client.svbProcedure.findUnique({
      where: {
        id: svbProcedureId,
      },
      select: svbProcedureSelect,
    });
  }
}

export const svbCatalogRepository = new SvbCatalogRepository();
