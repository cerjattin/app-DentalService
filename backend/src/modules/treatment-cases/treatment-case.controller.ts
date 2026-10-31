import type { RequestHandler } from "express";
import { successResponse } from "../../shared/http/api-response.js";
import { parseBigIntId } from "../../shared/utils/parse-bigint-id.js";
import { createTreatmentCaseSchema, updateTreatmentCaseSchema, listTreatmentCasesSchema } from "./treatment-case.schemas.js";
import { treatmentCaseService } from "./treatment-case.service.js";
const metadata = (req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1]) => ({
  ...(req.ip ? { ipAddress: req.ip } : {}), ...(req.get("user-agent") ? { userAgent: req.get("user-agent")! } : {}),
  ...(typeof res.locals.correlationId === "string" ? { correlationId: res.locals.correlationId } : {}),
});
export const listTreatmentCases: RequestHandler = async (req, res) => {
  const result = await treatmentCaseService.list(parseBigIntId(req.params.patientId, "patientId"), listTreatmentCasesSchema.parse(req.query), req.auth!);
  res.json(successResponse(result.cases, result.pagination));
};
export const getTreatmentCase: RequestHandler = async (req, res) => {
  res.json(successResponse(await treatmentCaseService.get(parseBigIntId(req.params.patientId, "patientId"), parseBigIntId(req.params.caseId, "caseId"), req.auth!)));
};
export const createTreatmentCase: RequestHandler = async (req, res) => {
  res.status(201).json(successResponse(await treatmentCaseService.create(parseBigIntId(req.params.patientId, "patientId"), createTreatmentCaseSchema.parse(req.body), req.auth!, metadata(req, res))));
};
export const updateTreatmentCase: RequestHandler = async (req, res) => {
  res.json(successResponse(await treatmentCaseService.update(parseBigIntId(req.params.patientId, "patientId"), parseBigIntId(req.params.caseId, "caseId"), updateTreatmentCaseSchema.parse(req.body), req.auth!, metadata(req, res))));
};
