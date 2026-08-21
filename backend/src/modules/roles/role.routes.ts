import { Router } from "express";

import { authenticate } from "../../shared/middleware/auth.middleware.js";

import { requirePermission } from "../../shared/middleware/permission.middleware.js";

import { listRoles } from "./role.controller.js";

export const roleRouter = Router();

roleRouter.get("/", authenticate, requirePermission("role.read"), listRoles);
