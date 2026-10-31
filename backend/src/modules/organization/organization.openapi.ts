import { z } from "zod";
import { openApiRegistry } from "../../docs/openapi.registry.js";
import { apiErrorSchema } from "../../docs/common.schemas.js";
import { updateOrganizationSchema } from "./organization.schemas.js";
const settings = openApiRegistry.register("OrganizationSettings", z.object({
  id: z.string(), legalName: z.string(), tradeName: z.string().nullable(), declarantId: z.string().nullable(),
  email: z.string().nullable(), phone: z.string().nullable(), timezone: z.literal("America/Curacao"),
  updatedAt: z.string(), revision: z.string(),
}));
for (const method of ["get", "patch"] as const) {
  openApiRegistry.registerPath({ method, path: "/api/v1/organization", tags: ["Organization"],
    summary: method === "get" ? "Read the authenticated organization settings" : "Update organization settings with revision and reason",
    description: `Requires organization.${method === "get" ? "read" : "update"}. Organization is taken exclusively from the session. PATCH preserves all historical snapshots; conflicts: ORGANIZATION_VERSION_CONFLICT, DECLARANT_ID_ALREADY_EXISTS.`,
    security: [{ operationalBearerAuth: [] }],
    ...(method === "patch" ? { request: { body: { required: true, content: { "application/json": { schema: updateOrganizationSchema } } } } } : {}),
    responses: { 200: { description: "Organization settings", content: { "application/json": { schema: z.object({ success: z.literal(true), data: settings }) } } },
      ...Object.fromEntries([400,401,403,404,409].map((status) => [status, { description: "Validation, authorization or revision conflict", content: { "application/json": { schema: apiErrorSchema } } }])) },
  });
}
