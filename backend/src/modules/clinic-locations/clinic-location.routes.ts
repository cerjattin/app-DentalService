import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../infrastructure/database/prisma.js";
import { authenticate } from "../../shared/middleware/auth.middleware.js";
import { requirePermission } from "../../shared/middleware/permission.middleware.js";
import { successResponse } from "../../shared/http/api-response.js";

export const clinicLocationRouter = Router();
clinicLocationRouter.use(authenticate, requirePermission("clinic_location.read"));
clinicLocationRouter.get("/", async (req, res) => {
  const query = z.strictObject({ isActive: z.enum(["true", "false"]).optional() }).parse(req.query);
  const rows = await prisma.clinicLocation.findMany({
    where: { organizationId: req.auth!.organizationId, archivedAt: null, ...(query.isActive ? { isActive: query.isActive === "true" } : {}) },
    select: { id: true, code: true, name: true, isActive: true }, orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  res.json(successResponse(rows.map((row) => ({ ...row, id: row.id.toString() }))));
});
