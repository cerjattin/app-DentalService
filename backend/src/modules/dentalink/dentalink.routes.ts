import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../shared/middleware/auth.middleware.js";
import { requirePermission as permission } from "../../shared/middleware/permission.middleware.js";
import * as controller from "./dentalink.controller.js";
export const dentalinkRouter = Router();
dentalinkRouter.use(authenticate, (_req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  next();
});
dentalinkRouter.get(
  "/accounts",
  permission("dentalink.read"),
  controller.listAccounts,
);
dentalinkRouter.post(
  "/accounts",
  permission("dentalink.manage"),
  controller.createAccount,
);
dentalinkRouter.get(
  "/accounts/:accountId/status",
  permission("dentalink.read"),
  controller.accountStatus,
);
dentalinkRouter.patch(
  "/accounts/:accountId",
  permission("dentalink.manage"),
  controller.updateAccount,
);
dentalinkRouter.get(
  "/accounts/:accountId/mappings",
  permission("dentalink.read"),
  controller.getMappings,
);
dentalinkRouter.put(
  "/accounts/:accountId/mappings",
  permission("dentalink.manage"),
  controller.putMapping,
);
dentalinkRouter.post(
  "/accounts/:accountId/previews",
  permission("dentalink.import"),
  permission("patient.read"),
  permission("appointment.read"),
  controller.createPreview,
);
dentalinkRouter.get(
  "/accounts/:accountId/previews",
  permission("dentalink.read"),
  controller.listPreviews,
);
dentalinkRouter.post(
  "/accounts/:accountId/previews/:runId/read-next-page",
  permission("dentalink.import"),
  permission("patient.read"),
  permission("appointment.read"),
  (req, _res, next) => {
    z.strictObject({}).parse(req.body ?? {});
    next();
  },
  controller.readNextPage,
);
dentalinkRouter.get(
  "/accounts/:accountId/previews/:runId",
  permission("dentalink.read"),
  controller.getRun,
);
dentalinkRouter.get(
  "/accounts/:accountId/previews/:runId/items",
  permission("dentalink.read"),
  permission("patient.read"),
  permission("appointment.read"),
  controller.getItems,
);
dentalinkRouter.post(
  "/accounts/:accountId/previews/:runId/confirm",
  permission("dentalink.import"),
  permission("patient.create"),
  permission("appointment.create"),
  permission("patient.read"),
  permission("appointment.read"),
  controller.confirmImport,
);
