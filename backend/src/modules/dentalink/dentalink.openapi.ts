import { z } from "zod";
import { openApiRegistry } from "../../docs/openapi.registry.js";
import { apiErrorSchema } from "../../docs/common.schemas.js";
import {
  accountSchema,
  accountUpdateSchema,
  mappingSchema,
  previewSchema,
  confirmSchema,
  listImportQuery,
  localId,
} from "./dentalink.schemas.js";
const account = openApiRegistry.register(
  "DentalinkAccount",
  accountSchema.extend({
    id: localId,
    enabled: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
);
const countSchema = z.object({
  total: z.number().int().optional(),
  ready: z.number().int().optional(),
  issues: z.number().int().optional(),
  imported: z.number().int().optional(),
  skipped: z.number().int().optional(),
  pages: z.number().int().optional(),
  sourceMode: z.string().optional(),
});
const run = openApiRegistry.register(
  "DentalinkImportPreview",
  z.object({
    id: localId,
    accountId: localId,
    state: z.enum(["READING", "PREVIEW_READY", "CONFIRMED"]),
    from: z.string().nullable(),
    to: z.string().nullable(),
    contentHash: z.string().nullable(),
    counts: countSchema,
    hasNextPage: z.boolean(),
    sourceMode: z.string(),
    realConnectionVerified: z.literal(false),
    createdByUserId: localId,
    createdAt: z.string(),
    confirmedAt: z.string().nullable(),
  }),
);
const mapping = openApiRegistry.register(
  "DentalinkMapping",
  mappingSchema.extend({ id: localId }),
);
const item = openApiRegistry.register(
  "DentalinkImportItem",
  z.object({
    id: localId,
    entityType: z.enum(["PATIENT", "APPOINTMENT"]),
    externalId: z.string(),
    data: z.record(z.string(), z.unknown()),
    disposition: z.enum(["READY", "ISSUE", "IMPORTED", "SKIPPED"]),
    issueCodes: z.array(z.string()),
    patientId: localId.nullable(),
    appointmentId: localId.nullable(),
  }),
);
const status = z.object({
  account,
  state: z.enum([
    "DISABLED",
    "NOT_CONFIGURED",
    "SYNTHETIC_QA",
    "PREPARED_ADAPTER",
  ]),
  canPreview: z.boolean(),
  realConnectionVerified: z.literal(false),
  mode: z.literal("READ_ONLY_IMPORT"),
});
const envelope = (schema: z.ZodType, paginated = false) =>
  z.object({
    success: z.literal(true),
    data: schema,
    ...(paginated
      ? {
          meta: z.object({
            page: z.number(),
            pageSize: z.number(),
            total: z.number(),
            totalPages: z.number(),
          }),
        }
      : {}),
  });
const operations: [
  "get" | "post" | "patch" | "put",
  string,
  string,
  z.ZodType,
  z.ZodType | undefined,
  boolean?,
][] = [
  ["get", "/accounts", "dentalink.read", z.array(account), undefined, true],
  ["post", "/accounts", "dentalink.manage", account, accountSchema],
  ["get", "/accounts/{accountId}/status", "dentalink.read", status, undefined],
  [
    "patch",
    "/accounts/{accountId}",
    "dentalink.manage",
    account,
    accountUpdateSchema,
  ],
  [
    "get",
    "/accounts/{accountId}/mappings",
    "dentalink.read",
    z.array(mapping),
    undefined,
  ],
  [
    "put",
    "/accounts/{accountId}/mappings",
    "dentalink.manage",
    mapping,
    mappingSchema,
  ],
  [
    "get",
    "/accounts/{accountId}/previews",
    "dentalink.read",
    z.array(run),
    undefined,
    true,
  ],
  [
    "post",
    "/accounts/{accountId}/previews",
    "dentalink.import AND patient.read AND appointment.read",
    run,
    previewSchema,
  ],
  [
    "post",
    "/accounts/{accountId}/previews/{runId}/read-next-page",
    "dentalink.import AND patient.read AND appointment.read",
    run,
    z.strictObject({}),
  ],
  [
    "get",
    "/accounts/{accountId}/previews/{runId}",
    "dentalink.read",
    run,
    undefined,
  ],
  [
    "get",
    "/accounts/{accountId}/previews/{runId}/items",
    "dentalink.read AND patient.read AND appointment.read",
    z.array(item),
    undefined,
    true,
  ],
  [
    "post",
    "/accounts/{accountId}/previews/{runId}/confirm",
    "dentalink.import AND patient.create AND appointment.create AND patient.read AND appointment.read",
    run,
    confirmSchema,
  ],
];
for (const [
  method,
  suffix,
  permissions,
  response,
  body,
  paginated,
] of operations)
  openApiRegistry.registerPath({
    method,
    path: `/api/v1/integrations/dentalink${suffix}`,
    tags: ["Dentalink preparation"],
    security: [{ operationalBearerAuth: [] }],
    summary: `${method.toUpperCase()} ${suffix}`,
    description: `Requires ${permissions}; organization scoped, private/no-store. Internal prepared module, not an official Dentalink HTTP API. Account enabled defaults false; enabling a logical account does not configure the missing real adapter. Missing adapter returns409 DENTALINK_NOT_CONFIGURED. Only test fixtures inject SYNTHETIC readers in local NODE_ENV=test/_test. New previews read one complete normalized page; next pages use the persisted cursor (never supplied by the client). Incomplete/error pages do not advance it. Limit200 items/page,1000/run,50pages. Input keys16–120 ASCII chars; external IDs remain exact strings. No token/URL/payload override accepted. Preview confirmation requires PREVIEW_READY and expectedContentHash; mapping/content changes are409 DENTALINK_PREVIEW_CHANGED. Creates new patients and SCHEDULED appointments through existing services with atomic identities/numbers/audit; uncertain matches/missing mappings/unsupported status/overlaps become issues, never automatic merges. Replays of original keys return200, first preview/confirmation201. Confirmed identities are skipped on subsequent runs; updates/write-back/automatic scheduling are outside scope. Full DTO/ordering and issue policy: backend/docs/OPS_01_API.md.`,
    request: {
      ...(suffix.includes("{")
        ? {
            params: z.object({
              accountId: localId,
              ...(suffix.includes("{runId}") ? { runId: localId } : {}),
            }),
          }
        : {}),
      ...(paginated ? { query: listImportQuery } : {}),
      ...(body
        ? {
            body: {
              required: suffix.endsWith("read-next-page") ? false : true,
              content: { "application/json": { schema: body } },
            },
          }
        : {}),
    },
    responses: {
      200: {
        description: "Read result or exact idempotent replay",
        content: {
          "application/json": { schema: envelope(response, paginated) },
        },
      },
      ...(method === "post" && !suffix.endsWith("read-next-page")
        ? {
            201: {
              description: "New logical account, preview or confirmed import",
              content: { "application/json": { schema: envelope(response) } },
            },
          }
        : {}),
      ...Object.fromEntries(
        [400, 401, 403, 404, 409, 500, 502, 503].map((code) => [
          code,
          {
            description:
              "Validation, scope, capability, integrity, source or transactional error; no source payload in error",
            content: { "application/json": { schema: apiErrorSchema } },
          },
        ]),
      ),
    },
  });
