import { Router } from "express";

import { authenticate } from "../../shared/middleware/auth.middleware.js";

import { requirePermission } from "../../shared/middleware/permission.middleware.js";

import {
  archivePatient,
  createPatient,
  getPatient,
  listPatients,
  updatePatient,
} from "./patient.controller.js";

export const patientRouter = Router();

patientRouter.use(authenticate);

patientRouter.get("/", requirePermission("patient.read"), listPatients);

patientRouter.get("/:id", requirePermission("patient.read"), getPatient);

patientRouter.post("/", requirePermission("patient.create"), createPatient);

patientRouter.patch("/:id", requirePermission("patient.update"), updatePatient);

patientRouter.patch(
  "/:id/archive",
  requirePermission("patient.archive"),
  archivePatient,
);
