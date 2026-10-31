import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../infrastructure/database/prisma.js";

export const organizationSelect = {
  id: true, legalName: true, tradeName: true, declarantId: true,
  email: true, phone: true, timezone: true, updatedAt: true,
} satisfies Prisma.OrganizationSelect;
export type OrganizationSettingsRecord = Prisma.OrganizationGetPayload<{ select: typeof organizationSelect }>;
export const organizationRepository = {
  find(id: bigint, client: Prisma.TransactionClient | typeof prisma = prisma) {
    return client.organization.findFirst({ where: { id, isActive: true, archivedAt: null }, select: organizationSelect });
  },
  async lock(tx: Prisma.TransactionClient, id: bigint) {
    await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${id} AND is_active = true AND archived_at IS NULL FOR UPDATE`;
    return this.find(id, tx);
  },
  update(tx: Prisma.TransactionClient, id: bigint, data: Prisma.OrganizationUpdateInput) {
    return tx.organization.update({ where: { id }, data, select: organizationSelect });
  },
};
