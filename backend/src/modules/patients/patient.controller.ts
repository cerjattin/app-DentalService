import type { RequestHandler } from "express";

import { AppError } from "../../shared/errors/app-error.js";

import { successResponse } from "../../shared/http/api-response.js";

import { parseBigIntId } from "../../shared/utils/parse-bigint-id.js";

import type { RequestSecurityMetadata } from "../auth/auth.types.js";

import {
  archivePatientSchema,
  createPatientSchema,
  listPatientsQuerySchema,
  updatePatientSchema,
} from "./patient.schemas.js";

import { patientService } from "./patient.service.js";

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

export const listPatients: RequestHandler = async (req, res) => {
  if (!req.auth) {
    throw new AppError(
      401,
      "AUTHENTICATION_REQUIRED",
      "Authentication is required",
    );
  }

  const query = listPatientsQuerySchema.parse(req.query);

  const result = await patientService.list(query, req.auth);

  res.status(200).json(successResponse(result.patients, result.pagination));
};

export const getPatient: RequestHandler = async (req, res) => {
  if (!req.auth) {
    throw new AppError(
      401,
      "AUTHENTICATION_REQUIRED",
      "Authentication is required",
    );
  }

  const patientId = parseBigIntId(req.params.id, "patientId");

  const result = await patientService.getById(patientId, req.auth);

  res.status(200).json(successResponse(result));
};

export const createPatient: RequestHandler = async (req, res) => {
  if (!req.auth) {
    throw new AppError(
      401,
      "AUTHENTICATION_REQUIRED",
      "Authentication is required",
    );
  }

  const input = createPatientSchema.parse(req.body);

  const result = await patientService.create(
    input,
    req.auth,
    securityMetadata(req, res),
  );

  res.status(201).json(successResponse(result));
};

export const updatePatient: RequestHandler = async (req, res) => {
  if (!req.auth) {
    throw new AppError(
      401,
      "AUTHENTICATION_REQUIRED",
      "Authentication is required",
    );
  }

  const patientId = parseBigIntId(req.params.id, "patientId");

  const input = updatePatientSchema.parse(req.body);

  const result = await patientService.update(
    patientId,
    input,
    req.auth,
    securityMetadata(req, res),
  );

  res.status(200).json(successResponse(result));
};

export const archivePatient: RequestHandler = async (req, res) => {
  if (!req.auth) {
    throw new AppError(
      401,
      "AUTHENTICATION_REQUIRED",
      "Authentication is required",
    );
  }

  const patientId = parseBigIntId(req.params.id, "patientId");

  const input = archivePatientSchema.parse(req.body);

  const result = await patientService.archive(
    patientId,
    input,
    req.auth,
    securityMetadata(req, res),
  );

  res.status(200).json(successResponse(result));
};
