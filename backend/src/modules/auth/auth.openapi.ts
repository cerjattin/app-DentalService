import { z } from "zod";

import { apiErrorSchema } from "../../docs/common.schemas.js";
import { openApiRegistry } from "../../docs/openapi.registry.js";

const authenticatedUserSchema = openApiRegistry.register(
  "AuthenticatedUser",
  z.object({
    id: z.string(),

    organizationId: z.string(),

    email: z.string().email(),

    firstName: z.string(),

    lastName: z.string(),

    roles: z.array(z.string()),

    permissions: z.array(z.string()),
  }),
);

const loginRequestSchema = openApiRegistry.register(
  "LoginRequest",
  z.object({
    email: z.string().email(),

    password: z.string().min(1),
  }),
);

const loginResponseSchema = openApiRegistry.register(
  "LoginResponse",
  z.object({
    success: z.literal(true),

    data: z.object({
      accessToken: z.string(),

      tokenType: z.literal("Bearer"),

      expiresIn: z.string(),

      user: authenticatedUserSchema,
    }),
  }),
);

const meResponseSchema = openApiRegistry.register(
  "MeResponse",
  z.object({
    success: z.literal(true),

    data: authenticatedUserSchema,
  }),
);

openApiRegistry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
});

openApiRegistry.registerPath({
  method: "post",

  path: "/api/v1/auth/login",

  tags: ["Authentication"],

  summary: "Authenticate user",

  request: {
    body: {
      content: {
        "application/json": {
          schema: loginRequestSchema,
        },
      },
    },
  },

  responses: {
    200: {
      description: "Authentication successful",

      content: {
        "application/json": {
          schema: loginResponseSchema,
        },
      },
    },

    400: {
      description: "Invalid request",

      content: {
        "application/json": {
          schema: apiErrorSchema,
        },
      },
    },

    401: {
      description: "Invalid credentials",

      content: {
        "application/json": {
          schema: apiErrorSchema,
        },
      },
    },

    423: {
      description: "Account locked",

      content: {
        "application/json": {
          schema: apiErrorSchema,
        },
      },
    },
  },
});

openApiRegistry.registerPath({
  method: "get",

  path: "/api/v1/auth/me",

  tags: ["Authentication"],

  summary: "Get authenticated user",

  security: [
    {
      bearerAuth: [],
    },
  ],

  responses: {
    200: {
      description: "Authenticated user",

      content: {
        "application/json": {
          schema: meResponseSchema,
        },
      },
    },

    401: {
      description: "Authentication required",

      content: {
        "application/json": {
          schema: apiErrorSchema,
        },
      },
    },
  },
});
