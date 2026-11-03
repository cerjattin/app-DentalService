import { Router } from "express";

import { authenticate } from "../../shared/middleware/auth.middleware.js";
import { requirePermission } from "../../shared/middleware/permission.middleware.js";
import { getManualDossier, downloadManualDossier, prepareManualEntry, flagManualUncertainty, releaseManualEntry, recordManualSubmission, recordManualOfficialResult } from "./manual-entry.controller.js";

import {
  addDeclarationItem,
  createDeclaration,
  exportDeclaration,
  getDeclaration,
  getDeclarationSubmission,
  listDeclarationExports,
  listDeclarationItems,
  listDeclarationSubmissions,
  listDeclarations,
  markDeclarationReady,
  recordDeclarationSubmissionResult,
  submitDeclaration,
  getDeclarationCandidates,
  removeDeclarationItem,
  cancelDraftDeclaration,
} from "./declaration.controller.js";

export const declarationRouter = Router();

declarationRouter.use(authenticate);
declarationRouter.get("/:id/manual-entry",requirePermission("declaration.read"),requirePermission("invoice.read"),getManualDossier);
declarationRouter.get("/:id/manual-entry/download",requirePermission("declaration.read"),requirePermission("invoice.read"),downloadManualDossier);
declarationRouter.post("/:id/manual-entry/prepare",requirePermission("declaration.submit"),requirePermission("declaration.read"),requirePermission("invoice.read"),prepareManualEntry);
declarationRouter.post("/:id/manual-entry/:entryId/uncertain",requirePermission("declaration.submit"),flagManualUncertainty);
declarationRouter.post("/:id/manual-entry/:entryId/release",requirePermission("declaration.submit"),releaseManualEntry);
declarationRouter.post("/:id/submissions/manual",requirePermission("declaration.submit"),recordManualSubmission);
declarationRouter.post("/:id/submissions/:submissionId/official-result",requirePermission("declaration.submit"),recordManualOfficialResult);
declarationRouter.get("/:id/candidates", requirePermission("declaration.read"), requirePermission("invoice.read"), getDeclarationCandidates);
declarationRouter.delete("/:id/items/:itemId", requirePermission("declaration.update"), removeDeclarationItem);
declarationRouter.post("/:id/cancel", requirePermission("declaration.update"), cancelDraftDeclaration);

declarationRouter.get(
  "/",
  requirePermission("declaration.read"),
  listDeclarations,
);

declarationRouter.post(
  "/",
  requirePermission("declaration.create"),
  createDeclaration,
);

declarationRouter.get(
  "/:id/items",
  requirePermission("declaration.read"),
  listDeclarationItems,
);

declarationRouter.post(
  "/:id/items",
  requirePermission("declaration.update"),
  addDeclarationItem,
);

declarationRouter.post(
  "/:id/ready",
  requirePermission("declaration.update"),
  markDeclarationReady,
);

declarationRouter.get(
  "/:id/exports",
  requirePermission("declaration.read"),
  listDeclarationExports,
);

declarationRouter.post(
  "/:id/exports",
  requirePermission("declaration.export"),
  exportDeclaration,
);

declarationRouter.get(
  "/:id/submissions",
  requirePermission("declaration.read"),
  listDeclarationSubmissions,
);

declarationRouter.get(
  "/:id/submissions/:submissionId",
  requirePermission("declaration.read"),
  getDeclarationSubmission,
);

declarationRouter.post(
  "/:id/submissions/:submissionId/result",
  requirePermission("declaration.submit"),
  recordDeclarationSubmissionResult,
);

declarationRouter.post(
  "/:id/submit",
  requirePermission("declaration.submit"),
  submitDeclaration,
);

declarationRouter.get(
  "/:id",
  requirePermission("declaration.read"),
  getDeclaration,
);
