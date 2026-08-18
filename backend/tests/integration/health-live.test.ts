import request from "supertest";

import { describe, expect, it } from "vitest";

import { app } from "../../src/app.js";

describe("GET /health/live", () => {
  it("returns HTTP 200", async () => {
    const response = await request(app).get("/health/live").expect(200);

    expect(response.body).toEqual({
      success: true,

      data: {
        status: "ok",
      },
    });
  });

  it("returns a correlation id", async () => {
    const response = await request(app).get("/health/live").expect(200);

    expect(response.headers["x-correlation-id"]).toBeTruthy();
  });
});
