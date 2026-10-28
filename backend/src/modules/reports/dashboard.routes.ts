import { Router } from "express";
import { authenticate } from "../../shared/middleware/auth.middleware.js";
import { requirePermission } from "../../shared/middleware/permission.middleware.js";
import { successResponse } from "../../shared/http/api-response.js";
import { dashboardQuerySchema, getDashboard } from "./dashboard.service.js";

export const dashboardRouter = Router();
dashboardRouter.use(authenticate, requirePermission("dashboard.read"));
dashboardRouter.get("/dashboard", async (req, res) => {
  res.json(successResponse(await getDashboard(dashboardQuerySchema.parse(req.query), req.auth!.organizationId)));
});
