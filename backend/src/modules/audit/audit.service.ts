import type { Prisma } from "../../generated/prisma/client.js";

export interface AuditEvent {
  organizationId: bigint;

  actorUserId?: bigint;

  action: string;
  entityType: string;

  entityId?: bigint;
  entityKey?: string;

  reason?: string;

  metadata?: Prisma.InputJsonValue;

  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
  oldValues?: Prisma.InputJsonValue;
  newValues?: Prisma.InputJsonValue;
}

export interface AuditTechnicalMetadata {
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export function auditTechnicalFields(
  metadata: AuditTechnicalMetadata,
): AuditTechnicalMetadata {
  return {
    ...(metadata.correlationId !== undefined
      ? {
          correlationId: metadata.correlationId,
        }
      : {}),

    ...(metadata.ipAddress !== undefined
      ? {
          ipAddress: metadata.ipAddress,
        }
      : {}),

    ...(metadata.userAgent !== undefined
      ? {
          userAgent: metadata.userAgent,
        }
      : {}),
  };
}

export class AuditService {
  async writeWithinTransaction(
    tx: Prisma.TransactionClient,
    event: AuditEvent,
  ): Promise<void> {
    const data: Prisma.AuditLogUncheckedCreateInput = {
      organizationId: event.organizationId,

      action: event.action,

      entityType: event.entityType,

      ...(event.actorUserId !== undefined
        ? {
            actorUserId: event.actorUserId,
          }
        : {}),

      ...(event.entityId !== undefined
        ? {
            entityId: event.entityId,
          }
        : {}),

      ...(event.entityKey !== undefined
        ? {
            entityKey: event.entityKey,
          }
        : {}),

      ...(event.reason !== undefined
        ? {
            reason: event.reason,
          }
        : {}),

      ...(event.metadata !== undefined
        ? {
            metadata: event.metadata,
          }
        : {}),

      ...(event.correlationId !== undefined
        ? {
            correlationId: event.correlationId,
          }
        : {}),

      ...(event.ipAddress !== undefined
        ? {
            ipAddress: event.ipAddress,
          }
        : {}),

      ...(event.userAgent !== undefined
        ? {
            userAgent: event.userAgent,
          }
        : {}),
      ...(event.oldValues !== undefined
        ? {
            oldValues: event.oldValues,
          }
        : {}),

      ...(event.newValues !== undefined
        ? {
            newValues: event.newValues,
          }
        : {}),
    };

    await tx.auditLog.create({
      data,
    });
  }
}

export const auditService = new AuditService();
