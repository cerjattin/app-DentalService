import type { RequestHandler } from "express";

import { AppError } from "../../shared/errors/app-error.js";
import { successResponse } from "../../shared/http/api-response.js";
import { parseBigIntId } from "../../shared/utils/parse-bigint-id.js";

import type { RequestSecurityMetadata } from "../auth/auth.types.js";

import {
  createEncounterProcedureSchema,
  updateEncounterProcedureSchema,
} from "./encounter-procedure.schemas.js";
import { encounterProcedureService } from "./encounter-procedure.service.js";

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

export const listEncounterProcedures: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);
  const encounterId = parseBigIntId(req.params.encounterId, "encounterId");

  const result = await encounterProcedureService.list(encounterId, actor);

  res.status(200).json(successResponse(result));
};

export const getEncounterProcedure: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);
  const encounterId = parseBigIntId(req.params.encounterId, "encounterId");
  const encounterProcedureId = parseBigIntId(
    req.params.encounterProcedureId,
    "encounterProcedureId",
  );

  const result = await encounterProcedureService.getById(
    encounterId,
    encounterProcedureId,
    actor,
  );

  res.status(200).json(successResponse(result));
};

export const createEncounterProcedure: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);
  const encounterId = parseBigIntId(req.params.encounterId, "encounterId");
  const input = createEncounterProcedureSchema.parse(req.body);

  const result = await encounterProcedureService.create(
    encounterId,
    input,
    actor,
    securityMetadata(req, res),
  );

  res.status(201).json(successResponse(result));
};

export const updateEncounterProcedure: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);
  const encounterId = parseBigIntId(req.params.encounterId, "encounterId");
  const encounterProcedureId = parseBigIntId(
    req.params.encounterProcedureId,
    "encounterProcedureId",
  );
  const input = updateEncounterProcedureSchema.parse(req.body);

  const result = await encounterProcedureService.update(
    encounterId,
    encounterProcedureId,
    input,
    actor,
    securityMetadata(req, res),
  );

  res.status(200).json(successResponse(result));
};

export const removeEncounterProcedure: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);
  const encounterId = parseBigIntId(req.params.encounterId, "encounterId");
  const encounterProcedureId = parseBigIntId(
    req.params.encounterProcedureId,
    "encounterProcedureId",
  );

  const result = await encounterProcedureService.remove(
    encounterId,
    encounterProcedureId,
    actor,
    securityMetadata(req, res),
  );

  res.status(200).json(successResponse(result));
};
