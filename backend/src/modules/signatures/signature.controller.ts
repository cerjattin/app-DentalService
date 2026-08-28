import type { RequestHandler } from "express";

import { AppError } from "../../shared/errors/app-error.js";
import { successResponse } from "../../shared/http/api-response.js";
import { parseBigIntId } from "../../shared/utils/parse-bigint-id.js";

import type { RequestSecurityMetadata } from "../auth/auth.types.js";
import { invoiceService } from "../invoices/invoice.service.js";

import {
  captureSignatureSchema,
  voidSignatureSchema,
} from "./signature.schemas.js";
import { signatureService } from "./signature.service.js";

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

function invoiceVersionIds(req: Parameters<RequestHandler>[0]) {
  return {
    invoiceId: parseBigIntId(req.params.invoiceId, "invoiceId"),
    versionId: parseBigIntId(req.params.versionId, "versionId"),
  };
}

export const prepareInvoiceSignature: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);
  const { invoiceId, versionId } = invoiceVersionIds(req);

  const result = await invoiceService.prepareForSignature(
    invoiceId,
    versionId,
    actor,
    securityMetadata(req, res),
  );

  res.status(200).json(successResponse(result));
};

export const getInvoiceSignatureContent: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);
  const { invoiceId, versionId } = invoiceVersionIds(req);

  const result = await invoiceService.getSignatureContent(
    invoiceId,
    versionId,
    actor,
  );

  res.status(200).json(successResponse(result));
};

export const listInvoiceVersionSignatures: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);
  const { invoiceId, versionId } = invoiceVersionIds(req);

  const result = await signatureService.list(invoiceId, versionId, actor);

  res.status(200).json(successResponse(result));
};

export const captureInvoiceVersionSignature: RequestHandler = async (
  req,
  res,
) => {
  const actor = requireAuth(req);
  const { invoiceId, versionId } = invoiceVersionIds(req);
  const input = captureSignatureSchema.parse(req.body);

  const result = await signatureService.capture(
    invoiceId,
    versionId,
    input,
    actor,
    securityMetadata(req, res),
  );

  res.status(201).json(successResponse(result));
};

export const confirmInvoiceVersionSigned: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);
  const { invoiceId, versionId } = invoiceVersionIds(req);

  const result = await invoiceService.confirmSigned(
    invoiceId,
    versionId,
    actor,
    securityMetadata(req, res),
  );

  res.status(200).json(successResponse(result));
};

export const closeInvoiceVersion: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);
  const { invoiceId, versionId } = invoiceVersionIds(req);

  const result = await invoiceService.close(
    invoiceId,
    versionId,
    actor,
    securityMetadata(req, res),
  );

  res.status(200).json(successResponse(result));
};

export const voidInvoiceVersionSignature: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);
  const { invoiceId, versionId } = invoiceVersionIds(req);
  const signatureId = parseBigIntId(req.params.signatureId, "signatureId");
  const input = voidSignatureSchema.parse(req.body);

  const result = await signatureService.void(
    invoiceId,
    versionId,
    signatureId,
    input,
    actor,
    securityMetadata(req, res),
  );

  res.status(200).json(successResponse(result));
};
