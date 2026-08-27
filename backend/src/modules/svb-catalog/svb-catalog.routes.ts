import { Router } from "express";

import { authenticate } from "../../shared/middleware/auth.middleware.js";
import { requirePermission } from "../../shared/middleware/permission.middleware.js";

import {
  getApplicableSvbTariff,
  getSvbProcedure,
  listSvbProcedures,
  listSvbTariffs,
} from "./svb-catalog.controller.js";

export const svbCatalogRouter = Router();

svbCatalogRouter.use(authenticate);

svbCatalogRouter.get(
  "/",
  requirePermission("svb_procedure.read"),
  listSvbProcedures,
);

svbCatalogRouter.get(
  "/:procedureId/tariffs",
  requirePermission("svb_tariff.read"),
  listSvbTariffs,
);

svbCatalogRouter.get(
  "/:procedureId/applicable-tariff",
  requirePermission("svb_tariff.read"),
  getApplicableSvbTariff,
);

svbCatalogRouter.get(
  "/:id",
  requirePermission("svb_procedure.read"),
  getSvbProcedure,
);
