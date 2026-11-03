import type { Prisma } from "../../generated/prisma/client.js";

export const accidentContextRepository = {
  async findAndLock(tx: Prisma.TransactionClient, id: bigint, patientId: bigint, organizationId: bigint) {
    await tx.$queryRaw`SELECT ac.id FROM accident_cases ac JOIN patients p ON p.id = ac.patient_id
      WHERE ac.id = ${id} AND ac.patient_id = ${patientId} AND p.organization_id = ${organizationId} FOR SHARE OF ac`;
    return tx.accidentCase.findFirst({
      where: { id, patientId, patient: { organizationId } },
      select: { id: true, patientInsuranceId: true, accidentFormNumber: true,
        patientInsurance: { select: { patientId: true, patient: { select: { organizationId: true } } } } },
    });
  },
};
