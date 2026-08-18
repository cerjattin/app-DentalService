import request from "supertest";

import { afterAll, describe, expect, it } from "vitest";

import { app } from "../../src/app.js";

import { prisma } from "../../src/infrastructure/database/prisma.js";

describe("GET /health/ready", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns ready when MySQL is reachable", async () => {
    const response = await request(app).get("/health/ready").expect(200);

    expect(response.body).toEqual({
      success: true,

      data: {
        status: "ready",
        database: "ok",
      },
    });
  });
});
