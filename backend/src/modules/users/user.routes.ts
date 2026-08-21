import { Router } from "express";

import { authenticate } from "../../shared/middleware/auth.middleware.js";

import { requirePermission } from "../../shared/middleware/permission.middleware.js";

import {
  changeUserStatus,
  createUser,
  getUser,
  listUsers,
  replaceUserRoles,
  updateUser,
} from "./user.controller.js";

export const userRouter = Router();

userRouter.use(authenticate);

userRouter.get("/", requirePermission("user.read"), listUsers);

userRouter.get("/:id", requirePermission("user.read"), getUser);

userRouter.post("/", requirePermission("user.create"), createUser);
userRouter.patch("/:id", requirePermission("user.update"), updateUser);

userRouter.patch(
  "/:id/status",
  requirePermission("user.update"),
  changeUserStatus,
);

userRouter.put(
  "/:id/roles",
  requirePermission("user.assign_roles"),
  replaceUserRoles,
);
