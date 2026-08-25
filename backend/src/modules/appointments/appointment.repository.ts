import type { Prisma } from "../../generated/prisma/client.js";

import { prisma } from "../../infrastructure/database/prisma.js";

export const appointmentDetailSelect = {
  id: true,
  organizationId: true,
  appointmentNumber: true,
  patientId: true,
  providerId: true,
  clinicLocationId: true,
  treatmentCaseId: true,
  accidentCaseId: true,
  scheduledStartAt: true,
  scheduledEndAt: true,
  status: true,
  reason: true,
  notes: true,
  createdByUserId: true,
  checkedInAt: true,
  startedAt: true,
  completedAt: true,
  cancelledAt: true,
  cancellationReason: true,
  createdAt: true,
  updatedAt: true,

  patient: {
    select: {
      id: true,
      patientNumber: true,
      firstName: true,
      middleName: true,
      lastName: true,
      secondLastName: true,
      documentType: true,
      documentNumber: true,
      status: true,
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

  clinicLocation: {
    select: {
      id: true,
      code: true,
      name: true,
      isActive: true,
    },
  },
} satisfies Prisma.AppointmentSelect;

export type AppointmentDetailRecord = Prisma.AppointmentGetPayload<{
  select: typeof appointmentDetailSelect;
}>;

export class AppointmentRepository {
  findById(
    appointmentId: bigint,
    organizationId: bigint,
    client: Prisma.TransactionClient | typeof prisma = prisma,
  ) {
    return client.appointment.findFirst({
      where: {
        id: appointmentId,
        organizationId,
      },

      select: appointmentDetailSelect,
    });
  }
}

export const appointmentRepository = new AppointmentRepository();
