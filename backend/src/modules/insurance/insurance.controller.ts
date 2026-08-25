import type { RequestHandler } from "express";

import { AppError } from "../../shared/errors/app-error.js";

import { successResponse } from "../../shared/http/api-response.js";

import { parseBigIntId } from "../../shared/utils/parse-bigint-id.js";

import type { RequestSecurityMetadata } from "../auth/auth.types.js";

import {
  createInsuranceSchema,
  updateInsuranceSchema,
  verifyInsuranceSchema,
} from "./insurance.schemas.js";

import { insuranceService } from "./insurance.service.js";

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
    ...(correlationId !== undefined
      ? {
          correlationId,
        }
      : {}),

    ...(ipAddress !== undefined
      ? {
          ipAddress,
        }
      : {}),

    ...(userAgent !== undefined
      ? {
          userAgent,
        }
      : {}),
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

export const listPayers: RequestHandler = async (req, res) => {
  requireAuth(req);

  const result = await insuranceService.listPayers();

  res.status(200).json(successResponse(result));
};

export const listPatientInsurance: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);

  const patientId = parseBigIntId(req.params.patientId, "patientId");

  const result = await insuranceService.list(patientId, actor);

  res.status(200).json(successResponse(result));
};

export const getPatientInsurance: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);

  const patientId = parseBigIntId(req.params.patientId, "patientId");

  const insuranceId = parseBigIntId(req.params.insuranceId, "insuranceId");

  const result = await insuranceService.getById(patientId, insuranceId, actor);

  res.status(200).json(successResponse(result));
};

export const createPatientInsurance: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);

  const patientId = parseBigIntId(req.params.patientId, "patientId");

  const input = createInsuranceSchema.parse(req.body);

  const result = await insuranceService.create(
    patientId,
    input,
    actor,
    securityMetadata(req, res),
  );

  res.status(201).json(successResponse(result));
};

export const updatePatientInsurance: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);

  const patientId = parseBigIntId(req.params.patientId, "patientId");

  const insuranceId = parseBigIntId(req.params.insuranceId, "insuranceId");

  const input = updateInsuranceSchema.parse(req.body);

  const result = await insuranceService.update(
    patientId,
    insuranceId,
    input,
    actor,
    securityMetadata(req, res),
  );

  res.status(200).json(successResponse(result));
};

export const verifyPatientInsurance: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);

  const patientId = parseBigIntId(req.params.patientId, "patientId");

  const insuranceId = parseBigIntId(req.params.insuranceId, "insuranceId");

  const input = verifyInsuranceSchema.parse(req.body);

  const result = await insuranceService.verify(
    patientId,
    insuranceId,
    input,
    actor,
    securityMetadata(req, res),
  );

  res.status(200).json(successResponse(result));
};
