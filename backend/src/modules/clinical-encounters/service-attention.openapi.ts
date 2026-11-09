import { z } from "zod";
import { apiErrorSchema } from "../../docs/common.schemas.js";
import { openApiRegistry } from "../../docs/openapi.registry.js";
import { createAppointmentInvoiceSchema } from "../invoices/invoice.schemas.js";

const id = z.string().regex(/^[1-9]\d*$/);
const errors = Object.fromEntries([400, 401, 403, 404, 409].map((status) => [status, {
  description: "Invalid request, permissions, resource or workflow state",
  content: { "application/json": { schema: apiErrorSchema } },
}]));

openApiRegistry.registerPath({
  method: "post", path: "/api/v1/appointments/{appointmentId}/clinical-encounter/start",
  tags: ["Service attention"], summary: "Start service attention",
  description: "Requires appointment.start and encounter.create. Empty strict body. Opens from CONFIRMED and advances to IN_PROGRESS atomically. Resumes legacy CHECKED_IN/IN_PROGRESS; an already OPEN correction on a COMPLETED appointment returns the same encounter without reopening the appointment. Concurrent duplicate start retries transaction conflicts and returns the existing OPEN attention. No medical notes or billing context required.",
  security: [{ operationalBearerAuth: [] }], request: { params: z.object({ appointmentId: id }) },
  responses: { 200: { description: "Open attention envelope" }, ...errors },
});

openApiRegistry.registerPath({
  method: "post", path: "/api/v1/clinical-encounters/{id}/finish-services",
  tags: ["Service attention"], summary: "Complete attention and hand off to billing",
  description: "Requires encounter.complete and appointment.complete. Empty strict body. At least one PERFORMED service required (409 ATTENTION_SERVICES_REQUIRED). Completes encounter/appointment atomically, including legacy CHECKED_IN handoff through IN_PROGRESS. An already COMPLETED encounter preserves its completion time. Reopened correction keeps appointment COMPLETED. Duplicate completed delivery returns existing state; concurrent conflict409 ATTENTION_CHANGED. Services/add/remove and billing share appointment→encounter lock order. Cancellation/rescheduling after start is rejected.",
  security: [{ operationalBearerAuth: [] }], request: { params: z.object({ id }) },
  responses: { 200: { description: "Completed attention envelope" }, ...errors },
});

openApiRegistry.registerPath({
  method: "post", path: "/api/v1/appointments/{appointmentId}/invoice",
  tags: ["Invoices"], summary: "Create or rebuild the invoice for a completed appointment",
  description: "Requires invoice.create. New service records receive insurance and tariff snapshots during invoicing. An explicitly selected insurance or currency resolves ambiguity. Clinical rebilling retains the original invoice context.",
  security: [{ operationalBearerAuth: [] }], request: { params: z.object({ appointmentId: id }),
    body: { required: false, content: { "application/json": { schema: createAppointmentInvoiceSchema } } } },
  responses: { 201: { description: "Draft invoice envelope" }, ...errors },
});
