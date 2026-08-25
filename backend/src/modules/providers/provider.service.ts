import { Prisma } from "../../generated/prisma/client.js";

import { prisma } from "../../infrastructure/database/prisma.js";

import { AppError } from "../../shared/errors/app-error.js";

import { auditService, auditTechnicalFields } from "../audit/audit.service.js";

import type {
  AuthenticatedRequestContext,
  RequestSecurityMetadata,
} from "../auth/auth.types.js";

import {
  providerDetailSelect,
  providerRepository,
  type ProviderDetailRecord,
} from "./provider.repository.js";

import type {
  CreateProviderInput,
  ListProvidersQuery,
  UpdateProviderInput,
} from "./provider.schemas.js";

import { toProviderResponse } from "./provider.types.js";

function normalizeNullableText(value: string | null | undefined) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmed = value.trim();

  return trimmed === "" ? null : trimmed;
}

function normalizeNullableEmail(value: string | null | undefined) {
  const normalized = normalizeNullableText(value);

  return typeof normalized === "string" ? normalized.toLowerCase() : normalized;
}

function providerEntityKey(provider: {
  id: bigint;
  svbProviderId: string | null;
}) {
  return provider.svbProviderId ?? provider.id.toString();
}

function toAuditValues(provider: {
  userId: bigint | null;
  svbProviderId: string | null;
  firstName: string;
  lastName: string;
  licenseNumber: string | null;
  specialty: string | null;
  email: string | null;
  phone: string | null;
  isActive: boolean;
}) {
  return {
    userId: provider.userId?.toString() ?? null,
    svbProviderId: provider.svbProviderId,
    firstName: provider.firstName,
    lastName: provider.lastName,
    licenseNumber: provider.licenseNumber,
    specialty: provider.specialty,
    email: provider.email,
    phone: provider.phone,
    isActive: provider.isActive,
  };
}

function mapUniqueConstraintError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    const target = Array.isArray(error.meta?.target)
      ? error.meta.target
      : [];

    if (target.includes("user_id") || target.includes("userId")) {
      throw new AppError(
        409,
        "USER_ALREADY_LINKED_TO_PROVIDER",
        "User is already linked to another provider",
      );
    }

    if (
      target.includes("organization_id") ||
      target.includes("organizationId") ||
      target.includes("svb_provider_id") ||
      target.includes("svbProviderId")
    ) {
      throw new AppError(
        409,
        "PROVIDER_SVB_ID_ALREADY_EXISTS",
        "SVB Provider ID already belongs to another provider",
      );
    }
  }

  throw error;
}

async function validateUserLink(
  tx: Prisma.TransactionClient,
  userId: bigint,
  organizationId: bigint,
  currentProviderId?: bigint,
) {
  const user = await tx.user.findFirst({
    where: {
      id: userId,
      organizationId,
      archivedAt: null,
    },

    select: {
      id: true,
    },
  });

  if (!user) {
    throw new AppError(404, "USER_NOT_FOUND", "User not found");
  }

  const linkedProvider = await providerRepository.findByUserId(userId, tx);

  if (
    linkedProvider &&
    (currentProviderId === undefined || linkedProvider.id !== currentProviderId)
  ) {
    throw new AppError(
      409,
      "USER_ALREADY_LINKED_TO_PROVIDER",
      "User is already linked to another provider",
    );
  }
}

async function validateSvbProviderId(
  tx: Prisma.TransactionClient,
  organizationId: bigint,
  svbProviderId: string | null,
  currentProviderId?: bigint,
) {
  if (svbProviderId === null) {
    return;
  }

  const existing = await providerRepository.findBySvbProviderId(
    organizationId,
    svbProviderId,
    tx,
  );

  if (
    existing &&
    (currentProviderId === undefined || existing.id !== currentProviderId)
  ) {
    throw new AppError(
      409,
      "PROVIDER_SVB_ID_ALREADY_EXISTS",
      "SVB Provider ID already belongs to another provider",
    );
  }
}

export class ProviderService {
  async list(query: ListProvidersQuery, actor: AuthenticatedRequestContext) {
    const skip = (query.page - 1) * query.pageSize;

    const where: Prisma.ProviderWhereInput = {
      organizationId: actor.organizationId,

      ...(query.isActive !== undefined
        ? {
            isActive: query.isActive,
          }
        : {}),

      ...(query.q !== undefined
        ? {
            OR: [
              {
                firstName: {
                  contains: query.q,
                },
              },
              {
                lastName: {
                  contains: query.q,
                },
              },
              {
                svbProviderId: {
                  contains: query.q,
                },
              },
              {
                licenseNumber: {
                  contains: query.q,
                },
              },
              {
                email: {
                  contains: query.q,
                },
              },
              {
                phone: {
                  contains: query.q,
                },
              },
              {
                specialty: {
                  contains: query.q,
                },
              },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.provider.findMany({
        where,
        select: providerDetailSelect,
        orderBy: [
          {
            lastName: "asc",
          },
          {
            firstName: "asc",
          },
        ],
        skip,
        take: query.pageSize,
      }),

      prisma.provider.count({
        where,
      }),
    ]);

    return {
      providers: rows.map(toProviderResponse),

      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async getById(providerId: bigint, actor: AuthenticatedRequestContext) {
    const provider = await providerRepository.findById(
      providerId,
      actor.organizationId,
    );

    if (!provider) {
      throw new AppError(404, "PROVIDER_NOT_FOUND", "Provider not found");
    }

    return toProviderResponse(provider);
  }

  async create(
    input: CreateProviderInput,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    const userId =
      input.userId === undefined || input.userId === null
        ? null
        : BigInt(input.userId);

    const svbProviderId = normalizeNullableText(input.svbProviderId);

    try {
      const created = await prisma.$transaction(async (tx) => {
        if (userId !== null) {
          await validateUserLink(tx, userId, actor.organizationId);
        }

        await validateSvbProviderId(
          tx,
          actor.organizationId,
          svbProviderId ?? null,
        );

        const provider = await tx.provider.create({
          data: {
            organizationId: actor.organizationId,
            userId,
            svbProviderId: svbProviderId ?? null,
            firstName: input.firstName.trim(),
            lastName: input.lastName.trim(),
            licenseNumber: normalizeNullableText(input.licenseNumber) ?? null,
            specialty: normalizeNullableText(input.specialty) ?? null,
            email: normalizeNullableEmail(input.email) ?? null,
            phone: normalizeNullableText(input.phone) ?? null,

            ...(input.isActive !== undefined
              ? {
                  isActive: input.isActive,
                }
              : {}),
          },

          select: providerDetailSelect,
        });

        await auditService.writeWithinTransaction(tx, {
          organizationId: actor.organizationId,
          actorUserId: actor.userId,
          action: "PROVIDER_CREATE",
          entityType: "PROVIDER",
          entityId: provider.id,
          entityKey: providerEntityKey(provider),
          newValues: toAuditValues(provider),
          ...auditTechnicalFields(metadata),
        });

        return provider;
      });

      return toProviderResponse(created);
    } catch (error) {
      mapUniqueConstraintError(error);
    }
  }

  async update(
    providerId: bigint,
    input: UpdateProviderInput,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    try {
      const updated: ProviderDetailRecord = await prisma.$transaction(
        async (tx) => {
          const current = await providerRepository.findById(
            providerId,
            actor.organizationId,
            tx,
          );

          if (!current) {
            throw new AppError(404, "PROVIDER_NOT_FOUND", "Provider not found");
          }

          const userId =
            input.userId === undefined
              ? current.userId
              : input.userId === null
                ? null
                : BigInt(input.userId);

          if (input.userId !== undefined && userId !== null) {
            await validateUserLink(
              tx,
              userId,
              actor.organizationId,
              providerId,
            );
          }

          const svbProviderId =
            input.svbProviderId === undefined
              ? current.svbProviderId
              : normalizeNullableText(input.svbProviderId) ?? null;

          if (input.svbProviderId !== undefined) {
            await validateSvbProviderId(
              tx,
              actor.organizationId,
              svbProviderId,
              providerId,
            );
          }

          const updateData: Prisma.ProviderUncheckedUpdateInput = {};

          if (input.userId !== undefined) {
            updateData.userId = userId;
          }

          if (input.svbProviderId !== undefined) {
            updateData.svbProviderId = svbProviderId;
          }

          if (input.firstName !== undefined) {
            updateData.firstName = input.firstName.trim();
          }

          if (input.lastName !== undefined) {
            updateData.lastName = input.lastName.trim();
          }

          if (input.licenseNumber !== undefined) {
            updateData.licenseNumber =
              normalizeNullableText(input.licenseNumber) ?? null;
          }

          if (input.specialty !== undefined) {
            updateData.specialty = normalizeNullableText(input.specialty) ?? null;
          }

          if (input.email !== undefined) {
            updateData.email = normalizeNullableEmail(input.email) ?? null;
          }

          if (input.phone !== undefined) {
            updateData.phone = normalizeNullableText(input.phone) ?? null;
          }

          if (input.isActive !== undefined) {
            updateData.isActive = input.isActive;
          }

          const provider = await tx.provider.update({
            where: {
              id: providerId,
            },

            data: updateData,

            select: providerDetailSelect,
          });

          await auditService.writeWithinTransaction(tx, {
            organizationId: actor.organizationId,
            actorUserId: actor.userId,
            action: "PROVIDER_UPDATE",
            entityType: "PROVIDER",
            entityId: provider.id,
            entityKey: providerEntityKey(provider),
            oldValues: toAuditValues(current),
            newValues: toAuditValues(provider),
            ...auditTechnicalFields(metadata),
          });

          return provider;
        },
      );

      return toProviderResponse(updated);
    } catch (error) {
      mapUniqueConstraintError(error);
    }
  }
}

export const providerService = new ProviderService();
