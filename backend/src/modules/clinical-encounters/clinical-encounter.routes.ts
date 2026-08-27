import { Router } from "express";

import { authenticate } from "../../shared/middleware/auth.middleware.js";
import { requirePermission } from "../../shared/middleware/permission.middleware.js";

import {
  completeClinicalEncounter,
  createClinicalEncounter,
  getClinicalEncounter,
  getClinicalEncounterByAppointment,
  listClinicalEncounters,
  updateClinicalEncounter,
} from "./clinical-encounter.controller.js";

export const clinicalEncounterRouter = Router();

clinicalEncounterRouter.use(authenticate);

clinicalEncounterRouter.get(
  "/",
  requirePermission("encounter.read"),
  listClinicalEncounters,
);

clinicalEncounterRouter.get(
  "/:id",
  requirePermission("encounter.read"),
  getClinicalEncounter,
);

clinicalEncounterRouter.patch(
  "/:id",
  requirePermission("encounter.update"),
  updateClinicalEncounter,
);

clinicalEncounterRouter.post(
  "/:id/complete",
  requirePermission("encounter.complete"),
  completeClinicalEncounter,
);

export const appointmentClinicalEncounterRouter = Router({
  mergeParams: true,
});

appointmentClinicalEncounterRouter.use(authenticate);

appointmentClinicalEncounterRouter.get(
  "/",
  requirePermission("encounter.read"),
  getClinicalEncounterByAppointment,
);

appointmentClinicalEncounterRouter.post(
  "/",
  requirePermission("encounter.create"),
  createClinicalEncounter,
);
