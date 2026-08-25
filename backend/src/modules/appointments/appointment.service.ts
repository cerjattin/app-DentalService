import { Prisma, type AppointmentStatus } from "../../generated/prisma/client.js";

import { prisma } from "../../infrastructure/database/prisma.js";

import { AppError } from "../../shared/errors/app-error.js";
import { parseDateOnly } from "../../shared/utils/date-only.js";

import { auditService, auditTechnicalFields } from "../audit/audit.service.js";

import type {
  AuthenticatedRequestContext,
  RequestSecurityMetadata,
} from "../auth/auth.types.js";

import { numberSequenceService } from "../number-sequences/number-sequence.service.js";

import {
  BLOCKING_APPOINTMENT_STATUSES,
  canTransitionAppointmentStatus,
} from "./appointment-status.js";

import {
  appointmentDetailSelect,
  appointmentRepository,
  type AppointmentDetailRecord,
} from "./appointment.repository.js";

import type {
  CreateAppointmentInput,
  ListAppointmentsQuery,
  UpdateAppointmentInput,
  UpdateAppointmentStatusInput,
} from "./appointment.schemas.js";

import { toAppointmentResponse } from "./appointment.types.js";

function parseTimestamp(value: string, fieldName: string): Date {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, "INVALID_DATE", `${fieldName} is invalid`);
  }

  return date;
}

function parseNullableBigIntId(value: string | null | undefined) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return BigInt(value);
}

function assertValidPeriod(scheduledStartAt: Date, scheduledEndAt: Date) {
  if (scheduledEndAt <= scheduledStartAt) {
    throw new AppError(
      400,
      "INVALID_APPOINTMENT_PERIOD",
      "scheduledEnd must be after scheduledStart",
    );
  }
}

function overlapWhere(
  organizationId: bigint,
  providerId: bigint,
  scheduledStartAt: Date,
  scheduledEndAt: Date,
  excludeAppointmentId?: bigint,
): Prisma.AppointmentWhereInput {
  return {
    organizationId,
    providerId,
    status: {
      in: [...BLOCKING_APPOINTMENT_STATUSES],
    },
    scheduledStartAt: {
      lt: scheduledEndAt,
    },
    scheduledEndAt: {
      gt: scheduledStartAt,
    },
    ...(excludeAppointmentId !== undefined
      ? {
          id: {
            not: excludeAppointmentId,
          },
        }
      : {}),
  };
}

function toAuditValues(appointment: {
  appointmentNumber: string;
  patientId: bigint;
  providerId: bigint;
  clinicLocationId: bigint;
  treatmentCaseId: bigint | null;
  accidentCaseId: bigint | null;
  scheduledStartAt: Date;
  scheduledEndAt: Date;
  status: AppointmentStatus;
  reason: string | null;
  notes: string | null;
  checkedInAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
}) {
  return {
    appointmentNumber: appointment.appointmentNumber,
    patientId: appointment.patientId.toString(),
    providerId: appointment.providerId.toString(),
    clinicLocationId: appointment.clinicLocationId.toString(),
    treatmentCaseId: appointment.treatmentCaseId?.toString() ?? null,
    accidentCaseId: appointment.accidentCaseId?.toString() ?? null,
    scheduledStart: appointment.scheduledStartAt.toISOString(),
    scheduledEnd: appointment.scheduledEndAt.toISOString(),
    status: appointment.status,
    reason: appointment.reason,
    notes: appointment.notes,
    checkedInAt: appointment.checkedInAt?.toISOString() ?? null,
    startedAt: appointment.startedAt?.toISOString() ?? null,
    completedAt: appointment.completedAt?.toISOString() ?? null,
    cancelledAt: appointment.cancelledAt?.toISOString() ?? null,
    cancellationReason: appointment.cancellationReason,
  };
}

function mapConcurrencyError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  ) {
    throw new AppError(
      409,
      "APPOINTMENT_PROVIDER_OVERLAP",
      "Provider already has an overlapping appointment",
    );
  }

  throw error;
}

function isBlockingAppointmentStatus(status: AppointmentStatus): boolean {
  return BLOCKING_APPOINTMENT_STATUSES.some((item) => item === status);
}

async function validatePatient(
  tx: Prisma.TransactionClient,
  patientId: bigint,
  organizationId: bigint,
) {
  const patient = await tx.patient.findFirst({
    where: {
      id: patientId,
      organizationId,
    },

    select: {
      id: true,
      status: true,
    },
  });

  if (!patient) {
    throw new AppError(404, "PATIENT_NOT_FOUND", "Patient not found");
  }

  if (patient.status === "ARCHIVED") {
    throw new AppError(404, "PATIENT_NOT_FOUND", "Patient not found");
  }
}

async function validateProvider(
  tx: Prisma.TransactionClient,
  providerId: bigint,
  organizationId: bigint,
  requireActive: boolean,
) {
  const provider = await tx.provider.findFirst({
    where: {
      id: providerId,
      organizationId,
    },

    select: {
      id: true,
      isActive: true,
      archivedAt: true,
    },
  });

  if (!provider) {
    throw new AppError(404, "PROVIDER_NOT_FOUND", "Provider not found");
  }

  if (requireActive && (!provider.isActive || provider.archivedAt !== null)) {
    throw new AppError(409, "PROVIDER_INACTIVE", "Provider is inactive");
  }
}

async function validateLocation(
  tx: Prisma.TransactionClient,
  clinicLocationId: bigint,
  organizationId: bigint,
  requireActive: boolean,
) {
  const location = await tx.clinicLocation.findFirst({
    where: {
      id: clinicLocationId,
      organizationId,
    },

    select: {
      id: true,
      isActive: true,
      archivedAt: true,
    },
  });

  if (!location) {
    throw new AppError(404, "LOCATION_NOT_FOUND", "Location not found");
  }

  if (requireActive && (!location.isActive || location.archivedAt !== null)) {
    throw new AppError(409, "LOCATION_INACTIVE", "Location is inactive");
  }
}

async function assertNoProviderOverlap(
  tx: Prisma.TransactionClient,
  organizationId: bigint,
  providerId: bigint,
  scheduledStartAt: Date,
  scheduledEndAt: Date,
  excludeAppointmentId?: bigint,
) {
  const overlap = await tx.appointment.findFirst({
    where: overlapWhere(
      organizationId,
      providerId,
      scheduledStartAt,
      scheduledEndAt,
      excludeAppointmentId,
    ),

    select: {
      id: true,
    },
  });

  if (overlap) {
    throw new AppError(
      409,
      "APPOINTMENT_PROVIDER_OVERLAP",
      "Provider already has an overlapping appointment",
    );
  }
}

export class AppointmentService {
  async list(query: ListAppointmentsQuery, actor: AuthenticatedRequestContext) {
    const skip = (query.page - 1) * query.pageSize;

    const where: Prisma.AppointmentWhereInput = {
      organizationId: actor.organizationId,

      ...(query.patientId !== undefined
        ? {
            patientId: BigInt(query.patientId),
          }
        : {}),

      ...(query.providerId !== undefined
        ? {
            providerId: BigInt(query.providerId),
          }
        : {}),

      ...(query.clinicLocationId !== undefined
        ? {
            clinicLocationId: BigInt(query.clinicLocationId),
          }
        : {}),

      ...(query.status !== undefined
        ? {
            status: query.status,
          }
        : {}),

      ...(query.date !== undefined
        ? {
            scheduledStartAt: {
              gte: parseDateOnly(query.date, "date"),
              lt: new Date(
                parseDateOnly(query.date, "date").getTime() + 86_400_000,
              ),
            },
          }
        : {}),

      ...(query.from !== undefined || query.to !== undefined
        ? {
            scheduledStartAt: {
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
                appointmentNumber: {
                  contains: query.q,
                },
              },
              {
                patient: {
                  patientNumber: {
                    contains: query.q,
                  },
                },
              },
              {
                patient: {
                  firstName: {
                    contains: query.q,
                  },
                },
              },
              {
                patient: {
                  lastName: {
                    contains: query.q,
                  },
                },
              },
              {
                patient: {
                  documentNumber: {
                    contains: query.q,
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        select: appointmentDetailSelect,
        orderBy: {
          scheduledStartAt: "asc",
        },
        skip,
        take: query.pageSize,
      }),

      prisma.appointment.count({
        where,
      }),
    ]);

    return {
      appointments: rows.map(toAppointmentResponse),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async getById(appointmentId: bigint, actor: AuthenticatedRequestContext) {
    const appointment = await appointmentRepository.findById(
      appointmentId,
      actor.organizationId,
    );

    if (!appointment) {
      throw new AppError(
        404,
        "APPOINTMENT_NOT_FOUND",
        "Appointment not found",
      );
    }

    return toAppointmentResponse(appointment);
  }

  async create(
    input: CreateAppointmentInput,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    const clinicLocationId = BigInt(input.clinicLocationId);
    const patientId = BigInt(input.patientId);
    const providerId = BigInt(input.providerId);
    const treatmentCaseId = parseNullableBigIntId(input.treatmentCaseId);
    const accidentCaseId = parseNullableBigIntId(input.accidentCaseId);
    const scheduledStartAt = parseTimestamp(
      input.scheduledStart,
      "scheduledStart",
    );
    const scheduledEndAt = parseTimestamp(input.scheduledEnd, "scheduledEnd");

    assertValidPeriod(scheduledStartAt, scheduledEndAt);

    try {
      const created = await prisma.$transaction(
        async (tx) => {
          await validatePatient(tx, patientId, actor.organizationId);
          await validateProvider(tx, providerId, actor.organizationId, true);
          await validateLocation(
            tx,
            clinicLocationId,
            actor.organizationId,
            true,
          );

          const allocatedNumber =
            await numberSequenceService.allocateWithinTransaction(tx, {
              organizationId: actor.organizationId,
              sequenceType: "APPOINTMENT",
            });

          await assertNoProviderOverlap(
            tx,
            actor.organizationId,
            providerId,
            scheduledStartAt,
            scheduledEndAt,
          );

          const appointment = await tx.appointment.create({
            data: {
              organizationId: actor.organizationId,
              appointmentNumber: allocatedNumber.formatted,
              patientId,
              providerId,
              clinicLocationId,
              treatmentCaseId: treatmentCaseId ?? null,
              accidentCaseId: accidentCaseId ?? null,
              scheduledStartAt,
              scheduledEndAt,
              createdByUserId: actor.userId,
              reason: input.reason ?? null,
              notes: input.notes ?? null,
            },

            select: appointmentDetailSelect,
          });

          await auditService.writeWithinTransaction(tx, {
            organizationId: actor.organizationId,
            actorUserId: actor.userId,
            action: "APPOINTMENT_CREATE",
            entityType: "APPOINTMENT",
            entityId: appointment.id,
            entityKey: appointment.appointmentNumber,
            newValues: toAuditValues(appointment),
            ...auditTechnicalFields(metadata),
          });

          return appointment;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 10_000,
          timeout: 10_000,
        },
      );

      return toAppointmentResponse(created);
    } catch (error) {
      mapConcurrencyError(error);
    }
  }

  async update(
    appointmentId: bigint,
    input: UpdateAppointmentInput,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    try {
      const updated: AppointmentDetailRecord = await prisma.$transaction(
        async (tx) => {
          const current = await appointmentRepository.findById(
            appointmentId,
            actor.organizationId,
            tx,
          );

          if (!current) {
            throw new AppError(
              404,
              "APPOINTMENT_NOT_FOUND",
              "Appointment not found",
            );
          }

          const providerId =
            input.providerId !== undefined
              ? BigInt(input.providerId)
              : current.providerId;

          const clinicLocationId =
            input.clinicLocationId !== undefined
              ? BigInt(input.clinicLocationId)
              : current.clinicLocationId;

          const scheduledStartAt =
            input.scheduledStart !== undefined
              ? parseTimestamp(input.scheduledStart, "scheduledStart")
              : current.scheduledStartAt;

          const scheduledEndAt =
            input.scheduledEnd !== undefined
              ? parseTimestamp(input.scheduledEnd, "scheduledEnd")
              : current.scheduledEndAt;

          assertValidPeriod(scheduledStartAt, scheduledEndAt);

          if (input.providerId !== undefined) {
            await validateProvider(
              tx,
              providerId,
              actor.organizationId,
              true,
            );
          }

          if (input.clinicLocationId !== undefined) {
            await validateLocation(
              tx,
              clinicLocationId,
              actor.organizationId,
              true,
            );
          }

          const changesSchedule =
            input.providerId !== undefined ||
            input.scheduledStart !== undefined ||
            input.scheduledEnd !== undefined;

          if (changesSchedule && isBlockingAppointmentStatus(current.status)) {
            await assertNoProviderOverlap(
              tx,
              actor.organizationId,
              providerId,
              scheduledStartAt,
              scheduledEndAt,
              appointmentId,
            );
          }

          const updateData: Prisma.AppointmentUncheckedUpdateInput = {};

          if (input.providerId !== undefined) {
            updateData.providerId = providerId;
          }

          if (input.clinicLocationId !== undefined) {
            updateData.clinicLocationId = clinicLocationId;
          }

          if (input.treatmentCaseId !== undefined) {
            updateData.treatmentCaseId =
              input.treatmentCaseId === null
                ? null
                : BigInt(input.treatmentCaseId);
          }

          if (input.accidentCaseId !== undefined) {
            updateData.accidentCaseId =
              input.accidentCaseId === null ? null : BigInt(input.accidentCaseId);
          }

          if (input.scheduledStart !== undefined) {
            updateData.scheduledStartAt = scheduledStartAt;
          }

          if (input.scheduledEnd !== undefined) {
            updateData.scheduledEndAt = scheduledEndAt;
          }

          if (input.reason !== undefined) {
            updateData.reason = input.reason;
          }

          if (input.notes !== undefined) {
            updateData.notes = input.notes;
          }

          const appointment = await tx.appointment.update({
            where: {
              id: appointmentId,
            },

            data: updateData,

            select: appointmentDetailSelect,
          });

          await auditService.writeWithinTransaction(tx, {
            organizationId: actor.organizationId,
            actorUserId: actor.userId,
            action: "APPOINTMENT_UPDATE",
            entityType: "APPOINTMENT",
            entityId: appointment.id,
            entityKey: appointment.appointmentNumber,
            oldValues: toAuditValues(current),
            newValues: toAuditValues(appointment),
            ...auditTechnicalFields(metadata),
          });

          return appointment;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 10_000,
          timeout: 10_000,
        },
      );

      return toAppointmentResponse(updated);
    } catch (error) {
      mapConcurrencyError(error);
    }
  }

  async changeStatus(
    appointmentId: bigint,
    input: UpdateAppointmentStatusInput,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    const updated = await prisma.$transaction(async (tx) => {
      const current = await appointmentRepository.findById(
        appointmentId,
        actor.organizationId,
        tx,
      );

      if (!current) {
        throw new AppError(
          404,
          "APPOINTMENT_NOT_FOUND",
          "Appointment not found",
        );
      }

      if (!canTransitionAppointmentStatus(current.status, input.status)) {
        throw new AppError(
          409,
          "INVALID_APPOINTMENT_STATUS_TRANSITION",
          "Appointment status transition is invalid",
        );
      }

      const now = new Date();

      const appointment = await tx.appointment.update({
        where: {
          id: appointmentId,
        },

        data: {
          status: input.status,
          ...(input.status === "CHECKED_IN" ? { checkedInAt: now } : {}),
          ...(input.status === "IN_PROGRESS" ? { startedAt: now } : {}),
          ...(input.status === "COMPLETED" ? { completedAt: now } : {}),
          ...(input.status === "CANCELLED"
            ? { cancelledAt: now, cancellationReason: input.reason ?? null }
            : {}),
        },

        select: appointmentDetailSelect,
      });

      await tx.appointmentStatusHistory.create({
        data: {
          appointmentId,
          oldStatus: current.status,
          newStatus: input.status,
          changedByUserId: actor.userId,
          reason: input.reason ?? null,
          metadata: {
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
        oldValues: {
          status: current.status,
        },
        newValues: {
          status: appointment.status,
        },
        ...auditTechnicalFields(metadata),
      });

      return appointment;
    });

    return toAppointmentResponse(updated);
  }
}

export const appointmentService = new AppointmentService();
