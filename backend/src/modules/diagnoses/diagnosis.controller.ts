import type { RequestHandler } from "express";

import { AppError } from "../../shared/errors/app-error.js";
import { successResponse } from "../../shared/http/api-response.js";
import { parseBigIntId } from "../../shared/utils/parse-bigint-id.js";

import type { RequestSecurityMetadata } from "../auth/auth.types.js";

import {
  createEncounterDiagnosisSchema,
  listDiagnosisCodesQuerySchema,
  updateEncounterDiagnosisSchema,
} from "./diagnosis.schemas.js";

import { diagnosisService } from "./diagnosis.service.js";

function securityMetadata(
  req: Parameters<RequestHandler>[0],
  res: Parameters<RequestHandler>[1],
): RequestSecurityMetadata {
  const correlationId =
    typeof res.locals.correlationId === "string"
      ? res.locals.correlationId
      : undefined;

  const ipAddress = req.ip;

  const userAgent = req.get("user-agent");

  return {
    ...(correlationId !== undefined ? { correlationId } : {}),
    ...(ipAddress !== undefined ? { ipAddress } : {}),
    ...(userAgent !== undefined ? { userAgent } : {}),
  };
}

function requireAuth(req: Parameters<RequestHandler>[0]) {
  if (!req.auth) {
    throw new AppError(
      401,
      "AUTHENTICATION_REQUIRED",
      "Authentication is required",
    );
  }

  return req.auth;
}

export const listDiagnosisCodes: RequestHandler = async (req, res) => {
  const query = listDiagnosisCodesQuerySchema.parse(req.query);

  const result = await diagnosisService.listCodes(query);

  res.status(200).json(successResponse(result.diagnosisCodes, result.pagination));
};

export const getDiagnosisCode: RequestHandler = async (req, res) => {
  const diagnosisCodeId = parseBigIntId(req.params.id, "diagnosisCodeId");

  const result = await diagnosisService.getCodeById(diagnosisCodeId);

  res.status(200).json(successResponse(result));
};

export const listEncounterDiagnoses: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);

  const encounterId = parseBigIntId(req.params.encounterId, "encounterId");

  const result = await diagnosisService.listEncounterDiagnoses(
    encounterId,
    actor,
  );

  res.status(200).json(successResponse(result));
};

export const assignEncounterDiagnosis: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);

  const encounterId = parseBigIntId(req.params.encounterId, "encounterId");

  const input = createEncounterDiagnosisSchema.parse(req.body);

  const result = await diagnosisService.assignEncounterDiagnosis(
    encounterId,
    input,
    actor,
    securityMetadata(req, res),
  );

  res.status(201).json(successResponse(result));
};

export const updateEncounterDiagnosis: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);

  const encounterId = parseBigIntId(req.params.encounterId, "encounterId");
  const encounterDiagnosisId = parseBigIntId(
    req.params.encounterDiagnosisId,
    "encounterDiagnosisId",
  );

  const input = updateEncounterDiagnosisSchema.parse(req.body);

  const result = await diagnosisService.updateEncounterDiagnosis(
    encounterId,
    encounterDiagnosisId,
    input,
    actor,
    securityMetadata(req, res),
  );

  res.status(200).json(successResponse(result));
};

export const removeEncounterDiagnosis: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);

  const encounterId = parseBigIntId(req.params.encounterId, "encounterId");
  const encounterDiagnosisId = parseBigIntId(
    req.params.encounterDiagnosisId,
    "encounterDiagnosisId",
  );

  const result = await diagnosisService.removeEncounterDiagnosis(
    encounterId,
    encounterDiagnosisId,
    actor,
    securityMetadata(req, res),
  );

  res.status(200).json(successResponse(result));
};
