import request from "supertest";

import { describe, expect, it } from "vitest";

import { app } from "../../src/app.js";

describe("Production hardening", () => {
  it("allows configured CORS origins and does not reflect blocked origins", async () => {
    const allowed = await request(app)
      .get("/health/live")
      .set("Origin", "http://localhost:5173")
      .expect(200);

    expect(allowed.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5173",
    );

    const blocked = await request(app)
      .get("/health/live")
      .set("Origin", "http://malicious.local")
      .expect(200);

    expect(blocked.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("allows no-origin requests for Postman and server-to-server clients", async () => {
    const response = await request(app).get("/health/live").expect(200);

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    expect(response.body.success).toBe(true);
  });

  it("sets security headers without breaking JSON APIs", async () => {
    const response = await request(app).get("/health/live").expect(200);

    expect(response.headers["x-powered-by"]).toBeUndefined();
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.body).toEqual({
      success: true,
      data: {
        status: "ok",
      },
    });
  });

  it("returns sanitized errors for invalid JSON", async () => {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .set("Content-Type", "application/json")
      .send("{")
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("INVALID_JSON");
    expect(response.body.error.message).toBe(
      "Request body contains invalid JSON",
    );
    expect(response.body.error.stack).toBeUndefined();
  });

  it("returns sanitized errors for oversized JSON payloads", async () => {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .set("Content-Type", "application/json")
      .send({
        email: "hardening@local.invalid",
        password: "x".repeat(1024 * 1024 + 1),
      })
      .expect(413);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("PAYLOAD_TOO_LARGE");
    expect(response.body.error.message).toBe("Request payload is too large");
    expect(response.body.error.stack).toBeUndefined();
  });

  it("keeps protected API routes behind authentication", async () => {
    const response = await request(app).get("/api/v1/users").expect(401);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("AUTHENTICATION_REQUIRED");
    expect(response.body.error.correlationId).toEqual(expect.any(String));
  });
});
