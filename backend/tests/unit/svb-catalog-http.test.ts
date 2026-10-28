import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestHandler } from "express";
import type { AuthenticatedRequestContext } from "../../src/modules/auth/auth.types.js";

const state = vi.hoisted(() => ({ permissions: [] as string[] }));
vi.mock("../../src/shared/middleware/auth.middleware.js", () => ({
  authenticate: ((req, _res, next) => {
    if (req.get("authorization") === "Bearer qa-http") {
      req.auth = {
        userId: 1n,
        organizationId: 1n,
        email: "qa@local.invalid",
        firstName: "QA",
        lastName: "HTTP",
        roles: [],
        permissions: state.permissions,
      } satisfies AuthenticatedRequestContext;
    }
    next();
  }) satisfies RequestHandler,
}));
vi.mock("../../src/modules/svb-catalog/svb-catalog.service.js", () => ({
  svbCatalogService: {
    listProcedures: vi.fn(),
    getProcedureById: vi.fn(),
    listTariffs: vi.fn(),
    getApplicableTariff: vi.fn(),
    createProcedure: vi.fn(),
    updateProcedure: vi.fn(),
    createTariff: vi.fn(),
    updateTariff: vi.fn(),
  },
}));
import { app } from "../../src/app.js";
import { AppError } from "../../src/shared/errors/app-error.js";
import { svbCatalogService } from "../../src/modules/svb-catalog/svb-catalog.service.js";

const root = "/api/v1/svb-procedures";
const id = "9007199254740993";
const cases = [
  {
    method: "get",
    path: "",
    permission: "svb_procedure.read",
    service: "listProcedures",
    status: 200,
    body: {},
  },
  {
    method: "get",
    path: `/${id}`,
    permission: "svb_procedure.read",
    service: "getProcedureById",
    status: 200,
    body: {},
  },
  {
    method: "get",
    path: `/${id}/tariffs`,
    permission: "svb_tariff.read",
    service: "listTariffs",
    status: 200,
    body: {},
  },
  {
    method: "get",
    path: `/${id}/applicable-tariff?serviceDate=2026-01-01&currencyCode=ANG`,
    permission: "svb_tariff.read",
    service: "getApplicableTariff",
    status: 200,
    body: {},
  },
  {
    method: "post",
    path: "",
    permission: "svb_procedure.manage",
    service: "createProcedure",
    status: 201,
    body: { code: "TEST", description: "Test" },
  },
  {
    method: "patch",
    path: `/${id}`,
    permission: "svb_procedure.manage",
    service: "updateProcedure",
    status: 200,
    body: { description: "Edited" },
  },
  {
    method: "patch",
    path: `/${id}/status`,
    permission: "svb_procedure.manage",
    service: "updateProcedure",
    status: 200,
    body: { isActive: false },
  },
  {
    method: "post",
    path: `/${id}/tariffs`,
    permission: "svb_tariff.manage",
    service: "createTariff",
    status: 201,
    body: { amount: "88.80", currencyCode: "ANG", validFrom: "2026-01-01" },
  },
  {
    method: "patch",
    path: `/${id}/tariffs/2`,
    permission: "svb_tariff.manage",
    service: "updateTariff",
    status: 200,
    body: { amount: "88.80" },
  },
] as const;

describe("mounted SVB HTTP routing (authentication/service doubles; real permission and validation middleware)", () => {
  beforeEach(() => {
    state.permissions = [];
  });
  it.each(cases)(
    "enforces the exact permission on $method $path",
    async ({ method, path, body, permission, service }) => {
      const response = await request(app)
        [method](root + path)
        .set("Authorization", "Bearer qa-http")
        .send(body)
        .expect(403);
      expect(response.body.error.details.requiredPermission).toBe(permission);
      expect(svbCatalogService[service]).not.toHaveBeenCalled();
    },
  );
  it.each(cases)(
    "dispatches $method $path with its permission and no roles",
    async ({ method, path, body, permission, service, status }) => {
      state.permissions = [permission];
      const mock = vi.mocked(svbCatalogService[service]);
      const procedure = {
        id,
        code: "TEST",
        description: "Test",
        category: null,
        unit: null,
        requiresAuthorization: false,
        requiresReferral: false,
        isActive: true,
        validFrom: "2026-01-01",
        validTo: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };
      const tariff = {
        id,
        svbProcedureId: id,
        amount: "88.80",
        currencyCode: "ANG",
        validFrom: "2026-01-01",
        validTo: null,
        isActive: true,
        createdAt: procedure.createdAt,
        updatedAt: procedure.updatedAt,
      };
      mock.mockResolvedValue({
        ...procedure,
        ...tariff,
        procedures: [],
        tariffs: [],
        procedure,
        tariff,
        serviceDate: "2026-01-01",
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      });
      const response = await request(app)
        [method](root + path)
        .set("Authorization", "Bearer qa-http")
        .send(body)
        .expect(status);
      expect(mock).toHaveBeenCalledOnce();
      if (method !== "get") {
        expect(response.body.data.id).toBe(id);
        expect(response.body.data.amount).toBe("88.80");
      }
      if (path.startsWith(`/${id}`))
        expect(mock.mock.calls[0]?.[0]).toBe(BigInt(id));
      if (service === "updateTariff") {
        expect(mock.mock.calls[0]?.[1]).toBe(2n);
        expect(mock.mock.calls[0]?.[2]).toEqual({ amount: "88.80" });
      }
    },
  );
  it("read permissions cannot mutate and manage permissions cannot read", async () => {
    state.permissions = ["svb_procedure.read", "svb_tariff.read"];
    await request(app)
      .post(root)
      .set("Authorization", "Bearer qa-http")
      .send({ code: "TEST", description: "Test" })
      .expect(403);
    state.permissions = ["svb_procedure.manage", "svb_tariff.manage"];
    await request(app)
      .get(root)
      .set("Authorization", "Bearer qa-http")
      .expect(403);
    await request(app)
      .get(root + "/1/tariffs")
      .set("Authorization", "Bearer qa-http")
      .expect(403);
  });
  it("rejects invalid bodies before invoking a writer", async () => {
    state.permissions = ["svb_procedure.manage", "svb_tariff.manage"];
    await request(app)
      .post(root)
      .set("Authorization", "Bearer qa-http")
      .send({ code: "TEST", description: "Test", id: "2" })
      .expect(400);
    await request(app)
      .patch(root + "/1")
      .set("Authorization", "Bearer qa-http")
      .send({})
      .expect(400);
    await request(app)
      .post(root + "/1/tariffs")
      .set("Authorization", "Bearer qa-http")
      .send({ amount: 88.8, currencyCode: "ANG", validFrom: "2026-01-01" })
      .expect(400);
    expect(svbCatalogService.createProcedure).not.toHaveBeenCalled();
    expect(svbCatalogService.updateProcedure).not.toHaveBeenCalled();
    expect(svbCatalogService.createTariff).not.toHaveBeenCalled();
  });
  it.each([
    [409, "SVB_PROCEDURE_CODE_ALREADY_EXISTS"],
    [400, "INVALID_SVB_PROCEDURE_PERIOD"],
  ] as const)(
    "serializes %s %s through the existing error envelope",
    async (status, code) => {
      state.permissions = ["svb_procedure.manage"];
      vi.mocked(svbCatalogService.createProcedure).mockRejectedValue(
        new AppError(status, code, "Domain validation"),
      );
      const response = await request(app)
        .post(root)
        .set("Authorization", "Bearer qa-http")
        .send({ code: "TEST", description: "Test" })
        .expect(status);
      expect(response.body.error.code).toBe(code);
      expect(response.headers["set-cookie"]).toBeUndefined();
    },
  );
});
