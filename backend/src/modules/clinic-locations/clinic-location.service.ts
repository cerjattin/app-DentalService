import { clinicLocationRepository } from "./clinic-location.repository.js";

export const clinicLocationService = {
  async list(organizationId: bigint, isActive?: boolean) {
    const rows = await clinicLocationRepository.list(organizationId, isActive);
    return rows.map((row) => ({ ...row, id: row.id.toString() }));
  },
};
