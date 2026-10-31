import request from "supertest";
import type { RequestHandler } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ permissions: [] as string[], roles: [] as string[] }));
vi.mock("../../src/shared/middleware/auth.middleware.js", () => ({
  authenticate: ((req, _res, next) => {
    if (req.get("Authorization") === "Bearer qa") req.auth = { userId: 1n, organizationId: 2n,
      email: "qa@local.invalid", firstName: "QA", lastName: "HTTP", roles: state.roles, permissions: state.permissions };
    next();
  }) satisfies RequestHandler,
}));
vi.mock("../../src/modules/organization/organization.service.js", () => ({ organizationService: { get: vi.fn(), update: vi.fn() } }));
vi.mock("../../src/modules/treatment-cases/treatment-case.service.js", () => ({ treatmentCaseService: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn() }, validateAssignableTreatmentCase: vi.fn() }));
vi.mock("../../src/modules/declarations/declaration-candidates.service.js", () => ({ listDeclarationCandidates: vi.fn() }));
vi.mock("../../src/modules/declarations/declaration-draft.service.js", () => ({ changeDraftDeclaration: vi.fn() }));
import { app } from "../../src/app.js";
import { organizationService } from "../../src/modules/organization/organization.service.js";
import { treatmentCaseService } from "../../src/modules/treatment-cases/treatment-case.service.js";
import { listDeclarationCandidates } from "../../src/modules/declarations/declaration-candidates.service.js";
import { changeDraftDeclaration } from "../../src/modules/declarations/declaration-draft.service.js";

describe("NEG-FUNC mounted HTTP contracts with explicit service/auth doubles", () => {
  beforeEach(() => { state.roles = []; state.permissions = []; });
  it("uses permissions independently of role names for organization read/update", async () => {
    state.roles = ["ADMIN"];
    await request(app).get("/api/v1/organization").set("Authorization","Bearer qa").expect(403);
    state.roles = []; state.permissions = ["organization.read"];
    vi.mocked(organizationService.get).mockResolvedValue({ id: "2" } as Awaited<ReturnType<typeof organizationService.get>>);
    await request(app).get("/api/v1/organization").set("Authorization","Bearer qa").expect(200);
    await request(app).patch("/api/v1/organization").set("Authorization","Bearer qa").send({ reason: "QA", phone: "QA", expectedRevision: "a".repeat(64) }).expect(403);
    state.permissions = ["organization.update"];
    vi.mocked(organizationService.update).mockResolvedValue({ id: "2" } as Awaited<ReturnType<typeof organizationService.update>>);
    await request(app).patch("/api/v1/organization").set("Authorization","Bearer qa").send({ reason: "QA", phone: "QA", expectedRevision: "a".repeat(64) }).expect(200);
    expect(organizationService.update).toHaveBeenCalledWith(expect.objectContaining({ phone: "QA" }), expect.objectContaining({ organizationId: 2n, roles: [] }), expect.any(Object));
  });
  it("requires both read permissions for candidates and keeps string identities in the envelope", async () => {
    state.permissions = ["declaration.read"];
    await request(app).get("/api/v1/declarations/3/candidates").set("Authorization","Bearer qa").expect(403);
    state.permissions = ["declaration.read","invoice.read"];
    vi.mocked(listDeclarationCandidates).mockResolvedValue({ candidates: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } });
    await request(app).get("/api/v1/declarations/9007199254740993/candidates").set("Authorization","Bearer qa").expect(200);
    expect(listDeclarationCandidates).toHaveBeenCalledWith(9007199254740993n, expect.objectContaining({ page: 1 }), expect.objectContaining({ organizationId: 2n }));
  });
  it("transports the mandatory JSON reason on Draft DELETE and rejects foreign/system fields", async () => {
    state.permissions = ["declaration.update"];
    vi.mocked(changeDraftDeclaration).mockResolvedValue({ id: "3" } as Awaited<ReturnType<typeof changeDraftDeclaration>>);
    await request(app).delete("/api/v1/declarations/3/items/4").set("Authorization","Bearer qa").send({ reason: " QA remove " }).expect(200);
    expect(changeDraftDeclaration).toHaveBeenCalledWith(3n,4n,"QA remove",expect.objectContaining({ organizationId: 2n }),expect.any(Object));
    await request(app).post("/api/v1/declarations/3/cancel").set("Authorization","Bearer qa").send({ reason: "QA", organizationId: "9" }).expect(400);
  });
  it("mounts merged patient params and never grants treatment management from read permission", async () => {
    state.permissions = ["treatment_case.read"];
    vi.mocked(treatmentCaseService.list).mockResolvedValue({ cases: [], pagination: { page: 1,pageSize: 20,total: 0,totalPages: 0 } });
    await request(app).get("/api/v1/patients/5/treatment-cases").set("Authorization","Bearer qa").expect(200);
    expect(treatmentCaseService.list).toHaveBeenCalledWith(5n,expect.any(Object),expect.objectContaining({ organizationId: 2n }));
    await request(app).post("/api/v1/patients/5/treatment-cases").set("Authorization","Bearer qa").send({ treatmentId: "00123" }).expect(403);
    state.permissions = ["treatment_case.manage"];
    vi.mocked(treatmentCaseService.create).mockResolvedValue({ id: "6", treatmentId: "00123" } as Awaited<ReturnType<typeof treatmentCaseService.create>>);
    const result = await request(app).post("/api/v1/patients/5/treatment-cases").set("Authorization","Bearer qa").send({ treatmentId: "00123" }).expect(201);
    expect(result.body.data.treatmentId).toBe("00123");
    await request(app).get("/api/v1/patients/5/treatment-cases").set("Authorization","Bearer qa").expect(403);
  });
  it("publishes the mounted routes and server diagnostic enums in OpenAPI", async () => {
    const result = await request(app).get("/api/openapi.json").expect(200);
    for (const path of ["/api/v1/organization", "/api/v1/declarations/{id}/candidates", "/api/v1/declarations/{id}/items/{itemId}",
      "/api/v1/declarations/{id}/cancel", "/api/v1/patients/{patientId}/treatment-cases", "/api/v1/patients/{patientId}/treatment-cases/{caseId}"]) {
      expect(result.body.paths[path]).toBeDefined();
    }
    expect(JSON.stringify(result.body.components.schemas.DeclarationCandidate)).toContain("DECLARATION_SVB_DATA_INCOMPLETE");
    expect(JSON.stringify(result.body.components.schemas.TreatmentCase)).toContain("isEditable");
  });
});
