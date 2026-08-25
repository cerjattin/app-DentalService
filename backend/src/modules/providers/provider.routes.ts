import { Router } from "express";

import { authenticate } from "../../shared/middleware/auth.middleware.js";

import { requirePermission } from "../../shared/middleware/permission.middleware.js";

import {
  createProvider,
  getProvider,
  listProviders,
  updateProvider,
} from "./provider.controller.js";

export const providerRouter = Router();

providerRouter.use(authenticate);

providerRouter.get("/", requirePermission("provider.read"), listProviders);

providerRouter.get("/:id", requirePermission("provider.read"), getProvider);

providerRouter.post("/", requirePermission("provider.create"), createProvider);

providerRouter.patch("/:id", requirePermission("provider.update"), updateProvider);
