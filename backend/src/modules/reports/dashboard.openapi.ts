import { z } from "zod";
import { openApiRegistry } from "../../docs/openapi.registry.js";
import { apiErrorSchema } from "../../docs/common.schemas.js";
import { dashboardQuerySchema } from "./dashboard.service.js";
openApiRegistry.registerComponent("securitySchemes", "operationalBearerAuth", { type: "http", scheme: "bearer", bearerFormat: "JWT" });
const id = z.string().regex(/^[1-9]\d*$/);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const money = z.object({ currencyCode: z.string().length(3), amount: z.string().regex(/^\d+\.\d{2}$/) });
const count = z.number().int().nonnegative();
const dashboard = openApiRegistry.register("DashboardReport", z.object({
  period: z.object({ from: date, to: date, timezone: z.literal("America/Curacao") }), providerId: id.nullable(),
  kpis: z.object({ production: z.array(money), svbBilled: z.array(money), patientsSeen: count, appointments: count, pendingSignatures: count, closedInvoices: count, toDeclare: count }),
  productionTimeline: z.array(money.extend({ date, chartPercent: z.number() })),
  productionByProvider: z.array(money.extend({ providerId: id, providerName: z.string(), chartPercent: z.number() })),
}));
const json = (schema: z.ZodType) => ({ "application/json": { schema } });
const errors = { 400: { description: "Invalid request or INVALID_REPORT_PERIOD", content: json(apiErrorSchema) }, 401: { description: "Authentication required", content: json(apiErrorSchema) }, 403: { description: "Permission denied", content: json(apiErrorSchema) }, 404: { description: "Provider not found in this organization", content: json(apiErrorSchema) } };
openApiRegistry.registerPath({ method: "get", path: "/api/v1/reports/dashboard", tags: ["Reports"], summary: "Aggregate operational dashboard",
  description: "Requires dashboard.read. Organization scoped. Inclusive Curacao business dates, at most 366 days. Exact financial strings grouped by currency; counts and charts are Backend aggregates.",
  security: [{ operationalBearerAuth: [] }], request: { query: dashboardQuerySchema },
  responses: { 200: { description: "Dashboard report", content: json(z.object({ success: z.literal(true), data: dashboard })) }, ...errors } });
openApiRegistry.registerPath({ method: "get", path: "/api/v1/clinic-locations", tags: ["Clinic locations"], summary: "Look up clinic locations",
  description: "Requires clinic_location.read. Returns only non-archived locations in the authenticated organization. IDs remain strings.",
  security: [{ operationalBearerAuth: [] }], request: { query: z.object({ isActive: z.enum(["true","false"]).optional() }) },
  responses: { 200: { description: "Locations", content: json(z.object({ success: z.literal(true), data: z.array(z.object({ id, code: z.string(), name: z.string(), isActive: z.boolean() })) })) }, ...errors } });
