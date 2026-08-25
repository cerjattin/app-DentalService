import { Router } from "express";

import { authenticate } from "../../shared/middleware/auth.middleware.js";

import { requirePermission } from "../../shared/middleware/permission.middleware.js";

import { listPayers } from "./insurance.controller.js";

export const payerRouter = Router();

payerRouter.use(authenticate);

payerRouter.get("/", requirePermission("insurance.read"), listPayers);
