import { z } from "zod";
import { openApiRegistry } from "../../docs/openapi.registry.js";
import { apiErrorSchema } from "../../docs/common.schemas.js";
import {
  createSvbProcedureSchema,
  updateSvbProcedureSchema,
  svbProcedureStatusSchema,
  createSvbTariffSchema,
  updateSvbTariffSchema,
} from "./svb-catalog.schemas.js";

openApiRegistry.registerComponent("securitySchemes", "catalogueBearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
});
const id = z
  .string()
  .regex(/^[1-9]\d*$/)
  .openapi({ example: "9007199254740993" });
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .openapi({ example: "2026-01-01" });
const procedure = openApiRegistry.register(
  "SvbProcedure",
  z.object({
    id,
    code: z.string(),
    description: z.string(),
    category: z.string().nullable(),
    unit: z.string().nullable(),
    requiresAuthorization: z.boolean(),
    requiresReferral: z.boolean(),
    isActive: z.boolean(),
    validFrom: date.nullable(),
    validTo: date.nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  }),
);
const tariff = openApiRegistry.register(
  "SvbTariff",
  z.object({
    id,
    svbProcedureId: id,
    amount: z
      .string()
      .regex(/^\d+\.\d{2}$/)
      .openapi({ example: "88.80", description: "Exact Decimal(15,2) string" }),
    currencyCode: z.string().length(3),
    validFrom: date,
    validTo: date.nullable(),
    isActive: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  }),
);
const pagination = z.object({
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});
const envelope = (data: z.ZodType) =>
  z.object({ success: z.literal(true), data });
const paginated = (row: z.ZodType) =>
  z.object({ success: z.literal(true), data: z.array(row), meta: pagination });
const json = (schema: z.ZodType) => ({ "application/json": { schema } });
const pageQuery = {
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
};
const booleanQuery = z.enum(["true", "false"]).optional();
const procedureQuery = z.object({
  q: z.string().max(120).optional(),
  category: z.string().max(120).optional(),
  requiresAuthorization: booleanQuery,
  requiresReferral: booleanQuery,
  isActive: booleanQuery,
  serviceDate: date.optional(),
  ...pageQuery,
});
const tariffQuery = z.object({
  currencyCode: z
    .string()
    .regex(/^[A-Za-z]{3}$/)
    .optional(),
  isActive: booleanQuery,
  serviceDate: date.optional(),
  ...pageQuery,
});
const errors = {
  400: {
    description:
      "VALIDATION_ERROR, INVALID_ID, INVALID_DATE, INVALID_SVB_PROCEDURE_PERIOD or INVALID_SVB_TARIFF_PERIOD",
    content: json(apiErrorSchema),
  },
  401: {
    description:
      "AUTHENTICATION_REQUIRED or existing authentication token error",
    content: json(apiErrorSchema),
  },
  403: {
    description: "PERMISSION_DENIED (read does not imply manage)",
    content: json(apiErrorSchema),
  },
  404: {
    description:
      "SVB_PROCEDURE_NOT_FOUND or SVB_TARIFF_NOT_FOUND; foreign-parent tariffs are not found",
    content: json(apiErrorSchema),
  },
  409: {
    description:
      "SVB_PROCEDURE_CODE_ALREADY_EXISTS, SVB_TARIFF_ALREADY_EXISTS, SVB_TARIFF_PERIOD_OVERLAP, SVB_PROCEDURE_INACTIVE, SVB_PROCEDURE_NOT_VALID or SVB_TARIFF_AMBIGUOUS",
    content: json(apiErrorSchema),
  },
};
const root = "/api/v1/svb-procedures";
function register(input: {
  method: "get" | "post" | "patch";
  path: string;
  operationId: string;
  permission: string;
  response: z.ZodType;
  params?: z.ZodObject;
  query?: z.ZodObject;
  body?: z.ZodType;
}) {
  openApiRegistry.registerPath({
    method: input.method,
    path: root + input.path,
    operationId: input.operationId,
    tags: ["SVB catalogue"],
    summary: input.operationId,
    description: `Requires ${input.permission}. Master changes preserve historical snapshots. No physical delete.`,
    security: [{ catalogueBearerAuth: [] }],
    request: {
      ...(input.params === undefined ? {} : { params: input.params }),
      ...(input.query === undefined ? {} : { query: input.query }),
      ...(input.body === undefined
        ? {}
        : { body: { required: true, content: json(input.body) } }),
    },
    responses: {
      [input.method === "post" ? 201 : 200]: {
        description: "Success",
        content: json(input.response),
      },
      ...errors,
    },
  });
}
register({
  method: "get",
  path: "",
  operationId: "listSvbProcedures",
  permission: "svb_procedure.read",
  query: procedureQuery,
  response: paginated(procedure),
});
register({
  method: "get",
  path: "/{id}",
  operationId: "getSvbProcedure",
  permission: "svb_procedure.read",
  params: z.object({ id }),
  response: envelope(procedure),
});
register({
  method: "post",
  path: "",
  operationId: "createSvbProcedure",
  permission: "svb_procedure.manage",
  body: openApiRegistry.register(
    "CreateSvbProcedure",
    createSvbProcedureSchema,
  ),
  response: envelope(procedure),
});
register({
  method: "patch",
  path: "/{id}",
  operationId: "updateSvbProcedure",
  permission: "svb_procedure.manage",
  params: z.object({ id }),
  body: openApiRegistry.register(
    "UpdateSvbProcedure",
    updateSvbProcedureSchema,
  ),
  response: envelope(procedure),
});
register({
  method: "patch",
  path: "/{id}/status",
  operationId: "setSvbProcedureStatus",
  permission: "svb_procedure.manage",
  params: z.object({ id }),
  body: svbProcedureStatusSchema,
  response: envelope(procedure),
});
register({
  method: "get",
  path: "/{procedureId}/tariffs",
  operationId: "listSvbTariffs",
  permission: "svb_tariff.read",
  params: z.object({ procedureId: id }),
  query: tariffQuery,
  response: paginated(tariff),
});
register({
  method: "get",
  path: "/{procedureId}/applicable-tariff",
  operationId: "getApplicableSvbTariff",
  permission: "svb_tariff.read",
  params: z.object({ procedureId: id }),
  query: z.object({
    serviceDate: date,
    currencyCode: z.string().regex(/^[A-Za-z]{3}$/),
  }),
  response: envelope(z.object({ procedure, tariff, serviceDate: date })),
});
register({
  method: "post",
  path: "/{procedureId}/tariffs",
  operationId: "createSvbTariff",
  permission: "svb_tariff.manage",
  params: z.object({ procedureId: id }),
  body: openApiRegistry.register("CreateSvbTariff", createSvbTariffSchema),
  response: envelope(tariff),
});
register({
  method: "patch",
  path: "/{procedureId}/tariffs/{tariffId}",
  operationId: "updateSvbTariff",
  permission: "svb_tariff.manage",
  params: z.object({ procedureId: id, tariffId: id }),
  body: openApiRegistry.register("UpdateSvbTariff", updateSvbTariffSchema),
  response: envelope(tariff),
});
