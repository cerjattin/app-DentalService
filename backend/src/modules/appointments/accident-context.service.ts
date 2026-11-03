import type { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../shared/errors/app-error.js";
import { accidentContextRepository } from "./accident-context.repository.js";

// Validates existing references only. This does not authorize a new accident
// capture workflow or assert that a particular accident qualifies for SVB.
export async function validateAccidentContext(tx: Prisma.TransactionClient, id: bigint | null | undefined,
  patientId: bigint, organizationId: bigint, patientInsuranceId?: bigint) {
  if (id == null) return null;
  const accident = await accidentContextRepository.findAndLock(tx, id, patientId, organizationId);
  if (!accident) throw new AppError(404, "ACCIDENT_CASE_NOT_FOUND", "Accident case not found");
  if ((accident.patientInsurance && (accident.patientInsurance.patientId !== patientId ||
        accident.patientInsurance.patient.organizationId !== organizationId)) ||
      (patientInsuranceId !== undefined && accident.patientInsuranceId !== null && accident.patientInsuranceId !== patientInsuranceId)) {
    throw new AppError(409, "ACCIDENT_INSURANCE_CONTEXT_MISMATCH", "Accident context does not match the procedure insurance");
  }
  return accident;
}
