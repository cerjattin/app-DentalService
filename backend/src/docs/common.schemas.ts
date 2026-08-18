import { z } from "zod";

import { openApiRegistry } from "./openapi.registry.js";

export const apiErrorSchema = openApiRegistry.register(
  "ApiError",
  z.object({
    success: z.literal(false),

    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.unknown().optional(),
      correlationId: z.string().optional(),
    }),
  }),
);
