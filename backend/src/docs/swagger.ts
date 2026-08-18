import type { Express, Request, Response } from "express";

import swaggerUi from "swagger-ui-express";

import { env } from "../config/env.js";
import { openApiDocument } from "./openapi.js";

export function mountSwagger(app: Express): void {
  if (!env.OPENAPI_ENABLED) {
    return;
  }

  app.get("/api/openapi.json", (_req: Request, res: Response) => {
    res.status(200).json(openApiDocument);
  });

  app.use(
    "/api/docs",
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
      customSiteTitle: "ODONTHO SVB API",
    }),
  );
}
