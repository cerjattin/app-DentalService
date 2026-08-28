import { Router } from "express";

import { authenticate } from "../../shared/middleware/auth.middleware.js";
import { requirePermission } from "../../shared/middleware/permission.middleware.js";

import {
  cancelInvoice,
  createAppointmentInvoice,
  getInvoice,
  getInvoiceVersion,
  listInvoiceStatusHistory,
  listInvoiceVersionItems,
  listInvoiceVersions,
  listInvoices,
} from "./invoice.controller.js";

export const invoiceRouter = Router();

invoiceRouter.use(authenticate);

invoiceRouter.get("/", requirePermission("invoice.read"), listInvoices);
invoiceRouter.get("/:id", requirePermission("invoice.read"), getInvoice);
invoiceRouter.get(
  "/:id/versions",
  requirePermission("invoice.read"),
  listInvoiceVersions,
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
invoiceRouter.get(
  "/:id/status-history",
  requirePermission("invoice.read"),
  listInvoiceStatusHistory,
);
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
