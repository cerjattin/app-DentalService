import express, { Router } from "express";

import { authenticate } from "../../shared/middleware/auth.middleware.js";
import { requirePermission } from "../../shared/middleware/permission.middleware.js";

import {
  downloadDocument,
  getDocument,
  listInvoiceDocuments,
  uploadDocument,
} from "./document.controller.js";

export const documentRouter = Router();

documentRouter.use(authenticate);
documentRouter.post(
  "/",
  requirePermission("document.upload"),
  express.raw({ type: "*/*", limit: "10mb" }),
  uploadDocument,
);
documentRouter.get("/:id", requirePermission("document.read"), getDocument);
documentRouter.get(
  "/:id/download",
  requirePermission("document.read"),
  downloadDocument,
);

export const invoiceDocumentRouter = Router({
  mergeParams: true,
});

invoiceDocumentRouter.use(authenticate);
invoiceDocumentRouter.get(
  "/",
  requirePermission("document.read"),
  listInvoiceDocuments,
);
