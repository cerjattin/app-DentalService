import type { ProviderDetailRecord } from "./provider.repository.js";

export function toProviderResponse(provider: ProviderDetailRecord) {
  return {
    id: provider.id.toString(),

    organizationId: provider.organizationId.toString(),

    userId: provider.userId?.toString() ?? null,

    svbProviderId: provider.svbProviderId,

    firstName: provider.firstName,

    lastName: provider.lastName,

    licenseNumber: provider.licenseNumber,

    specialty: provider.specialty,

    email: provider.email,

    phone: provider.phone,

    isActive: provider.isActive,

    user:
      provider.user === null
        ? null
        : {
            id: provider.user.id.toString(),

            email: provider.user.email,

            firstName: provider.user.firstName,

            lastName: provider.user.lastName,

            status: provider.user.status,
          },

    archivedAt: provider.archivedAt?.toISOString() ?? null,

    createdAt: provider.createdAt.toISOString(),

    updatedAt: provider.updatedAt.toISOString(),
  };
}
