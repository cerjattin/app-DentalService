import { z } from "zod";
import { openApiRegistry } from "../../docs/openapi.registry.js";
import { apiErrorSchema } from "../../docs/common.schemas.js";
import {
  prepareManualEntrySchema,
  uncertainManualEntrySchema,
  releaseManualEntrySchema,
  recordManualSubmissionSchema,
  recordManualResultSchema,
} from "./manual-entry.schemas.js";
const id = z.string().regex(/^[1-9]\d*$/),
  hash = z.string().regex(/^[a-f0-9]{64}$/),
  time = z.string().datetime();
const line = z.object({
  declarationItemId: id,
  status: z.enum(["ACCEPTED", "REJECTED"]),
  responseCode: z.string().nullable().optional(),
  responseMessage: z.string().nullable().optional(),
});
const entry = openApiRegistry.register(
  "DeclarationManualEntry",
  z.object({
    id,
    declarationId: id,
    state: z.enum(["PREPARED", "UNCERTAIN", "RELEASED", "RECORDED"]),
    schemaVersion: z.literal("ODONTHO_MANUAL_ENTRY_V1"),
    entryMode: z.literal("MANUAL_ENTRY"),
    contentHash: hash,
    preparedByUserId: id,
    preparedAt: time,
    uncertaintyReason: z.string().nullable(),
    releaseReason: z.string().nullable(),
    releasedAt: time.nullable(),
    resolutionDocumentId: id.nullable(),
    submissionId: id.nullable(),
    receiptDocumentId: id.nullable(),
    receiptSha256: hash.nullable(),
    externalSubmittedAt: time.nullable(),
    recordedAt: time.nullable(),
    result: z
      .object({
        id,
        status: z.enum(["ACCEPTED", "PARTIALLY_REJECTED", "REJECTED"]),
        documentId: id,
        sha256: hash,
        externalReference: z.string().nullable(),
        externalRespondedAt: time,
        recordedAt: time,
        recordedByUserId: id,
        lines: z.array(line),
      })
      .nullable(),
  }),
);
const dossier = openApiRegistry.register(
  "DeclarationManualDossier",
  z.object({
    contentHash: hash,
    entry: entry.nullable(),
    content: z.object({
      schemaVersion: z.literal("ODONTHO_MANUAL_ENTRY_V1"),
      entryMode: z.literal("MANUAL_ENTRY"),
      notOfficialSvbFile: z.literal(true),
      officialRulesVerified: z.literal(false),
      externalSubmissionPerformedByApplication: z.literal(false),
      declaration: z.object({
        id,
        number: z.string(),
        organizationId: id,
        payerId: id,
        declarantId: z.string(),
        periodStart: z.string().nullable(),
        periodEnd: z.string().nullable(),
      }),
      unconfirmedFieldSemantics: z.array(z.string()),
      items: z.array(
        z.object({
          declarationItemId: id,
          sequenceNumber: z.number().int(),
          invoiceItemId: id,
          invoiceId: id,
          invoiceVersionId: id,
          versionNumber: z.number().int(),
          invoiceContentHash: hash,
          declarantId: z.string(),
          invoiceNumber: z.string(),
          detailInvoiceNumber: z.string().nullable(),
          serviceDate: z.string(),
          procedureCode: z.string(),
          procedureDescription: z.string(),
          providerId: z.string().nullable(),
          insuredId: z.string().nullable(),
          treatmentId: z.string().nullable(),
          accidentFormNumber: z.string().nullable(),
          authorizationId: z.string().nullable(),
          numberOfTreatments: z.number().nullable(),
          assistance: z.string().nullable(),
          referrerId: z.string().nullable(),
          diagnosticCode: z.string().nullable(),
          policlinic: z.string().nullable(),
          additionalNote: z.string().nullable(),
          quantity: z.string(),
          unitTariff: z.string(),
          amount: z.string(),
          currencyCode: z.string(),
          technicalFileIssues: z.array(
            z.object({ field: z.string(), code: z.string() }),
          ),
        }),
      ),
      totalsByCurrency: z.array(
        z.object({ currencyCode: z.string(), amount: z.string() }),
      ),
    }),
  }),
);
const errors = Object.fromEntries(
  [400, 401, 403, 404, 409, 413, 503].map((status) => [
    status,
    {
      description:
        "Validation, permission, organization, immutable-state, evidence or storage conflict",
      content: { "application/json": { schema: apiErrorSchema } },
    },
  ]),
);
const envelope = (schema: z.ZodType) => ({
  "application/json": {
    schema: z.object({ success: z.literal(true), data: schema }),
  },
});
for (const download of [false, true])
  openApiRegistry.registerPath({
    method: "get",
    path: `/api/v1/declarations/{id}/manual-entry${download ? "/download" : ""}`,
    tags: ["Declarations"],
    security: [{ operationalBearerAuth: [] }],
    summary: download
      ? "Download the internal dossier (not an official SVB file)"
      : "Read frozen fields for manual portal entry",
    description:
      "Requires declaration.read AND invoice.read. Current closed source versions only; active preparations return their immutable snapshot. Null external semantics remain null. Download has X-Content-SHA256 and does not submit or reserve anything.",
    request: { params: z.object({ id }) },
    responses: {
      200: {
        description: download
          ? "Canonical internal JSON bytes"
          : "Dossier and active preparation",
        content: download
          ? {
              "application/json": { schema: z.record(z.string(), z.unknown()) },
            }
          : envelope(dossier),
      },
      ...errors,
    },
  });
const operations = [
  {
    suffix: "/manual-entry/prepare",
    schema: prepareManualEntrySchema,
    response: entry,
    summary: "Reserve and freeze a manual portal preparation",
    description:
      "Requires declaration.submit AND declaration.read AND invoice.read. New preparations return 409 SVB_PRESENTATION_DEFERRED by default; explicit synthetic QA only (SVB_MANUAL_RECORDING_ENABLED=true, NODE_ENV=test, local PostgreSQL _test). Exact replay of an existing key precedes the capability gate and returns 200 without mutation. In QA, DRAFT/READY/EXPORTED must contain exactly every invoiceItemId from one current CLOSED invoice/version, checked transactionally with invoice locks. Mixed invoice/version: 409 MANUAL_ENTRY_SINGLE_INVOICE_REQUIRED; missing/repeated/extra item: 409 MANUAL_ENTRY_INCOMPLETE_INVOICE. No sensitive IDs in error details. One active preparation per batch, keys scoped to organization/batch. 201 initial result. No transmission.",
  },
  {
    suffix: "/manual-entry/{entryId}/uncertain",
    schema: uncertainManualEntrySchema,
    response: entry,
    summary: "Report an uncertain external portal outcome",
    description:
      "Requires declaration.submit and preparing operator or declaration.update. Available while new presentations are deferred. UNCERTAIN keeps all reservations. Never silently retry presentation.",
  },
  {
    suffix: "/manual-entry/{entryId}/release",
    schema: releaseManualEntrySchema,
    response: entry,
    summary: "Release a preparation after verifying it was not presented",
    description:
      "Requires declaration.submit and preparing operator or declaration.update. Available while new presentations are deferred. UNCERTAIN requires resolutionDocumentId with readable, same-organization PDF/image proof. RECORDED cannot be released. Reason and NOT_PRESENTED_VERIFIED required.",
  },
  {
    suffix: "/submissions/manual",
    schema: recordManualSubmissionSchema,
    response: z
      .object({
        id,
        channel: z.literal("MANUAL"),
        declarationExportId: z.null(),
        manualEntry: entry,
      })
      .passthrough(),
    summary: "Record a human-attested portal presentation with proof",
    description:
      "Requires declaration.submit and preparing operator or declaration.update. Scoped lookup then exact confirmed-key replay precedes the capability gate, source validation and file access: 200 with preserved evidence, even when deferred or the old file is temporarily unavailable. Different content on an existing key is 409 IDEMPOTENCY_KEY_CONFLICT. New records return 409 SVB_PRESENTATION_DEFERRED by default before reading receipt bytes. QA-only explicit configuration allows new records: one complete current CLOSED invoice/version, exact persisted item set (MANUAL_ENTRY_SINGLE_INVOICE_REQUIRED / MANUAL_ENTRY_INCOMPLETE_INVOICE), content hash matching preparation, actual readable same-organization receipt. No export required. Legacy partial preparations are not rewritten and fail new record validation. externalReference string or null plus reason; submittedAt offset-aware external time, recordedAt server time. 201 initial result, no external transmission or inferred acceptance/payment.",
  },
  {
    suffix: "/submissions/{submissionId}/official-result",
    schema: recordManualResultSchema,
    response: entry,
    summary: "Record the official final response and every line outcome",
    description:
      "Requires declaration.submit. Same-organization evidence mandatory; 201 first result, 200 exact replay. Every declaration item must occur exactly once. ACCEPTED all accepted, REJECTED all rejected, PARTIALLY_REJECTED both. Rejection requires responseCode or responseMessage. Final result immutable; no amounts changed, no payment inferred, no resubmission of accepted lines. Existing generic submission-result route rejects these manual records.",
  },
] as const;
for (const op of operations)
  openApiRegistry.registerPath({
    method: "post",
    path: `/api/v1/declarations/{id}${op.suffix}`,
    tags: ["Declarations"],
    security: [{ operationalBearerAuth: [] }],
    summary: op.summary,
    description: op.description,
    request: {
      params: z.object({
        id,
        ...(op.suffix.includes("{entryId}") ? { entryId: id } : {}),
        ...(op.suffix.includes("{submissionId}") ? { submissionId: id } : {}),
      }),
      body: {
        required: true,
        content: { "application/json": { schema: op.schema } },
      },
    },
    responses: {
      200: {
        description: "Recorded state or idempotent replay",
        content: envelope(op.response),
      },
      ...(op.suffix.endsWith("prepare") || op.suffix.includes("submissions")
        ? {
            201: {
              description: "First immutable record",
              content: envelope(op.response),
            },
          }
        : {}),
      ...errors,
    },
  });
