import express, { Router } from "express";

import { env } from "../../config/env.js";
import { authenticate } from "../../shared/middleware/auth.middleware.js";
import { requirePermission } from "../../shared/middleware/permission.middleware.js";

import {
  downloadDocument,
  getDocument,
  listInvoiceDocuments,
  uploadDocument,
} from "./document.controller.js";

export const documentRouter = Router();

const documentRawBodyLimit = Math.min(
  env.DOCUMENT_MAX_UPLOAD_BYTES + 1024 * 1024,
  25 * 1024 * 1024,
);

documentRouter.use(authenticate);
documentRouter.post(
  "/",
  requirePermission("document.upload"),
  express.raw({ type: "*/*", limit: documentRawBodyLimit }),
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
