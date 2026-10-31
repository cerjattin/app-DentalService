import { z } from "zod";
import { openApiRegistry } from "../../docs/openapi.registry.js";
import { apiErrorSchema } from "../../docs/common.schemas.js";
import { createTreatmentCaseSchema, updateTreatmentCaseSchema, listTreatmentCasesSchema } from "./treatment-case.schemas.js";
const dto = openApiRegistry.register("TreatmentCase", z.object({
  id: z.string(), organizationId: z.string(), patientId: z.string(), treatmentId: z.string().nullable(),
  treatmentType: z.string().nullable(), description: z.string().nullable(),
  status: z.enum(["PLANNED","ACTIVE","COMPLETED","CANCELLED"]), startedAt: z.string().nullable(),
  completedAt: z.string().nullable(), createdAt: z.string(), updatedAt: z.string(), isEditable: z.boolean(),
}));
const base = "/api/v1/patients/{patientId}/treatment-cases";
for (const [method, detail] of [["get", false], ["get", true], ["post", false], ["patch", true]] as const) {
  const write = method === "post" || method === "patch";
  openApiRegistry.registerPath({ method, path: base + (detail ? "/{caseId}" : ""), tags: ["Treatment cases"],
    summary: `${method.toUpperCase()} patient treatment cases`, security: [{ operationalBearerAuth: [] }],
    description: `Requires treatment_case.${write ? "manage" : "read"}. Session organization and route patient are authoritative. POST creates PLANNED; PATCH only unused PLANNED cases. No lifecycle transitions or deletion. isEditable is server-calculated; historical snapshots are immutable.`,
    request: { params: z.object({ patientId: z.string().regex(/^[1-9]\d*$/), ...(detail ? { caseId: z.string().regex(/^[1-9]\d*$/) } : {}) }),
      ...(!write && !detail ? { query: listTreatmentCasesSchema } : {}),
      ...(write ? { body: { required: true, content: { "application/json": { schema: method === "post" ? createTreatmentCaseSchema : updateTreatmentCaseSchema } } } } : {}) },
    responses: { [method === "post" ? 201 : 200]: { description: "Treatment cases", content: { "application/json": { schema: z.object({ success: z.literal(true), data: !write && !detail ? z.array(dto) : dto,
      ...(!write && !detail ? { meta: z.object({ page: z.number(), pageSize: z.number(), total: z.number(), totalPages: z.number() }) } : {}) }) } } },
      ...Object.fromEntries([400,401,403,404,409].map((status) => [status, { description: "Validation, ownership, duplicate or usage conflict", content: { "application/json": { schema: apiErrorSchema } } }])) },
  });
}
