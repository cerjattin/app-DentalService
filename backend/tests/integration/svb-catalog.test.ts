import request from "supertest";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { app } from "../../src/app.js";
import { prisma } from "../../src/infrastructure/database/prisma.js";
import { accessTokenService } from "../../src/modules/auth/access-token.service.js";
import { svbCatalogService } from "../../src/modules/svb-catalog/svb-catalog.service.js";
import { auditService } from "../../src/modules/audit/audit.service.js";
import { parseDateOnly } from "../../src/shared/utils/date-only.js";

const ADMIN_EMAIL = "svb.catalog.admin.integration@local.invalid";
const RECEPTION_EMAIL = "svb.catalog.reception.integration@local.invalid";
const PROVIDER_EMAIL = "svb.catalog.provider.integration@local.invalid";
const NO_ROLE_EMAIL = "svb.catalog.norole.integration@local.invalid";

let organizationId: bigint;
let adminUserId: bigint;
let adminToken: string;
let receptionToken: string;
let providerToken: string;
let noRoleToken: string;
let mainProcedureId: bigint;
let inactiveProcedureId: bigint;
let futureProcedureId: bigint;
let otherProcedureId: bigint;
let ambiguousProcedureId: bigint;

async function cleanupSvbCatalogFixture() {
  const procedures = await prisma.svbProcedure.findMany({
    where: {
      code: {
        startsWith: "TEST-SVB-PROC",
      },
    },
    select: {
      id: true,
    },
  });

  const procedureIds = procedures.map((procedure) => procedure.id);

  await prisma.svbTariff.deleteMany({
    where: {
      svbProcedureId: {
        in: procedureIds,
      },
    },
  });

  await prisma.svbProcedure.deleteMany({
    where: {
      id: {
        in: procedureIds,
      },
    },
  });

  const users = await prisma.user.findMany({
    where: {
      email: {
        in: [ADMIN_EMAIL, RECEPTION_EMAIL, PROVIDER_EMAIL, NO_ROLE_EMAIL],
      },
    },
    select: {
      id: true,
    },
  });

  const userIds = users.map((user) => user.id);

  await prisma.auditLog.deleteMany({
    where: {
      actorUserId: {
        in: userIds,
      },
    },
  });

  await prisma.userRole.deleteMany({
    where: {
      userId: {
        in: userIds,
      },
    },
  });

  await prisma.user.deleteMany({
    where: {
      id: {
        in: userIds,
      },
    },
  });
}

async function createUser(email: string, roleCode?: string) {
  const user = await prisma.user.create({
    data: {
      organizationId,
      email,
      passwordHash: "not-used-for-token-fixture",
      firstName: "SVB",
      lastName: roleCode ?? "NoRole",
      status: "ACTIVE",
    },
    select: {
      id: true,
    },
  });

  if (roleCode !== undefined) {
    const role = await prisma.role.findUniqueOrThrow({
      where: {
        code: roleCode,
      },
      select: {
        id: true,
      },
    });

    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: role.id,
      },
    });
  }

  return user.id;
}

async function createProcedure(input: {
  code: string;
  description: string;
  category?: string;
  requiresAuthorization?: boolean;
  requiresReferral?: boolean;
  isActive?: boolean;
  validFrom?: Date | null;
  validTo?: Date | null;
}) {
  const procedure = await prisma.svbProcedure.create({
    data: {
      code: input.code,
      description: input.description,
      category: input.category ?? "TEST-SVB-CAT",
      unit: "VISIT",
      requiresAuthorization: input.requiresAuthorization ?? false,
      requiresReferral: input.requiresReferral ?? false,
      isActive: input.isActive ?? true,
      validFrom: input.validFrom ?? new Date("2026-01-01T00:00:00.000Z"),
      validTo: input.validTo ?? new Date("2026-12-31T00:00:00.000Z"),
    },
    select: {
      id: true,
    },
  });

  return procedure.id;
}

async function createTariff(input: {
  procedureId: bigint;
  amount: string;
  currencyCode?: string;
  validFrom: Date;
  validTo?: Date | null;
  isActive?: boolean;
}) {
  const tariff = await prisma.svbTariff.create({
    data: {
      svbProcedureId: input.procedureId,
      amount: input.amount,
      currencyCode: input.currencyCode ?? "ANG",
      validFrom: input.validFrom,
      validTo: input.validTo ?? null,
      isActive: input.isActive ?? true,
    },
    select: {
      id: true,
    },
  });

  return tariff.id;
}

function applicableTariffUrl(
  procedureId: bigint,
  serviceDate: string,
  currencyCode = "ANG",
) {
  return `/api/v1/svb-procedures/${procedureId.toString()}/applicable-tariff?serviceDate=${serviceDate}&currencyCode=${currencyCode}`;
}

describe("SVB catalog API", () => {
  beforeAll(async () => {
    await cleanupSvbCatalogFixture();

    const organization = await prisma.organization.findFirstOrThrow({
      where: {
        legalName: "Odontho Services B.V.",
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    organizationId = organization.id;

    adminUserId = await createUser(ADMIN_EMAIL, "ADMIN");
    const receptionUserId = await createUser(RECEPTION_EMAIL, "RECEPTION");
    const providerUserId = await createUser(PROVIDER_EMAIL, "PROVIDER");
    const noRoleUserId = await createUser(NO_ROLE_EMAIL);

    adminToken = await accessTokenService.sign(adminUserId, organizationId);
    receptionToken = await accessTokenService.sign(
      receptionUserId,
      organizationId,
    );
    providerToken = await accessTokenService.sign(
      providerUserId,
      organizationId,
    );
    noRoleToken = await accessTokenService.sign(noRoleUserId, organizationId);

    mainProcedureId = await createProcedure({
      code: "TEST-SVB-PROC-001",
      description: "TEST SVB restorative procedure",
      category: "TEST-SVB-RESTORATIVE",
      requiresAuthorization: true,
    });

    await createProcedure({
      code: "TEST-SVB-PROC-REFERRAL",
      description: "TEST SVB referral procedure",
      category: "TEST-SVB-REFERRAL",
      requiresReferral: true,
    });

    inactiveProcedureId = await createProcedure({
      code: "TEST-SVB-PROC-INACTIVE",
      description: "TEST SVB inactive procedure",
      isActive: false,
    });

    futureProcedureId = await createProcedure({
      code: "TEST-SVB-PROC-FUTURE",
      description: "TEST SVB future procedure",
      validFrom: new Date("2027-01-01T00:00:00.000Z"),
      validTo: new Date("2027-12-31T00:00:00.000Z"),
    });

    otherProcedureId = await createProcedure({
      code: "TEST-SVB-PROC-OTHER",
      description: "TEST SVB other procedure",
    });

    ambiguousProcedureId = await createProcedure({
      code: "TEST-SVB-PROC-AMBIGUOUS",
      description: "TEST SVB ambiguous tariffs",
    });

    await createTariff({
      procedureId: mainProcedureId,
      amount: "1234.50",
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
      validTo: new Date("2026-06-30T00:00:00.000Z"),
    });

    await createTariff({
      procedureId: mainProcedureId,
      amount: "1400.00",
      validFrom: new Date("2026-07-01T00:00:00.000Z"),
      validTo: new Date("2026-12-31T00:00:00.000Z"),
    });

    await createTariff({
      procedureId: mainProcedureId,
      amount: "9999.00",
      validFrom: new Date("2027-01-01T00:00:00.000Z"),
      validTo: null,
    });

    await createTariff({
      procedureId: mainProcedureId,
      amount: "1111.00",
      validFrom: new Date("2025-01-01T00:00:00.000Z"),
      validTo: new Date("2025-12-31T00:00:00.000Z"),
    });

    await createTariff({
      procedureId: mainProcedureId,
      amount: "2222.00",
      validFrom: new Date("2026-03-01T00:00:00.000Z"),
      validTo: new Date("2026-03-31T00:00:00.000Z"),
      isActive: false,
    });

    await createTariff({
      procedureId: mainProcedureId,
      amount: "2000.00",
      currencyCode: "USD",
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
      validTo: new Date("2026-12-31T00:00:00.000Z"),
    });

    await createTariff({
      procedureId: otherProcedureId,
      amount: "3333.00",
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
      validTo: new Date("2026-12-31T00:00:00.000Z"),
    });

    await createTariff({
      procedureId: ambiguousProcedureId,
      amount: "10.00",
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
      validTo: new Date("2026-12-31T00:00:00.000Z"),
    });

    await createTariff({
      procedureId: ambiguousProcedureId,
      amount: "20.00",
      validFrom: new Date("2026-06-01T00:00:00.000Z"),
      validTo: new Date("2027-05-31T00:00:00.000Z"),
    });
  });

  afterAll(async () => {
    await cleanupSvbCatalogFixture();

    await prisma.$disconnect();
  });

  it("requires authentication and svb_procedure.read", async () => {
    await request(app).get("/api/v1/svb-procedures").expect(401);

    await request(app)
      .get("/api/v1/svb-procedures")
      .set("Authorization", `Bearer ${noRoleToken}`)
      .expect(403)
      .expect((response) => {
        expect(response.body.error.code).toBe("PERMISSION_DENIED");
      });
  });

  it("allows RECEPTION and PROVIDER read according to seed permissions", async () => {
    await request(app)
      .get("/api/v1/svb-procedures?q=TEST-SVB-PROC-001")
      .set("Authorization", `Bearer ${receptionToken}`)
      .expect(200);

    await request(app)
      .get(`/api/v1/svb-procedures/${mainProcedureId.toString()}/tariffs`)
      .set("Authorization", `Bearer ${providerToken}`)
      .expect(200);
  });

  it("lists procedures with pagination, search, filters, and date validity", async () => {
    const byCode = await request(app)
      .get("/api/v1/svb-procedures?q=TEST-SVB-PROC-001&page=1&pageSize=1")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(byCode.body.data).toHaveLength(1);
    expect(byCode.body.data[0].id).toBe(mainProcedureId.toString());
    expect(typeof byCode.body.data[0].id).toBe("string");
    expect(byCode.body.meta.total).toBeGreaterThanOrEqual(1);

    const byDescription = await request(app)
      .get("/api/v1/svb-procedures?q=referral%20procedure")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(
      byDescription.body.data.some(
        (procedure: { code: string }) =>
          procedure.code === "TEST-SVB-PROC-REFERRAL",
      ),
    ).toBe(true);

    const byCategory = await request(app)
      .get("/api/v1/svb-procedures?category=TEST-SVB-RESTORATIVE")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(byCategory.body.data[0].code).toBe("TEST-SVB-PROC-001");

    const byAuthorization = await request(app)
      .get("/api/v1/svb-procedures?requiresAuthorization=true")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(
      byAuthorization.body.data.some(
        (procedure: { code: string }) =>
          procedure.code === "TEST-SVB-PROC-001",
      ),
    ).toBe(true);

    const byReferral = await request(app)
      .get("/api/v1/svb-procedures?requiresReferral=true")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(
      byReferral.body.data.some(
        (procedure: { code: string }) =>
          procedure.code === "TEST-SVB-PROC-REFERRAL",
      ),
    ).toBe(true);

    const inactive = await request(app)
      .get("/api/v1/svb-procedures?isActive=false")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(
      inactive.body.data.some(
        (procedure: { code: string }) =>
          procedure.code === "TEST-SVB-PROC-INACTIVE",
      ),
    ).toBe(true);

    const validOnDate = await request(app)
      .get("/api/v1/svb-procedures?serviceDate=2026-08-01&q=TEST-SVB-PROC")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(
      validOnDate.body.data.some(
        (procedure: { code: string }) =>
          procedure.code === "TEST-SVB-PROC-FUTURE",
      ),
    ).toBe(false);
  });

  it("gets procedure detail and rejects missing or invalid ids", async () => {
    const detail = await request(app)
      .get(`/api/v1/svb-procedures/${mainProcedureId.toString()}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(detail.body.data).toMatchObject({
      id: mainProcedureId.toString(),
      code: "TEST-SVB-PROC-001",
      validFrom: "2026-01-01",
      validTo: "2026-12-31",
    });

    await request(app)
      .get("/api/v1/svb-procedures/not-a-number")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(400)
      .expect((response) => {
        expect(response.body.error.code).toBe("INVALID_ID");
      });

    await request(app)
      .get("/api/v1/svb-procedures/999999999999")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(404)
      .expect((response) => {
        expect(response.body.error.code).toBe("SVB_PROCEDURE_NOT_FOUND");
      });
  });

  it("lists tariff history with filters and exact decimal strings", async () => {
    const history = await request(app)
      .get(
        `/api/v1/svb-procedures/${mainProcedureId.toString()}/tariffs?currencyCode=ang&page=1&pageSize=2`,
      )
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(history.body.data).toHaveLength(2);
    expect(history.body.data[0].svbProcedureId).toBe(
      mainProcedureId.toString(),
    );
    expect(typeof history.body.data[0].id).toBe("string");
    expect(typeof history.body.data[0].amount).toBe("string");
    expect(history.body.data.some((tariff: { amount: string }) => tariff.amount === "1234.50")).toBe(
      false,
    );

    const validOnBoundary = await request(app)
      .get(
        `/api/v1/svb-procedures/${mainProcedureId.toString()}/tariffs?currencyCode=ANG&serviceDate=2026-06-30&isActive=true`,
      )
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(
      validOnBoundary.body.data.some(
        (tariff: { amount: string }) => tariff.amount === "1234.50",
      ),
    ).toBe(true);
  });

  it("resolves applicable tariffs with inclusive boundaries", async () => {
    const validToInclusive = await request(app)
      .get(applicableTariffUrl(mainProcedureId, "2026-06-30"))
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(validToInclusive.body.data.tariff.amount).toBe("1234.50");
    expect(validToInclusive.body.data.serviceDate).toBe("2026-06-30");

    const validFromInclusive = await request(app)
      .get(applicableTariffUrl(mainProcedureId, "2026-07-01"))
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(validFromInclusive.body.data.tariff.amount).toBe("1400.00");
    expect(validFromInclusive.body.data.tariff.amount).not.toBe("1234.5");
  });

  it("does not select future, expired, inactive, other currency, or other procedure tariffs", async () => {
    const marchLookup = await request(app)
      .get(applicableTariffUrl(mainProcedureId, "2026-03-15"))
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(marchLookup.body.data.tariff.amount).toBe("1234.50");
    expect(marchLookup.body.data.tariff.amount).not.toBe("2222.00");
    expect(marchLookup.body.data.tariff.amount).not.toBe("9999.00");
    expect(marchLookup.body.data.tariff.amount).not.toBe("1111.00");
    expect(marchLookup.body.data.tariff.amount).not.toBe("3333.00");

    const usdLookup = await request(app)
      .get(applicableTariffUrl(mainProcedureId, "2026-03-15", "USD"))
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(usdLookup.body.data.tariff.amount).toBe("2000.00");
  });

  it("returns controlled errors for missing tariff and invalid query values", async () => {
    await request(app)
      .get(applicableTariffUrl(mainProcedureId, "2026-08-01", "EUR"))
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(404)
      .expect((response) => {
        expect(response.body.error.code).toBe("SVB_TARIFF_NOT_FOUND");
      });

    await request(app)
      .get(
        `/api/v1/svb-procedures/${mainProcedureId.toString()}/applicable-tariff?serviceDate=2026-02-30&currencyCode=ANG`,
      )
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(400);

    await request(app)
      .get(applicableTariffUrl(mainProcedureId, "2026-08-01", "AN"))
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(400);
  });

  it("rejects inactive, outside validity, missing, and ambiguous procedures", async () => {
    await request(app)
      .get(applicableTariffUrl(inactiveProcedureId, "2026-08-01"))
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("SVB_PROCEDURE_INACTIVE");
      });

    await request(app)
      .get(applicableTariffUrl(futureProcedureId, "2026-08-01"))
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("SVB_PROCEDURE_NOT_VALID");
      });

    await request(app)
      .get(applicableTariffUrl(999999999999n, "2026-08-01"))
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(404)
      .expect((response) => {
        expect(response.body.error.code).toBe("SVB_PROCEDURE_NOT_FOUND");
      });

    await request(app)
      .get(applicableTariffUrl(ambiguousProcedureId, "2026-08-01"))
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("SVB_TARIFF_AMBIGUOUS");
      });
  });

  it("requires svb_tariff.read for tariff endpoints", async () => {
    await request(app)
      .get(`/api/v1/svb-procedures/${mainProcedureId.toString()}/tariffs`)
      .set("Authorization", `Bearer ${noRoleToken}`)
      .expect(403)
      .expect((response) => {
        expect(response.body.error.code).toBe("PERMISSION_DENIED");
      });
  });

  it("exposes the internal resolver for future encounter procedure usage", async () => {
    const result = await svbCatalogService.resolveApplicableTariff({
      svbProcedureId: mainProcedureId,
      serviceDate: parseDateOnly("2026-07-01", "serviceDate"),
      currencyCode: "ANG",
    });

    expect(result.procedure.id).toBe(mainProcedureId.toString());
    expect(result.tariff.amount).toBe("1400.00");
  });
  let sequence = 0;
  async function newMaster(extra: Record<string, unknown> = {}) {
    const response = await request(app)
      .post("/api/v1/svb-procedures")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        code: `TEST-SVB-PROC-M02R-${++sequence}`,
        description: "M02R fixture",
        ...extra,
      })
      .expect(201);
    return response.body.data as { id: string; code: string };
  }
  const tariffInput = {
    amount: "88.80",
    currencyCode: "ANG",
    validFrom: "2026-01-01",
    validTo: "2026-06-30",
  };
  async function newTariff(id: string, extra: Record<string, unknown> = {}) {
    const response = await request(app)
      .post(`/api/v1/svb-procedures/${id}/tariffs`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...tariffInput, ...extra })
      .expect(201);
    return response.body.data as { id: string; amount: string };
  }
  const mutations = [
    {
      method: "post",
      path: "",
      body: { code: "TEST-SVB-PROC-DENIED", description: "Denied" },
      permission: "svb_procedure.manage",
    },
    {
      method: "patch",
      path: "/1",
      body: { description: "Denied" },
      permission: "svb_procedure.manage",
    },
    {
      method: "patch",
      path: "/1/status",
      body: { isActive: false },
      permission: "svb_procedure.manage",
    },
    {
      method: "post",
      path: "/1/tariffs",
      body: tariffInput,
      permission: "svb_tariff.manage",
    },
    {
      method: "patch",
      path: "/1/tariffs/1",
      body: { amount: "88.80" },
      permission: "svb_tariff.manage",
    },
  ] as const;
  it.each(mutations)(
    "requires authentication for $method $path",
    async ({ method, path, body }) => {
      await request(app)
        [method](`/api/v1/svb-procedures${path}`)
        .send(body)
        .expect(401);
    },
  );
  it.each(mutations)(
    "read does not imply $permission for $method $path",
    async ({ method, path, body, permission }) => {
      const response = await request(app)
        [method](`/api/v1/svb-procedures${path}`)
        .set("Authorization", `Bearer ${receptionToken}`)
        .send(body)
        .expect(403);
      expect(response.body.error).toMatchObject({
        code: "PERMISSION_DENIED",
        details: { requiredPermission: permission },
      });
    },
  );
  it("creates and updates all mutable procedure fields with string IDs and nullable bounds", async () => {
    const master = await newMaster({
      category: "M02R",
      unit: "VISIT",
      requiresAuthorization: true,
      requiresReferral: true,
      isActive: false,
      validFrom: "2026-01-01",
      validTo: null,
    });
    expect(typeof master.id).toBe("string");
    const response = await request(app)
      .patch(`/api/v1/svb-procedures/${master.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        code: master.code + "-EDIT",
        description: "Changed",
        category: null,
        unit: null,
        requiresAuthorization: false,
        requiresReferral: false,
        isActive: true,
        validFrom: null,
        validTo: "2026-12-31",
      })
      .expect(200);
    expect(response.body.data).toMatchObject({
      id: master.id,
      code: master.code + "-EDIT",
      description: "Changed",
      category: null,
      unit: null,
      requiresAuthorization: false,
      requiresReferral: false,
      isActive: true,
      validFrom: null,
      validTo: "2026-12-31",
    });
    const logs = await prisma.auditLog.findMany({
      where: { entityType: "SVB_PROCEDURE", entityId: BigInt(master.id) },
      orderBy: { id: "asc" },
    });
    expect(logs.map((log) => log.action)).toEqual([
      "SVB_PROCEDURE_CREATE",
      "SVB_PROCEDURE_UPDATE",
    ]);
    expect(logs[1]).toMatchObject({
      actorUserId: adminUserId,
      organizationId,
      oldValues: expect.objectContaining({ code: master.code }),
      newValues: expect.objectContaining({ code: master.code + "-EDIT" }),
    });
  });
  it("maps duplicate code on create and update without leaking database internals", async () => {
    const a = await newMaster();
    const b = await newMaster();
    for (const response of [
      await request(app)
        .post("/api/v1/svb-procedures")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ code: a.code, description: "Duplicate" })
        .expect(409),
      await request(app)
        .patch(`/api/v1/svb-procedures/${b.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ code: a.code })
        .expect(409),
    ]) {
      expect(response.body.error.code).toBe(
        "SVB_PROCEDURE_CODE_ALREADY_EXISTS",
      );
      expect(JSON.stringify(response.body)).not.toMatch(/Prisma|P2002|uq_svb/);
    }
  });
  it("rejects invalid procedure periods on create and merged partial update", async () => {
    const response = await request(app)
      .post("/api/v1/svb-procedures")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        code: "TEST-SVB-PROC-M02R-BAD",
        description: "Invalid",
        validFrom: "2026-07-01",
        validTo: "2026-06-30",
      })
      .expect(400);
    expect(response.body.error.code).toBe("INVALID_SVB_PROCEDURE_PERIOD");
    const master = await newMaster({ validFrom: "2026-07-01" });
    const update = await request(app)
      .patch(`/api/v1/svb-procedures/${master.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ validTo: "2026-06-30" })
      .expect(400);
    expect(update.body.error.code).toBe("INVALID_SVB_PROCEDURE_PERIOD");
  });
  it("deactivates and reactivates without deletion, excludes inactive Clinical selections, and audits status", async () => {
    const master = await newMaster();
    await newTariff(master.id);
    for (const active of [false, true]) {
      await request(app)
        .patch(`/api/v1/svb-procedures/${master.id}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isActive: active })
        .expect(200);
      const list = await request(app)
        .get(
          `/api/v1/svb-procedures?q=${master.code}&isActive=true&serviceDate=2026-03-01`,
        )
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      expect(list.body.data.length).toBe(active ? 1 : 0);
      const detail = await request(app)
        .get(`/api/v1/svb-procedures/${master.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      expect(detail.body.data.isActive).toBe(active);
      const applicable = await request(app)
        .get(applicableTariffUrl(BigInt(master.id), "2026-03-01"))
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(active ? 200 : 409);
      if (!active)
        expect(applicable.body.error.code).toBe("SVB_PROCEDURE_INACTIVE");
    }
    expect(
      await prisma.auditLog.count({
        where: {
          entityType: "SVB_PROCEDURE",
          entityId: BigInt(master.id),
          action: "SVB_PROCEDURE_UPDATE",
        },
      }),
    ).toBe(2);
    await request(app)
      .delete(`/api/v1/svb-procedures/${master.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(404);
  });
  it("applies validity only when serviceDate is supplied", async () => {
    const master = await newMaster({ validFrom: "2030-01-01" });
    const base = `/api/v1/svb-procedures?q=${master.code}&isActive=true`;
    const unfiltered = await request(app)
      .get(base)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(unfiltered.body.data).toHaveLength(1);
    const clinical = await request(app)
      .get(base + "&serviceDate=2026-01-01")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(clinical.body.data).toHaveLength(0);
  });
  it("creates/updates exact Decimal strings and audits both tariff mutations", async () => {
    const master = await newMaster();
    const tariff = await newTariff(master.id);
    expect(tariff.amount).toBe("88.80");
    const response = await request(app)
      .patch(`/api/v1/svb-procedures/${master.id}/tariffs/${tariff.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        amount: "9999999999999.99",
        currencyCode: "usd",
        validFrom: "2026-02-01",
        validTo: null,
        isActive: false,
      })
      .expect(200);
    expect(response.body.data).toMatchObject({
      id: tariff.id,
      svbProcedureId: master.id,
      amount: "9999999999999.99",
      currencyCode: "USD",
      validTo: null,
      isActive: false,
    });
    const rows = await prisma.auditLog.findMany({
      where: { entityType: "SVB_TARIFF", entityId: BigInt(tariff.id) },
      orderBy: { id: "asc" },
    });
    expect(rows.map((row) => row.action)).toEqual([
      "SVB_TARIFF_CREATE",
      "SVB_TARIFF_UPDATE",
    ]);
    expect(rows[1]).toMatchObject({
      actorUserId: adminUserId,
      oldValues: expect.objectContaining({ amount: "88.80" }),
      newValues: expect.objectContaining({ amount: "9999999999999.99" }),
    });
    await request(app)
      .delete(`/api/v1/svb-procedures/${master.id}/tariffs/${tariff.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(404);
  });
  it("rejects invalid tariff periods on create and merged partial update", async () => {
    const master = await newMaster();
    const bad = await request(app)
      .post(`/api/v1/svb-procedures/${master.id}/tariffs`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...tariffInput, validTo: "2025-12-31" })
      .expect(400);
    expect(bad.body.error.code).toBe("INVALID_SVB_TARIFF_PERIOD");
    const tariff = await newTariff(master.id);
    const update = await request(app)
      .patch(`/api/v1/svb-procedures/${master.id}/tariffs/${tariff.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ validFrom: "2026-07-01" })
      .expect(400);
    expect(update.body.error.code).toBe("INVALID_SVB_TARIFF_PERIOD");
  });
  it("rejects duplicate starts, inclusive overlap, overlapping update and activation; permits adjacent periods and other currency", async () => {
    const master = await newMaster();
    await newTariff(master.id);
    const base = `/api/v1/svb-procedures/${master.id}/tariffs`;
    const duplicate = await request(app)
      .post(base)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(tariffInput)
      .expect(409);
    expect(duplicate.body.error.code).toBe("SVB_TARIFF_ALREADY_EXISTS");
    const overlap = await request(app)
      .post(base)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...tariffInput, validFrom: "2026-06-30", validTo: null })
      .expect(409);
    expect(overlap.body.error.code).toBe("SVB_TARIFF_PERIOD_OVERLAP");
    const next = await newTariff(master.id, {
      validFrom: "2026-07-01",
      validTo: null,
    });
    const duplicateUpdate = await request(app)
      .patch(`${base}/${next.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ validFrom: "2026-01-01" })
      .expect(409);
    expect(duplicateUpdate.body.error.code).toBe("SVB_TARIFF_ALREADY_EXISTS");
    const update = await request(app)
      .patch(`${base}/${next.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ validFrom: "2026-06-29" })
      .expect(409);
    expect(update.body.error.code).toBe("SVB_TARIFF_PERIOD_OVERLAP");
    const inactive = await newTariff(master.id, {
      validFrom: "2026-02-01",
      isActive: false,
    });
    const activation = await request(app)
      .patch(`${base}/${inactive.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: true })
      .expect(409);
    expect(activation.body.error.code).toBe("SVB_TARIFF_PERIOD_OVERLAP");
    await newTariff(master.id, { currencyCode: "USD" });
  });
  it("serializes competing tariff creates so at most one overlapping period commits", async () => {
    const master = await newMaster();
    const responses = await Promise.all(
      ["2026-01-01", "2026-02-01"].map((validFrom) =>
        request(app)
          .post(`/api/v1/svb-procedures/${master.id}/tariffs`)
          .set("Authorization", `Bearer ${adminToken}`)
          .send({ ...tariffInput, validFrom }),
      ),
    );
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    expect(
      responses.find((response) => response.status === 409)?.body.error.code,
    ).toBe("SVB_TARIFF_PERIOD_OVERLAP");
  });
  it("returns domain not-found for missing procedure on all mutation paths", async () => {
    for (const operation of [
      {
        method: "patch",
        path: "/999999999999",
        body: { description: "Missing" },
      },
      {
        method: "patch",
        path: "/999999999999/status",
        body: { isActive: false },
      },
      { method: "post", path: "/999999999999/tariffs", body: tariffInput },
    ] as const) {
      const response = await request(app)
        [operation.method](`/api/v1/svb-procedures${operation.path}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send(operation.body)
        .expect(404);
      expect(response.body.error.code).toBe("SVB_PROCEDURE_NOT_FOUND");
    }
  });
  it("rejects missing and foreign-parent tariffs without changing their amounts", async () => {
    const a = await newMaster();
    const b = await newMaster();
    const tariff = await newTariff(a.id);
    for (const id of [tariff.id, "999999999999"]) {
      const response = await request(app)
        .patch(`/api/v1/svb-procedures/${b.id}/tariffs/${id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ amount: "99.99" })
        .expect(404);
      expect(response.body.error.code).toBe("SVB_TARIFF_NOT_FOUND");
    }
    expect(
      (
        await prisma.svbTariff.findUniqueOrThrow({
          where: { id: BigInt(tariff.id) },
        })
      ).amount.toFixed(2),
    ).toBe("88.80");
  });
  it("rolls back procedure and tariff creates/updates/status when transactional audit fails", async () => {
    const master = await newMaster();
    const tariff = await newTariff(master.id);
    const beforeProcedure = await prisma.svbProcedure.findUniqueOrThrow({
      where: { id: BigInt(master.id) },
    });
    const beforeTariff = await prisma.svbTariff.findUniqueOrThrow({
      where: { id: BigInt(tariff.id) },
    });
    const beforeLogs = await prisma.auditLog.count({
      where: { actorUserId: adminUserId },
    });
    const writeAudit = auditService.writeWithinTransaction.bind(auditService);
    const spy = vi
      .spyOn(auditService, "writeWithinTransaction")
      .mockImplementation(async (tx, event) => {
        await writeAudit(tx, event);
        throw new Error("TEST failure after inserting audit record");
      });
    try {
      await request(app)
        .post("/api/v1/svb-procedures")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ code: "TEST-SVB-PROC-M02R-ROLLBACK", description: "Rollback" })
        .expect(500);
      await request(app)
        .patch(`/api/v1/svb-procedures/${master.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ description: "Rollback" })
        .expect(500);
      await request(app)
        .patch(`/api/v1/svb-procedures/${master.id}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isActive: false })
        .expect(500);
      await request(app)
        .post(`/api/v1/svb-procedures/${master.id}/tariffs`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ ...tariffInput, currencyCode: "USD" })
        .expect(500);
      await request(app)
        .patch(`/api/v1/svb-procedures/${master.id}/tariffs/${tariff.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ amount: "99.99" })
        .expect(500);
    } finally {
      spy.mockRestore();
    }
    expect(
      await prisma.svbProcedure.findUnique({
        where: { code: "TEST-SVB-PROC-M02R-ROLLBACK" },
      }),
    ).toBeNull();
    expect(
      await prisma.svbProcedure.findUniqueOrThrow({
        where: { id: BigInt(master.id) },
      }),
    ).toEqual(beforeProcedure);
    expect(
      await prisma.svbTariff.findUniqueOrThrow({
        where: { id: BigInt(tariff.id) },
      }),
    ).toEqual(beforeTariff);
    expect(
      await prisma.svbTariff.count({
        where: { svbProcedureId: BigInt(master.id) },
      }),
    ).toBe(1);
    expect(
      await prisma.auditLog.count({ where: { actorUserId: adminUserId } }),
    ).toBe(beforeLogs);
  });
});
