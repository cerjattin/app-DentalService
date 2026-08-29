import type { RequestHandler } from "express";

import { AppError } from "../../shared/errors/app-error.js";
import { successResponse } from "../../shared/http/api-response.js";
import { parseBigIntId } from "../../shared/utils/parse-bigint-id.js";
import type { RequestSecurityMetadata } from "../auth/auth.types.js";

import {
  addDeclarationItemSchema,
  createDeclarationExportSchema,
  createDeclarationSchema,
  declarationSubmissionResultSchema,
  listDeclarationsQuerySchema,
} from "./declaration.schemas.js";
import { declarationService } from "./declaration.service.js";

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

export const listDeclarations: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);
  const query = listDeclarationsQuerySchema.parse(req.query);
  const result = await declarationService.list(query, actor);

  res.status(200).json(successResponse(result.declarations, result.pagination));
};

export const getDeclaration: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);
  const declarationId = parseBigIntId(req.params.id, "declarationId");
  const result = await declarationService.getById(declarationId, actor);

  res.status(200).json(successResponse(result));
};

export const createDeclaration: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);
  const input = createDeclarationSchema.parse(req.body);
  const result = await declarationService.create(
    input,
    actor,
    securityMetadata(req, res),
  );

  res.status(201).json(successResponse(result));
};

export const listDeclarationItems: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);
  const declarationId = parseBigIntId(req.params.id, "declarationId");
  const result = await declarationService.listItems(declarationId, actor);

  res.status(200).json(successResponse(result));
};

export const addDeclarationItem: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);
  const declarationId = parseBigIntId(req.params.id, "declarationId");
  const input = addDeclarationItemSchema.parse(req.body);
  const result = await declarationService.addItem(
    declarationId,
    input,
    actor,
    securityMetadata(req, res),
  );

  res.status(201).json(successResponse(result));
};

export const markDeclarationReady: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);
  const declarationId = parseBigIntId(req.params.id, "declarationId");
  const result = await declarationService.markReady(
    declarationId,
    actor,
    securityMetadata(req, res),
  );

  res.status(200).json(successResponse(result));
};

export const listDeclarationExports: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);
  const declarationId = parseBigIntId(req.params.id, "declarationId");
  const result = await declarationService.listExports(declarationId, actor);

  res.status(200).json(successResponse(result));
};

export const listDeclarationSubmissions: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);
  const declarationId = parseBigIntId(req.params.id, "declarationId");
  const result = await declarationService.listSubmissions(declarationId, actor);

  res.status(200).json(successResponse(result));
};

export const getDeclarationSubmission: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);
  const declarationId = parseBigIntId(req.params.id, "declarationId");
  const submissionId = parseBigIntId(req.params.submissionId, "submissionId");
  const result = await declarationService.getSubmission(
    declarationId,
    submissionId,
    actor,
  );

  res.status(200).json(successResponse(result));
};

export const submitDeclaration: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);
  const declarationId = parseBigIntId(req.params.id, "declarationId");
  const result = await declarationService.submit(
    declarationId,
    actor,
    securityMetadata(req, res),
  );

  res.status(201).json(successResponse(result));
};

export const recordDeclarationSubmissionResult: RequestHandler = async (
  req,
  res,
) => {
  const actor = requireAuth(req);
  const declarationId = parseBigIntId(req.params.id, "declarationId");
  const submissionId = parseBigIntId(req.params.submissionId, "submissionId");
  const input = declarationSubmissionResultSchema.parse(req.body);
  const result = await declarationService.recordSubmissionResult(
    declarationId,
    submissionId,
    input,
    actor,
    securityMetadata(req, res),
  );

  res.status(200).json(successResponse(result));
};

export const exportDeclaration: RequestHandler = async (req, res) => {
  const actor = requireAuth(req);
  const declarationId = parseBigIntId(req.params.id, "declarationId");
  const input = createDeclarationExportSchema.parse(req.body);
  const result = await declarationService.exportDeclaration(
    declarationId,
    input,
    actor,
    securityMetadata(req, res),
  );

  res.status(201).json(successResponse(result));
};
