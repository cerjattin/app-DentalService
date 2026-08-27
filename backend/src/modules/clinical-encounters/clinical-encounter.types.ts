import type { ClinicalEncounterDetailRecord } from "./clinical-encounter.repository.js";

export function toClinicalEncounterResponse(
  encounter: ClinicalEncounterDetailRecord,
) {
  return {
    id: encounter.id.toString(),

    appointmentId: encounter.appointmentId.toString(),

    providerId: encounter.providerId.toString(),

    status: encounter.status,

    startedAt: encounter.startedAt.toISOString(),

    completedAt: encounter.completedAt?.toISOString() ?? null,

    chiefComplaint: encounter.chiefComplaint,

    clinicalNotes: encounter.clinicalNotes,

    appointment: {
      id: encounter.appointment.id.toString(),
      appointmentNumber: encounter.appointment.appointmentNumber,
      scheduledStartAt: encounter.appointment.scheduledStartAt.toISOString(),
      scheduledEndAt: encounter.appointment.scheduledEndAt.toISOString(),
      status: encounter.appointment.status,
    },

    patient: {
      id: encounter.appointment.patient.id.toString(),
      patientNumber: encounter.appointment.patient.patientNumber,
      firstName: encounter.appointment.patient.firstName,
      middleName: encounter.appointment.patient.middleName,
      lastName: encounter.appointment.patient.lastName,
      secondLastName: encounter.appointment.patient.secondLastName,
    },

    provider: {
      id: encounter.provider.id.toString(),
      svbProviderId: encounter.provider.svbProviderId,
      firstName: encounter.provider.firstName,
      lastName: encounter.provider.lastName,
      isActive: encounter.provider.isActive,
    },

    createdByUserId: encounter.createdByUserId.toString(),

    createdAt: encounter.createdAt.toISOString(),

    updatedAt: encounter.updatedAt.toISOString(),
  };
}
