import type { RequestHandler } from "express";

import { successResponse } from "../../shared/http/api-response.js";
import { parseBigIntId } from "../../shared/utils/parse-bigint-id.js";

import {
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
