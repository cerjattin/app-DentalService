import { Router } from "express";

import { authenticate } from "../../shared/middleware/auth.middleware.js";
import { requirePermission } from "../../shared/middleware/permission.middleware.js";

import {
  captureInvoiceVersionSignature,
  confirmInvoiceVersionSigned,
  getInvoiceSignatureContent,
  listInvoiceVersionSignatures,
  prepareInvoiceSignature,
  voidInvoiceVersionSignature,
} from "./signature.controller.js";

export const invoiceSignatureRouter = Router({
  mergeParams: true,
});

invoiceSignatureRouter.use(authenticate);
invoiceSignatureRouter.post(
  "/prepare-signature",
  requirePermission("invoice.prepare_signature"),
  prepareInvoiceSignature,
);
invoiceSignatureRouter.get(
  "/signature-content",
  requirePermission("invoice.read"),
  getInvoiceSignatureContent,
);
invoiceSignatureRouter.get(
  "/signatures",
  requirePermission("invoice.read"),
  listInvoiceVersionSignatures,
);
invoiceSignatureRouter.post(
  "/signatures",
  requirePermission("signature.capture"),
  captureInvoiceVersionSignature,
);
invoiceSignatureRouter.post(
  "/sign",
  requirePermission("invoice.sign"),
  confirmInvoiceVersionSigned,
);
invoiceSignatureRouter.post(
  "/signatures/:signatureId/void",
  requirePermission("signature.void"),
  voidInvoiceVersionSignature,
);
