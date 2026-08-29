import { Router } from "express";
import rateLimit from "express-rate-limit";

import { env } from "../../config/env.js";
import { login, me } from "./auth.controller.js";

import { authenticate } from "../../shared/middleware/auth.middleware.js";

export const authRouter = Router();

const loginRateLimiter = rateLimit({
  windowMs: env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_LOGIN_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const correlationId = res.locals.correlationId ?? req.id ?? "unknown";

    res.status(429).json({
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many login attempts. Please retry later.",
        correlationId,
      },
    });
  },
});

authRouter.post("/login", loginRateLimiter, login);

authRouter.get("/me", authenticate, me);
