import { Router } from "express";

import { login, me } from "./auth.controller.js";

import { authenticate } from "../../shared/middleware/auth.middleware.js";

export const authRouter = Router();

authRouter.post("/login", login);

authRouter.get("/me", authenticate, me);
