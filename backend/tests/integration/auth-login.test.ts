import request from "supertest";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { app } from "../../src/app.js";

import { prisma } from "../../src/infrastructure/database/prisma.js";

import {
  AUTH_TEST_EMAIL,
  AUTH_TEST_PASSWORD,
  cleanupAuthFixture,
  createAuthFixture,
} from "../helpers/auth-fixture.js";

describe("POST /api/v1/auth/login", () => {
  beforeAll(async () => {
    await createAuthFixture("RECEPTION");
  });

  afterAll(async () => {
    await cleanupAuthFixture();

    await prisma.$disconnect();
  });

  it("authenticates an active user", async () => {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: AUTH_TEST_EMAIL,

        password: AUTH_TEST_PASSWORD,
      })
      .expect(200);

    expect(response.body.success).toBe(true);

    expect(response.body.data.accessToken).toEqual(expect.any(String));

    expect(response.body.data.tokenType).toBe("Bearer");

    expect(response.body.data.user.email).toBe(AUTH_TEST_EMAIL);

    expect(response.body.data.user.roles).toContain("RECEPTION");

    expect(response.body.data.user.permissions).toContain("patient.read");
  });

  it("updates lastLoginAt and resets failed attempts", async () => {
    const user = await prisma.user.findUniqueOrThrow({
      where: {
        email: AUTH_TEST_EMAIL,
      },

      select: {
        lastLoginAt: true,

        failedLoginAttempts: true,
      },
    });

    expect(user.lastLoginAt).not.toBeNull();

    expect(user.failedLoginAttempts).toBe(0);
  });

  it("creates successful login audit", async () => {
    const audit = await prisma.auditLog.findFirst({
      where: {
        entityKey: AUTH_TEST_EMAIL,

        action: "AUTH_LOGIN_SUCCESS",
      },
    });

    expect(audit).not.toBeNull();
  });
});
