import { Prisma } from "../../generated/prisma/client.js";

import { prisma } from "../../infrastructure/database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { parseDateOnly } from "../../shared/utils/date-only.js";

import { auditService, auditTechnicalFields } from "../audit/audit.service.js";
import type {
  AuthenticatedRequestContext,
  RequestSecurityMetadata,
} from "../auth/auth.types.js";
import { authorizationService } from "../authorizations/authorization.service.js";
import { clinicalEncounterRepository } from "../clinical-encounters/clinical-encounter.repository.js";
import { svbCatalogService } from "../svb-catalog/svb-catalog.service.js";

import {
  encounterProcedureRepository,
  encounterProcedureSelect,
  type EncounterProcedureRecord,
} from "./encounter-procedure.repository.js";
import type {
  CreateEncounterProcedureInput,
  UpdateEncounterProcedureInput,
} from "./encounter-procedure.schemas.js";
import { toEncounterProcedureResponse } from "./encounter-procedure.types.js";

const DEFAULT_CURRENCY_CODE = "ANG";
const USABLE_AUTHORIZATION_STATUSES = ["APPROVED", "PARTIALLY_USED"] as const;

function serviceDateInCuracao(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Curacao",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (year === undefined || month === undefined || day === undefined) {
    throw new AppError(
      500,
      "INTERNAL_SERVER_ERROR",
      "Unable to resolve service date",
    );
  }

  return parseDateOnly(`${year}-${month}-${day}`, "serviceDate");
}

function assertEncounterEditable(status: string) {
  if (status !== "OPEN") {
    throw new AppError(
      409,
      "CLINICAL_ENCOUNTER_NOT_EDITABLE",
      "Clinical encounter is not editable",
    );
  }
}

function assertPositiveQuantity(quantity: Prisma.Decimal) {
  if (quantity.lte(0)) {
    throw new AppError(
      400,
      "INVALID_PROCEDURE_QUANTITY",
      "quantity must be greater than 0",
    );
  }
}

function assertDateWithin(
  validFrom: Date | null,
  validTo: Date | null,
  serviceDate: Date,
  code: "INSURANCE_NOT_VALID" | "AUTHORIZATION_NOT_VALID" | "AUTHORIZATION_ITEM_NOT_VALID",
) {
  if (
    (validFrom !== null && validFrom > serviceDate) ||
    (validTo !== null && validTo < serviceDate)
  ) {
    throw new AppError(409, code, "Record is not valid for this service date");
  }
}

function toAuditValues(procedure: EncounterProcedureRecord) {
  return {
    encounterId: procedure.encounterId.toString(),
    patientInsuranceId: procedure.patientInsuranceId.toString(),
    svbProcedureId: procedure.svbProcedureId.toString(),
    svbTariffId: procedure.svbTariffId.toString(),
    authorizationItemId: procedure.authorizationItemId?.toString() ?? null,
    diagnosisId: procedure.diagnosisId?.toString() ?? null,
    performedByProviderId: procedure.performedByProviderId.toString(),
    procedureCodeSnapshot: procedure.procedureCodeSnapshot,
    procedureDescriptionSnapshot: procedure.procedureDescriptionSnapshot,
    providerIdSnapshot: procedure.providerIdSnapshot,
    insuredIdSnapshot: procedure.insuredIdSnapshot,
    unitTariffSnapshot: procedure.unitTariffSnapshot.toFixed(2),
    currencyCodeSnapshot: procedure.currencyCodeSnapshot,
    quantity: procedure.quantity.toFixed(2),
    amount: procedure.amount.toFixed(2),
    authorizationIdSnapshot: procedure.authorizationIdSnapshot,
    diagnosticCodeSnapshot: procedure.diagnosticCodeSnapshot,
    performedAt: procedure.performedAt?.toISOString() ?? null,
    additionalNote: procedure.additionalNote,
    status: procedure.status,
    createdByUserId: procedure.createdByUserId.toString(),
  } satisfies Prisma.InputJsonObject;
}

function isSerializableConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

async function serializableTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10_000,
        timeout: 10_000,
      });
    } catch (error) {
      if (!isSerializableConflict(error)) {
        throw error;
      }

      lastError = error;
    }
  }

  throw lastError;
}

async function recalculateAuthorizationStatus(
  tx: Prisma.TransactionClient,
  authorizationId: bigint,
) {
  const authorization = await tx.svbAuthorization.findUnique({
    where: {
      id: authorizationId,
    },
    select: {
      status: true,
      items: {
        select: {
          authorizedQuantity: true,
          usedQuantity: true,
        },
      },
    },
  });

  if (
    authorization === null ||
    !["APPROVED", "PARTIALLY_USED", "EXHAUSTED"].includes(authorization.status)
  ) {
    return;
  }

  const hasUsage = authorization.items.some((item) => item.usedQuantity.gt(0));
  const hasUnlimitedItem = authorization.items.some(
    (item) => item.authorizedQuantity === null,
  );
  const exhausted =
    authorization.items.length > 0 &&
    !hasUnlimitedItem &&
    authorization.items.every(
      (item) =>
        item.authorizedQuantity !== null &&
        item.usedQuantity.gte(item.authorizedQuantity),
    );

  const status = exhausted
    ? "EXHAUSTED"
    : hasUsage
      ? "PARTIALLY_USED"
      : "APPROVED";

  if (authorization.status !== status) {
    await tx.svbAuthorization.update({
      where: {
        id: authorizationId,
      },
      data: {
        status,
      },
    });
  }
}

async function validateAndConsumeAuthorizationItem(input: {
  tx: Prisma.TransactionClient;
  authorizationItemId: bigint;
  patientId: bigint;
  patientInsuranceId: bigint;
  svbProcedureId: bigint;
  serviceDate: Date;
  quantity: Prisma.Decimal;
}) {
  const item = await input.tx.svbAuthorizationItem.findUnique({
    where: {
      id: input.authorizationItemId,
    },
    select: {
      id: true,
      authorizationId: true,
      svbProcedureId: true,
      procedureCodeSnapshot: true,
      authorizedQuantity: true,
      usedQuantity: true,
      validFrom: true,
      validTo: true,
      authorization: {
        select: {
          id: true,
          authorizationId: true,
          patientId: true,
          patientInsuranceId: true,
          status: true,
          validFrom: true,
          validTo: true,
          patientInsurance: {
            select: {
              patientId: true,
            },
          },
        },
      },
    },
  });

  if (item === null) {
    throw new AppError(
      404,
      "AUTHORIZATION_ITEM_NOT_FOUND",
      "Authorization item not found",
    );
  }

  if (
    item.authorization.patientId !== input.patientId ||
    item.authorization.patientInsuranceId !== input.patientInsuranceId ||
    item.authorization.patientInsurance.patientId !== input.patientId
  ) {
    throw new AppError(
      409,
      "AUTHORIZATION_INSURANCE_PATIENT_MISMATCH",
      "Authorization does not match the encounter patient and insurance",
    );
  }

  if (
    !USABLE_AUTHORIZATION_STATUSES.some(
      (status) => status === item.authorization.status,
    )
  ) {
    throw new AppError(
      409,
      "AUTHORIZATION_NOT_USABLE",
      "Authorization is not usable",
    );
  }

  assertDateWithin(
    item.authorization.validFrom,
    item.authorization.validTo,
    input.serviceDate,
    "AUTHORIZATION_NOT_VALID",
  );
  assertDateWithin(
    item.validFrom,
    item.validTo,
    input.serviceDate,
    "AUTHORIZATION_ITEM_NOT_VALID",
  );

  if (item.svbProcedureId !== null && item.svbProcedureId !== input.svbProcedureId) {
    throw new AppError(
      409,
      "AUTHORIZATION_PROCEDURE_MISMATCH",
      "Authorization item does not apply to this procedure",
    );
  }

  if (
    item.authorizedQuantity !== null &&
    input.quantity.gt(item.authorizedQuantity.minus(item.usedQuantity))
  ) {
    throw new AppError(
      409,
      "AUTHORIZATION_QUANTITY_EXCEEDED",
      "Requested quantity exceeds remaining authorization quantity",
    );
  }

  await input.tx.svbAuthorizationItem.update({
    where: {
      id: item.id,
    },
    data: {
      usedQuantity: {
        increment: input.quantity,
      },
    },
  });

  await recalculateAuthorizationStatus(input.tx, item.authorizationId);

  return {
    authorizationId: item.authorizationId,
    authorizationExternalId: item.authorization.authorizationId,
  };
}

async function releaseAuthorizationQuantity(input: {
  tx: Prisma.TransactionClient;
  authorizationItemId: bigint;
  quantity: Prisma.Decimal;
}) {
  const item = await input.tx.svbAuthorizationItem.findUnique({
    where: {
      id: input.authorizationItemId,
    },
    select: {
      authorizationId: true,
      usedQuantity: true,
    },
  });

  if (item === null) {
    throw new AppError(
      404,
      "AUTHORIZATION_ITEM_NOT_FOUND",
      "Authorization item not found",
    );
  }

  if (item.usedQuantity.lt(input.quantity)) {
    throw new AppError(
      409,
      "AUTHORIZATION_QUANTITY_EXCEEDED",
      "Authorization item usage cannot be reduced below zero",
    );
  }

  await input.tx.svbAuthorizationItem.update({
    where: {
      id: input.authorizationItemId,
    },
    data: {
      usedQuantity: {
        decrement: input.quantity,
      },
    },
  });

  await recalculateAuthorizationStatus(input.tx, item.authorizationId);
}

export class EncounterProcedureService {
  async list(encounterId: bigint, actor: AuthenticatedRequestContext) {
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

    const rows = await encounterProcedureRepository.listByEncounter(
      encounterId,
      actor.organizationId,
    );

    return rows.map(toEncounterProcedureResponse);
  }

  async getById(
    encounterId: bigint,
    encounterProcedureId: bigint,
    actor: AuthenticatedRequestContext,
  ) {
    const procedure = await encounterProcedureRepository.findById(
      encounterId,
      encounterProcedureId,
      actor.organizationId,
    );

    if (!procedure) {
      throw new AppError(
        404,
        "ENCOUNTER_PROCEDURE_NOT_FOUND",
        "Encounter procedure not found",
      );
    }

    return toEncounterProcedureResponse(procedure);
  }

  async create(
    encounterId: bigint,
    input: CreateEncounterProcedureInput,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    const patientInsuranceId = BigInt(input.patientInsuranceId);
    const svbProcedureId = BigInt(input.svbProcedureId);
    const authorizationItemId =
      input.authorizationItemId === undefined || input.authorizationItemId === null
        ? null
        : BigInt(input.authorizationItemId);
    const diagnosisId =
      input.diagnosisId === undefined || input.diagnosisId === null
        ? null
        : BigInt(input.diagnosisId);
    const quantity = new Prisma.Decimal(input.quantity);
    assertPositiveQuantity(quantity);

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

    assertEncounterEditable(encounter.status);

    const serviceDate = serviceDateInCuracao(
      encounter.appointment.scheduledStartAt,
    );
    const tariffResolution = await svbCatalogService.resolveApplicableTariff({
      svbProcedureId,
      serviceDate,
      currencyCode: DEFAULT_CURRENCY_CODE,
    });

    if (tariffResolution.procedure.requiresAuthorization) {
      if (authorizationItemId === null) {
        throw new AppError(
          409,
          "PROCEDURE_AUTHORIZATION_REQUIRED",
          "This SVB procedure requires authorization",
        );
      }

      await authorizationService.resolveApplicableAuthorizationItem({
        patientId: encounter.appointment.patient.id,
        patientInsuranceId,
        svbProcedureId,
        serviceDate,
        requestedQuantity: quantity,
        authorizationItemId,
      });
    }

    const created = await serializableTransaction(async (tx) => {
      const currentEncounter = await clinicalEncounterRepository.findById(
        encounterId,
        actor.organizationId,
        tx,
      );

      if (!currentEncounter) {
        throw new AppError(
          404,
          "CLINICAL_ENCOUNTER_NOT_FOUND",
          "Clinical encounter not found",
        );
      }

      assertEncounterEditable(currentEncounter.status);

      const insurance = await tx.patientInsurance.findFirst({
        where: {
          id: patientInsuranceId,
          patient: {
            organizationId: actor.organizationId,
          },
        },
        select: {
          id: true,
          patientId: true,
          insuredId: true,
          status: true,
          validFrom: true,
          validTo: true,
        },
      });

      if (insurance === null) {
        throw new AppError(
          404,
          "PATIENT_INSURANCE_NOT_FOUND",
          "Patient insurance not found",
        );
      }

      if (insurance.patientId !== currentEncounter.appointment.patient.id) {
        throw new AppError(
          409,
          "PROCEDURE_INSURANCE_PATIENT_MISMATCH",
          "Insurance coverage does not belong to the encounter patient",
        );
      }

      if (insurance.status !== "ACTIVE") {
        throw new AppError(
          409,
          "INSURANCE_NOT_VALID",
          "Insurance coverage is not valid for procedures",
        );
      }

      assertDateWithin(
        insurance.validFrom,
        insurance.validTo,
        serviceDate,
        "INSURANCE_NOT_VALID",
      );

      const diagnosis =
        diagnosisId === null
          ? null
          : await tx.encounterDiagnosis.findFirst({
              where: {
                id: diagnosisId,
                encounterId,
              },
              select: {
                id: true,
                codeSnapshot: true,
              },
            });

      if (diagnosisId !== null && diagnosis === null) {
        throw new AppError(
          409,
          "PROCEDURE_DIAGNOSIS_ENCOUNTER_MISMATCH",
          "Diagnosis does not belong to this encounter",
        );
      }

      let authorizationExternalId: string | null = null;

      if (authorizationItemId !== null) {
        const consumed = await validateAndConsumeAuthorizationItem({
          tx,
          authorizationItemId,
          patientId: currentEncounter.appointment.patient.id,
          patientInsuranceId,
          svbProcedureId,
          serviceDate,
          quantity,
        });

        authorizationExternalId = consumed.authorizationExternalId;
      }

      const unitTariff = new Prisma.Decimal(tariffResolution.tariff.amount);
      const procedure = await tx.encounterProcedure.create({
        data: {
          encounterId,
          patientInsuranceId,
          svbProcedureId,
          svbTariffId: BigInt(tariffResolution.tariff.id),
          authorizationItemId,
          diagnosisId,
          performedByProviderId: currentEncounter.providerId,
          procedureCodeSnapshot: tariffResolution.procedure.code,
          procedureDescriptionSnapshot: tariffResolution.procedure.description,
          providerIdSnapshot: currentEncounter.provider.svbProviderId,
          insuredIdSnapshot: insurance.insuredId,
          unitTariffSnapshot: unitTariff,
          currencyCodeSnapshot: tariffResolution.tariff.currencyCode,
          quantity,
          amount: unitTariff.mul(quantity),
          authorizationIdSnapshot: authorizationExternalId,
          diagnosticCodeSnapshot: diagnosis?.codeSnapshot ?? null,
          performedAt: new Date(),
          additionalNote: input.additionalNote ?? null,
          status: "PERFORMED",
          createdByUserId: actor.userId,
        },
        select: encounterProcedureSelect,
      });

      await auditService.writeWithinTransaction(tx, {
        organizationId: actor.organizationId,
        actorUserId: actor.userId,
        action: "ENCOUNTER_PROCEDURE_CREATE",
        entityType: "ENCOUNTER_PROCEDURE",
        entityId: procedure.id,
        entityKey: `${currentEncounter.appointment.appointmentNumber}:${procedure.procedureCodeSnapshot}`,
        newValues: toAuditValues(procedure),
        ...auditTechnicalFields(metadata),
      });

      return procedure;
    });

    return toEncounterProcedureResponse(created);
  }

  async update(
    encounterId: bigint,
    encounterProcedureId: bigint,
    input: UpdateEncounterProcedureInput,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    const updated = await serializableTransaction(async (tx) => {
      const encounter = await clinicalEncounterRepository.findById(
        encounterId,
        actor.organizationId,
        tx,
      );

      if (!encounter) {
        throw new AppError(
          404,
          "CLINICAL_ENCOUNTER_NOT_FOUND",
          "Clinical encounter not found",
        );
      }

      assertEncounterEditable(encounter.status);

      const current = await encounterProcedureRepository.findById(
        encounterId,
        encounterProcedureId,
        actor.organizationId,
        tx,
      );

      if (!current) {
        throw new AppError(
          404,
          "ENCOUNTER_PROCEDURE_NOT_FOUND",
          "Encounter procedure not found",
        );
      }

      if (current.status !== "PERFORMED") {
        throw new AppError(
          409,
          "ENCOUNTER_PROCEDURE_NOT_EDITABLE",
          "Encounter procedure is not editable",
        );
      }

      let diagnosisId: bigint | null | undefined;
      let diagnosticCodeSnapshot: string | null | undefined;

      if (input.diagnosisId !== undefined) {
        diagnosisId =
          input.diagnosisId === null ? null : BigInt(input.diagnosisId);
      }

      if (diagnosisId !== undefined && diagnosisId !== null) {
        const diagnosis = await tx.encounterDiagnosis.findFirst({
          where: {
            id: diagnosisId,
            encounterId,
          },
          select: {
            id: true,
            codeSnapshot: true,
          },
        });

        if (diagnosis === null) {
          throw new AppError(
            409,
            "PROCEDURE_DIAGNOSIS_ENCOUNTER_MISMATCH",
            "Diagnosis does not belong to this encounter",
          );
        }

        diagnosticCodeSnapshot = diagnosis.codeSnapshot;
      } else if (diagnosisId === null) {
        diagnosticCodeSnapshot = null;
      }

      const updateData: Prisma.EncounterProcedureUncheckedUpdateInput = {};

      if (input.diagnosisId !== undefined) {
        updateData.diagnosisId =
          input.diagnosisId === null ? null : BigInt(input.diagnosisId);
        updateData.diagnosticCodeSnapshot =
          input.diagnosisId === null ? null : diagnosticCodeSnapshot ?? null;
      }

      if (input.additionalNote !== undefined) {
        updateData.additionalNote = input.additionalNote;
      }

      const procedure = await tx.encounterProcedure.update({
        where: {
          id: encounterProcedureId,
        },
        data: updateData,
        select: encounterProcedureSelect,
      });

      await auditService.writeWithinTransaction(tx, {
        organizationId: actor.organizationId,
        actorUserId: actor.userId,
        action: "ENCOUNTER_PROCEDURE_UPDATE",
        entityType: "ENCOUNTER_PROCEDURE",
        entityId: procedure.id,
        entityKey: `${encounter.appointment.appointmentNumber}:${procedure.procedureCodeSnapshot}`,
        oldValues: toAuditValues(current),
        newValues: toAuditValues(procedure),
        ...auditTechnicalFields(metadata),
      });

      return procedure;
    });

    return toEncounterProcedureResponse(updated);
  }

  async remove(
    encounterId: bigint,
    encounterProcedureId: bigint,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    const removed = await serializableTransaction(async (tx) => {
      const encounter = await clinicalEncounterRepository.findById(
        encounterId,
        actor.organizationId,
        tx,
      );

      if (!encounter) {
        throw new AppError(
          404,
          "CLINICAL_ENCOUNTER_NOT_FOUND",
          "Clinical encounter not found",
        );
      }

      assertEncounterEditable(encounter.status);

      const current = await encounterProcedureRepository.findById(
        encounterId,
        encounterProcedureId,
        actor.organizationId,
        tx,
      );

      if (!current) {
        throw new AppError(
          404,
          "ENCOUNTER_PROCEDURE_NOT_FOUND",
          "Encounter procedure not found",
        );
      }

      if (current.invoiceItems.length > 0) {
        throw new AppError(
          409,
          "ENCOUNTER_PROCEDURE_ALREADY_BILLED",
          "Encounter procedure is already linked to billing",
        );
      }

      if (current.authorizationItemId !== null) {
        await releaseAuthorizationQuantity({
          tx,
          authorizationItemId: current.authorizationItemId,
          quantity: current.quantity,
        });
      }

      await tx.encounterProcedure.delete({
        where: {
          id: encounterProcedureId,
        },
      });

      await auditService.writeWithinTransaction(tx, {
        organizationId: actor.organizationId,
        actorUserId: actor.userId,
        action: "ENCOUNTER_PROCEDURE_REMOVE",
        entityType: "ENCOUNTER_PROCEDURE",
        entityId: current.id,
        entityKey: `${encounter.appointment.appointmentNumber}:${current.procedureCodeSnapshot}`,
        oldValues: toAuditValues(current),
        ...auditTechnicalFields(metadata),
      });

      return current;
    });

    return toEncounterProcedureResponse(removed);
  }
}

export const encounterProcedureService = new EncounterProcedureService();
