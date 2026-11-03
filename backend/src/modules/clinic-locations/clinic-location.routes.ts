import { Router } from "express";
import { z } from "zod";
import { clinicLocationService } from "./clinic-location.service.js";
import { authenticate } from "../../shared/middleware/auth.middleware.js";
import { requirePermission } from "../../shared/middleware/permission.middleware.js";
import { successResponse } from "../../shared/http/api-response.js";

export const clinicLocationRouter = Router();
clinicLocationRouter.use(authenticate, requirePermission("clinic_location.read"));
clinicLocationRouter.get("/", async (req, res) => {
  const query = z.strictObject({ isActive: z.enum(["true", "false"]).optional() }).parse(req.query);
  res.json(successResponse(await clinicLocationService.list(req.auth!.organizationId,
    query.isActive === undefined ? undefined : query.isActive === "true")));
});
