import { Router } from "express";

import { authenticate } from "../../shared/middleware/auth.middleware.js";

import { requirePermission } from "../../shared/middleware/permission.middleware.js";

import {
  createPatientInsurance,
  getPatientInsurance,
  listPatientInsurance,
  updatePatientInsurance,
  verifyPatientInsurance,
} from "./insurance.controller.js";

export const insuranceRouter = Router({
  mergeParams: true,
});

insuranceRouter.use(authenticate);

insuranceRouter.get(
  "/",
  requirePermission("insurance.read"),
  listPatientInsurance,
);

insuranceRouter.get(
  "/:insuranceId",
  requirePermission("insurance.read"),
  getPatientInsurance,
);

insuranceRouter.post(
  "/",
  requirePermission("insurance.create"),
  createPatientInsurance,
);

insuranceRouter.patch(
  "/:insuranceId",
  requirePermission("insurance.update"),
  updatePatientInsurance,
);

insuranceRouter.post(
  "/:insuranceId/verify",
  requirePermission("insurance.verify"),
  verifyPatientInsurance,
);
