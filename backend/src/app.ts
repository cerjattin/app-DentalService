import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";

import { env } from "./config/env.js";

import { appointmentRouter } from "./modules/appointments/appointment.routes.js";
import { authorizationRouter } from "./modules/authorizations/authorization.routes.js";
import {
  appointmentClinicalEncounterRouter,
  clinicalEncounterRouter,
} from "./modules/clinical-encounters/clinical-encounter.routes.js";
import {
  diagnosisCodeRouter,
  encounterDiagnosisRouter,
} from "./modules/diagnoses/diagnosis.routes.js";
import { encounterProcedureRouter } from "./modules/encounter-procedures/encounter-procedure.routes.js";
import { mountSwagger } from "./docs/swagger.js";

import { healthRouter } from "./modules/health/health.routes.js";

import { errorHandler } from "./shared/errors/error-handler.js";

import { httpLoggerMiddleware } from "./shared/middleware/http-logger.middleware.js";

import { notFoundMiddleware } from "./shared/middleware/not-found.middleware.js";
import { userRouter } from "./modules/users/user.routes.js";

import { roleRouter } from "./modules/roles/role.routes.js";

import { requestContextMiddleware } from "./shared/middleware/request-context.middleware.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { insuranceRouter } from "./modules/insurance/insurance.routes.js";
import {
  appointmentInvoiceRouter,
  invoiceRouter,
} from "./modules/invoices/invoice.routes.js";
import { payerRouter } from "./modules/insurance/payer.routes.js";
import { patientRouter } from "./modules/patients/patient.routes.js";
import { providerRouter } from "./modules/providers/provider.routes.js";
import { invoiceSignatureRouter } from "./modules/signatures/signature.routes.js";
import { svbCatalogRouter } from "./modules/svb-catalog/svb-catalog.routes.js";
export const app = express();

app.disable("x-powered-by");

app.use(helmet());

app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  }),
);

app.use(
  express.json({
    limit: "1mb",
  }),
);

app.use(
  express.urlencoded({
    extended: false,
    limit: "1mb",
  }),
);

app.use(cookieParser());
app.use(requestContextMiddleware);
app.use(httpLoggerMiddleware);
mountSwagger(app);
app.use("/health", healthRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/roles", roleRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/authorizations", authorizationRouter);
app.use(
  "/api/v1/appointments/:appointmentId/clinical-encounter",
  appointmentClinicalEncounterRouter,
);
app.use("/api/v1/appointments/:appointmentId/invoice", appointmentInvoiceRouter);
app.use("/api/v1/appointments", appointmentRouter);
app.use(
  "/api/v1/clinical-encounters/:encounterId/diagnoses",
  encounterDiagnosisRouter,
);
app.use(
  "/api/v1/clinical-encounters/:encounterId/procedures",
  encounterProcedureRouter,
);
app.use("/api/v1/clinical-encounters", clinicalEncounterRouter);
app.use("/api/v1/diagnosis-codes", diagnosisCodeRouter);
app.use(
  "/api/v1/invoices/:invoiceId/versions/:versionId",
  invoiceSignatureRouter,
);
app.use("/api/v1/invoices", invoiceRouter);
app.use("/api/v1/payers", payerRouter);
app.use("/api/v1/svb-procedures", svbCatalogRouter);
app.use("/api/v1/patients/:patientId/insurance", insuranceRouter);
app.use("/api/v1/patients", patientRouter);
app.use("/api/v1/providers", providerRouter);
app.use(notFoundMiddleware);

app.use(errorHandler);
