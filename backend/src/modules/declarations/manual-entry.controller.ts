import type { RequestHandler } from "express";
import { successResponse } from "../../shared/http/api-response.js";
import { parseBigIntId } from "../../shared/utils/parse-bigint-id.js";
import {
  canonicalManualJson,
  manualEntryService,
} from "./manual-entry.service.js";
import {
  prepareManualEntrySchema,
  uncertainManualEntrySchema,
  releaseManualEntrySchema,
  recordManualSubmissionSchema,
  recordManualResultSchema,
} from "./manual-entry.schemas.js";
const batchId = (req: Parameters<RequestHandler>[0]) =>
  parseBigIntId(req.params.id, "declarationId");
const entryId = (req: Parameters<RequestHandler>[0]) =>
  parseBigIntId(req.params.entryId, "manualEntryId");
const metadata = (
  req: Parameters<RequestHandler>[0],
  res: Parameters<RequestHandler>[1],
) => ({
  ...(req.ip ? { ipAddress: req.ip } : {}),
  ...(req.get("user-agent") ? { userAgent: req.get("user-agent")! } : {}),
  ...(typeof res.locals.correlationId === "string"
    ? { correlationId: res.locals.correlationId }
    : {}),
});
export const getManualDossier: RequestHandler = async (req, res) => {
  res.set("Cache-Control", "private, no-store");
  res.json(
    successResponse(await manualEntryService.dossier(batchId(req), req.auth!)),
  );
};
export const downloadManualDossier: RequestHandler = async (req, res) => {
  const id = batchId(req);
  const result = await manualEntryService.dossier(id, req.auth!);
  res
    .type("application/json")
    .set("Cache-Control", "private, no-store")
    .set(
      "Content-Disposition",
      `attachment; filename="declaration-${id}-internal-v1.json"`,
    )
    .set("X-Content-SHA256", result.contentHash)
    .send(canonicalManualJson(result.content));
};
export const prepareManualEntry: RequestHandler = async (req, res) => {
  const result = await manualEntryService.prepare(
    batchId(req),
    prepareManualEntrySchema.parse(req.body),
    req.auth!,
    metadata(req, res),
  );
  res.status(result.replayed ? 200 : 201).json(successResponse(result.record));
};
export const flagManualUncertainty: RequestHandler = async (req, res) => {
  const input = uncertainManualEntrySchema.parse(req.body);
  res.json(
    successResponse(
      await manualEntryService.uncertain(
        batchId(req),
        entryId(req),
        input.reason,
        req.auth!,
        metadata(req, res),
      ),
    ),
  );
};
export const releaseManualEntry: RequestHandler = async (req, res) => {
  res.json(
    successResponse(
      await manualEntryService.release(
        batchId(req),
        entryId(req),
        releaseManualEntrySchema.parse(req.body),
        req.auth!,
        metadata(req, res),
      ),
    ),
  );
};
export const recordManualSubmission: RequestHandler = async (req, res) => {
  const result = await manualEntryService.record(
    batchId(req),
    recordManualSubmissionSchema.parse(req.body),
    req.auth!,
    metadata(req, res),
  );
  res.status(result.replayed ? 200 : 201).json(successResponse(result.record));
};
export const recordManualOfficialResult: RequestHandler = async (req, res) => {
  const result = await manualEntryService.result(
    batchId(req),
    parseBigIntId(req.params.submissionId, "submissionId"),
    recordManualResultSchema.parse(req.body),
    req.auth!,
    metadata(req, res),
  );
  res.status(result.replayed ? 200 : 201).json(successResponse(result.record));
};
