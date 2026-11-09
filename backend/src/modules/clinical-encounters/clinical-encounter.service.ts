import { normalizeSearch } from "../../infrastructure/database/text-search.js";
import {
  Prisma,
  type ClinicalEncounterStatus,
} from "../../generated/prisma/client.js";

import { prisma } from "../../infrastructure/database/prisma.js";

import { AppError } from "../../shared/errors/app-error.js";
import { isTransactionConflict } from "../../infrastructure/database/transaction-conflict.js";
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

async function advanceAttentionAppointment(
  tx: Prisma.TransactionClient,
  appointment: {
    id: bigint;
    appointmentNumber: string;
    status: "CONFIRMED" | "CHECKED_IN" | "IN_PROGRESS";
  },
  status: "IN_PROGRESS" | "COMPLETED",
  now: Date,
  actor: AuthenticatedRequestContext,
  metadata: RequestSecurityMetadata,
) {
  await tx.appointment.update({
    where: { id: appointment.id },
    data: {
      status,
      ...(status === "IN_PROGRESS" ? { startedAt: now } : { completedAt: now }),
    },
  });
  await tx.appointmentStatusHistory.create({
    data: {
      appointmentId: appointment.id,
      oldStatus: appointment.status,
      newStatus: status,
      changedByUserId: actor.userId,
      metadata: {
        source: "service_attention",
        ...auditTechnicalFields(metadata),
      },
    },
  });
  await auditService.writeWithinTransaction(tx, {
    organizationId: actor.organizationId,
    actorUserId: actor.userId,
    action: "APPOINTMENT_STATUS_CHANGE",
    entityType: "APPOINTMENT",
    entityId: appointment.id,
    entityKey: appointment.appointmentNumber,
    oldValues: { status: appointment.status },
    newValues: { status },
    ...auditTechnicalFields(metadata),
  });
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

    const searchQuery = await normalizeSearch(query.q);

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

      ...(searchQuery !== undefined
        ? {
            OR: [
              {
                appointment: {
                  appointmentNumberSearch: {
                    contains: searchQuery,
                  },
                },
              },
              {
                appointment: {
                  patient: {
                    patientNumberSearch: {
                      contains: searchQuery,
                    },
                  },
                },
              },
              {
                appointment: {
                  patient: {
                    firstNameSearch: {
                      contains: searchQuery,
                    },
                  },
                },
              },
              {
                appointment: {
                  patient: {
                    lastNameSearch: {
                      contains: searchQuery,
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
      throw new AppError(404, "APPOINTMENT_NOT_FOUND", "Appointment not found");
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
    serviceFlow = false,
  ) {
    for (let attempt = 0; ; attempt++) {
      try {
        const created = await prisma.$transaction(
          async (tx) => {
            if (serviceFlow)
              await clinicalEncounterRepository.lockForAppointment(
                tx,
                appointmentId,
                actor.organizationId,
              );
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

            if (appointment.clinicalEncounter !== null) {
              if (
                serviceFlow &&
                [
                  "IN_PROGRESS",
                  "CHECKED_IN",
                  "CONFIRMED",
                  "COMPLETED",
                ].includes(appointment.status)
              ) {
                const existing =
                  await clinicalEncounterRepository.findByAppointmentId(
                    appointmentId,
                    actor.organizationId,
                    tx,
                  );
                if (existing?.status === "OPEN") {
                  if (
                    appointment.status === "CONFIRMED" ||
                    appointment.status === "CHECKED_IN"
                  ) {
                    await advanceAttentionAppointment(
                      tx,
                      { ...appointment, status: appointment.status },
                      "IN_PROGRESS",
                      existing.startedAt,
                      actor,
                      metadata,
                    );
                    return (await clinicalEncounterRepository.findByAppointmentId(
                      appointmentId,
                      actor.organizationId,
                      tx,
                    ))!;
                  }
                  return existing;
                }
              }
              throw new AppError(
                409,
                "CLINICAL_ENCOUNTER_ALREADY_EXISTS",
                "Clinical encounter already exists for this appointment",
              );
            }

            const now = new Date();
            if (
              serviceFlow &&
              (appointment.status === "CONFIRMED" ||
                appointment.status === "CHECKED_IN")
            ) {
              await advanceAttentionAppointment(
                tx,
                { ...appointment, status: appointment.status },
                "IN_PROGRESS",
                now,
                actor,
                metadata,
              );
            } else {
              assertAppointmentCanOpenEncounter(appointment);
            }

            const encounter = await tx.clinicalEncounter.create({
              data: {
                appointmentId: appointment.id,
                providerId: appointment.providerId,
                status: "OPEN",
                startedAt: now,
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
        if (serviceFlow && isTransactionConflict(error) && attempt < 2)
          continue;
        mapDuplicateEncounterError(error);
      }
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
    serviceFlow = false,
  ) {
    const completeWithin = async (
      tx: Prisma.TransactionClient,
    ): Promise<ClinicalEncounterDetailRecord> => {
      if (serviceFlow)
        await clinicalEncounterRepository.lockForEncounter(
          tx,
          encounterId,
          actor.organizationId,
        );
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

      const completedAt = new Date();
      if (serviceFlow) {
        let status = current.appointment.status;
        if (current.status === "COMPLETED" && status === "COMPLETED")
          return current;
        if (status === "CHECKED_IN") {
          await advanceAttentionAppointment(
            tx,
            { ...current.appointment, status },
            "IN_PROGRESS",
            current.startedAt,
            actor,
            metadata,
          );
          status = "IN_PROGRESS";
        }
        if (status !== "IN_PROGRESS" && status !== "COMPLETED") {
          throw new AppError(
            409,
            "INVALID_APPOINTMENT_STATUS",
            "The appointment cannot be sent to billing",
          );
        }
        if (current.status !== "COMPLETED")
          assertEncounterCompletable(current.status);
        const service = await tx.encounterProcedure.findFirst({
          where: { encounterId, status: "PERFORMED" },
          select: { id: true },
        });
        if (!service)
          throw new AppError(
            409,
            "ATTENTION_SERVICES_REQUIRED",
            "Record at least one service before completing attention",
          );
        if (status === "IN_PROGRESS") {
          await advanceAttentionAppointment(
            tx,
            { ...current.appointment, status },
            "COMPLETED",
            completedAt,
            actor,
            metadata,
          );
        }
        if (current.status === "COMPLETED") {
          return {
            ...current,
            appointment: { ...current.appointment, status: "COMPLETED" },
          };
        }
      } else {
        assertEncounterCompletable(current.status);
      }

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
    };

    try {
      const completed = await prisma.$transaction(
        completeWithin,
        serviceFlow
          ? {
              isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
              timeout: 10_000,
            }
          : {},
      );
      return toClinicalEncounterResponse(completed);
    } catch (error) {
      if (serviceFlow && isTransactionConflict(error)) {
        throw new AppError(
          409,
          "ATTENTION_CHANGED",
          "Service attention changed. Reload before completing it",
        );
      }
      throw error;
    }
  }
}

export const clinicalEncounterService = new ClinicalEncounterService();
