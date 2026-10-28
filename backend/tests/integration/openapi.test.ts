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
  it("documents all nine catalogue operations, permissions and DTOs", async () => {
    const { body } = await request(app).get("/api/openapi.json").expect(200);
    const root = "/api/v1/svb-procedures";
    const operations = [
      ["get", "", "svb_procedure.read"],
      ["get", "/{id}", "svb_procedure.read"],
      ["post", "", "svb_procedure.manage"],
      ["patch", "/{id}", "svb_procedure.manage"],
      ["patch", "/{id}/status", "svb_procedure.manage"],
      ["get", "/{procedureId}/tariffs", "svb_tariff.read"],
      ["get", "/{procedureId}/applicable-tariff", "svb_tariff.read"],
      ["post", "/{procedureId}/tariffs", "svb_tariff.manage"],
      ["patch", "/{procedureId}/tariffs/{tariffId}", "svb_tariff.manage"],
    ];
    for (const [method, path, permission] of operations) {
      const operation = body.paths[root + path][method!];
      expect(operation.description).toContain(permission);
      expect(operation.security).toEqual([{ catalogueBearerAuth: [] }]);
      for (const status of [400, 401, 403, 404, 409])
        expect(operation.responses[status]).toBeDefined();
      if (method !== "get") expect(operation.requestBody).toBeDefined();
    }
    expect(body.components.schemas.SvbProcedure.properties.id.type).toBe(
      "string",
    );
    expect(body.components.schemas.SvbTariff.properties.amount.type).toBe(
      "string",
    );
    expect(
      body.components.schemas.CreateSvbProcedure.properties,
    ).toHaveProperty("requiresReferral");
    expect(body.components.schemas.UpdateSvbTariff.properties).toHaveProperty(
      "isActive",
    );
  });
});
