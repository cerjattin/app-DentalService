import { formatDateOnly } from "../../shared/utils/date-only.js";

import type {
  SvbProcedureRecord,
  SvbTariffRecord,
} from "./svb-catalog.repository.js";

export function toSvbProcedureResponse(procedure: SvbProcedureRecord) {
  return {
    id: procedure.id.toString(),
    code: procedure.code,
    description: procedure.description,
    category: procedure.category,
    unit: procedure.unit,
    requiresAuthorization: procedure.requiresAuthorization,
    requiresReferral: procedure.requiresReferral,
    isActive: procedure.isActive,
    validFrom: formatDateOnly(procedure.validFrom),
    validTo: formatDateOnly(procedure.validTo),
    createdAt: procedure.createdAt.toISOString(),
    updatedAt: procedure.updatedAt.toISOString(),
  };
}

export function toSvbTariffResponse(tariff: SvbTariffRecord) {
  return {
    id: tariff.id.toString(),
    svbProcedureId: tariff.svbProcedureId.toString(),
    amount: tariff.amount.toFixed(2),
    currencyCode: tariff.currencyCode,
    validFrom: formatDateOnly(tariff.validFrom),
    validTo: formatDateOnly(tariff.validTo),
    isActive: tariff.isActive,
    createdAt: tariff.createdAt.toISOString(),
    updatedAt: tariff.updatedAt.toISOString(),
  };
}
