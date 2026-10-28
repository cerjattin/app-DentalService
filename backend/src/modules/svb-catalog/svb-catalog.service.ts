import { Prisma } from "../../generated/prisma/client.js";

import { prisma } from "../../infrastructure/database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { formatDateOnly, parseDateOnly } from "../../shared/utils/date-only.js";

import {
  svbCatalogRepository,
  svbProcedureSelect,
  svbTariffSelect,
} from "./svb-catalog.repository.js";

import type {
  CreateSvbProcedureInput,
  UpdateSvbProcedureInput,
  CreateSvbTariffInput,
  UpdateSvbTariffInput,
  ApplicableTariffQuery,
  ListSvbProceduresQuery,
  ListSvbTariffsQuery,
} from "./svb-catalog.schemas.js";

import {
  toSvbProcedureResponse,
  toSvbTariffResponse,
} from "./svb-catalog.types.js";

import { auditService, auditTechnicalFields } from "../audit/audit.service.js";
import type {
  AuthenticatedRequestContext,
  RequestSecurityMetadata,
} from "../auth/auth.types.js";

function nullableDate(value: string | null | undefined, field: string) {
  return value == null ? null : parseDateOnly(value, field);
}

function assertPeriod(from: Date | null, to: Date | null, code: string) {
  if (from !== null && to !== null && to < from) {
    throw new AppError(400, code, "validTo must be on or after validFrom");
  }
}

function mapWriteError(error: unknown, code: string): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw new AppError(
      409,
      code,
      code === "SVB_PROCEDURE_CODE_ALREADY_EXISTS"
        ? "A service with this code already exists"
        : "A tariff with this procedure, currency and validFrom already exists",
    );
  }
  throw error;
}

// All catalogue writers for a procedure take the same parent row lock. This
// serializes overlap checks even when no tariff yet exists in the interval.
async function lockProcedure(tx: Prisma.TransactionClient, id: bigint) {
  const rows = await tx.$queryRaw<Array<{ id: bigint }>>`
    SELECT id FROM svb_procedures WHERE id = ${id} FOR UPDATE`;
  if (rows.length === 0) {
    throw new AppError(
      404,
      "SVB_PROCEDURE_NOT_FOUND",
      "SVB procedure not found",
    );
  }
  return tx.svbProcedure.findUniqueOrThrow({
    where: { id },
    select: svbProcedureSelect,
  });
}

async function assertTariffAvailable(
  tx: Prisma.TransactionClient,
  input: {
    svbProcedureId: bigint;
    currencyCode: string;
    validFrom: Date;
    validTo: Date | null;
    isActive: boolean;
  },
  excludeId?: bigint,
) {
  const scope = {
    svbProcedureId: input.svbProcedureId,
    currencyCode: input.currencyCode,
    ...(excludeId === undefined ? {} : { id: { not: excludeId } }),
  };
  // The existing unique key applies to inactive tariffs as well.
  if (
    await tx.svbTariff.findFirst({
      where: { ...scope, validFrom: input.validFrom },
      select: { id: true },
    })
  ) {
    throw new AppError(
      409,
      "SVB_TARIFF_ALREADY_EXISTS",
      "A tariff with this procedure, currency and validFrom already exists",
    );
  }
  if (!input.isActive) return;
  const overlap = await tx.svbTariff.findFirst({
    where: {
      ...scope,
      isActive: true,
      ...(input.validTo === null ? {} : { validFrom: { lte: input.validTo } }),
      OR: [{ validTo: null }, { validTo: { gte: input.validFrom } }],
    },
    select: { id: true },
  });
  if (overlap) {
    throw new AppError(
      409,
      "SVB_TARIFF_PERIOD_OVERLAP",
      "An active tariff overlaps this period for the same currency",
    );
  }
}

function normalizeCurrencyCode(currencyCode: string) {
  const normalized = currencyCode.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "currencyCode must be a 3-letter ISO code",
    );
  }

  return normalized;
}

function validityWhere(serviceDate: Date) {
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
  } satisfies Prisma.SvbProcedureWhereInput;
}

function tariffValidityWhere(serviceDate: Date) {
  return {
    validFrom: {
      lte: serviceDate,
    },
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
  } satisfies Prisma.SvbTariffWhereInput;
}

function assertProcedureValidForServiceDate(
  procedure: {
    isActive: boolean;
    validFrom: Date | null;
    validTo: Date | null;
  },
  serviceDate: Date,
) {
  if (!procedure.isActive) {
    throw new AppError(
      409,
      "SVB_PROCEDURE_INACTIVE",
      "SVB procedure is inactive",
    );
  }

  if (
    (procedure.validFrom !== null && procedure.validFrom > serviceDate) ||
    (procedure.validTo !== null && procedure.validTo < serviceDate)
  ) {
    throw new AppError(
      409,
      "SVB_PROCEDURE_NOT_VALID",
      "SVB procedure is not valid for the service date",
    );
  }
}

export class SvbCatalogService {
  async createProcedure(
    input: CreateSvbProcedureInput,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    const validFrom = nullableDate(input.validFrom, "validFrom");
    const validTo = nullableDate(input.validTo, "validTo");
    assertPeriod(validFrom, validTo, "INVALID_SVB_PROCEDURE_PERIOD");
    try {
      return await prisma.$transaction(async (tx) => {
        const row = await tx.svbProcedure.create({
          data: {
            code: input.code,
            description: input.description,
            category: input.category ?? null,
            unit: input.unit ?? null,
            requiresAuthorization: input.requiresAuthorization ?? false,
            requiresReferral: input.requiresReferral ?? false,
            isActive: input.isActive ?? true,
            validFrom,
            validTo,
          },
          select: svbProcedureSelect,
        });
        const response = toSvbProcedureResponse(row);
        await auditService.writeWithinTransaction(tx, {
          organizationId: actor.organizationId,
          actorUserId: actor.userId,
          action: "SVB_PROCEDURE_CREATE",
          entityType: "SVB_PROCEDURE",
          entityId: row.id,
          entityKey: row.code,
          newValues: response,
          ...auditTechnicalFields(metadata),
        });
        return response;
      });
    } catch (error) {
      mapWriteError(error, "SVB_PROCEDURE_CODE_ALREADY_EXISTS");
    }
  }

  async updateProcedure(
    id: bigint,
    input: UpdateSvbProcedureInput,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    try {
      return await prisma.$transaction(async (tx) => {
        const before = await lockProcedure(tx, id);
        const validFrom =
          input.validFrom === undefined
            ? before.validFrom
            : nullableDate(input.validFrom, "validFrom");
        const validTo =
          input.validTo === undefined
            ? before.validTo
            : nullableDate(input.validTo, "validTo");
        assertPeriod(validFrom, validTo, "INVALID_SVB_PROCEDURE_PERIOD");
        const row = await tx.svbProcedure.update({
          where: { id },
          data: {
            code: input.code ?? before.code,
            description: input.description ?? before.description,
            category:
              input.category === undefined ? before.category : input.category,
            unit: input.unit === undefined ? before.unit : input.unit,
            requiresAuthorization:
              input.requiresAuthorization ?? before.requiresAuthorization,
            requiresReferral: input.requiresReferral ?? before.requiresReferral,
            isActive: input.isActive ?? before.isActive,
            validFrom,
            validTo,
            updatedAt: new Date(),
          },
          select: svbProcedureSelect,
        });
        const response = toSvbProcedureResponse(row);
        await auditService.writeWithinTransaction(tx, {
          organizationId: actor.organizationId,
          actorUserId: actor.userId,
          action: "SVB_PROCEDURE_UPDATE",
          entityType: "SVB_PROCEDURE",
          entityId: id,
          entityKey: row.code,
          oldValues: toSvbProcedureResponse(before),
          newValues: response,
          ...auditTechnicalFields(metadata),
        });
        return response;
      });
    } catch (error) {
      mapWriteError(error, "SVB_PROCEDURE_CODE_ALREADY_EXISTS");
    }
  }

  async createTariff(
    id: bigint,
    input: CreateSvbTariffInput,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    const validFrom = parseDateOnly(input.validFrom, "validFrom");
    const validTo = nullableDate(input.validTo, "validTo");
    assertPeriod(validFrom, validTo, "INVALID_SVB_TARIFF_PERIOD");
    try {
      return await prisma.$transaction(async (tx) => {
        await lockProcedure(tx, id);
        const data = {
          ...input,
          svbProcedureId: id,
          validFrom,
          validTo,
          isActive: input.isActive ?? true,
        };
        await assertTariffAvailable(tx, data);
        const row = await tx.svbTariff.create({
          data,
          select: svbTariffSelect,
        });
        const response = toSvbTariffResponse(row);
        await auditService.writeWithinTransaction(tx, {
          organizationId: actor.organizationId,
          actorUserId: actor.userId,
          action: "SVB_TARIFF_CREATE",
          entityType: "SVB_TARIFF",
          entityId: row.id,
          newValues: response,
          ...auditTechnicalFields(metadata),
        });
        return response;
      });
    } catch (error) {
      mapWriteError(error, "SVB_TARIFF_ALREADY_EXISTS");
    }
  }

  async updateTariff(
    id: bigint,
    tariffId: bigint,
    input: UpdateSvbTariffInput,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    try {
      return await prisma.$transaction(async (tx) => {
        await lockProcedure(tx, id);
        const before = await tx.svbTariff.findFirst({
          where: { id: tariffId, svbProcedureId: id },
          select: svbTariffSelect,
        });
        if (!before)
          throw new AppError(
            404,
            "SVB_TARIFF_NOT_FOUND",
            "SVB tariff not found for this procedure",
          );
        const validFrom =
          input.validFrom === undefined
            ? before.validFrom
            : parseDateOnly(input.validFrom, "validFrom");
        const validTo =
          input.validTo === undefined
            ? before.validTo
            : nullableDate(input.validTo, "validTo");
        assertPeriod(validFrom, validTo, "INVALID_SVB_TARIFF_PERIOD");
        await assertTariffAvailable(
          tx,
          {
            svbProcedureId: id,
            currencyCode: input.currencyCode ?? before.currencyCode,
            isActive: input.isActive ?? before.isActive,
            validFrom,
            validTo,
          },
          tariffId,
        );
        const row = await tx.svbTariff.update({
          where: { id: tariffId, svbProcedureId: id },
          data: {
            amount: input.amount ?? before.amount,
            currencyCode: input.currencyCode ?? before.currencyCode,
            isActive: input.isActive ?? before.isActive,
            validFrom,
            validTo,
            updatedAt: new Date(),
          },
          select: svbTariffSelect,
        });
        const response = toSvbTariffResponse(row);
        await auditService.writeWithinTransaction(tx, {
          organizationId: actor.organizationId,
          actorUserId: actor.userId,
          action: "SVB_TARIFF_UPDATE",
          entityType: "SVB_TARIFF",
          entityId: tariffId,
          oldValues: toSvbTariffResponse(before),
          newValues: response,
          ...auditTechnicalFields(metadata),
        });
        return response;
      });
    } catch (error) {
      mapWriteError(error, "SVB_TARIFF_ALREADY_EXISTS");
    }
  }

  async listProcedures(query: ListSvbProceduresQuery) {
    const skip = (query.page - 1) * query.pageSize;
    const serviceDate =
      query.serviceDate !== undefined
        ? parseDateOnly(query.serviceDate, "serviceDate")
        : undefined;

    const where: Prisma.SvbProcedureWhereInput = {
      ...(query.category !== undefined
        ? {
            category: query.category,
          }
        : {}),

      ...(query.requiresAuthorization !== undefined
        ? {
            requiresAuthorization: query.requiresAuthorization,
          }
        : {}),

      ...(query.requiresReferral !== undefined
        ? {
            requiresReferral: query.requiresReferral,
          }
        : {}),

      ...(query.isActive !== undefined
        ? {
            isActive: query.isActive,
          }
        : {}),

      ...(query.q !== undefined
        ? {
            OR: [
              {
                code: {
                  contains: query.q,
                },
              },
              {
                description: {
                  contains: query.q,
                },
              },
            ],
          }
        : {}),

      ...(serviceDate !== undefined ? validityWhere(serviceDate) : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.svbProcedure.findMany({
        where,
        select: svbProcedureSelect,
        orderBy: {
          code: "asc",
        },
        skip,
        take: query.pageSize,
      }),

      prisma.svbProcedure.count({
        where,
      }),
    ]);

    return {
      procedures: rows.map(toSvbProcedureResponse),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async getProcedureById(svbProcedureId: bigint) {
    const procedure =
      await svbCatalogRepository.findProcedureById(svbProcedureId);

    if (!procedure) {
      throw new AppError(
        404,
        "SVB_PROCEDURE_NOT_FOUND",
        "SVB procedure not found",
      );
    }

    return toSvbProcedureResponse(procedure);
  }

  async listTariffs(svbProcedureId: bigint, query: ListSvbTariffsQuery) {
    const procedure =
      await svbCatalogRepository.findProcedureById(svbProcedureId);

    if (!procedure) {
      throw new AppError(
        404,
        "SVB_PROCEDURE_NOT_FOUND",
        "SVB procedure not found",
      );
    }

    const skip = (query.page - 1) * query.pageSize;
    const serviceDate =
      query.serviceDate !== undefined
        ? parseDateOnly(query.serviceDate, "serviceDate")
        : undefined;

    const where: Prisma.SvbTariffWhereInput = {
      svbProcedureId,

      ...(query.currencyCode !== undefined
        ? {
            currencyCode: query.currencyCode,
          }
        : {}),

      ...(query.isActive !== undefined
        ? {
            isActive: query.isActive,
          }
        : {}),

      ...(serviceDate !== undefined ? tariffValidityWhere(serviceDate) : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.svbTariff.findMany({
        where,
        select: svbTariffSelect,
        orderBy: {
          validFrom: "desc",
        },
        skip,
        take: query.pageSize,
      }),

      prisma.svbTariff.count({
        where,
      }),
    ]);

    return {
      tariffs: rows.map(toSvbTariffResponse),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async resolveApplicableTariff(input: {
    svbProcedureId: bigint;
    serviceDate: Date;
    currencyCode: string;
  }) {
    const currencyCode = normalizeCurrencyCode(input.currencyCode);

    const procedure = await svbCatalogRepository.findProcedureById(
      input.svbProcedureId,
    );

    if (!procedure) {
      throw new AppError(
        404,
        "SVB_PROCEDURE_NOT_FOUND",
        "SVB procedure not found",
      );
    }

    assertProcedureValidForServiceDate(procedure, input.serviceDate);

    const tariffs = await prisma.svbTariff.findMany({
      where: {
        svbProcedureId: input.svbProcedureId,
        currencyCode,
        isActive: true,
        ...tariffValidityWhere(input.serviceDate),
      },
      select: svbTariffSelect,
      orderBy: {
        validFrom: "desc",
      },
      take: 2,
    });

    if (tariffs.length === 0) {
      throw new AppError(
        404,
        "SVB_TARIFF_NOT_FOUND",
        "SVB tariff not found",
      );
    }

    if (tariffs.length > 1) {
      throw new AppError(
        409,
        "SVB_TARIFF_AMBIGUOUS",
        "More than one SVB tariff applies to the requested service date",
      );
    }

    const tariff = tariffs[0];

    if (tariff === undefined) {
      throw new AppError(
        500,
        "INTERNAL_SERVER_ERROR",
        "Unable to resolve SVB tariff",
      );
    }

    return {
      procedure: toSvbProcedureResponse(procedure),
      tariff: toSvbTariffResponse(tariff),
      serviceDate: formatDateOnly(input.serviceDate),
    };
  }

  async getApplicableTariff(
    svbProcedureId: bigint,
    query: ApplicableTariffQuery,
  ) {
    return this.resolveApplicableTariff({
      svbProcedureId,
      serviceDate: parseDateOnly(query.serviceDate, "serviceDate"),
      currencyCode: query.currencyCode,
    });
  }
}

export const svbCatalogService = new SvbCatalogService();
