import request from "supertest";

import { describe, expect, it } from "vitest";

import { app } from "../../src/app.js";

describe("GET /api/openapi.json", () => {
  it("returns OpenAPI document", async () => {
    const response = await request(app).get("/api/openapi.json").expect(200);

    expect(response.body.openapi).toBe("3.0.3");

    expect(response.body.info.title).toBe("ODONTHO SERVICES — SVB BILLING API");

    expect(response.body.paths["/health/live"]).toBeDefined();

    expect(response.body.paths["/health/ready"]).toBeDefined();
  });
});
