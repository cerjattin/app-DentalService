import type { Prisma } from "../../generated/prisma/client.js";

import { prisma } from "../../infrastructure/database/prisma.js";

export const clinicalEncounterDetailSelect = {
  id: true,
  appointmentId: true,
  providerId: true,
  status: true,
  startedAt: true,
  completedAt: true,
  chiefComplaint: true,
  clinicalNotes: true,
  createdByUserId: true,
  createdAt: true,
  updatedAt: true,

  appointment: {
    select: {
      id: true,
      appointmentNumber: true,
      scheduledStartAt: true,
      scheduledEndAt: true,
      status: true,
      organizationId: true,
      patient: {
        select: {
          id: true,
          patientNumber: true,
          firstName: true,
          middleName: true,
          lastName: true,
          secondLastName: true,
        },
      },
    },
  },

  provider: {
    select: {
      id: true,
      svbProviderId: true,
      firstName: true,
      lastName: true,
      isActive: true,
    },
  },
} satisfies Prisma.ClinicalEncounterSelect;

export type ClinicalEncounterDetailRecord =
  Prisma.ClinicalEncounterGetPayload<{
    select: typeof clinicalEncounterDetailSelect;
  }>;

export class ClinicalEncounterRepository {
  findById(
    encounterId: bigint,
    organizationId: bigint,
    client: Prisma.TransactionClient | typeof prisma = prisma,
  ) {
    return client.clinicalEncounter.findFirst({
      where: {
        id: encounterId,
        appointment: {
          organizationId,
        },
      },
      select: clinicalEncounterDetailSelect,
    });
  }

  findByAppointmentId(
    appointmentId: bigint,
    organizationId: bigint,
    client: Prisma.TransactionClient | typeof prisma = prisma,
  ) {
    return client.clinicalEncounter.findFirst({
      where: {
        appointmentId,
        appointment: {
          organizationId,
        },
      },
      select: clinicalEncounterDetailSelect,
    });
  }
}

export const clinicalEncounterRepository = new ClinicalEncounterRepository();
