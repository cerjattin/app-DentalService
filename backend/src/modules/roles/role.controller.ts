import type { RequestHandler } from "express";

import { successResponse } from "../../shared/http/api-response.js";

import { roleService } from "./role.service.js";

export const listRoles: RequestHandler = async (_req, res) => {
  const roles = await roleService.list();

  res.status(200).json(successResponse(roles));
};
