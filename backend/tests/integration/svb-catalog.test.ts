import request from "supertest";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { app } from "../../src/app.js";
import { prisma } from "../../src/infrastructure/database/prisma.js";
import { accessTokenService } from "../../src/modules/auth/access-token.service.js";
import { svbCatalogService } from "../../src/modules/svb-catalog/svb-catalog.service.js";
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
});
