import { z } from "zod";
import { openApiRegistry } from "../../docs/openapi.registry.js";
import { apiErrorSchema } from "../../docs/common.schemas.js";
import { declarationCandidatesQuerySchema, declarationReasonSchema } from "./declaration.schemas.js";
import { svbIssueCodes, svbIssueFields } from "./export/declaration-row.mapper.js";
const candidate = openApiRegistry.register("DeclarationCandidate", z.object({
  invoiceId: z.string(), invoiceVersionId: z.string(), invoiceItemId: z.string(), invoiceNumber: z.string().nullable(),
  versionNumber: z.number().int(), detailInvoiceNumber: z.string().nullable(), serviceDate: z.string(),
  procedureCode: z.string(), procedureDescription: z.string(), providerIdSnapshot: z.string(), insuredIdSnapshot: z.string(),
  amount: z.string(), currencyCode: z.string(), svbReadiness: z.enum(["COMPLETE", "INCOMPLETE"]),
  issues: z.array(z.object({ field: z.enum(svbIssueFields), code: z.enum(svbIssueCodes) })),
}));
openApiRegistry.registerPath({ method: "get", path: "/api/v1/declarations/{id}/candidates", tags: ["Declarations"],
  summary: "List available current closed invoice items without reserving them", security: [{ operationalBearerAuth: [] }],
  description: "Requires declaration.read AND invoice.read. DRAFT only, same organization/payer, compatible frozen Declarant ID and no active assignment. Incomplete SVB data is diagnostic, not a reservation or promise of READY. POST /declarations/{id}/items revalidates availability and identity atomically; DECLARATION_ITEM_ASSIGNED, DECLARATION_DECLARANT_MISMATCH or DECLARATION_LEGACY_DATA_CONFLICT can be returned.",
  request: { params: z.object({ id: z.string().regex(/^[1-9]\d*$/) }), query: declarationCandidatesQuerySchema },
  responses: { 200: { description: "Paginated candidates", content: { "application/json": { schema: z.object({ success: z.literal(true), data: z.array(candidate),
    meta: z.object({ page: z.number(), pageSize: z.number(), total: z.number(), totalPages: z.number() }) }) } } },
    ...Object.fromEntries([400,401,403,404,409].map((status) => [status, { description: "Validation, authorization or draft conflict", content: { "application/json": { schema: apiErrorSchema } } }])) },
});
for (const [method, path] of [["delete", "/api/v1/declarations/{id}/items/{itemId}"], ["post", "/api/v1/declarations/{id}/cancel"]] as const) {
  openApiRegistry.registerPath({ method, path, tags: ["Declarations"], summary: "Release a Draft declaration assignment with audit reason",
    description: "Requires declaration.update. DRAFT only with no exports/submissions. DELETE removes one assignment and audits its full snapshot; cancel preserves items and history. Bound Declarant ID and last allocated ordinal are retained even when empty. Returns the existing complete Declaration DTO. Concurrent READY produces a conflict. Errors: DECLARATION_NOT_EDITABLE, DECLARATION_ITEM_NOT_FOUND, DECLARATION_HAS_EXPORTS_OR_SUBMISSIONS.",
    security: [{ operationalBearerAuth: [] }], request: { params: z.object({ id: z.string().regex(/^[1-9]\d*$/),
      ...(method === "delete" ? { itemId: z.string().regex(/^[1-9]\d*$/) } : {}) }),
      body: { required: true, content: { "application/json": { schema: declarationReasonSchema } } } },
    responses: { 200: { description: "Existing complete Declaration success envelope" },
      ...Object.fromEntries([400,401,403,404,409].map((status) => [status, { description: "Validation, authorization or draft conflict", content: { "application/json": { schema: apiErrorSchema } } }])) },
  });
}
