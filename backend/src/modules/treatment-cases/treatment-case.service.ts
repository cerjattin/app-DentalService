import { isTransactionConflict } from "../../infrastructure/database/transaction-conflict.js";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../infrastructure/database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { auditService, auditTechnicalFields } from "../audit/audit.service.js";
import type { AuthenticatedRequestContext, RequestSecurityMetadata } from "../auth/auth.types.js";
import { treatmentCaseRepository, type TreatmentCaseRecord } from "./treatment-case.repository.js";
import type { CreateTreatmentCaseInput, UpdateTreatmentCaseInput, ListTreatmentCasesQuery } from "./treatment-case.schemas.js";

export function treatmentCaseResponse(row: TreatmentCaseRecord) {
  return { id: row.id.toString(), organizationId: row.organizationId.toString(), patientId: row.patientId.toString(),
    treatmentId: row.treatmentId, treatmentType: row.treatmentType, description: row.description, status: row.status,
    startedAt: row.startedAt?.toISOString() ?? null, completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
    isEditable: row.status === "PLANNED" && row.firstAssignedAt === null && row._count.appointments === 0 };
}
async function patient(tx: Prisma.TransactionClient, patientId: bigint, organizationId: bigint, active: boolean) {
  const found = await treatmentCaseRepository.findPatient(tx, patientId, organizationId, active);
  if (!found) throw new AppError(404, "PATIENT_NOT_FOUND", "Patient not found");
}
function requireCase(row: TreatmentCaseRecord | null): asserts row is TreatmentCaseRecord {
  if (!row) throw new AppError(404, "TREATMENT_CASE_NOT_FOUND", "Treatment case not found");
}
export async function validateAssignableTreatmentCase(tx: Prisma.TransactionClient, id: bigint | null | undefined, patientId: bigint, organizationId: bigint) {
  if (id == null) return;
  const row = await treatmentCaseRepository.lock(tx, id, patientId, organizationId);
  requireCase(row);
  if (row.status !== "PLANNED" && row.status !== "ACTIVE") {
    throw new AppError(409, "TREATMENT_CASE_NOT_ASSIGNABLE", "Treatment case is not assignable");
  }
}
async function write<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
    catch (error) {
      if (isTransactionConflict(error)) {
        if (attempt < 2) continue;
        throw new AppError(409, "TREATMENT_CASE_NOT_EDITABLE", "Treatment case changed concurrently; reload before editing");
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") throw new AppError(409, "TREATMENT_ID_ALREADY_EXISTS", "External treatment ID is already used for this patient");
      }
      throw error;
    }
  }
}
export const treatmentCaseService = {
  async list(patientId: bigint, query: ListTreatmentCasesQuery, actor: AuthenticatedRequestContext) {
    return prisma.$transaction(async (tx) => {
      await patient(tx, patientId, actor.organizationId, false);
      const { rows, total } = await treatmentCaseRepository.listPage(tx, patientId, actor.organizationId, query);
      return { cases: rows.map(treatmentCaseResponse), pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) } };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  },
  async get(patientId: bigint, id: bigint, actor: AuthenticatedRequestContext) {
    return prisma.$transaction(async (tx) => {
      await patient(tx, patientId, actor.organizationId, false);
      const row = await treatmentCaseRepository.find(tx, id, patientId, actor.organizationId);
      requireCase(row);
      return treatmentCaseResponse(row);
    });
  },
  async create(patientId: bigint, input: CreateTreatmentCaseInput, actor: AuthenticatedRequestContext, metadata: RequestSecurityMetadata) {
    return write(async (tx) => {
      await patient(tx, patientId, actor.organizationId, true);
      const row = await treatmentCaseRepository.create(tx, { patientId, organizationId: actor.organizationId,
        createdByUserId: actor.userId, treatmentId: input.treatmentId, treatmentType: input.treatmentType ?? null,
        description: input.description ?? null, status: "PLANNED" });
      const response = treatmentCaseResponse(row);
      await auditService.writeWithinTransaction(tx, { organizationId: actor.organizationId, actorUserId: actor.userId,
        action: "TREATMENT_CASE_CREATE", entityType: "TREATMENT_CASE", entityId: row.id, newValues: response, ...auditTechnicalFields(metadata) });
      return response;
    });
  },
  async update(patientId: bigint, id: bigint, input: UpdateTreatmentCaseInput, actor: AuthenticatedRequestContext, metadata: RequestSecurityMetadata) {
    return write(async (tx) => {
      await patient(tx, patientId, actor.organizationId, true);
      const before = await treatmentCaseRepository.lock(tx, id, patientId, actor.organizationId);
      requireCase(before);
      if (!treatmentCaseResponse(before).isEditable) throw new AppError(409, "TREATMENT_CASE_NOT_EDITABLE", "Only unused PLANNED treatment cases can be edited");
      const row = await treatmentCaseRepository.update(tx, id, {
        ...(input.treatmentId !== undefined ? { treatmentId: input.treatmentId } : {}),
        ...(input.treatmentType !== undefined ? { treatmentType: input.treatmentType } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}), updatedAt: new Date(),
      });
      await auditService.writeWithinTransaction(tx, { organizationId: actor.organizationId, actorUserId: actor.userId,
        action: "TREATMENT_CASE_UPDATE", entityType: "TREATMENT_CASE", entityId: id,
        oldValues: treatmentCaseResponse(before), newValues: treatmentCaseResponse(row), ...auditTechnicalFields(metadata) });
      return treatmentCaseResponse(row);
    });
  },
};
