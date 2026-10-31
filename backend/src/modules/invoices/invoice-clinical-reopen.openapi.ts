import { z } from "zod";
import { openApiRegistry } from "../../docs/openapi.registry.js";
import { apiErrorSchema } from "../../docs/common.schemas.js";
import { reopenInvoiceEncounterSchema } from "./invoice.schemas.js";

openApiRegistry.registerPath({
  method: "post", path: "/api/v1/invoices/{id}/reopen-encounter", tags: ["Invoices"],
  summary: "Return an invoice to clinical care for correction and rebilling",
  description: "Requires invoice.apply_correction, encounter.update and procedure.update. Organization scoped. Retains the original invoice version and opens a new empty unsigned correction version. Complete the encounter, then POST /appointments/{appointmentId}/invoice to rebuild the same logical invoice. Active declaration assignments block this operation.",
  security: [{ operationalBearerAuth: [] }],
  request: { params: z.object({ id: z.string().regex(/^[1-9]\d*$/) }), body: { required: true, content: { "application/json": { schema: reopenInvoiceEncounterSchema } } } },
  responses: {
    200: { description: "Updated invoice using the existing invoice DTO and success envelope" },
    ...Object.fromEntries([400, 401, 403, 404, 409].map((status) => [status, { description: "Validation, authorization, ownership or clinical return conflict", content: { "application/json": { schema: apiErrorSchema } } }])),
  },
});
