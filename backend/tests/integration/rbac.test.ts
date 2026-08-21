import express from "express";
import request from "supertest";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "../../src/infrastructure/database/prisma.js";

import { accessTokenService } from "../../src/modules/auth/access-token.service.js";

import { errorHandler } from "../../src/shared/errors/error-handler.js";

import { authenticate } from "../../src/shared/middleware/auth.middleware.js";

import { requirePermission } from "../../src/shared/middleware/permission.middleware.js";

import { requestContextMiddleware } from "../../src/shared/middleware/request-context.middleware.js";

import {
  cleanupAuthFixture,
  createAuthFixture,
  type AuthFixture,
} from "../helpers/auth-fixture.js";

let fixture: AuthFixture;

const testApp = express();

testApp.use(express.json());

testApp.use(requestContextMiddleware);

testApp.get(
  "/allowed",
  authenticate,
  requirePermission("patient.read"),
  (_req, res) => {
    res.status(200).json({
      success: true,
    });
  },
);

testApp.get(
  "/denied",
  authenticate,
  requirePermission("settings.update"),
  (_req, res) => {
    res.status(200).json({
      success: true,
    });
  },
);

testApp.use(errorHandler);

describe("RBAC permissions", () => {
  beforeAll(async () => {
    fixture = await createAuthFixture("RECEPTION");
  });

  afterAll(async () => {
    await cleanupAuthFixture();

    await prisma.$disconnect();
  });

  it("allows an assigned permission", async () => {
    const token = await accessTokenService.sign(
      fixture.userId,
      fixture.organizationId,
    );

    await request(testApp)
      .get("/allowed")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
  });

  it("returns 403 when permission is missing", async () => {
    const token = await accessTokenService.sign(
      fixture.userId,
      fixture.organizationId,
    );

    const response = await request(testApp)
      .get("/denied")
      .set("Authorization", `Bearer ${token}`)
      .expect(403);

    expect(response.body.error.code).toBe("PERMISSION_DENIED");

    expect(response.body.error.details.requiredPermission).toBe(
      "settings.update",
    );
  });
});
