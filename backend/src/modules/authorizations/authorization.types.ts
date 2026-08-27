import { Prisma } from "../../generated/prisma/client.js";
import { formatDateOnly } from "../../shared/utils/date-only.js";

import type {
  AuthorizationItemForResolverRecord,
  AuthorizationItemRecord,
  AuthorizationRecord,
} from "./authorization.repository.js";

type ItemLike = AuthorizationItemRecord | AuthorizationItemForResolverRecord;

function decimalToFixed(value: Prisma.Decimal) {
  return value.toFixed(2);
}

export function remainingQuantity(item: {
  authorizedQuantity: Prisma.Decimal | null;
  usedQuantity: Prisma.Decimal;
}) {
  if (item.authorizedQuantity === null) {
    return null;
  }

  return decimalToFixed(item.authorizedQuantity.minus(item.usedQuantity));
}

export function toAuthorizationItemResponse(item: ItemLike) {
  const svbProcedure =
    "svbProcedure" in item
      ? item.svbProcedure === null
        ? null
        : {
            id: item.svbProcedure.id.toString(),
            code: item.svbProcedure.code,
            description: item.svbProcedure.description,
            requiresAuthorization: item.svbProcedure.requiresAuthorization,
          }
      : undefined;

  return {
    id: item.id.toString(),
    authorizationId: item.authorizationId.toString(),
    svbProcedureId: item.svbProcedureId?.toString() ?? null,
    procedureCodeSnapshot: item.procedureCodeSnapshot,
    authorizedQuantity:
      item.authorizedQuantity === null
        ? null
        : decimalToFixed(item.authorizedQuantity),
    usedQuantity: decimalToFixed(item.usedQuantity),
    remainingQuantity: remainingQuantity(item),
    validFrom: formatDateOnly(item.validFrom),
    validTo: formatDateOnly(item.validTo),
    notes: item.notes,
    ...(svbProcedure !== undefined ? { svbProcedure } : {}),
    createdAt: item.createdAt?.toISOString(),
    updatedAt: item.updatedAt?.toISOString(),
  };
}

export function toAuthorizationResponse(authorization: AuthorizationRecord) {
  return {
    id: authorization.id.toString(),
    patientId: authorization.patientId.toString(),
    patientInsuranceId: authorization.patientInsuranceId.toString(),
    authorizationId: authorization.authorizationId,
    status: authorization.status,
    validFrom: formatDateOnly(authorization.validFrom),
    validTo: formatDateOnly(authorization.validTo),
    issuedAt: authorization.issuedAt?.toISOString() ?? null,
    notes: authorization.notes,
    createdByUserId: authorization.createdByUserId.toString(),
    patient: {
      id: authorization.patient.id.toString(),
      patientNumber: authorization.patient.patientNumber,
      firstName: authorization.patient.firstName,
      lastName: authorization.patient.lastName,
    },
    patientInsurance: {
      id: authorization.patientInsurance.id.toString(),
      insuredId: authorization.patientInsurance.insuredId,
      status: authorization.patientInsurance.status,
      payer: {
        id: authorization.patientInsurance.payer.id.toString(),
        code: authorization.patientInsurance.payer.code,
        name: authorization.patientInsurance.payer.name,
      },
    },
    items: authorization.items.map(toAuthorizationItemResponse),
    createdAt: authorization.createdAt.toISOString(),
    updatedAt: authorization.updatedAt.toISOString(),
  };
}
