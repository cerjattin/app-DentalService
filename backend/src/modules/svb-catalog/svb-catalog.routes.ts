import { Router } from "express";

import { authenticate } from "../../shared/middleware/auth.middleware.js";
import { requirePermission } from "../../shared/middleware/permission.middleware.js";

import {
  createSvbProcedure,
  updateSvbProcedure,
  setSvbProcedureStatus,
  createSvbTariff,
  updateSvbTariff,
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

svbCatalogRouter.post(
  "/",
  requirePermission("svb_procedure.manage"),
  createSvbProcedure,
);
svbCatalogRouter.patch(
  "/:id/status",
  requirePermission("svb_procedure.manage"),
  setSvbProcedureStatus,
);
svbCatalogRouter.patch(
  "/:id",
  requirePermission("svb_procedure.manage"),
  updateSvbProcedure,
);
svbCatalogRouter.post(
  "/:procedureId/tariffs",
  requirePermission("svb_tariff.manage"),
  createSvbTariff,
);
svbCatalogRouter.patch(
  "/:procedureId/tariffs/:tariffId",
  requirePermission("svb_tariff.manage"),
  updateSvbTariff,
);
