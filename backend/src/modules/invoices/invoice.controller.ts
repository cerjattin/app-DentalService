import type { RequestHandler } from "express";

import { AppError } from "../../shared/errors/app-error.js";
import { successResponse } from "../../shared/http/api-response.js";
import { parseBigIntId } from "../../shared/utils/parse-bigint-id.js";

import type { RequestSecurityMetadata } from "../auth/auth.types.js";

import {
  cancelInvoiceSchema,
  listInvoicesQuerySchema,
  requestInvoiceCorrectionSchema,
  resolveInvoiceCorrectionSchema,
  updateCorrectionInvoiceItemSchema,
} from "./invoice.schemas.js";
import { invoiceService } from "./invoice.service.js";

function securityMetadata(
  req: Parameters<RequestHandler>[0],
  res: Parameters<RequestHandler>[1],
): RequestSecurityMetadata {
  const correlationId =
    typeof res.locals.correlationId === "string"
      ? res.locals.correlationId
      : undefined;
  const ipAddress = req.ip;
  const userAgent = req.get("user-agent");

  return {
    ...(correlationId !== undefined ? { correlationId } : {}),
    ...(ipAddress !== undefined ? { ipAddress } : {}),
    ...(userAgent !== undefined ? { userAgent } : {}),
  };
}

function requireAuth(req: Parameters<RequestHandler>[0]) {
  if (!req.auth) {
    throw new AppError(
      401,
      "AUTHENTICATION_REQUIRED",
      "Authentication is required",
    );
  }

  return req.auth;
}

export const listInvoices: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);
  const query = listInvoicesQuerySchema.parse(req.query);

  const result = await invoiceService.list(query, actor);

  res.status(200).json(successResponse(result.invoices, result.pagination));
};

export const getInvoice: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);
  const invoiceId = parseBigIntId(req.params.id, "invoiceId");

  const result = await invoiceService.getById(invoiceId, actor);

  res.status(200).json(successResponse(result));
};

export const listInvoiceVersions: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);
  const invoiceId = parseBigIntId(req.params.id, "invoiceId");

  const result = await invoiceService.listVersions(invoiceId, actor);

  res.status(200).json(successResponse(result));
};

export const getInvoiceVersion: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);
  const invoiceId = parseBigIntId(req.params.id, "invoiceId");
  const versionId = parseBigIntId(req.params.versionId, "versionId");

  const result = await invoiceService.getVersion(invoiceId, versionId, actor);

  res.status(200).json(successResponse(result));
};

export const listInvoiceVersionItems: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);
  const invoiceId = parseBigIntId(req.params.id, "invoiceId");
  const versionId = parseBigIntId(req.params.versionId, "versionId");

  const result = await invoiceService.listItems(invoiceId, versionId, actor);

  res.status(200).json(successResponse(result));
};

export const listInvoiceStatusHistory: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);
  const invoiceId = parseBigIntId(req.params.id, "invoiceId");

  const result = await invoiceService.listStatusHistory(invoiceId, actor);

  res.status(200).json(successResponse(result));
};

export const listInvoiceCorrections: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);
  const invoiceId = parseBigIntId(req.params.id, "invoiceId");

  const result = await invoiceService.listCorrections(invoiceId, actor);

  res.status(200).json(successResponse(result));
};

export const getInvoiceCorrection: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);
  const invoiceId = parseBigIntId(req.params.id, "invoiceId");
  const correctionId = parseBigIntId(req.params.correctionId, "correctionId");

  const result = await invoiceService.getCorrection(
    invoiceId,
    correctionId,
    actor,
  );

  res.status(200).json(successResponse(result));
};

export const requestInvoiceCorrection: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);
  const invoiceId = parseBigIntId(req.params.id, "invoiceId");
  const input = requestInvoiceCorrectionSchema.parse(req.body);

  const result = await invoiceService.requestCorrection(
    invoiceId,
    input,
    actor,
    securityMetadata(req, res),
  );

  res.status(201).json(successResponse(result));
};

export const approveInvoiceCorrection: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);
  const invoiceId = parseBigIntId(req.params.id, "invoiceId");
  const correctionId = parseBigIntId(req.params.correctionId, "correctionId");

  const result = await invoiceService.approveCorrection(
    invoiceId,
    correctionId,
    actor,
    securityMetadata(req, res),
  );

  res.status(200).json(successResponse(result));
};

export const rejectInvoiceCorrection: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);
  const invoiceId = parseBigIntId(req.params.id, "invoiceId");
  const correctionId = parseBigIntId(req.params.correctionId, "correctionId");
  const input = resolveInvoiceCorrectionSchema.parse(req.body);

  const result = await invoiceService.rejectCorrection(
    invoiceId,
    correctionId,
    input,
    actor,
    securityMetadata(req, res),
  );

  res.status(200).json(successResponse(result));
};

export const cancelInvoiceCorrectionRequest: RequestHandler = async (
  req,
  res,
) => {
  const actor = requireAuth(req);
  const invoiceId = parseBigIntId(req.params.id, "invoiceId");
  const correctionId = parseBigIntId(req.params.correctionId, "correctionId");
  const input = resolveInvoiceCorrectionSchema.parse(req.body);

  const result = await invoiceService.cancelCorrection(
    invoiceId,
    correctionId,
    input,
    actor,
    securityMetadata(req, res),
  );

  res.status(200).json(successResponse(result));
};

export const createInvoiceCorrectionReplacement: RequestHandler = async (
  req,
  res,
) => {
  const actor = requireAuth(req);
  const invoiceId = parseBigIntId(req.params.id, "invoiceId");
  const correctionId = parseBigIntId(req.params.correctionId, "correctionId");

  const result = await invoiceService.createCorrectionReplacement(
    invoiceId,
    correctionId,
    actor,
    securityMetadata(req, res),
  );

  res.status(201).json(successResponse(result));
};

export const updateCorrectionInvoiceItem: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);
  const invoiceId = parseBigIntId(req.params.id, "invoiceId");
  const versionId = parseBigIntId(req.params.versionId, "versionId");
  const itemId = parseBigIntId(req.params.itemId, "itemId");
  const input = updateCorrectionInvoiceItemSchema.parse(req.body);

  const result = await invoiceService.updateCorrectionItem(
    invoiceId,
    versionId,
    itemId,
    input,
    actor,
    securityMetadata(req, res),
  );

  res.status(200).json(successResponse(result));
};

export const createAppointmentInvoice: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);
  const appointmentId = parseBigIntId(req.params.appointmentId, "appointmentId");

  const result = await invoiceService.createFromAppointment(
    appointmentId,
    actor,
    securityMetadata(req, res),
  );

  res.status(201).json(successResponse(result));
};

export const cancelInvoice: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);
  const invoiceId = parseBigIntId(req.params.id, "invoiceId");
  const input = cancelInvoiceSchema.parse(req.body);

  const result = await invoiceService.cancel(
    invoiceId,
    input,
    actor,
    securityMetadata(req, res),
  );

  res.status(200).json(successResponse(result));
};
