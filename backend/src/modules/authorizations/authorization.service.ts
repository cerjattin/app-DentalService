import { Prisma } from "../../generated/prisma/client.js";

import { prisma } from "../../infrastructure/database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { parseDateOnly } from "../../shared/utils/date-only.js";

import { auditService, auditTechnicalFields } from "../audit/audit.service.js";
import type {
  AuthenticatedRequestContext,
  RequestSecurityMetadata,
} from "../auth/auth.types.js";
import { svbCatalogRepository } from "../svb-catalog/svb-catalog.repository.js";

import {
  authorizationForResolverSelect,
  authorizationItemForResolverSelect,
  authorizationItemSelect,
  authorizationRepository,
  authorizationSelect,
  type AuthorizationItemForResolverRecord,
} from "./authorization.repository.js";
import type {
  CreateAuthorizationInput,
  CreateAuthorizationItemInput,
  ListAuthorizationsQuery,
  UpdateAuthorizationInput,
  UpdateAuthorizationItemInput,
} from "./authorization.schemas.js";
import {
  remainingQuantity,
  toAuthorizationItemResponse,
  toAuthorizationResponse,
} from "./authorization.types.js";

const USABLE_AUTHORIZATION_STATUSES = ["APPROVED", "PARTIALLY_USED"] as const;

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

function assertValidPeriod(
  validFrom: Date | null,
  validTo: Date | null,
  code: "INVALID_AUTHORIZATION_PERIOD" | "INVALID_AUTHORIZATION_ITEM_PERIOD",
) {
  if (validFrom !== null && validTo !== null && validTo < validFrom) {
    throw new AppError(
      400,
      code,
      "validTo must be greater than or equal to validFrom",
    );
  }
}

function validOnDateWhere(serviceDate: Date) {
  return {
    AND: [
      {
        OR: [
          {
            validFrom: null,
          },
          {
            validFrom: {
              lte: serviceDate,
            },
          },
        ],
      },
      {
        OR: [
          {
            validTo: null,
          },
          {
            validTo: {
              gte: serviceDate,
            },
          },
        ],
      },
    ],
  };
}

function decimalQuantity(value: string | Prisma.Decimal) {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

function assertNonNegativeQuantity(
  value: Prisma.Decimal | null,
  fieldName: string,
) {
  if (value !== null && value.lt(0)) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      `${fieldName} must be greater than or equal to 0`,
    );
  }
}

function assertRequestedQuantity(value: Prisma.Decimal) {
  if (value.lte(0)) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "requestedQuantity must be greater than 0",
    );
  }
}

function assertAuthorizationUsable(status: string) {
  if (!USABLE_AUTHORIZATION_STATUSES.some((usable) => usable === status)) {
    throw new AppError(
      409,
      "AUTHORIZATION_NOT_USABLE",
      "Authorization is not usable",
    );
  }
}

function assertDateWithin(
  validFrom: Date | null,
  validTo: Date | null,
  serviceDate: Date,
  code: "AUTHORIZATION_NOT_VALID" | "AUTHORIZATION_ITEM_NOT_VALID",
) {
  if (
    (validFrom !== null && validFrom > serviceDate) ||
    (validTo !== null && validTo < serviceDate)
  ) {
    throw new AppError(409, code, "Authorization is not valid for this date");
  }
}

function assertRemainingQuantity(
  item: {
    authorizedQuantity: Prisma.Decimal | null;
    usedQuantity: Prisma.Decimal;
  },
  requestedQuantity: Prisma.Decimal,
) {
  if (item.authorizedQuantity === null) {
    return;
  }

  if (requestedQuantity.gt(item.authorizedQuantity.minus(item.usedQuantity))) {
    throw new AppError(
      409,
      "AUTHORIZATION_QUANTITY_EXCEEDED",
      "Requested quantity exceeds remaining authorization quantity",
    );
  }
}

function mapUniqueAuthorizationError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw new AppError(
      409,
      "AUTHORIZATION_ALREADY_EXISTS",
      "Authorization already exists for this insurance coverage",
    );
  }

  throw error;
}

function toAuthorizationAuditValues(authorization: {
  patientId: bigint;
  patientInsuranceId: bigint;
  authorizationId: string;
  status: string;
  validFrom: Date | null;
  validTo: Date | null;
  issuedAt: Date | null;
  notes: string | null;
  metadata: Prisma.JsonValue | null;
  createdByUserId: bigint;
}) {
  return {
    patientId: authorization.patientId.toString(),
    patientInsuranceId: authorization.patientInsuranceId.toString(),
    authorizationId: authorization.authorizationId,
    status: authorization.status,
    validFrom: authorization.validFrom?.toISOString().slice(0, 10) ?? null,
    validTo: authorization.validTo?.toISOString().slice(0, 10) ?? null,
    issuedAt: authorization.issuedAt?.toISOString() ?? null,
    notes: authorization.notes,
    metadata: authorization.metadata,
    createdByUserId: authorization.createdByUserId.toString(),
  };
}

function toAuthorizationItemAuditValues(item: {
  authorizationId: bigint;
  svbProcedureId: bigint | null;
  procedureCodeSnapshot: string | null;
  authorizedQuantity: Prisma.Decimal | null;
  usedQuantity: Prisma.Decimal;
  validFrom: Date | null;
  validTo: Date | null;
  notes: string | null;
}) {
  return {
    authorizationId: item.authorizationId.toString(),
    svbProcedureId: item.svbProcedureId?.toString() ?? null,
    procedureCodeSnapshot: item.procedureCodeSnapshot,
    authorizedQuantity: item.authorizedQuantity?.toFixed(2) ?? null,
    usedQuantity: item.usedQuantity.toFixed(2),
    remainingQuantity: remainingQuantity(item),
    validFrom: item.validFrom?.toISOString().slice(0, 10) ?? null,
    validTo: item.validTo?.toISOString().slice(0, 10) ?? null,
    notes: item.notes,
  };
}

function toPrismaMetadata(
  value: Record<string, string | number | boolean | null> | null | undefined,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonObject;
}

function assertResolverItem(
  item: AuthorizationItemForResolverRecord,
  input: {
    patientId: bigint;
    patientInsuranceId: bigint;
    svbProcedureId: bigint;
    serviceDate: Date;
    requestedQuantity: Prisma.Decimal;
  },
) {
  if (item.authorization.patientId !== input.patientId) {
    throw new AppError(
      409,
      "AUTHORIZATION_PATIENT_MISMATCH",
      "Authorization belongs to another patient",
    );
  }

  if (item.authorization.patientInsuranceId !== input.patientInsuranceId) {
    throw new AppError(
      409,
      "AUTHORIZATION_INSURANCE_MISMATCH",
      "Authorization belongs to another insurance coverage",
    );
  }

  if (item.authorization.patientInsurance.patientId !== input.patientId) {
    throw new AppError(
      409,
      "AUTHORIZATION_INSURANCE_PATIENT_MISMATCH",
      "Authorization insurance does not belong to the expected patient",
    );
  }

  assertAuthorizationUsable(item.authorization.status);
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

  if (
    item.svbProcedureId !== null &&
    item.svbProcedureId !== input.svbProcedureId
  ) {
    throw new AppError(
      409,
      "AUTHORIZATION_PROCEDURE_MISMATCH",
      "Authorization item does not apply to this procedure",
    );
  }

  assertRemainingQuantity(item, input.requestedQuantity);
}

export class AuthorizationService {
  async list(query: ListAuthorizationsQuery, actor: AuthenticatedRequestContext) {
    const skip = (query.page - 1) * query.pageSize;
    const serviceDate =
      query.serviceDate !== undefined
        ? parseDateOnly(query.serviceDate, "serviceDate")
        : undefined;

    const where: Prisma.SvbAuthorizationWhereInput = {
      patient: {
        organizationId: actor.organizationId,
      },

      ...(query.patientId !== undefined
        ? {
            patientId: BigInt(query.patientId),
          }
        : {}),

      ...(query.patientInsuranceId !== undefined
        ? {
            patientInsuranceId: BigInt(query.patientInsuranceId),
          }
        : {}),

      ...(query.status !== undefined
        ? {
            status: query.status,
          }
        : {}),

      ...(query.q !== undefined
        ? {
            OR: [
              {
                authorizationId: {
                  contains: query.q,
                },
              },
              {
                patientInsurance: {
                  insuredId: {
                    contains: query.q,
                  },
                },
              },
              {
                patient: {
                  patientNumber: {
                    contains: query.q,
                  },
                },
              },
              {
                patient: {
                  firstName: {
                    contains: query.q,
                  },
                },
              },
              {
                patient: {
                  lastName: {
                    contains: query.q,
                  },
                },
              },
            ],
          }
        : {}),

      ...(serviceDate !== undefined ? validOnDateWhere(serviceDate) : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.svbAuthorization.findMany({
        where,
        select: authorizationSelect,
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: query.pageSize,
      }),
      prisma.svbAuthorization.count({
        where,
      }),
    ]);

    return {
      authorizations: rows.map(toAuthorizationResponse),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async getById(authorizationId: bigint, actor: AuthenticatedRequestContext) {
    const authorization = await authorizationRepository.findById(
      authorizationId,
      actor.organizationId,
    );

    if (!authorization) {
      throw new AppError(
        404,
        "AUTHORIZATION_NOT_FOUND",
        "Authorization not found",
      );
    }

    return toAuthorizationResponse(authorization);
  }

  async create(
    input: CreateAuthorizationInput,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    const patientId = BigInt(input.patientId);
    const patientInsuranceId = BigInt(input.patientInsuranceId);
    const validFrom = parseNullableDateOnly(input.validFrom, "validFrom");
    const validTo = parseNullableDateOnly(input.validTo, "validTo");

    assertValidPeriod(
      validFrom ?? null,
      validTo ?? null,
      "INVALID_AUTHORIZATION_PERIOD",
    );

    try {
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
            },
          });

          if (!insurance) {
            throw new AppError(
              404,
              "INSURANCE_NOT_FOUND",
              "Insurance coverage not found",
            );
          }

          if (insurance.patientId !== patientId) {
            throw new AppError(
              409,
              "AUTHORIZATION_INSURANCE_PATIENT_MISMATCH",
              "Insurance coverage does not belong to the selected patient",
            );
          }

          const duplicate = await tx.svbAuthorization.findUnique({
            where: {
              patientInsuranceId_authorizationId: {
                patientInsuranceId,
                authorizationId: input.authorizationId,
              },
            },
            select: {
              id: true,
            },
          });

          if (duplicate) {
            throw new AppError(
              409,
              "AUTHORIZATION_ALREADY_EXISTS",
              "Authorization already exists for this insurance coverage",
            );
          }

          const createData: Prisma.SvbAuthorizationUncheckedCreateInput = {
            patientId,
            patientInsuranceId,
            authorizationId: input.authorizationId,
            status: input.status,
            createdByUserId: actor.userId,
          };

          if (validFrom !== undefined) {
            createData.validFrom = validFrom;
          }

          if (validTo !== undefined) {
            createData.validTo = validTo;
          }

          if (input.issuedAt !== undefined) {
            createData.issuedAt =
              input.issuedAt === null ? null : new Date(input.issuedAt);
          }

          if (input.notes !== undefined) {
            createData.notes = input.notes;
          }

          if (input.metadata !== undefined) {
            const metadataValue = toPrismaMetadata(input.metadata);

            if (metadataValue !== undefined) {
              createData.metadata = metadataValue;
            }
          }

          const authorization = await tx.svbAuthorization.create({
            data: createData,
            select: authorizationSelect,
          });

          await auditService.writeWithinTransaction(tx, {
            organizationId: actor.organizationId,
            actorUserId: actor.userId,
            action: "AUTHORIZATION_CREATE",
            entityType: "SVB_AUTHORIZATION",
            entityId: authorization.id,
            entityKey: authorization.authorizationId,
            newValues: toAuthorizationAuditValues(authorization),
            ...auditTechnicalFields(metadata),
          });

          return authorization;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 10_000,
          timeout: 10_000,
        },
      );

      return toAuthorizationResponse(created);
    } catch (error) {
      mapUniqueAuthorizationError(error);
    }
  }

  async update(
    authorizationId: bigint,
    input: UpdateAuthorizationInput,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    const updated = await prisma.$transaction(async (tx) => {
      const current = await authorizationRepository.findById(
        authorizationId,
        actor.organizationId,
        tx,
      );

      if (!current) {
        throw new AppError(
          404,
          "AUTHORIZATION_NOT_FOUND",
          "Authorization not found",
        );
      }

      const validFrom =
        input.validFrom !== undefined
          ? parseNullableDateOnly(input.validFrom, "validFrom")
          : current.validFrom;
      const validTo =
        input.validTo !== undefined
          ? parseNullableDateOnly(input.validTo, "validTo")
          : current.validTo;

      assertValidPeriod(
        validFrom ?? null,
        validTo ?? null,
        "INVALID_AUTHORIZATION_PERIOD",
      );

      const updateData: Prisma.SvbAuthorizationUncheckedUpdateInput = {};

      if (input.status !== undefined) {
        updateData.status = input.status;
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

      if (input.issuedAt !== undefined) {
        updateData.issuedAt =
          input.issuedAt === null ? null : new Date(input.issuedAt);
      }

      if (input.notes !== undefined) {
        updateData.notes = input.notes;
      }

      if (input.metadata !== undefined) {
        const metadataValue = toPrismaMetadata(input.metadata);

        if (metadataValue !== undefined) {
          updateData.metadata = metadataValue;
        }
      }

      const authorization = await tx.svbAuthorization.update({
        where: {
          id: authorizationId,
        },
        data: updateData,
        select: authorizationSelect,
      });

      await auditService.writeWithinTransaction(tx, {
        organizationId: actor.organizationId,
        actorUserId: actor.userId,
        action: "AUTHORIZATION_UPDATE",
        entityType: "SVB_AUTHORIZATION",
        entityId: authorization.id,
        entityKey: authorization.authorizationId,
        oldValues: toAuthorizationAuditValues(current),
        newValues: toAuthorizationAuditValues(authorization),
        ...auditTechnicalFields(metadata),
      });

      return authorization;
    });

    return toAuthorizationResponse(updated);
  }

  async listItems(
    authorizationId: bigint,
    actor: AuthenticatedRequestContext,
  ) {
    const authorization = await authorizationRepository.findById(
      authorizationId,
      actor.organizationId,
    );

    if (!authorization) {
      throw new AppError(
        404,
        "AUTHORIZATION_NOT_FOUND",
        "Authorization not found",
      );
    }

    return authorization.items.map(toAuthorizationItemResponse);
  }

  async createItem(
    authorizationId: bigint,
    input: CreateAuthorizationItemInput,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    const validFrom = parseNullableDateOnly(input.validFrom, "validFrom");
    const validTo = parseNullableDateOnly(input.validTo, "validTo");
    const authorizedQuantity =
      input.authorizedQuantity === undefined ||
      input.authorizedQuantity === null
        ? null
        : decimalQuantity(input.authorizedQuantity);

    assertValidPeriod(
      validFrom ?? null,
      validTo ?? null,
      "INVALID_AUTHORIZATION_ITEM_PERIOD",
    );
    assertNonNegativeQuantity(authorizedQuantity, "authorizedQuantity");

    const created = await prisma.$transaction(async (tx) => {
      const authorization = await authorizationRepository.findById(
        authorizationId,
        actor.organizationId,
        tx,
      );

      if (!authorization) {
        throw new AppError(
          404,
          "AUTHORIZATION_NOT_FOUND",
          "Authorization not found",
        );
      }

      const svbProcedureId =
        input.svbProcedureId === undefined || input.svbProcedureId === null
          ? null
          : BigInt(input.svbProcedureId);
      const svbProcedure =
        svbProcedureId === null
          ? null
          : await svbCatalogRepository.findProcedureById(svbProcedureId, tx);

      if (svbProcedureId !== null && !svbProcedure) {
        throw new AppError(
          404,
          "SVB_PROCEDURE_NOT_FOUND",
          "SVB procedure not found",
        );
      }

      const item = await tx.svbAuthorizationItem.create({
        data: {
          authorizationId,
          svbProcedureId,
          procedureCodeSnapshot: svbProcedure?.code ?? null,
          authorizedQuantity,
          usedQuantity: new Prisma.Decimal("0.00"),
          ...(validFrom !== undefined ? { validFrom } : {}),
          ...(validTo !== undefined ? { validTo } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
        },
        select: authorizationItemSelect,
      });

      await auditService.writeWithinTransaction(tx, {
        organizationId: actor.organizationId,
        actorUserId: actor.userId,
        action: "AUTHORIZATION_ITEM_CREATE",
        entityType: "SVB_AUTHORIZATION_ITEM",
        entityId: item.id,
        entityKey: `${authorization.authorizationId}:${item.procedureCodeSnapshot ?? item.id.toString()}`,
        newValues: toAuthorizationItemAuditValues(item),
        ...auditTechnicalFields(metadata),
      });

      return item;
    });

    return toAuthorizationItemResponse(created);
  }

  async updateItem(
    authorizationId: bigint,
    itemId: bigint,
    input: UpdateAuthorizationItemInput,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    const updated = await prisma.$transaction(async (tx) => {
      const authorization = await authorizationRepository.findById(
        authorizationId,
        actor.organizationId,
        tx,
      );

      if (!authorization) {
        throw new AppError(
          404,
          "AUTHORIZATION_NOT_FOUND",
          "Authorization not found",
        );
      }

      const current = await authorizationRepository.findItemById(
        authorizationId,
        itemId,
        actor.organizationId,
        tx,
      );

      if (!current) {
        throw new AppError(
          404,
          "AUTHORIZATION_ITEM_NOT_FOUND",
          "Authorization item not found",
        );
      }

      if (input.svbProcedureId !== undefined && current.usedQuantity.gt(0)) {
        throw new AppError(
          409,
          "AUTHORIZATION_ITEM_NOT_VALID",
          "Cannot change procedure after authorization item consumption",
        );
      }

      const validFrom =
        input.validFrom !== undefined
          ? parseNullableDateOnly(input.validFrom, "validFrom")
          : current.validFrom;
      const validTo =
        input.validTo !== undefined
          ? parseNullableDateOnly(input.validTo, "validTo")
          : current.validTo;

      assertValidPeriod(
        validFrom ?? null,
        validTo ?? null,
        "INVALID_AUTHORIZATION_ITEM_PERIOD",
      );

      const authorizedQuantity =
        input.authorizedQuantity === undefined
          ? current.authorizedQuantity
          : input.authorizedQuantity === null
            ? null
            : decimalQuantity(input.authorizedQuantity);

      assertNonNegativeQuantity(authorizedQuantity, "authorizedQuantity");

      if (
        authorizedQuantity !== null &&
        current.usedQuantity.gt(authorizedQuantity)
      ) {
        throw new AppError(
          409,
          "AUTHORIZATION_QUANTITY_EXCEEDED",
          "Authorized quantity cannot be lower than used quantity",
        );
      }

      const updateData: Prisma.SvbAuthorizationItemUncheckedUpdateInput = {};

      if (input.svbProcedureId !== undefined) {
        if (input.svbProcedureId === null) {
          updateData.svbProcedureId = null;
          updateData.procedureCodeSnapshot = null;
        } else {
          const svbProcedureId = BigInt(input.svbProcedureId);
          const svbProcedure = await svbCatalogRepository.findProcedureById(
            svbProcedureId,
            tx,
          );

          if (!svbProcedure) {
            throw new AppError(
              404,
              "SVB_PROCEDURE_NOT_FOUND",
              "SVB procedure not found",
            );
          }

          updateData.svbProcedureId = svbProcedureId;
          updateData.procedureCodeSnapshot = svbProcedure.code;
        }
      }

      if (input.authorizedQuantity !== undefined) {
        updateData.authorizedQuantity = authorizedQuantity;
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

      if (input.notes !== undefined) {
        updateData.notes = input.notes;
      }

      const item = await tx.svbAuthorizationItem.update({
        where: {
          id: itemId,
        },
        data: updateData,
        select: authorizationItemSelect,
      });

      await auditService.writeWithinTransaction(tx, {
        organizationId: actor.organizationId,
        actorUserId: actor.userId,
        action: "AUTHORIZATION_ITEM_UPDATE",
        entityType: "SVB_AUTHORIZATION_ITEM",
        entityId: item.id,
        entityKey: `${authorization.authorizationId}:${item.procedureCodeSnapshot ?? item.id.toString()}`,
        oldValues: toAuthorizationItemAuditValues(current),
        newValues: toAuthorizationItemAuditValues(item),
        ...auditTechnicalFields(metadata),
      });

      return item;
    });

    return toAuthorizationItemResponse(updated);
  }

  async resolveApplicableAuthorizationItem(input: {
    patientId: bigint;
    patientInsuranceId: bigint;
    svbProcedureId: bigint;
    serviceDate: Date;
    requestedQuantity: string | Prisma.Decimal;
    authorizationItemId?: bigint;
  }) {
    const requestedQuantity = decimalQuantity(input.requestedQuantity);
    assertRequestedQuantity(requestedQuantity);

    if (input.authorizationItemId !== undefined) {
      const item = await prisma.svbAuthorizationItem.findUnique({
        where: {
          id: input.authorizationItemId,
        },
        select: authorizationItemForResolverSelect,
      });

      if (!item) {
        throw new AppError(
          404,
          "AUTHORIZATION_ITEM_NOT_FOUND",
          "Authorization item not found",
        );
      }

      assertResolverItem(item, {
        patientId: input.patientId,
        patientInsuranceId: input.patientInsuranceId,
        svbProcedureId: input.svbProcedureId,
        serviceDate: input.serviceDate,
        requestedQuantity,
      });

      return toAuthorizationItemResponse(item);
    }

    const candidates = await prisma.svbAuthorizationItem.findMany({
      where: {
        OR: [
          {
            svbProcedureId: input.svbProcedureId,
          },
          {
            svbProcedureId: null,
          },
        ],
        ...validOnDateWhere(input.serviceDate),
        authorization: {
          patientId: input.patientId,
          patientInsuranceId: input.patientInsuranceId,
          status: {
            in: [...USABLE_AUTHORIZATION_STATUSES],
          },
          ...validOnDateWhere(input.serviceDate),
          patientInsurance: {
            patientId: input.patientId,
          },
        },
      },
      select: authorizationItemForResolverSelect,
      orderBy: {
        createdAt: "asc",
      },
    });

    const validCandidates = candidates.filter((item) => {
      if (item.authorizedQuantity === null) {
        return true;
      }

      return requestedQuantity.lte(
        item.authorizedQuantity.minus(item.usedQuantity),
      );
    });

    if (validCandidates.length === 0) {
      throw new AppError(
        404,
        "AUTHORIZATION_ITEM_NOT_FOUND",
        "Authorization item not found",
      );
    }

    if (validCandidates.length > 1) {
      throw new AppError(
        409,
        "AUTHORIZATION_ITEM_AMBIGUOUS",
        "More than one authorization item applies",
      );
    }

    const item = validCandidates[0];

    if (item === undefined) {
      throw new AppError(
        500,
        "INTERNAL_SERVER_ERROR",
        "Unable to resolve authorization item",
      );
    }

    return toAuthorizationItemResponse(item);
  }
}

export const authorizationService = new AuthorizationService();
