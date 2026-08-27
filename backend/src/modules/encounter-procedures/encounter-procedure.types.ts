import type { Prisma } from "../../generated/prisma/client.js";

import type { EncounterProcedureRecord } from "./encounter-procedure.repository.js";

function decimalString(value: Prisma.Decimal) {
  return value.toFixed(2);
}

function dateOnly(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? null;
}

export function remainingAuthorizationQuantity(item: {
  authorizedQuantity: Prisma.Decimal | null;
  usedQuantity: Prisma.Decimal;
}) {
  return item.authorizedQuantity === null
    ? null
    : decimalString(item.authorizedQuantity.minus(item.usedQuantity));
}

export function toEncounterProcedureResponse(
  procedure: EncounterProcedureRecord,
) {
  return {
    id: procedure.id.toString(),
    encounterId: procedure.encounterId.toString(),
    patientInsuranceId: procedure.patientInsuranceId.toString(),
    svbProcedureId: procedure.svbProcedureId.toString(),
    svbTariffId: procedure.svbTariffId.toString(),
    authorizationItemId: procedure.authorizationItemId?.toString() ?? null,
    diagnosisId: procedure.diagnosisId?.toString() ?? null,
    referrerId: procedure.referrerId?.toString() ?? null,
    performedByProviderId: procedure.performedByProviderId.toString(),
    procedureCodeSnapshot: procedure.procedureCodeSnapshot,
    procedureDescriptionSnapshot: procedure.procedureDescriptionSnapshot,
    providerIdSnapshot: procedure.providerIdSnapshot,
    insuredIdSnapshot: procedure.insuredIdSnapshot,
    unitTariffSnapshot: decimalString(procedure.unitTariffSnapshot),
    currencyCodeSnapshot: procedure.currencyCodeSnapshot,
    quantity: decimalString(procedure.quantity),
    amount: decimalString(procedure.amount),
    authorizationIdSnapshot: procedure.authorizationIdSnapshot,
    diagnosticCodeSnapshot: procedure.diagnosticCodeSnapshot,
    treatmentIdSnapshot: procedure.treatmentIdSnapshot,
    accidentFormNumberSnapshot: procedure.accidentFormNumberSnapshot,
    numberOfTreatmentsSnapshot: procedure.numberOfTreatmentsSnapshot,
    assistanceSnapshot: procedure.assistanceSnapshot,
    referrerIdSnapshot: procedure.referrerIdSnapshot,
    policlinicSnapshot: procedure.policlinicSnapshot,
    performedAt: procedure.performedAt?.toISOString() ?? null,
    additionalNote: procedure.additionalNote,
    status: procedure.status,
    createdByUserId: procedure.createdByUserId.toString(),
    createdAt: procedure.createdAt.toISOString(),
    updatedAt: procedure.updatedAt.toISOString(),
    svbProcedure: {
      id: procedure.svbProcedure.id.toString(),
      code: procedure.svbProcedure.code,
      description: procedure.svbProcedure.description,
      requiresAuthorization: procedure.svbProcedure.requiresAuthorization,
      requiresReferral: procedure.svbProcedure.requiresReferral,
    },
    svbTariff: {
      id: procedure.svbTariff.id.toString(),
      amount: decimalString(procedure.svbTariff.amount),
      currencyCode: procedure.svbTariff.currencyCode,
      validFrom: dateOnly(procedure.svbTariff.validFrom),
      validTo: dateOnly(procedure.svbTariff.validTo),
    },
    patientInsurance: {
      id: procedure.patientInsurance.id.toString(),
      patientId: procedure.patientInsurance.patientId.toString(),
      insuredId: procedure.patientInsurance.insuredId,
      status: procedure.patientInsurance.status,
      validFrom: dateOnly(procedure.patientInsurance.validFrom),
      validTo: dateOnly(procedure.patientInsurance.validTo),
      payer: {
        id: procedure.patientInsurance.payer.id.toString(),
        code: procedure.patientInsurance.payer.code,
        name: procedure.patientInsurance.payer.name,
      },
    },
    authorizationItem:
      procedure.authorizationItem === null
        ? null
        : {
            id: procedure.authorizationItem.id.toString(),
            authorizationId:
              procedure.authorizationItem.authorizationId.toString(),
            externalAuthorizationId:
              procedure.authorizationItem.authorization.authorizationId,
            status: procedure.authorizationItem.authorization.status,
            svbProcedureId:
              procedure.authorizationItem.svbProcedureId?.toString() ?? null,
            procedureCodeSnapshot:
              procedure.authorizationItem.procedureCodeSnapshot,
            authorizedQuantity:
              procedure.authorizationItem.authorizedQuantity?.toFixed(2) ??
              null,
            usedQuantity:
              procedure.authorizationItem.usedQuantity.toFixed(2),
            remainingQuantity: remainingAuthorizationQuantity(
              procedure.authorizationItem,
            ),
            validFrom: dateOnly(procedure.authorizationItem.validFrom),
            validTo: dateOnly(procedure.authorizationItem.validTo),
          },
    diagnosis:
      procedure.diagnosis === null
        ? null
        : {
            id: procedure.diagnosis.id.toString(),
            codeSnapshot: procedure.diagnosis.codeSnapshot,
            descriptionSnapshot: procedure.diagnosis.descriptionSnapshot,
            isPrimary: procedure.diagnosis.isPrimary,
          },
    performedByProvider: {
      id: procedure.performedByProvider.id.toString(),
      svbProviderId: procedure.performedByProvider.svbProviderId,
      firstName: procedure.performedByProvider.firstName,
      lastName: procedure.performedByProvider.lastName,
    },
  };
}
