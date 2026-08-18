import { z } from "zod";

import { apiErrorSchema } from "../../docs/common.schemas.js";
import { openApiRegistry } from "../../docs/openapi.registry.js";

const liveResponseSchema = openApiRegistry.register(
  "HealthLiveResponse",
  z.object({
    success: z.literal(true),

    data: z.object({
      status: z.literal("ok"),
    }),
  }),
);

const readyResponseSchema = openApiRegistry.register(
  "HealthReadyResponse",
  z.object({
    success: z.literal(true),

    data: z.object({
      status: z.literal("ready"),
      database: z.literal("ok"),
    }),
  }),
);

openApiRegistry.registerPath({
  method: "get",

  path: "/health/live",

  tags: ["Health"],

  summary: "Check whether the backend process is alive",

  responses: {
    200: {
      description: "Backend process is running",

      content: {
        "application/json": {
          schema: liveResponseSchema,
        },
      },
    },
  },
});

openApiRegistry.registerPath({
  method: "get",

  path: "/health/ready",

  tags: ["Health"],

  summary: "Check application readiness",

  description: "Verifies that the backend can communicate with the database.",

  responses: {
    200: {
      description: "Backend and database are ready",

      content: {
        "application/json": {
          schema: readyResponseSchema,
        },
      },
    },

    503: {
      description: "Database is unavailable",

      content: {
        "application/json": {
          schema: apiErrorSchema,
        },
      },
    },
  },
});
