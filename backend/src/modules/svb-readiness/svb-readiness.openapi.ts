import { z } from "zod";
import { openApiRegistry } from "../../docs/openapi.registry.js";
import { apiErrorSchema } from "../../docs/common.schemas.js";
import { realSvbBlockerCodes } from "./svb-readiness.service.js";
import { createDeclarationExportSchema, markDeclarationReadySchema } from "../declarations/declaration.schemas.js";
import { captureEncounterProcedureSchema, updateEncounterProcedureSchema } from "../encounter-procedures/encounter-procedure.schemas.js";

export const realPresentationReadinessSchema = openApiRegistry.register("RealSvbPresentationReadiness", z.object({
  status: z.literal("BLOCKED"), realSubmissionEnabled: z.literal(false),
  issues: z.array(z.object({ field: z.enum(["SourceSheet", "DestinationFormat"]), code: z.enum(realSvbBlockerCodes) })),
}));
const errors = Object.fromEntries([400,401,403,404,409].map((status) => [status, {
  description: "Validation, permission, ownership, technical data or unsupported SVB flow",
  content: { "application/json": { schema: apiErrorSchema } },
}]));
openApiRegistry.registerPath({ method: "get", path: "/api/v1/svb-pilot/readiness", tags: ["SVB readiness"],
  summary: "Read the current real-presentation pilot scope and external prerequisites",
  description: "Requires svb_procedure.read. manualPortalRecordingEnabled is false by default for the first clinical deployment; new preparations/records are deferred. SVB_MANUAL_RECORDING_ENABLED=true is accepted only in NODE_ENV=test with a local PostgreSQL _test target for synthetic QA. History, exact replays and resolution of existing preparations remain available. Source sheet/destination are not approved; technical READY/COMPLETE is not eligibility.",
  security: [{ operationalBearerAuth: [] }], request: { query: z.strictObject({}) },
  responses: { 200: { description: "Current blocked pilot", content: { "application/json": { schema: z.object({ success: z.literal(true),
    data: realPresentationReadinessSchema.extend({ contract: z.literal("NEG-FINAL-06"), sourceSheet: z.null(), destinationFormat: z.null(),
      manualPortalRecordingEnabled: z.boolean(), manualEntryRequiresFile: z.literal(false),
      enabledServiceCodes: z.array(z.string()).length(0), enabledCaseTypes: z.array(z.string()).length(0),
      unresolvedFields: z.array(z.enum(["NumberOfTreatments", "Assistance", "PoliClinic", "ReferralEvidence"])) }) }) } } }, ...errors },
});
for (const [action, body] of [["ready", markDeclarationReadySchema], ["exports", createDeclarationExportSchema]] as const) {
  openApiRegistry.registerPath({ method: "post", path: `/api/v1/declarations/{id}/${action}`, tags: ["Declarations"],
    summary: action === "ready" ? "Validate a technical declaration draft" : "Create an internal technical export",
    description: `Requires ${action === "ready" ? "declaration.update" : "declaration.export"}. Optional presentationPurpose: TECHNICAL or REAL_SVB. Omitted preserves legacy TECHNICAL behavior, never verified portal eligibility. REAL_SVB returns 409 SVB_REAL_PRESENTATION_NOT_ENABLED before mutation, file creation or cache reuse. Missing/invalid fields retain DECLARATION_SVB_DATA_INCOMPLETE/INVALID. DTO realPresentationReadiness remains BLOCKED pending sources.`,
    security: [{ operationalBearerAuth: [] }], request: { params: z.object({ id: z.string().regex(/^[1-9]\d*$/) }),
      body: { required: action === "exports", content: { "application/json": { schema: body } } } },
    responses: { [action === "ready" ? 200 : 201]: { description: "Existing declaration/export envelope plus realPresentationReadiness" }, ...errors },
  });
}
for (const [method, schema] of [["post", captureEncounterProcedureSchema], ["patch", updateEncounterProcedureSchema]] as const) {
  openApiRegistry.registerPath({ method, path: "/api/v1/clinical-encounters/{encounterId}/procedures" + (method === "patch" ? "/{encounterProcedureId}" : ""),
    tags: ["Encounter procedures"], summary: method === "post" ? "Record a performed service" : "Update legacy procedure metadata",
    description: method === "post"
      ? "Requires procedure.update. The service-attention body contains svbProcedureId and optional quantity. Billing fields are null until invoicing. The existing body with patientInsuranceId retains the legacy capture rules. SVB eligibility is validated separately."
      : "Requires procedure.update. This legacy operation updates diagnosis and notes on a performed row. Fiscal snapshots are server-owned.",
    security: [{ operationalBearerAuth: [] }], request: { params: z.object({ encounterId: z.string().regex(/^[1-9]\d*$/),
      ...(method === "patch" ? { encounterProcedureId: z.string().regex(/^[1-9]\d*$/) } : {}) }),
      body: { required: true, content: { "application/json": { schema } } } },
    responses: { [method === "post" ? 201 : 200]: { description: "Existing performed-procedure DTO" }, ...errors },
  });
}
