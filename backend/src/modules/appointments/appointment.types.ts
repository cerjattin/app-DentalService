import type { AppointmentDetailRecord } from "./appointment.repository.js";

export function toAppointmentResponse(appointment: AppointmentDetailRecord) {
  return {
    id: appointment.id.toString(),

    organizationId: appointment.organizationId.toString(),

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

    patient: {
      id: appointment.patient.id.toString(),
      patientNumber: appointment.patient.patientNumber,
      firstName: appointment.patient.firstName,
      middleName: appointment.patient.middleName,
      lastName: appointment.patient.lastName,
      secondLastName: appointment.patient.secondLastName,
      documentType: appointment.patient.documentType,
      documentNumber: appointment.patient.documentNumber,
      status: appointment.patient.status,
    },

    provider: {
      id: appointment.provider.id.toString(),
      svbProviderId: appointment.provider.svbProviderId,
      firstName: appointment.provider.firstName,
      lastName: appointment.provider.lastName,
      isActive: appointment.provider.isActive,
    },

    location: {
      id: appointment.clinicLocation.id.toString(),
      code: appointment.clinicLocation.code,
      name: appointment.clinicLocation.name,
      isActive: appointment.clinicLocation.isActive,
    },

    createdByUserId: appointment.createdByUserId.toString(),

    createdAt: appointment.createdAt.toISOString(),

    updatedAt: appointment.updatedAt.toISOString(),
  };
}
