import { Router } from "express";
import { authenticate } from "../../shared/middleware/auth.middleware.js";
import { requirePermission } from "../../shared/middleware/permission.middleware.js";
import { getOrganization, updateOrganization } from "./organization.controller.js";
export const organizationRouter = Router();
organizationRouter.use(authenticate);
organizationRouter.get("/", requirePermission("organization.read"), getOrganization);
organizationRouter.patch("/", requirePermission("organization.update"), updateOrganization);
