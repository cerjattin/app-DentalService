import { Router } from "express";

import { authenticate } from "../../shared/middleware/auth.middleware.js";
import { requirePermission } from "../../shared/middleware/permission.middleware.js";

import {
  createEncounterProcedure,
  getEncounterProcedure,
  listEncounterProcedures,
  removeEncounterProcedure,
  updateEncounterProcedure,
} from "./encounter-procedure.controller.js";

export const encounterProcedureRouter = Router({
  mergeParams: true,
});

encounterProcedureRouter.use(authenticate);

encounterProcedureRouter.get(
  "/",
  requirePermission("procedure.read"),
  listEncounterProcedures,
);

encounterProcedureRouter.get(
  "/:encounterProcedureId",
  requirePermission("procedure.read"),
  getEncounterProcedure,
);

encounterProcedureRouter.post(
  "/",
  requirePermission("procedure.update"),
  createEncounterProcedure,
);

encounterProcedureRouter.patch(
  "/:encounterProcedureId",
  requirePermission("procedure.update"),
  updateEncounterProcedure,
);

encounterProcedureRouter.delete(
  "/:encounterProcedureId",
  requirePermission("procedure.update"),
  removeEncounterProcedure,
);
