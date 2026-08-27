import { Router } from "express";

import { authenticate } from "../../shared/middleware/auth.middleware.js";
import { requirePermission } from "../../shared/middleware/permission.middleware.js";

import {
  assignEncounterDiagnosis,
  getDiagnosisCode,
  listDiagnosisCodes,
  listEncounterDiagnoses,
  removeEncounterDiagnosis,
  updateEncounterDiagnosis,
} from "./diagnosis.controller.js";

export const diagnosisCodeRouter = Router();

diagnosisCodeRouter.use(authenticate);

diagnosisCodeRouter.get(
  "/",
  requirePermission("diagnosis.read"),
  listDiagnosisCodes,
);

diagnosisCodeRouter.get(
  "/:id",
  requirePermission("diagnosis.read"),
  getDiagnosisCode,
);

export const encounterDiagnosisRouter = Router({
  mergeParams: true,
});

encounterDiagnosisRouter.use(authenticate);

encounterDiagnosisRouter.get(
  "/",
  requirePermission("diagnosis.read"),
  listEncounterDiagnoses,
);

encounterDiagnosisRouter.post(
  "/",
  requirePermission("diagnosis.assign"),
  assignEncounterDiagnosis,
);

encounterDiagnosisRouter.patch(
  "/:encounterDiagnosisId",
  requirePermission("diagnosis.assign"),
  updateEncounterDiagnosis,
);

encounterDiagnosisRouter.delete(
  "/:encounterDiagnosisId",
  requirePermission("diagnosis.assign"),
  removeEncounterDiagnosis,
);
