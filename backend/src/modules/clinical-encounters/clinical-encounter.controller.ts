import type { RequestHandler } from "express";

import { AppError } from "../../shared/errors/app-error.js";
import { successResponse } from "../../shared/http/api-response.js";
import { parseBigIntId } from "../../shared/utils/parse-bigint-id.js";

import type { RequestSecurityMetadata } from "../auth/auth.types.js";

import {
  createClinicalEncounterSchema,
  listClinicalEncountersQuerySchema,
  updateClinicalEncounterSchema,
} from "./clinical-encounter.schemas.js";

import { clinicalEncounterService } from "./clinical-encounter.service.js";

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

export const listClinicalEncounters: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);

  const query = listClinicalEncountersQuerySchema.parse(req.query);

  const result = await clinicalEncounterService.list(query, actor);

  res.status(200).json(successResponse(result.encounters, result.pagination));
};

export const getClinicalEncounter: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);

  const encounterId = parseBigIntId(req.params.id, "encounterId");

  const result = await clinicalEncounterService.getById(encounterId, actor);

  res.status(200).json(successResponse(result));
};

export const getClinicalEncounterByAppointment: RequestHandler = async (
  req,
  res,
) => {
  const actor = requireAuth(req);

  const appointmentId = parseBigIntId(
    req.params.appointmentId,
    "appointmentId",
  );

  const result = await clinicalEncounterService.getByAppointmentId(
    appointmentId,
    actor,
  );

  res.status(200).json(successResponse(result));
};

export const createClinicalEncounter: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);

  const appointmentId = parseBigIntId(
    req.params.appointmentId,
    "appointmentId",
  );

  const input = createClinicalEncounterSchema.parse(req.body);

  const result = await clinicalEncounterService.create(
    appointmentId,
    input,
    actor,
    securityMetadata(req, res),
  );

  res.status(201).json(successResponse(result));
};

export const updateClinicalEncounter: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);

  const encounterId = parseBigIntId(req.params.id, "encounterId");

  const input = updateClinicalEncounterSchema.parse(req.body);

  const result = await clinicalEncounterService.update(
    encounterId,
    input,
    actor,
    securityMetadata(req, res),
  );

  res.status(200).json(successResponse(result));
};

export const completeClinicalEncounter: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);

  const encounterId = parseBigIntId(req.params.id, "encounterId");

  const result = await clinicalEncounterService.complete(
    encounterId,
    actor,
    securityMetadata(req, res),
  );

  res.status(200).json(successResponse(result));
};
