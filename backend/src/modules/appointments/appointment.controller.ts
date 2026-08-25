import type { RequestHandler } from "express";

import { AppError } from "../../shared/errors/app-error.js";
import { successResponse } from "../../shared/http/api-response.js";
import { parseBigIntId } from "../../shared/utils/parse-bigint-id.js";

import type { RequestSecurityMetadata } from "../auth/auth.types.js";

import {
  createAppointmentSchema,
  listAppointmentsQuerySchema,
  updateAppointmentSchema,
  updateAppointmentStatusSchema,
} from "./appointment.schemas.js";

import { appointmentService } from "./appointment.service.js";

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

export const listAppointments: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);

  const query = listAppointmentsQuerySchema.parse(req.query);

  const result = await appointmentService.list(query, actor);

  res.status(200).json(successResponse(result.appointments, result.pagination));
};

export const getAppointment: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);

  const appointmentId = parseBigIntId(req.params.id, "appointmentId");

  const result = await appointmentService.getById(appointmentId, actor);

  res.status(200).json(successResponse(result));
};

export const createAppointment: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);

  const input = createAppointmentSchema.parse(req.body);

  const result = await appointmentService.create(
    input,
    actor,
    securityMetadata(req, res),
  );

  res.status(201).json(successResponse(result));
};

export const updateAppointment: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);

  const appointmentId = parseBigIntId(req.params.id, "appointmentId");

  const input = updateAppointmentSchema.parse(req.body);

  const result = await appointmentService.update(
    appointmentId,
    input,
    actor,
    securityMetadata(req, res),
  );

  res.status(200).json(successResponse(result));
};

export const changeAppointmentStatus: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);

  const appointmentId = parseBigIntId(req.params.id, "appointmentId");

  const input = updateAppointmentStatusSchema.parse(req.body);

  const result = await appointmentService.changeStatus(
    appointmentId,
    input,
    actor,
    securityMetadata(req, res),
  );

  res.status(200).json(successResponse(result));
};
