import { Prisma } from "../../generated/prisma/client.js";

import { prisma } from "../../infrastructure/database/prisma.js";

import { AppError } from "../../shared/errors/app-error.js";

import { parseDateOnly } from "../../shared/utils/date-only.js";

import { auditService, auditTechnicalFields } from "../audit/audit.service.js";

import type {
  AuthenticatedRequestContext,
  RequestSecurityMetadata,
} from "../auth/auth.types.js";

import {
  insuranceDetailSelect,
  insuranceRepository,
  type InsuranceDetailRecord,
} from "./insurance.repository.js";

import type {
  CreateInsuranceInput,
  UpdateInsuranceInput,
  VerifyInsuranceInput,
} from "./insurance.schemas.js";

import { toInsuranceResponse, toPayerResponse } from "./insurance.types.js";

function parseNullableDateOnly(
  value: string | null | undefined,
  fieldName: string,
): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return parseDateOnly(value, fieldName);
}

function assertValidPeriod(validFrom: Date | null, validTo: Date | null) {
  if (validFrom !== null && validTo !== null && validTo < validFrom) {
    throw new AppError(
      400,
      "INVALID_INSURANCE_PERIOD",
      "validTo must be greater than or equal to validFrom",
    );
  }
}

function overlapWhere(
  patientId: bigint,
  payerId: bigint,
  insuredId: string,
  validFrom: Date | null,
  validTo: Date | null,
  excludeInsuranceId?: bigint,
): Prisma.PatientInsuranceWhereInput {
  return {
    patientId,
    payerId,
    insuredId,

    ...(excludeInsuranceId !== undefined
      ? {
          id: {
            not: excludeInsuranceId,
          },
        }
      : {}),

    ...(validTo === null
      ? {}
      : {
          OR: [
            {
              validFrom: null,
            },
            {
              validFrom: {
                lte: validTo,
              },
            },
          ],
        }),

    ...(validFrom === null
      ? {}
      : {
          AND: [
            {
              OR: [
                {
                  validTo: null,
                },
                {
                  validTo: {
                    gte: validFrom,
                  },
                },
              ],
            },
          ],
        }),
  };
}

function toAuditValues(insurance: {
  payerId: bigint;
  insuredId: string;
  validFrom: Date | null;
  validTo: Date | null;
  status: string;
  isPrimary: boolean;
  verifiedAt: Date | null;
  verifiedByUserId: bigint | null;
  verificationSource: string | null;
}) {
  return {
    payerId: insurance.payerId.toString(),
    insuredId: insurance.insuredId,
    validFrom: insurance.validFrom?.toISOString().slice(0, 10) ?? null,
    validTo: insurance.validTo?.toISOString().slice(0, 10) ?? null,
    status: insurance.status,
    isPrimary: insurance.isPrimary,
    verifiedAt: insurance.verifiedAt?.toISOString() ?? null,
    verifiedByUserId: insurance.verifiedByUserId?.toString() ?? null,
    verificationSource: insurance.verificationSource,
  };
}

export class InsuranceService {
  async listPayers() {
    const payers = await insuranceRepository.findActivePayers();

    return payers.map(toPayerResponse);
  }

  async list(patientId: bigint, actor: AuthenticatedRequestContext) {
    const patient = await insuranceRepository.findPatient(
      patientId,
      actor.organizationId,
    );

    if (!patient) {
      throw new AppError(404, "PATIENT_NOT_FOUND", "Patient not found");
    }

    const rows = await insuranceRepository.listByPatient(
      patientId,
      actor.organizationId,
    );

    return rows.map(toInsuranceResponse);
  }

  async getById(
    patientId: bigint,
    insuranceId: bigint,
    actor: AuthenticatedRequestContext,
  ) {
    const insurance = await insuranceRepository.findByIdForPatient(
      patientId,
      insuranceId,
      actor.organizationId,
    );

    if (!insurance) {
      throw new AppError(
        404,
        "INSURANCE_NOT_FOUND",
        "Insurance coverage not found",
      );
    }

    return toInsuranceResponse(insurance);
  }

  async create(
    patientId: bigint,
    input: CreateInsuranceInput,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    const payerId = BigInt(input.payerId);
    const validFrom = parseNullableDateOnly(input.validFrom, "validFrom");
    const validTo = parseNullableDateOnly(input.validTo, "validTo");

    assertValidPeriod(validFrom ?? null, validTo ?? null);

    const created = await prisma.$transaction(
      async (tx) => {
        const patient = await tx.patient.findFirst({
          where: {
            id: patientId,
            organizationId: actor.organizationId,
          },

          select: {
            id: true,
          },
        });

        if (!patient) {
          throw new AppError(404, "PATIENT_NOT_FOUND", "Patient not found");
        }

        const payer = await insuranceRepository.findActivePayer(payerId, tx);

        if (!payer) {
          throw new AppError(400, "INVALID_PAYER", "Payer is invalid");
        }

        const overlap = await tx.patientInsurance.findFirst({
          where: overlapWhere(
            patientId,
            payerId,
            input.insuredId,
            validFrom ?? null,
            validTo ?? null,
          ),

          select: {
            id: true,
          },
        });

        if (overlap) {
          throw new AppError(
            409,
            "INSURANCE_PERIOD_OVERLAP",
            "Insurance coverage period overlaps an existing equivalent coverage",
          );
        }

        if (input.isPrimary === true) {
          await tx.patientInsurance.updateMany({
            where: {
              patientId,
              isPrimary: true,
            },

            data: {
              isPrimary: false,
            },
          });
        }

        const insurance = await tx.patientInsurance.create({
          data: {
            patientId,
            payerId,
            insuredId: input.insuredId,

            ...(validFrom !== undefined
              ? {
                  validFrom,
                }
              : {}),

            ...(validTo !== undefined
              ? {
                  validTo,
                }
              : {}),

            ...(input.status !== undefined
              ? {
                  status: input.status,
                }
              : {}),

            ...(input.isPrimary !== undefined
              ? {
                  isPrimary: input.isPrimary,
                }
              : {}),
          },

          select: insuranceDetailSelect,
        });

        await auditService.writeWithinTransaction(tx, {
          organizationId: actor.organizationId,
          actorUserId: actor.userId,
          action: "INSURANCE_CREATE",
          entityType: "PATIENT_INSURANCE",
          entityId: insurance.id,
          entityKey: insurance.insuredId,
          newValues: toAuditValues(insurance),
          ...auditTechnicalFields(metadata),
        });

        return insurance;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10_000,
        timeout: 10_000,
      },
    );

    return toInsuranceResponse(created);
  }

  async update(
    patientId: bigint,
    insuranceId: bigint,
    input: UpdateInsuranceInput,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    const updated = await prisma.$transaction(
      async (tx) => {
        const current = await insuranceRepository.findByIdForPatient(
          patientId,
          insuranceId,
          actor.organizationId,
          tx,
        );

        if (!current) {
          throw new AppError(
            404,
            "INSURANCE_NOT_FOUND",
            "Insurance coverage not found",
          );
        }

        const payerId =
          input.payerId !== undefined ? BigInt(input.payerId) : current.payerId;

        if (input.payerId !== undefined) {
          const payer = await insuranceRepository.findActivePayer(payerId, tx);

          if (!payer) {
            throw new AppError(400, "INVALID_PAYER", "Payer is invalid");
          }
        }

        const validFrom =
          input.validFrom !== undefined
            ? parseNullableDateOnly(input.validFrom, "validFrom")
            : current.validFrom;

        const validTo =
          input.validTo !== undefined
            ? parseNullableDateOnly(input.validTo, "validTo")
            : current.validTo;

        assertValidPeriod(validFrom ?? null, validTo ?? null);

        const insuredId =
          input.insuredId !== undefined ? input.insuredId : current.insuredId;

        const overlap = await tx.patientInsurance.findFirst({
          where: overlapWhere(
            patientId,
            payerId,
            insuredId,
            validFrom ?? null,
            validTo ?? null,
            insuranceId,
          ),

          select: {
            id: true,
          },
        });

        if (overlap) {
          throw new AppError(
            409,
            "INSURANCE_PERIOD_OVERLAP",
            "Insurance coverage period overlaps an existing equivalent coverage",
          );
        }

        if (input.isPrimary === true) {
          await tx.patientInsurance.updateMany({
            where: {
              patientId,
              isPrimary: true,
              id: {
                not: insuranceId,
              },
            },

            data: {
              isPrimary: false,
            },
          });
        }

        const updateData: Prisma.PatientInsuranceUncheckedUpdateInput = {};

        if (input.payerId !== undefined) {
          updateData.payerId = payerId;
        }

        if (input.insuredId !== undefined) {
          updateData.insuredId = input.insuredId;
        }

        if (input.validFrom !== undefined) {
          updateData.validFrom =
            input.validFrom === null
              ? null
              : parseDateOnly(input.validFrom, "validFrom");
        }

        if (input.validTo !== undefined) {
          updateData.validTo =
            input.validTo === null ? null : parseDateOnly(input.validTo, "validTo");
        }

        if (input.status !== undefined) {
          updateData.status = input.status;
        }

        if (input.isPrimary !== undefined) {
          updateData.isPrimary = input.isPrimary;
        }

        const result: InsuranceDetailRecord = await tx.patientInsurance.update({
          where: {
            id: insuranceId,
          },

          data: updateData,

          select: insuranceDetailSelect,
        });

        await auditService.writeWithinTransaction(tx, {
          organizationId: actor.organizationId,
          actorUserId: actor.userId,
          action: "INSURANCE_UPDATE",
          entityType: "PATIENT_INSURANCE",
          entityId: result.id,
          entityKey: result.insuredId,
          oldValues: toAuditValues(current),
          newValues: toAuditValues(result),
          ...auditTechnicalFields(metadata),
        });

        return result;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10_000,
        timeout: 10_000,
      },
    );

    return toInsuranceResponse(updated);
  }

  async verify(
    patientId: bigint,
    insuranceId: bigint,
    input: VerifyInsuranceInput,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    const verified = await prisma.$transaction(async (tx) => {
      const current = await insuranceRepository.findByIdForPatient(
        patientId,
        insuranceId,
        actor.organizationId,
        tx,
      );

      if (!current) {
        throw new AppError(
          404,
          "INSURANCE_NOT_FOUND",
          "Insurance coverage not found",
        );
      }

      const result = await tx.patientInsurance.update({
        where: {
          id: insuranceId,
        },

        data: {
          verifiedAt: new Date(),
          verifiedByUserId: actor.userId,
          verificationSource: input.verificationSource,
        },

        select: insuranceDetailSelect,
      });

      await auditService.writeWithinTransaction(tx, {
        organizationId: actor.organizationId,
        actorUserId: actor.userId,
        action: "INSURANCE_VERIFY",
        entityType: "PATIENT_INSURANCE",
        entityId: result.id,
        entityKey: result.insuredId,
        oldValues: toAuditValues(current),
        newValues: toAuditValues(result),
        ...auditTechnicalFields(metadata),
      });

      return result;
    });

    return toInsuranceResponse(verified);
  }
}

export const insuranceService = new InsuranceService();
