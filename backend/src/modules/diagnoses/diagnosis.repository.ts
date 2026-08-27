import type { Prisma } from "../../generated/prisma/client.js";

import { prisma } from "../../infrastructure/database/prisma.js";

export const diagnosisCodeSelect = {
  id: true,
  codeSystem: true,
  code: true,
  description: true,
  isActive: true,
  validFrom: true,
  validTo: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DiagnosisCodeSelect;

export type DiagnosisCodeRecord = Prisma.DiagnosisCodeGetPayload<{
  select: typeof diagnosisCodeSelect;
}>;

export const encounterDiagnosisSelect = {
  id: true,
  encounterId: true,
  diagnosisCodeId: true,
  isPrimary: true,
  codeSnapshot: true,
  descriptionSnapshot: true,
  notes: true,
  createdByUserId: true,
  createdAt: true,

  diagnosisCode: {
    select: diagnosisCodeSelect,
  },

  encounter: {
    select: {
      id: true,
      status: true,
      appointment: {
        select: {
          id: true,
          appointmentNumber: true,
          organizationId: true,
          scheduledStartAt: true,
        },
      },
    },
  },
} satisfies Prisma.EncounterDiagnosisSelect;

export type EncounterDiagnosisRecord = Prisma.EncounterDiagnosisGetPayload<{
  select: typeof encounterDiagnosisSelect;
}>;

export const encounterForDiagnosisSelect = {
  id: true,
  status: true,
  appointment: {
    select: {
      id: true,
      appointmentNumber: true,
      organizationId: true,
      scheduledStartAt: true,
    },
  },
} satisfies Prisma.ClinicalEncounterSelect;

export type EncounterForDiagnosisRecord =
  Prisma.ClinicalEncounterGetPayload<{
    select: typeof encounterForDiagnosisSelect;
  }>;

export class DiagnosisRepository {
  findCodeById(
    diagnosisCodeId: bigint,
    client: Prisma.TransactionClient | typeof prisma = prisma,
  ) {
    return client.diagnosisCode.findUnique({
      where: {
        id: diagnosisCodeId,
      },
      select: diagnosisCodeSelect,
    });
  }

  findEncounter(
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
      select: encounterForDiagnosisSelect,
    });
  }

  findEncounterDiagnosis(
    encounterDiagnosisId: bigint,
    encounterId: bigint,
    organizationId: bigint,
    client: Prisma.TransactionClient | typeof prisma = prisma,
  ) {
    return client.encounterDiagnosis.findFirst({
      where: {
        id: encounterDiagnosisId,
        encounterId,
        encounter: {
          appointment: {
            organizationId,
          },
        },
      },
      select: encounterDiagnosisSelect,
    });
  }
}

export const diagnosisRepository = new DiagnosisRepository();
