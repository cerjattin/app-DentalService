import { Router } from "express";

import { authenticate } from "../../shared/middleware/auth.middleware.js";
import { requirePermission } from "../../shared/middleware/permission.middleware.js";

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
} from "./declaration.controller.js";

export const declarationRouter = Router();

declarationRouter.use(authenticate);

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
