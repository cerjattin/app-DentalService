import { AppError } from "../../shared/errors/app-error.js";
import type { RequestSecurityMetadata } from "../auth/auth.types.js";
import type { RequestHandler } from "express";

import { successResponse } from "../../shared/http/api-response.js";
import { parseBigIntId } from "../../shared/utils/parse-bigint-id.js";

import {
  createSvbProcedureSchema,
  updateSvbProcedureSchema,
  svbProcedureStatusSchema,
  createSvbTariffSchema,
  updateSvbTariffSchema,
  applicableTariffQuerySchema,
  listSvbProceduresQuerySchema,
  listSvbTariffsQuerySchema,
} from "./svb-catalog.schemas.js";

import { svbCatalogService } from "./svb-catalog.service.js";

export const listSvbProcedures: RequestHandler = async (req, res) => {
  const query = listSvbProceduresQuerySchema.parse(req.query);

  const result = await svbCatalogService.listProcedures(query);

  res.status(200).json(successResponse(result.procedures, result.pagination));
};

export const getSvbProcedure: RequestHandler = async (req, res) => {
  const svbProcedureId = parseBigIntId(req.params.id, "svbProcedureId");

  const result = await svbCatalogService.getProcedureById(svbProcedureId);

  res.status(200).json(successResponse(result));
};

export const listSvbTariffs: RequestHandler = async (req, res) => {
  const svbProcedureId = parseBigIntId(
    req.params.procedureId,
    "svbProcedureId",
  );
  const query = listSvbTariffsQuerySchema.parse(req.query);

  const result = await svbCatalogService.listTariffs(svbProcedureId, query);

  res.status(200).json(successResponse(result.tariffs, result.pagination));
};

export const getApplicableSvbTariff: RequestHandler = async (req, res) => {
  const svbProcedureId = parseBigIntId(
    req.params.procedureId,
    "svbProcedureId",
  );
  const query = applicableTariffQuerySchema.parse(req.query);

  const result = await svbCatalogService.getApplicableTariff(
    svbProcedureId,
    query,
  );

  res.status(200).json(successResponse(result));
};

function mutationContext(
  req: Parameters<RequestHandler>[0],
  res: Parameters<RequestHandler>[1],
) {
  if (!req.auth)
    throw new AppError(
      401,
      "AUTHENTICATION_REQUIRED",
      "Authentication is required",
    );
  const userAgent = req.get("user-agent");
  const metadata: RequestSecurityMetadata = {
    ...(typeof res.locals.correlationId === "string"
      ? { correlationId: res.locals.correlationId }
      : {}),
    ...(req.ip === undefined ? {} : { ipAddress: req.ip }),
    ...(userAgent === undefined ? {} : { userAgent }),
  };
  return { actor: req.auth, metadata };
}

export const createSvbProcedure: RequestHandler = async (req, res) => {
  const { actor, metadata } = mutationContext(req, res);
  const result = await svbCatalogService.createProcedure(
    createSvbProcedureSchema.parse(req.body),
    actor,
    metadata,
  );
  res.status(201).json(successResponse(result));
};

export const updateSvbProcedure: RequestHandler = async (req, res) => {
  const { actor, metadata } = mutationContext(req, res);
  const result = await svbCatalogService.updateProcedure(
    parseBigIntId(req.params.id, "svbProcedureId"),
    updateSvbProcedureSchema.parse(req.body),
    actor,
    metadata,
  );
  res.status(200).json(successResponse(result));
};

export const setSvbProcedureStatus: RequestHandler = async (req, res) => {
  const { actor, metadata } = mutationContext(req, res);
  const result = await svbCatalogService.updateProcedure(
    parseBigIntId(req.params.id, "svbProcedureId"),
    svbProcedureStatusSchema.parse(req.body),
    actor,
    metadata,
  );
  res.status(200).json(successResponse(result));
};

export const createSvbTariff: RequestHandler = async (req, res) => {
  const { actor, metadata } = mutationContext(req, res);
  const result = await svbCatalogService.createTariff(
    parseBigIntId(req.params.procedureId, "svbProcedureId"),
    createSvbTariffSchema.parse(req.body),
    actor,
    metadata,
  );
  res.status(201).json(successResponse(result));
};

export const updateSvbTariff: RequestHandler = async (req, res) => {
  const { actor, metadata } = mutationContext(req, res);
  const result = await svbCatalogService.updateTariff(
    parseBigIntId(req.params.procedureId, "svbProcedureId"),
    parseBigIntId(req.params.tariffId, "tariffId"),
    updateSvbTariffSchema.parse(req.body),
    actor,
    metadata,
  );
  res.status(200).json(successResponse(result));
};
