import { createHash } from "node:crypto";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../infrastructure/database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { auditService, auditTechnicalFields } from "../audit/audit.service.js";
import type { AuthenticatedRequestContext, RequestSecurityMetadata } from "../auth/auth.types.js";
import { organizationRepository, type OrganizationSettingsRecord } from "./organization.repository.js";
import type { UpdateOrganizationInput } from "./organization.schemas.js";

export function organizationSettings(row: OrganizationSettingsRecord) {
  const settings = { id: row.id.toString(), legalName: row.legalName, tradeName: row.tradeName,
    declarantId: row.declarantId, email: row.email, phone: row.phone, timezone: row.timezone,
    updatedAt: row.updatedAt.toISOString() };
  return { ...settings, revision: createHash("sha256").update(JSON.stringify(settings)).digest("hex") };
}
function requireOrganization(row: OrganizationSettingsRecord | null): asserts row is OrganizationSettingsRecord {
  if (!row) throw new AppError(404, "ORGANIZATION_NOT_FOUND", "Organization not found");
}
export const organizationService = {
  async get(actor: AuthenticatedRequestContext) {
    const row = await organizationRepository.find(actor.organizationId);
    requireOrganization(row);
    return organizationSettings(row);
  },
  async update(input: UpdateOrganizationInput, actor: AuthenticatedRequestContext, metadata: RequestSecurityMetadata) {
    try {
      return await prisma.$transaction(async (tx) => {
        const before = await organizationRepository.lock(tx, actor.organizationId);
        requireOrganization(before);
        if (organizationSettings(before).revision !== input.expectedRevision) {
          throw new AppError(409, "ORGANIZATION_VERSION_CONFLICT", "Organization settings changed; reload and compare before saving");
        }
        const { expectedRevision: _revision, reason, ...data } = input;
        const after = await organizationRepository.update(tx, before.id, {
          ...(data.legalName !== undefined ? { legalName: data.legalName } : {}),
          ...(data.tradeName !== undefined ? { tradeName: data.tradeName } : {}),
          ...(data.declarantId !== undefined ? { declarantId: data.declarantId } : {}),
          ...(data.email !== undefined ? { email: data.email } : {}),
          ...(data.phone !== undefined ? { phone: data.phone } : {}), updatedAt: new Date(),
        });
        await auditService.writeWithinTransaction(tx, {
          organizationId: actor.organizationId, actorUserId: actor.userId, action: "ORGANIZATION_UPDATE",
          entityType: "ORGANIZATION", entityId: before.id, reason,
          oldValues: organizationSettings(before), newValues: organizationSettings(after), ...auditTechnicalFields(metadata),
        });
        return organizationSettings(after);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new AppError(409, "DECLARANT_ID_ALREADY_EXISTS", "Declarant ID is already configured");
      }
      throw error;
    }
  },
};
