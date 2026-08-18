import type { Request, Response } from "express";

import { successResponse } from "../../shared/http/api-response.js";
import { healthService } from "./health.service.js";

export class HealthController {
  live(_req: Request, res: Response): void {
    res.status(200).json(
      successResponse({
        status: "ok",
      }),
    );
  }

  async ready(_req: Request, res: Response): Promise<void> {
    try {
      await healthService.checkDatabase();

      res.status(200).json(
        successResponse({
          status: "ready",
          database: "ok",
        }),
      );
    } catch {
      res.status(503).json({
        success: false,
        error: {
          code: "DATABASE_UNAVAILABLE",
          message: "Application database is not available",
          correlationId: res.locals.correlationId,
        },
      });
    }
  }
}

export const healthController = new HealthController();
