import {
  Prisma,
  type ClinicalEncounterStatus,
} from "../../generated/prisma/client.js";

import { prisma } from "../../infrastructure/database/prisma.js";

import { AppError } from "../../shared/errors/app-error.js";
import { parseDateOnly } from "../../shared/utils/date-only.js";

import { auditService, auditTechnicalFields } from "../audit/audit.service.js";

import type {
  AuthenticatedRequestContext,
  RequestSecurityMetadata,
} from "../auth/auth.types.js";

import {
  clinicalEncounterDetailSelect,
  clinicalEncounterRepository,
  type ClinicalEncounterDetailRecord,
} from "./clinical-encounter.repository.js";

import type {
  CreateClinicalEncounterInput,
  ListClinicalEncountersQuery,
  UpdateClinicalEncounterInput,
} from "./clinical-encounter.schemas.js";

import { toClinicalEncounterResponse } from "./clinical-encounter.types.js";

function parseTimestamp(value: string, fieldName: string): Date {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, "INVALID_DATE", `${fieldName} is invalid`);
  }

  return date;
}

function toAuditValues(encounter: {
  appointmentId: bigint;
  providerId: bigint;
  status: ClinicalEncounterStatus;
  startedAt: Date;
  completedAt: Date | null;
  chiefComplaint: string | null;
  clinicalNotes: string | null;
  createdByUserId: bigint;
}) {
  return {
    appointmentId: encounter.appointmentId.toString(),
    providerId: encounter.providerId.toString(),
    status: encounter.status,
    startedAt: encounter.startedAt.toISOString(),
    completedAt: encounter.completedAt?.toISOString() ?? null,
    chiefComplaint: encounter.chiefComplaint,
    clinicalNotes: encounter.clinicalNotes,
    createdByUserId: encounter.createdByUserId.toString(),
  };
}

function mapDuplicateEncounterError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2002" || error.code === "P2034")
  ) {
    throw new AppError(
      409,
      "CLINICAL_ENCOUNTER_ALREADY_EXISTS",
      "Clinical encounter already exists for this appointment",
    );
  }

  throw error;
}

function assertAppointmentCanOpenEncounter(appointment: { status: string }) {
  if (appointment.status !== "IN_PROGRESS") {
    throw new AppError(
      409,
      "INVALID_APPOINTMENT_STATUS",
      "Appointment must be IN_PROGRESS before opening a clinical encounter",
    );
  }
}

function assertEncounterEditable(status: ClinicalEncounterStatus) {
  if (status !== "OPEN") {
    throw new AppError(
      409,
      "CLINICAL_ENCOUNTER_NOT_EDITABLE",
      "Clinical encounter is not editable",
    );
  }
}

function assertEncounterCompletable(status: ClinicalEncounterStatus) {
  if (status === "COMPLETED") {
    throw new AppError(
      409,
      "CLINICAL_ENCOUNTER_ALREADY_COMPLETED",
      "Clinical encounter is already completed",
    );
  }

  if (status !== "OPEN") {
    throw new AppError(
      409,
      "INVALID_CLINICAL_ENCOUNTER_STATUS",
      "Clinical encounter status is invalid for this operation",
    );
  }
}

export class ClinicalEncounterService {
  async list(
    query: ListClinicalEncountersQuery,
    actor: AuthenticatedRequestContext,
  ) {
    const skip = (query.page - 1) * query.pageSize;

    const where: Prisma.ClinicalEncounterWhereInput = {
      appointment: {
        organizationId: actor.organizationId,

        ...(query.patientId !== undefined
          ? {
              patientId: BigInt(query.patientId),
            }
          : {}),
      },

      ...(query.status !== undefined
        ? {
            status: query.status,
          }
        : {}),

      ...(query.providerId !== undefined
        ? {
            providerId: BigInt(query.providerId),
          }
        : {}),

      ...(query.appointmentId !== undefined
        ? {
            appointmentId: BigInt(query.appointmentId),
          }
        : {}),

      ...(query.date !== undefined
        ? {
            startedAt: {
              gte: parseDateOnly(query.date, "date"),
              lt: new Date(
                parseDateOnly(query.date, "date").getTime() + 86_400_000,
              ),
            },
          }
        : {}),

      ...(query.from !== undefined || query.to !== undefined
        ? {
            startedAt: {
              ...(query.from !== undefined
                ? {
                    gte: parseTimestamp(query.from, "from"),
                  }
                : {}),
              ...(query.to !== undefined
                ? {
                    lt: parseTimestamp(query.to, "to"),
                  }
                : {}),
            },
          }
        : {}),

      ...(query.q !== undefined
        ? {
            OR: [
              {
                appointment: {
                  appointmentNumber: {
                    contains: query.q,
                  },
                },
              },
              {
                appointment: {
                  patient: {
                    patientNumber: {
                      contains: query.q,
                    },
                  },
                },
              },
              {
                appointment: {
                  patient: {
                    firstName: {
                      contains: query.q,
                    },
                  },
                },
              },
              {
                appointment: {
                  patient: {
                    lastName: {
                      contains: query.q,
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.clinicalEncounter.findMany({
        where,
        select: clinicalEncounterDetailSelect,
        orderBy: {
          startedAt: "desc",
        },
        skip,
        take: query.pageSize,
      }),

      prisma.clinicalEncounter.count({
        where,
      }),
    ]);

    return {
      encounters: rows.map(toClinicalEncounterResponse),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async getById(encounterId: bigint, actor: AuthenticatedRequestContext) {
    const encounter = await clinicalEncounterRepository.findById(
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

    return toClinicalEncounterResponse(encounter);
  }

  async getByAppointmentId(
    appointmentId: bigint,
    actor: AuthenticatedRequestContext,
  ) {
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        organizationId: actor.organizationId,
      },
      select: {
        id: true,
      },
    });

    if (!appointment) {
      throw new AppError(
        404,
        "APPOINTMENT_NOT_FOUND",
        "Appointment not found",
      );
    }

    const encounter = await clinicalEncounterRepository.findByAppointmentId(
      appointmentId,
      actor.organizationId,
    );

    if (!encounter) {
      throw new AppError(
        404,
        "CLINICAL_ENCOUNTER_NOT_FOUND",
        "Clinical encounter not found",
      );
    }

    return toClinicalEncounterResponse(encounter);
  }

  async create(
    appointmentId: bigint,
    input: CreateClinicalEncounterInput,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    try {
      const created = await prisma.$transaction(
        async (tx) => {
          const appointment = await tx.appointment.findFirst({
            where: {
              id: appointmentId,
              organizationId: actor.organizationId,
            },
            select: {
              id: true,
              appointmentNumber: true,
              providerId: true,
              status: true,
              clinicalEncounter: {
                select: {
                  id: true,
                },
              },
            },
          });

          if (!appointment) {
            throw new AppError(
              404,
              "APPOINTMENT_NOT_FOUND",
              "Appointment not found",
            );
          }

          assertAppointmentCanOpenEncounter(appointment);

          if (appointment.clinicalEncounter !== null) {
            throw new AppError(
              409,
              "CLINICAL_ENCOUNTER_ALREADY_EXISTS",
              "Clinical encounter already exists for this appointment",
            );
          }

          const encounter = await tx.clinicalEncounter.create({
            data: {
              appointmentId: appointment.id,
              providerId: appointment.providerId,
              status: "OPEN",
              startedAt: new Date(),
              completedAt: null,
              chiefComplaint: input.chiefComplaint ?? null,
              clinicalNotes: input.clinicalNotes ?? null,
              createdByUserId: actor.userId,
            },
            select: clinicalEncounterDetailSelect,
          });

          await auditService.writeWithinTransaction(tx, {
            organizationId: actor.organizationId,
            actorUserId: actor.userId,
            action: "CLINICAL_ENCOUNTER_CREATE",
            entityType: "CLINICAL_ENCOUNTER",
            entityId: encounter.id,
            entityKey: appointment.appointmentNumber,
            newValues: toAuditValues(encounter),
            ...auditTechnicalFields(metadata),
          });

          return encounter;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 10_000,
          timeout: 10_000,
        },
      );

      return toClinicalEncounterResponse(created);
    } catch (error) {
      mapDuplicateEncounterError(error);
    }
  }

  async update(
    encounterId: bigint,
    input: UpdateClinicalEncounterInput,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    const updated: ClinicalEncounterDetailRecord = await prisma.$transaction(
      async (tx) => {
        const current = await clinicalEncounterRepository.findById(
          encounterId,
          actor.organizationId,
          tx,
        );

        if (!current) {
          throw new AppError(
            404,
            "CLINICAL_ENCOUNTER_NOT_FOUND",
            "Clinical encounter not found",
          );
        }

        assertEncounterEditable(current.status);

        const updateData: Prisma.ClinicalEncounterUncheckedUpdateInput = {};

        if (input.chiefComplaint !== undefined) {
          updateData.chiefComplaint = input.chiefComplaint;
        }

        if (input.clinicalNotes !== undefined) {
          updateData.clinicalNotes = input.clinicalNotes;
        }

        const encounter = await tx.clinicalEncounter.update({
          where: {
            id: encounterId,
          },
          data: updateData,
          select: clinicalEncounterDetailSelect,
        });

        await auditService.writeWithinTransaction(tx, {
          organizationId: actor.organizationId,
          actorUserId: actor.userId,
          action: "CLINICAL_ENCOUNTER_UPDATE",
          entityType: "CLINICAL_ENCOUNTER",
          entityId: encounter.id,
          entityKey: encounter.appointment.appointmentNumber,
          oldValues: toAuditValues(current),
          newValues: toAuditValues(encounter),
          ...auditTechnicalFields(metadata),
        });

        return encounter;
      },
    );

    return toClinicalEncounterResponse(updated);
  }

  async complete(
    encounterId: bigint,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    const completed: ClinicalEncounterDetailRecord =
      await prisma.$transaction(async (tx) => {
        const current = await clinicalEncounterRepository.findById(
          encounterId,
          actor.organizationId,
          tx,
        );

        if (!current) {
          throw new AppError(
            404,
            "CLINICAL_ENCOUNTER_NOT_FOUND",
            "Clinical encounter not found",
          );
        }

        assertEncounterCompletable(current.status);

        const completedAt = new Date();

        const encounter = await tx.clinicalEncounter.update({
          where: {
            id: encounterId,
          },
          data: {
            status: "COMPLETED",
            completedAt,
          },
          select: clinicalEncounterDetailSelect,
        });

        await auditService.writeWithinTransaction(tx, {
          organizationId: actor.organizationId,
          actorUserId: actor.userId,
          action: "CLINICAL_ENCOUNTER_COMPLETE",
          entityType: "CLINICAL_ENCOUNTER",
          entityId: encounter.id,
          entityKey: encounter.appointment.appointmentNumber,
          oldValues: {
            status: current.status,
            completedAt: current.completedAt?.toISOString() ?? null,
          },
          newValues: {
            status: encounter.status,
            completedAt: encounter.completedAt?.toISOString() ?? null,
          },
          ...auditTechnicalFields(metadata),
        });

        return encounter;
      });

    return toClinicalEncounterResponse(completed);
  }
}

export const clinicalEncounterService = new ClinicalEncounterService();
