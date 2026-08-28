import type { RequestHandler } from "express";

import { AppError } from "../../shared/errors/app-error.js";
import { successResponse } from "../../shared/http/api-response.js";
import { parseBigIntId } from "../../shared/utils/parse-bigint-id.js";

import { uploadDocumentQuerySchema } from "./document.schemas.js";
import { documentService } from "./document.service.js";

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

function contentDispositionFilename(filename: string) {
  return filename.replace(/[^A-Za-z0-9._-]/g, "_");
}

export const uploadDocument: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);
  const query = uploadDocumentQuerySchema.parse(req.query);
  const bytes = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);

  const result = await documentService.upload(
    {
      ...query,
      bytes,
      mimeType: req.get("content-type"),
    },
    actor,
  );

  res.status(201).json(successResponse(result));
};

export const getDocument: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);
  const documentId = parseBigIntId(req.params.id, "documentId");

  const result = await documentService.getMetadata(documentId, actor);

  res.status(200).json(successResponse(result));
};

export const downloadDocument: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);
  const documentId = parseBigIntId(req.params.id, "documentId");

  const result = await documentService.download(documentId, actor);

  res.setHeader("Content-Type", result.document.mimeType);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${contentDispositionFilename(result.document.originalFilename)}"`,
  );
  res.status(200).send(result.bytes);
};

export const listInvoiceDocuments: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);
  const invoiceId = parseBigIntId(req.params.invoiceId, "invoiceId");

  const result = await documentService.listInvoiceDocuments(invoiceId, actor);

  res.status(200).json(successResponse(result));
};
