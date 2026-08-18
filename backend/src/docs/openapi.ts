import { OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";

import "./common.schemas.js";
import "../modules/health/health.openapi.js";

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
