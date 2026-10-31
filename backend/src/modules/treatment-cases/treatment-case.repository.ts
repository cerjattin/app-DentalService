import { Prisma } from "../../generated/prisma/client.js";
import type { ListTreatmentCasesQuery } from "./treatment-case.schemas.js";
export const treatmentCaseSelect = {
  id: true, organizationId: true, patientId: true, treatmentId: true, treatmentType: true,
  description: true, status: true, firstAssignedAt: true, startedAt: true, completedAt: true, createdAt: true, updatedAt: true,
  _count: { select: { appointments: true } },
} satisfies Prisma.TreatmentCaseSelect;
export type TreatmentCaseRecord = Prisma.TreatmentCaseGetPayload<{ select: typeof treatmentCaseSelect }>;
export const treatmentCaseRepository = {
  findPatient(tx: Prisma.TransactionClient, patientId: bigint, organizationId: bigint, active: boolean) {
    return tx.patient.findFirst({ where: { id: patientId, organizationId,
      ...(active ? { status: "ACTIVE" as const, archivedAt: null } : {}) }, select: { id: true } });
  },
  create(tx: Prisma.TransactionClient, data: Prisma.TreatmentCaseUncheckedCreateInput) {
    return tx.treatmentCase.create({ data, select: treatmentCaseSelect });
  },
  update(tx: Prisma.TransactionClient, id: bigint, data: Prisma.TreatmentCaseUpdateInput) {
    return tx.treatmentCase.update({ where: { id }, data, select: treatmentCaseSelect });
  },
  async listPage(tx: Prisma.TransactionClient, patientId: bigint, organizationId: bigint, query: ListTreatmentCasesQuery) {
    const search = query.q ? Prisma.sql`AND strpos(public.odontho_fold_search(concat_ws(' ', treatment_id, treatment_type, description)) COLLATE "C", public.odontho_fold_search(${query.q}::text) COLLATE "C") > 0` : Prisma.empty;
    const filter = Prisma.sql`WHERE patient_id = ${patientId} AND organization_id = ${organizationId}
      ${query.status ? Prisma.sql`AND status::text = ${query.status}` : Prisma.empty} ${search}`;
    const counts = await tx.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`SELECT count(*) AS total FROM treatment_cases ${filter}`);
    const ids = await tx.$queryRaw<Array<{ id: bigint }>>(Prisma.sql`SELECT id FROM treatment_cases ${filter}
      ORDER BY created_at DESC, id DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    const rows = await tx.treatmentCase.findMany({ where: { id: { in: ids.map((r) => r.id) } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: treatmentCaseSelect });
    return { total: Number(counts[0]?.total ?? 0n), rows };
  },
  async lock(tx: Prisma.TransactionClient, id: bigint, patientId: bigint, organizationId: bigint) {
    await tx.$queryRaw`SELECT id FROM treatment_cases WHERE id = ${id} AND patient_id = ${patientId}
      AND organization_id = ${organizationId} FOR UPDATE`;
    return this.find(tx, id, patientId, organizationId);
  },
  find(tx: Prisma.TransactionClient, id: bigint, patientId: bigint, organizationId: bigint) {
    return tx.treatmentCase.findFirst({ where: { id, patientId, organizationId }, select: treatmentCaseSelect });
  },
};
