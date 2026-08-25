import { formatDateOnly } from "../../shared/utils/date-only.js";

import type { PatientDetailRecord } from "./patient.repository.js";

export function toPatientResponse(patient: PatientDetailRecord) {
  return {
    id: patient.id.toString(),

    organizationId: patient.organizationId.toString(),

    patientNumber: patient.patientNumber,

    firstName: patient.firstName,

    middleName: patient.middleName,

    lastName: patient.lastName,

    secondLastName: patient.secondLastName,

    dateOfBirth: formatDateOnly(patient.dateOfBirth),

    sex: patient.sex,

    documentType: patient.documentType,

    documentNumber: patient.documentNumber,

    email: patient.email,

    phone: patient.phone,

    mobilePhone: patient.mobilePhone,

    addressLine1: patient.addressLine1,

    addressLine2: patient.addressLine2,

    city: patient.city,

    countryCode: patient.countryCode,

    status: patient.status,

    archivedAt: patient.archivedAt?.toISOString() ?? null,

    createdAt: patient.createdAt.toISOString(),

    updatedAt: patient.updatedAt.toISOString(),

    insuranceCoverages: patient.insuranceCoverages.map((insurance) => ({
      id: insurance.id.toString(),

      insuredId: insurance.insuredId,

      status: insurance.status,

      isPrimary: insurance.isPrimary,

      validFrom: formatDateOnly(insurance.validFrom),

      validTo: formatDateOnly(insurance.validTo),

      payer: {
        id: insurance.payer.id.toString(),

        code: insurance.payer.code,

        name: insurance.payer.name,
      },
    })),
  };
}
