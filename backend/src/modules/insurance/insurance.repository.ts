import type { Prisma } from "../../generated/prisma/client.js";

import { prisma } from "../../infrastructure/database/prisma.js";

export const insuranceDetailSelect = {
  id: true,
  patientId: true,
  payerId: true,
  insuredId: true,
  validFrom: true,
  validTo: true,
  status: true,
  isPrimary: true,
  verifiedAt: true,
  verifiedByUserId: true,
  verificationSource: true,
  createdAt: true,
  updatedAt: true,

  payer: {
    select: {
      id: true,
      code: true,
      name: true,
      payerType: true,
    },
  },

  verifiedByUser: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
} satisfies Prisma.PatientInsuranceSelect;

export const payerSelect = {
  id: true,
  code: true,
  name: true,
  payerType: true,
} satisfies Prisma.PayerSelect;

export type InsuranceDetailRecord = Prisma.PatientInsuranceGetPayload<{
  select: typeof insuranceDetailSelect;
}>;

export type PayerRecord = Prisma.PayerGetPayload<{
  select: typeof payerSelect;
}>;

export class InsuranceRepository {
  findPatient(patientId: bigint, organizationId: bigint) {
    return prisma.patient.findFirst({
      where: {
        id: patientId,
        organizationId,
      },

      select: {
        id: true,
      },
    });
  }

  findActivePayers() {
    return prisma.payer.findMany({
      where: {
        isActive: true,
      },

      select: payerSelect,

      orderBy: {
        name: "asc",
      },
    });
  }

  findActivePayer(payerId: bigint, tx: Prisma.TransactionClient) {
    return tx.payer.findFirst({
      where: {
        id: payerId,
        isActive: true,
      },

      select: {
        id: true,
      },
    });
  }

  findByIdForPatient(
    patientId: bigint,
    insuranceId: bigint,
    organizationId: bigint,
    client: Prisma.TransactionClient | typeof prisma = prisma,
  ) {
    return client.patientInsurance.findFirst({
      where: {
        id: insuranceId,
        patientId,
        patient: {
          organizationId,
        },
      },

      select: insuranceDetailSelect,
    });
  }

  listByPatient(patientId: bigint, organizationId: bigint) {
    return prisma.patientInsurance.findMany({
      where: {
        patientId,
        patient: {
          organizationId,
        },
      },

      select: insuranceDetailSelect,

      orderBy: [
        {
          isPrimary: "desc",
        },
        {
          validFrom: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
    });
  }
}

export const insuranceRepository = new InsuranceRepository();
