import { Router } from "express";

import { authenticate } from "../../shared/middleware/auth.middleware.js";

import { requirePermission } from "../../shared/middleware/permission.middleware.js";

import { createUser, getUser, listUsers } from "./user.controller.js";

export const userRouter = Router();

userRouter.use(authenticate);

userRouter.get("/", requirePermission("user.read"), listUsers);

userRouter.get("/:id", requirePermission("user.read"), getUser);

userRouter.post("/", requirePermission("user.create"), createUser);
