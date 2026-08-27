import { Router } from "express";

import { authenticate } from "../../shared/middleware/auth.middleware.js";
import { requirePermission } from "../../shared/middleware/permission.middleware.js";

import {
  createAuthorization,
  createAuthorizationItem,
  getAuthorization,
  listAuthorizationItems,
  listAuthorizations,
  updateAuthorization,
  updateAuthorizationItem,
} from "./authorization.controller.js";

export const authorizationRouter = Router();

authorizationRouter.use(authenticate);

authorizationRouter.get(
  "/",
  requirePermission("authorization.read"),
  listAuthorizations,
);

authorizationRouter.post(
  "/",
  requirePermission("authorization.create"),
  createAuthorization,
);

authorizationRouter.get(
  "/:authorizationId/items",
  requirePermission("authorization.read"),
  listAuthorizationItems,
);

authorizationRouter.post(
  "/:authorizationId/items",
  requirePermission("authorization.update"),
  createAuthorizationItem,
);

authorizationRouter.patch(
  "/:authorizationId/items/:itemId",
  requirePermission("authorization.update"),
  updateAuthorizationItem,
);

authorizationRouter.get(
  "/:id",
  requirePermission("authorization.read"),
  getAuthorization,
);

authorizationRouter.patch(
  "/:id",
  requirePermission("authorization.update"),
  updateAuthorization,
);
