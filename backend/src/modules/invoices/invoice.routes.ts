import { Router } from "express";

import { authenticate } from "../../shared/middleware/auth.middleware.js";
import { requirePermission } from "../../shared/middleware/permission.middleware.js";

import {
  approveInvoiceCorrection,
  cancelInvoice,
  cancelInvoiceCorrectionRequest,
  createAppointmentInvoice,
  createInvoiceCorrectionReplacement,
  generateInvoicePdf,
  getInvoice,
  getInvoiceCorrection,
  getInvoiceVersion,
  listInvoiceStatusHistory,
  listInvoiceCorrections,
  listInvoiceVersionItems,
  listInvoiceVersions,
  listInvoices,
  rejectInvoiceCorrection,
  requestInvoiceCorrection,
  updateCorrectionInvoiceItem,
} from "./invoice.controller.js";

export const invoiceRouter = Router();

invoiceRouter.use(authenticate);

invoiceRouter.get("/", requirePermission("invoice.read"), listInvoices);
invoiceRouter.get(
  "/:id/corrections",
  requirePermission("invoice.read"),
  listInvoiceCorrections,
);
invoiceRouter.get(
  "/:id/corrections/:correctionId",
  requirePermission("invoice.read"),
  getInvoiceCorrection,
);
invoiceRouter.post(
  "/:id/corrections",
  requirePermission("invoice.request_correction"),
  requestInvoiceCorrection,
);
invoiceRouter.post(
  "/:id/corrections/:correctionId/approve",
  requirePermission("invoice.apply_correction"),
  approveInvoiceCorrection,
);
invoiceRouter.post(
  "/:id/corrections/:correctionId/reject",
  requirePermission("invoice.apply_correction"),
  rejectInvoiceCorrection,
);
invoiceRouter.post(
  "/:id/corrections/:correctionId/cancel",
  requirePermission("invoice.apply_correction"),
  cancelInvoiceCorrectionRequest,
);
invoiceRouter.post(
  "/:id/corrections/:correctionId/replacement",
  requirePermission("invoice.apply_correction"),
  createInvoiceCorrectionReplacement,
);
invoiceRouter.get(
  "/:id/versions",
  requirePermission("invoice.read"),
  listInvoiceVersions,
);
invoiceRouter.patch(
  "/:id/versions/:versionId/items/:itemId",
  requirePermission("invoice.apply_correction"),
  updateCorrectionInvoiceItem,
);
invoiceRouter.get(
  "/:id/versions/:versionId",
  requirePermission("invoice.read"),
  getInvoiceVersion,
);
invoiceRouter.get(
  "/:id/versions/:versionId/items",
  requirePermission("invoice.read"),
  listInvoiceVersionItems,
);
invoiceRouter.post(
  "/:id/versions/:versionId/pdf",
  requirePermission("document.generate"),
  generateInvoicePdf,
);
invoiceRouter.get(
  "/:id/status-history",
  requirePermission("invoice.read"),
  listInvoiceStatusHistory,
);
invoiceRouter.get("/:id", requirePermission("invoice.read"), getInvoice);
invoiceRouter.post("/:id/cancel", requirePermission("invoice.cancel"), cancelInvoice);

export const appointmentInvoiceRouter = Router({
  mergeParams: true,
});

appointmentInvoiceRouter.use(authenticate);
appointmentInvoiceRouter.post(
  "/",
  requirePermission("invoice.create"),
  createAppointmentInvoice,
);
