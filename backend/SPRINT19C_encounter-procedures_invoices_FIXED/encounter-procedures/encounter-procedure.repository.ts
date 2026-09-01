import type { Prisma } from "../../generated/prisma/client.js";

import { prisma } from "../../infrastructure/database/prisma.js";

export const encounterProcedureSelect = {
  id: true,
  encounterId: true,
  patientInsuranceId: true,
  svbProcedureId: true,
  svbTariffId: true,
  authorizationItemId: true,
  diagnosisId: true,
  referrerId: true,
  performedByProviderId: true,
  procedureCodeSnapshot: true,
  procedureDescriptionSnapshot: true,
  providerIdSnapshot: true,
  insuredIdSnapshot: true,
  unitTariffSnapshot: true,
  currencyCodeSnapshot: true,
  quantity: true,
  amount: true,
  authorizationIdSnapshot: true,
  diagnosticCodeSnapshot: true,
  treatmentIdSnapshot: true,
  accidentFormNumberSnapshot: true,
  numberOfTreatmentsSnapshot: true,
  assistanceSnapshot: true,
  referrerIdSnapshot: true,
  policlinicSnapshot: true,
  performedAt: true,
  additionalNote: true,
  status: true,
  createdByUserId: true,
  createdAt: true,
  updatedAt: true,

  svbProcedure: {
    select: {
      id: true,
      code: true,
      description: true,
      requiresAuthorization: true,
      requiresReferral: true,
    },
  },

  svbTariff: {
    select: {
      id: true,
      amount: true,
      currencyCode: true,
      validFrom: true,
      validTo: true,
    },
  },

  patientInsurance: {
    select: {
      id: true,
      patientId: true,
      insuredId: true,
      status: true,
      validFrom: true,
      validTo: true,
      payer: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
    },
  },

  authorizationItem: {
    select: {
      id: true,
      authorizationId: true,
      svbProcedureId: true,
      procedureCodeSnapshot: true,
      authorizedQuantity: true,
      usedQuantity: true,
      validFrom: true,
      validTo: true,
      authorization: {
        select: {
          id: true,
          authorizationId: true,
          status: true,
        },
      },
    },
  },

  diagnosis: {
    select: {
      id: true,
      codeSnapshot: true,
      descriptionSnapshot: true,
      isPrimary: true,
    },
  },

  performedByProvider: {
    select: {
      id: true,
      svbProviderId: true,
      firstName: true,
      lastName: true,
    },
  },

  invoiceItems: {
    select: {
      id: true,
    },
    take: 1,
  },
} satisfies Prisma.EncounterProcedureSelect;

export type EncounterProcedureRecord =
  Prisma.EncounterProcedureGetPayload<{
    select: typeof encounterProcedureSelect;
  }>;

export class EncounterProcedureRepository {
  listByEncounter(
    encounterId: bigint,
    organizationId: bigint,
    client: Prisma.TransactionClient | typeof prisma = prisma,
  ) {
    return client.encounterProcedure.findMany({
      where: {
        encounterId,
        encounter: {
          appointment: {
            organizationId,
          },
        },
      },
      select: encounterProcedureSelect,
      orderBy: {
        createdAt: "asc",
      },
    });
  }

  findById(
    encounterId: bigint,
    encounterProcedureId: bigint,
    organizationId: bigint,
    client: Prisma.TransactionClient | typeof prisma = prisma,
  ) {
    return client.encounterProcedure.findFirst({
      where: {
        id: encounterProcedureId,
        encounterId,
        encounter: {
          appointment: {
            organizationId,
          },
        },
      },
      select: encounterProcedureSelect,
    });
  }
}

export const encounterProcedureRepository =
  new EncounterProcedureRepository();
