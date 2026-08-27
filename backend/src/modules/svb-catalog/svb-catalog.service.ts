import type { Prisma } from "../../generated/prisma/client.js";

import { prisma } from "../../infrastructure/database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { formatDateOnly, parseDateOnly } from "../../shared/utils/date-only.js";

import {
  svbCatalogRepository,
  svbProcedureSelect,
  svbTariffSelect,
} from "./svb-catalog.repository.js";

import type {
  ApplicableTariffQuery,
  ListSvbProceduresQuery,
  ListSvbTariffsQuery,
} from "./svb-catalog.schemas.js";

import {
  toSvbProcedureResponse,
  toSvbTariffResponse,
} from "./svb-catalog.types.js";

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
