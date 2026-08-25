import { formatDateOnly } from "../../shared/utils/date-only.js";

import type {
  InsuranceDetailRecord,
  PayerRecord,
} from "./insurance.repository.js";

export function toPayerResponse(payer: PayerRecord) {
  return {
    id: payer.id.toString(),

    code: payer.code,

    name: payer.name,

    payerType: payer.payerType,
  };
}

export function toInsuranceResponse(insurance: InsuranceDetailRecord) {
  return {
    id: insurance.id.toString(),

    patientId: insurance.patientId.toString(),

    payerId: insurance.payerId.toString(),

    insuredId: insurance.insuredId,

    validFrom: formatDateOnly(insurance.validFrom),

    validTo: formatDateOnly(insurance.validTo),

    status: insurance.status,

    isPrimary: insurance.isPrimary,

    verifiedAt: insurance.verifiedAt?.toISOString() ?? null,

    verificationSource: insurance.verificationSource,

    verifiedBy:
      insurance.verifiedByUser === null
        ? null
        : {
            id: insurance.verifiedByUser.id.toString(),

            firstName: insurance.verifiedByUser.firstName,

            lastName: insurance.verifiedByUser.lastName,

            email: insurance.verifiedByUser.email,
          },

    payer: toPayerResponse(insurance.payer),

    createdAt: insurance.createdAt.toISOString(),

    updatedAt: insurance.updatedAt.toISOString(),
  };
}
