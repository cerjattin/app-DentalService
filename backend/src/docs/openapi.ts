import { OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";

import "./common.schemas.js";
import "../modules/health/health.openapi.js";
import "../modules/health/health.openapi.js";

import "../modules/svb-catalog/svb-catalog.openapi.js";

import "../modules/reports/dashboard.openapi.js";
import "../modules/invoices/invoice-clinical-reopen.openapi.js";
import "../modules/organization/organization.openapi.js";
import "../modules/declarations/declaration-candidates.openapi.js";
import "../modules/treatment-cases/treatment-case.openapi.js";
import "../modules/svb-readiness/svb-readiness.openapi.js";
import "../modules/clinical-encounters/service-attention.openapi.js";
import "../modules/declarations/manual-entry.openapi.js";
import "../modules/dentalink/dentalink.openapi.js";

import { openApiRegistry } from "./openapi.registry.js";

const generator = new OpenApiGeneratorV3(openApiRegistry.definitions);

export const openApiDocument = generator.generateDocument({
  openapi: "3.0.3",

  info: {
    title: "ODONTHO SERVICES — SVB BILLING API",

    version: "1.0.0",

    description:
      "Backend API for ODONTHO SERVICES SVB billing and clinical workflow.",
  },

  servers: [
    {
      url: "/",
      description: "Current backend server",
    },
  ],
});
