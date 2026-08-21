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

describe("GET /api/v1/auth/me", () => {
  beforeAll(async () => {
    await createAuthFixture("RECEPTION");
  });

  afterAll(async () => {
    await cleanupAuthFixture();

    await prisma.$disconnect();
  });

  it("returns authenticated user", async () => {
    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: AUTH_TEST_EMAIL,

        password: AUTH_TEST_PASSWORD,
      })
      .expect(200);

    const token = login.body.data.accessToken;

    const response = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body.data.email).toBe(AUTH_TEST_EMAIL);

    expect(response.body.data.roles).toContain("RECEPTION");
  });

  it("rejects requests without token", async () => {
    const response = await request(app).get("/api/v1/auth/me").expect(401);

    expect(response.body.error.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("rejects invalid token", async () => {
    const response = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", "Bearer this-is-not-a-jwt")
      .expect(401);

    expect(response.body.error.code).toBe("INVALID_ACCESS_TOKEN");
  });
});
