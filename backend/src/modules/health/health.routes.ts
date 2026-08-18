import { Router } from "express";

import { healthController } from "./health.controller.js";

export const healthRouter = Router();

healthRouter.get("/live", healthController.live.bind(healthController));

healthRouter.get("/ready", healthController.ready.bind(healthController));
