import type { RequestHandler } from "express";
import { successResponse } from "../../shared/http/api-response.js";
import { organizationService } from "./organization.service.js";
import { updateOrganizationSchema } from "./organization.schemas.js";

export const getOrganization: RequestHandler = async (req, res) => {
  res.json(successResponse(await organizationService.get(req.auth!)));
};
export const updateOrganization: RequestHandler = async (req, res) => {
  res.json(successResponse(await organizationService.update(updateOrganizationSchema.parse(req.body), req.auth!, {
    ...(req.ip ? { ipAddress: req.ip } : {}),
    ...(req.get("user-agent") ? { userAgent: req.get("user-agent")! } : {}),
    ...(typeof res.locals.correlationId === "string" ? { correlationId: res.locals.correlationId } : {}),
  })));
};
