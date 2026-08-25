import type { Prisma } from "../../generated/prisma/client.js";

import { prisma } from "../../infrastructure/database/prisma.js";

export const patientDetailSelect = {
  id: true,
  organizationId: true,
  patientNumber: true,

  firstName: true,
  middleName: true,
  lastName: true,
  secondLastName: true,

  dateOfBirth: true,
  sex: true,

  documentType: true,
  documentNumber: true,

  email: true,
  phone: true,
  mobilePhone: true,

  addressLine1: true,
  addressLine2: true,
  city: true,
  countryCode: true,

  status: true,

  createdAt: true,
  updatedAt: true,
  archivedAt: true,

  insuranceCoverages: {
    select: {
      id: true,
      insuredId: true,
      status: true,
      isPrimary: true,
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

    orderBy: [
      {
        isPrimary: "desc",
      },
      {
        createdAt: "desc",
      },
    ],
  },
} satisfies Prisma.PatientSelect;

export type PatientDetailRecord = Prisma.PatientGetPayload<{
  select: typeof patientDetailSelect;
}>;

export class PatientRepository {
  findById(patientId: bigint, organizationId: bigint) {
    return prisma.patient.findFirst({
      where: {
        id: patientId,
        organizationId,
      },

      select: patientDetailSelect,
    });
  }

  findByDocument(
    organizationId: bigint,
    documentType: string,
    documentNumber: string,
  ) {
    return prisma.patient.findUnique({
      where: {
        organizationId_documentType_documentNumber: {
          organizationId,
          documentType,
          documentNumber,
        },
      },

      select: {
        id: true,
      },
    });
  }
}

export const patientRepository = new PatientRepository();
