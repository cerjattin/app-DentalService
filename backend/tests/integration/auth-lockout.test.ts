import request from "supertest";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { app } from "../../src/app.js";

import { env } from "../../src/config/env.js";

import { prisma } from "../../src/infrastructure/database/prisma.js";

import {
  AUTH_TEST_EMAIL,
  cleanupAuthFixture,
  createAuthFixture,
} from "../helpers/auth-fixture.js";

describe("Authentication lockout", () => {
  beforeAll(async () => {
    await createAuthFixture("RECEPTION");
  });

  afterAll(async () => {
    await cleanupAuthFixture();

    await prisma.$disconnect();
  });

  it("locks account after maximum failed attempts", async () => {
    for (
      let attempt = 1;
      attempt <= env.AUTH_MAX_FAILED_ATTEMPTS;
      attempt += 1
    ) {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: AUTH_TEST_EMAIL,

          password: "WRONG-PASSWORD",
        })
        .expect(401);

      expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
    }

    const user = await prisma.user.findUniqueOrThrow({
      where: {
        email: AUTH_TEST_EMAIL,
      },

      select: {
        status: true,

        failedLoginAttempts: true,

        lockedUntil: true,
      },
    });

    expect(user.status).toBe("LOCKED");

    expect(user.failedLoginAttempts).toBe(env.AUTH_MAX_FAILED_ATTEMPTS);

    expect(user.lockedUntil).not.toBeNull();

    /*
     * El siguiente intento ya detecta
     * la cuenta bloqueada antes de
     * verificar password.
     */
    const lockedResponse = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: AUTH_TEST_EMAIL,

        password: "ANYTHING",
      })
      .expect(423);

    expect(lockedResponse.body.error.code).toBe("ACCOUNT_LOCKED");
  });
});
