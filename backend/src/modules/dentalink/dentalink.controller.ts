import type { RequestHandler } from "express";
import { successResponse } from "../../shared/http/api-response.js";
import { parseBigIntId } from "../../shared/utils/parse-bigint-id.js";
import { dentalinkService as service } from "./dentalink.service.js";
import {
  accountSchema,
  accountUpdateSchema,
  mappingSchema,
  previewSchema,
  confirmSchema,
  listImportQuery,
} from "./dentalink.schemas.js";
const id = (req: Parameters<RequestHandler>[0]) =>
  parseBigIntId(req.params.accountId, "accountId");
const run = (req: Parameters<RequestHandler>[0]) =>
  parseBigIntId(req.params.runId, "runId");
const meta = (
  req: Parameters<RequestHandler>[0],
  res: Parameters<RequestHandler>[1],
) => ({
  ...(req.ip ? { ipAddress: req.ip } : {}),
  ...(typeof res.locals.correlationId === "string"
    ? { correlationId: res.locals.correlationId }
    : {}),
});
export const listAccounts: RequestHandler = async (req, res) => {
  const q = listImportQuery.parse(req.query);
  const result = await service.list(req.auth!, q.page, q.pageSize);
  res.json(successResponse(result.data, result.pagination));
};
export const accountStatus: RequestHandler = async (req, res) => {
  res.json(successResponse(await service.status(id(req), req.auth!)));
};
export const createAccount: RequestHandler = async (req, res) => {
  res
    .status(201)
    .json(
      successResponse(
        await service.create(
          accountSchema.parse(req.body),
          req.auth!,
          meta(req, res),
        ),
      ),
    );
};
export const updateAccount: RequestHandler = async (req, res) => {
  res.json(
    successResponse(
      await service.enable(
        id(req),
        accountUpdateSchema.parse(req.body).enabled,
        req.auth!,
        meta(req, res),
      ),
    ),
  );
};
export const getMappings: RequestHandler = async (req, res) => {
  res.json(successResponse(await service.mappings(id(req), req.auth!)));
};
export const putMapping: RequestHandler = async (req, res) => {
  res.json(
    successResponse(
      await service.map(
        id(req),
        mappingSchema.parse(req.body),
        req.auth!,
        meta(req, res),
      ),
    ),
  );
};
export const createPreview: RequestHandler = async (req, res) => {
  const r = await service.preview(
    id(req),
    previewSchema.parse(req.body),
    req.auth!,
    meta(req, res),
  );
  res.status(r.replayed ? 200 : 201).json(successResponse(r.record));
};
export const readNextPage: RequestHandler = async (req, res) => {
  res.json(
    successResponse(
      await service.readPage(id(req), run(req), req.auth!, meta(req, res)),
    ),
  );
};
export const getRun: RequestHandler = async (req, res) => {
  res.json(successResponse(await service.getRun(id(req), run(req), req.auth!)));
};
export const listPreviews: RequestHandler = async (req, res) => {
  const q = listImportQuery.parse(req.query);
  const r = await service.listRuns(id(req), req.auth!, q.page, q.pageSize);
  res.json(successResponse(r.data, r.pagination));
};
export const getItems: RequestHandler = async (req, res) => {
  const q = listImportQuery.parse(req.query);
  const r = await service.listItems(
    id(req),
    run(req),
    req.auth!,
    q.page,
    q.pageSize,
  );
  res.json(successResponse(r.data, r.pagination));
};
export const confirmImport: RequestHandler = async (req, res) => {
  const r = await service.confirm(
    id(req),
    run(req),
    confirmSchema.parse(req.body),
    req.auth!,
    meta(req, res),
  );
  res.status(r.replayed ? 200 : 201).json(successResponse(r.record));
};
