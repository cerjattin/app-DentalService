import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../shared/middleware/auth.middleware.js";
import { requirePermission } from "../../shared/middleware/permission.middleware.js";
import { successResponse } from "../../shared/http/api-response.js";
import { getSvbPilotReadiness } from "./svb-readiness.service.js";

export const svbReadinessRouter = Router();
svbReadinessRouter.use(authenticate);
svbReadinessRouter.get("/readiness", requirePermission("svb_procedure.read"), (req, res) => {
  z.strictObject({}).parse(req.query);
  res.json(successResponse(getSvbPilotReadiness()));
});
