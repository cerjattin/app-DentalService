import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";

import { env } from "./config/env.js";

import { mountSwagger } from "./docs/swagger.js";

import { healthRouter } from "./modules/health/health.routes.js";

import { errorHandler } from "./shared/errors/error-handler.js";

import { httpLoggerMiddleware } from "./shared/middleware/http-logger.middleware.js";

import { notFoundMiddleware } from "./shared/middleware/not-found.middleware.js";
import { userRouter } from "./modules/users/user.routes.js";

import { roleRouter } from "./modules/roles/role.routes.js";

import { requestContextMiddleware } from "./shared/middleware/request-context.middleware.js";
import { authRouter } from "./modules/auth/auth.routes.js";

export const app = express();

app.disable("x-powered-by");

app.use(helmet());

app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  }),
);

app.use(
  express.json({
    limit: "1mb",
  }),
);

app.use(
  express.urlencoded({
    extended: false,
    limit: "1mb",
  }),
);

app.use(cookieParser());
app.use(requestContextMiddleware);
app.use(httpLoggerMiddleware);
mountSwagger(app);
app.use("/health", healthRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/roles", roleRouter);
app.use("/api/v1/auth", authRouter);

app.use(notFoundMiddleware);

app.use(errorHandler);
