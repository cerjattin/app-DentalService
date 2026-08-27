import type { Prisma } from "../../generated/prisma/client.js";

import { prisma } from "../../infrastructure/database/prisma.js";

export const authorizationItemSelect = {
  id: true,
  authorizationId: true,
  svbProcedureId: true,
  procedureCodeSnapshot: true,
  authorizedQuantity: true,
  usedQuantity: true,
  validFrom: true,
  validTo: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  svbProcedure: {
    select: {
      id: true,
      code: true,
      description: true,
      requiresAuthorization: true,
    },
  },
} satisfies Prisma.SvbAuthorizationItemSelect;

export type AuthorizationItemRecord = Prisma.SvbAuthorizationItemGetPayload<{
  select: typeof authorizationItemSelect;
}>;

export const authorizationSelect = {
  id: true,
  patientId: true,
  patientInsuranceId: true,
  authorizationId: true,
  status: true,
  validFrom: true,
  validTo: true,
  issuedAt: true,
  notes: true,
  metadata: true,
  createdByUserId: true,
  createdAt: true,
  updatedAt: true,
  patient: {
    select: {
      id: true,
      patientNumber: true,
      firstName: true,
      lastName: true,
    },
  },
  patientInsurance: {
    select: {
      id: true,
      patientId: true,
      insuredId: true,
      status: true,
      payer: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
    },
  },
  items: {
    select: authorizationItemSelect,
    orderBy: {
      createdAt: "asc",
    },
  },
} satisfies Prisma.SvbAuthorizationSelect;

export type AuthorizationRecord = Prisma.SvbAuthorizationGetPayload<{
  select: typeof authorizationSelect;
}>;

export const authorizationForResolverSelect = {
  id: true,
  patientId: true,
  patientInsuranceId: true,
  authorizationId: true,
  status: true,
  validFrom: true,
  validTo: true,
  patientInsurance: {
    select: {
      id: true,
      patientId: true,
    },
  },
} satisfies Prisma.SvbAuthorizationSelect;

export const authorizationItemForResolverSelect = {
  id: true,
  authorizationId: true,
  svbProcedureId: true,
  procedureCodeSnapshot: true,
  authorizedQuantity: true,
  usedQuantity: true,
  validFrom: true,
  validTo: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  authorization: {
    select: authorizationForResolverSelect,
  },
} satisfies Prisma.SvbAuthorizationItemSelect;

export type AuthorizationItemForResolverRecord =
  Prisma.SvbAuthorizationItemGetPayload<{
    select: typeof authorizationItemForResolverSelect;
  }>;

export class AuthorizationRepository {
  findById(
    authorizationId: bigint,
    organizationId: bigint,
    client: Prisma.TransactionClient | typeof prisma = prisma,
  ) {
    return client.svbAuthorization.findFirst({
      where: {
        id: authorizationId,
        patient: {
          organizationId,
        },
      },
      select: authorizationSelect,
    });
  }

  findItemById(
    authorizationId: bigint,
    itemId: bigint,
    organizationId: bigint,
    client: Prisma.TransactionClient | typeof prisma = prisma,
  ) {
    return client.svbAuthorizationItem.findFirst({
      where: {
        id: itemId,
        authorizationId,
        authorization: {
          patient: {
            organizationId,
          },
        },
      },
      select: authorizationItemSelect,
    });
  }
}

export const authorizationRepository = new AuthorizationRepository();
