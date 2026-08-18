import request from "supertest";

import { describe, expect, it } from "vitest";

import { app } from "../../src/app.js";

describe("Unknown route", () => {
  it("returns standardized 404 error", async () => {
    const response = await request(app)
      .get("/route-that-does-not-exist")
      .expect(404);

    expect(response.body.success).toBe(false);

    expect(response.body.error.code).toBe("ROUTE_NOT_FOUND");

    expect(response.body.error.correlationId).toBeTruthy();
  });
});
