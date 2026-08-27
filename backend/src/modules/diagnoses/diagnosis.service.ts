import { Prisma } from "../../generated/prisma/client.js";

import { prisma } from "../../infrastructure/database/prisma.js";

import { AppError } from "../../shared/errors/app-error.js";
import { parseDateOnly } from "../../shared/utils/date-only.js";

import { auditService, auditTechnicalFields } from "../audit/audit.service.js";

import type {
  AuthenticatedRequestContext,
  RequestSecurityMetadata,
} from "../auth/auth.types.js";

import {
  diagnosisCodeSelect,
  diagnosisRepository,
  encounterDiagnosisSelect,
  type EncounterDiagnosisRecord,
  type EncounterForDiagnosisRecord,
} from "./diagnosis.repository.js";

import type {
  CreateEncounterDiagnosisInput,
  ListDiagnosisCodesQuery,
  UpdateEncounterDiagnosisInput,
} from "./diagnosis.schemas.js";

import {
  toDiagnosisCodeResponse,
  toEncounterDiagnosisResponse,
} from "./diagnosis.types.js";

function serviceDateInCuracao(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Curacao",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (year === undefined || month === undefined || day === undefined) {
    throw new AppError(
      500,
      "INTERNAL_SERVER_ERROR",
      "Unable to resolve service date",
    );
  }

  return parseDateOnly(`${year}-${month}-${day}`, "serviceDate");
}

function toAuditValues(diagnosis: {
  encounterId: bigint;
  diagnosisCodeId: bigint;
  isPrimary: boolean;
  codeSnapshot: string;
  descriptionSnapshot: string;
  notes: string | null;
  createdByUserId: bigint;
  createdAt: Date;
}) {
  return {
    encounterId: diagnosis.encounterId.toString(),
    diagnosisCodeId: diagnosis.diagnosisCodeId.toString(),
    isPrimary: diagnosis.isPrimary,
    codeSnapshot: diagnosis.codeSnapshot,
    descriptionSnapshot: diagnosis.descriptionSnapshot,
    notes: diagnosis.notes,
    createdByUserId: diagnosis.createdByUserId.toString(),
    createdAt: diagnosis.createdAt.toISOString(),
  };
}

function entityKey(encounter: EncounterForDiagnosisRecord, codeSnapshot: string) {
  return `${encounter.appointment.appointmentNumber}:${codeSnapshot}`;
}

function assertEncounterEditable(encounter: EncounterForDiagnosisRecord) {
  if (encounter.status !== "OPEN") {
    throw new AppError(
      409,
      "CLINICAL_ENCOUNTER_NOT_EDITABLE",
      "Clinical encounter is not editable",
    );
  }
}

function assertDiagnosisValidForServiceDate(
  diagnosisCode: {
    isActive: boolean;
    validFrom: Date | null;
    validTo: Date | null;
  },
  serviceDate: Date,
) {
  if (!diagnosisCode.isActive) {
    throw new AppError(
      409,
      "DIAGNOSIS_CODE_INACTIVE",
      "Diagnosis code is inactive",
    );
  }

  if (
    (diagnosisCode.validFrom !== null &&
      diagnosisCode.validFrom > serviceDate) ||
    (diagnosisCode.validTo !== null && diagnosisCode.validTo < serviceDate)
  ) {
    throw new AppError(
      409,
      "DIAGNOSIS_CODE_NOT_VALID",
      "Diagnosis code is not valid for the service date",
    );
  }
}

function isSerializableConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

function mapUniqueError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw new AppError(
      409,
      "DIAGNOSIS_ALREADY_ASSIGNED",
      "Diagnosis is already assigned to this encounter",
    );
  }

  throw error;
}

async function serializableTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10_000,
        timeout: 10_000,
      });
    } catch (error) {
      if (!isSerializableConflict(error)) {
        throw error;
      }

      lastError = error;
    }
  }

  throw lastError;
}

export class DiagnosisService {
  async listCodes(query: ListDiagnosisCodesQuery) {
    const skip = (query.page - 1) * query.pageSize;

    const where: Prisma.DiagnosisCodeWhereInput = {
      ...(query.codeSystem !== undefined
        ? {
            codeSystem: query.codeSystem,
          }
        : {}),

      ...(query.isActive !== undefined
        ? {
            isActive: query.isActive,
          }
        : {}),

      ...(query.q !== undefined
        ? {
            OR: [
              {
                code: {
                  contains: query.q,
                },
              },
              {
                description: {
                  contains: query.q,
                },
              },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.diagnosisCode.findMany({
        where,
        select: diagnosisCodeSelect,
        orderBy: [{ codeSystem: "asc" }, { code: "asc" }],
        skip,
        take: query.pageSize,
      }),

      prisma.diagnosisCode.count({
        where,
      }),
    ]);

    return {
      diagnosisCodes: rows.map(toDiagnosisCodeResponse),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async getCodeById(diagnosisCodeId: bigint) {
    const diagnosisCode =
      await diagnosisRepository.findCodeById(diagnosisCodeId);

    if (!diagnosisCode) {
      throw new AppError(
        404,
        "DIAGNOSIS_CODE_NOT_FOUND",
        "Diagnosis code not found",
      );
    }

    return toDiagnosisCodeResponse(diagnosisCode);
  }

  async listEncounterDiagnoses(
    encounterId: bigint,
    actor: AuthenticatedRequestContext,
  ) {
    const encounter = await diagnosisRepository.findEncounter(
      encounterId,
      actor.organizationId,
    );

    if (!encounter) {
      throw new AppError(
        404,
        "CLINICAL_ENCOUNTER_NOT_FOUND",
        "Clinical encounter not found",
      );
    }

    const rows = await prisma.encounterDiagnosis.findMany({
      where: {
        encounterId,
      },
      select: encounterDiagnosisSelect,
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    });

    return rows.map(toEncounterDiagnosisResponse);
  }

  async assignEncounterDiagnosis(
    encounterId: bigint,
    input: CreateEncounterDiagnosisInput,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    const diagnosisCodeId = BigInt(input.diagnosisCodeId);

    try {
      const created = await serializableTransaction(async (tx) => {
        const encounter = await diagnosisRepository.findEncounter(
          encounterId,
          actor.organizationId,
          tx,
        );

        if (!encounter) {
          throw new AppError(
            404,
            "CLINICAL_ENCOUNTER_NOT_FOUND",
            "Clinical encounter not found",
          );
        }

        assertEncounterEditable(encounter);

        const diagnosisCode =
          await diagnosisRepository.findCodeById(diagnosisCodeId, tx);

        if (!diagnosisCode) {
          throw new AppError(
            404,
            "DIAGNOSIS_CODE_NOT_FOUND",
            "Diagnosis code not found",
          );
        }

        assertDiagnosisValidForServiceDate(
          diagnosisCode,
          serviceDateInCuracao(encounter.appointment.scheduledStartAt),
        );

        const existing = await tx.encounterDiagnosis.findUnique({
          where: {
            encounterId_diagnosisCodeId: {
              encounterId,
              diagnosisCodeId,
            },
          },
          select: {
            id: true,
          },
        });

        if (existing) {
          throw new AppError(
            409,
            "DIAGNOSIS_ALREADY_ASSIGNED",
            "Diagnosis is already assigned to this encounter",
          );
        }

        if (input.isPrimary) {
          await tx.encounterDiagnosis.updateMany({
            where: {
              encounterId,
              isPrimary: true,
            },
            data: {
              isPrimary: false,
            },
          });
        }

        const diagnosis = await tx.encounterDiagnosis.create({
          data: {
            encounterId,
            diagnosisCodeId,
            isPrimary: input.isPrimary,
            codeSnapshot: diagnosisCode.code,
            descriptionSnapshot: diagnosisCode.description,
            notes: input.notes ?? null,
            createdByUserId: actor.userId,
          },
          select: encounterDiagnosisSelect,
        });

        await auditService.writeWithinTransaction(tx, {
          organizationId: actor.organizationId,
          actorUserId: actor.userId,
          action: "ENCOUNTER_DIAGNOSIS_ASSIGN",
          entityType: "ENCOUNTER_DIAGNOSIS",
          entityId: diagnosis.id,
          entityKey: entityKey(encounter, diagnosis.codeSnapshot),
          newValues: toAuditValues(diagnosis),
          ...auditTechnicalFields(metadata),
        });

        return diagnosis;
      });

      return toEncounterDiagnosisResponse(created);
    } catch (error) {
      mapUniqueError(error);
    }
  }

  async updateEncounterDiagnosis(
    encounterId: bigint,
    encounterDiagnosisId: bigint,
    input: UpdateEncounterDiagnosisInput,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    const updated = await serializableTransaction(async (tx) => {
      const encounter = await diagnosisRepository.findEncounter(
        encounterId,
        actor.organizationId,
        tx,
      );

      if (!encounter) {
        throw new AppError(
          404,
          "CLINICAL_ENCOUNTER_NOT_FOUND",
          "Clinical encounter not found",
        );
      }

      assertEncounterEditable(encounter);

      const current = await diagnosisRepository.findEncounterDiagnosis(
        encounterDiagnosisId,
        encounterId,
        actor.organizationId,
        tx,
      );

      if (!current) {
        throw new AppError(
          404,
          "ENCOUNTER_DIAGNOSIS_NOT_FOUND",
          "Encounter diagnosis not found",
        );
      }

      if (input.isPrimary === true) {
        await tx.encounterDiagnosis.updateMany({
          where: {
            encounterId,
            isPrimary: true,
            id: {
              not: encounterDiagnosisId,
            },
          },
          data: {
            isPrimary: false,
          },
        });
      }

      const updateData: Prisma.EncounterDiagnosisUncheckedUpdateInput = {};

      if (input.isPrimary !== undefined) {
        updateData.isPrimary = input.isPrimary;
      }

      if (input.notes !== undefined) {
        updateData.notes = input.notes;
      }

      const diagnosis = await tx.encounterDiagnosis.update({
        where: {
          id: encounterDiagnosisId,
        },
        data: updateData,
        select: encounterDiagnosisSelect,
      });

      await auditService.writeWithinTransaction(tx, {
        organizationId: actor.organizationId,
        actorUserId: actor.userId,
        action: "ENCOUNTER_DIAGNOSIS_UPDATE",
        entityType: "ENCOUNTER_DIAGNOSIS",
        entityId: diagnosis.id,
        entityKey: entityKey(encounter, diagnosis.codeSnapshot),
        oldValues: toAuditValues(current),
        newValues: toAuditValues(diagnosis),
        ...auditTechnicalFields(metadata),
      });

      return diagnosis;
    });

    return toEncounterDiagnosisResponse(updated);
  }

  async removeEncounterDiagnosis(
    encounterId: bigint,
    encounterDiagnosisId: bigint,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    const removed: EncounterDiagnosisRecord = await prisma.$transaction(
      async (tx) => {
        const encounter = await diagnosisRepository.findEncounter(
          encounterId,
          actor.organizationId,
          tx,
        );

        if (!encounter) {
          throw new AppError(
            404,
            "CLINICAL_ENCOUNTER_NOT_FOUND",
            "Clinical encounter not found",
          );
        }

        assertEncounterEditable(encounter);

        const current = await diagnosisRepository.findEncounterDiagnosis(
          encounterDiagnosisId,
          encounterId,
          actor.organizationId,
          tx,
        );

        if (!current) {
          throw new AppError(
            404,
            "ENCOUNTER_DIAGNOSIS_NOT_FOUND",
            "Encounter diagnosis not found",
          );
        }

        await tx.encounterDiagnosis.delete({
          where: {
            id: encounterDiagnosisId,
          },
        });

        await auditService.writeWithinTransaction(tx, {
          organizationId: actor.organizationId,
          actorUserId: actor.userId,
          action: "ENCOUNTER_DIAGNOSIS_REMOVE",
          entityType: "ENCOUNTER_DIAGNOSIS",
          entityId: current.id,
          entityKey: entityKey(encounter, current.codeSnapshot),
          oldValues: toAuditValues(current),
          ...auditTechnicalFields(metadata),
        });

        return current;
      },
    );

    return toEncounterDiagnosisResponse(removed);
  }
}

export const diagnosisService = new DiagnosisService();
