import request from "supertest";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { app } from "../../src/app.js";

import { prisma } from "../../src/infrastructure/database/prisma.js";

import { accessTokenService } from "../../src/modules/auth/access-token.service.js";

const ADMIN_EMAIL = "provider.admin.integration@local.invalid";
const PROVIDER_EMAIL = "provider.provider.integration@local.invalid";
const NO_ROLE_EMAIL = "provider.norole.integration@local.invalid";
const LINKED_USER_EMAIL = "provider.linked.integration@local.invalid";
const SECOND_LINKED_USER_EMAIL = "provider.second-linked.integration@local.invalid";
const OTHER_ORG_USER_EMAIL = "provider.other-org.integration@local.invalid";
const OTHER_ORG_LEGAL_NAME = "TEST Provider Other Organization";

let organizationId: bigint;
let otherOrganizationId: bigint;
let adminUserId: bigint;
let providerRoleUserId: bigint;
let noRoleUserId: bigint;
let linkedUserId: bigint;
let secondLinkedUserId: bigint;
let otherOrganizationUserId: bigint;
let adminToken: string;
let providerToken: string;
let noRoleToken: string;
let providerWithoutUserId: string;
let linkedProviderId: string;

async function cleanupProviderFixture() {
  const users = await prisma.user.findMany({
    where: {
      email: {
        in: [
          ADMIN_EMAIL,
          PROVIDER_EMAIL,
          NO_ROLE_EMAIL,
          LINKED_USER_EMAIL,
          SECOND_LINKED_USER_EMAIL,
          OTHER_ORG_USER_EMAIL,
        ],
      },
    },

    select: {
      id: true,
    },
  });

  const userIds = users.map((user) => user.id);

  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        {
          actorUserId: {
            in: userIds,
          },
        },
        {
          entityType: "PROVIDER",
          entityKey: {
            startsWith: "TEST-PROV",
          },
        },
        {
          organization: {
            legalName: OTHER_ORG_LEGAL_NAME,
          },
        },
      ],
    },
  });

  await prisma.provider.deleteMany({
    where: {
      OR: [
        {
          svbProviderId: {
            startsWith: "TEST-PROV",
          },
        },
        {
          licenseNumber: {
            startsWith: "TEST-LIC",
          },
        },
        {
          userId: {
            in: userIds,
          },
        },
        {
          organization: {
            legalName: OTHER_ORG_LEGAL_NAME,
          },
        },
      ],
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

  await prisma.organization.deleteMany({
    where: {
      legalName: OTHER_ORG_LEGAL_NAME,
    },
  });
}

async function createUser(email: string, roleCode?: string) {
  const user = await prisma.user.create({
    data: {
      organizationId,
      email,
      passwordHash: "not-used-for-token-fixture",
      firstName: "Provider",
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

describe("Providers API", () => {
  beforeAll(async () => {
    await cleanupProviderFixture();

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

    const otherOrganization = await prisma.organization.create({
      data: {
        legalName: OTHER_ORG_LEGAL_NAME,
        tradeName: "TEST Provider Other Org",
        countryCode: "CW",
        timezone: "America/Curacao",
        isActive: true,
      },

      select: {
        id: true,
      },
    });

    otherOrganizationId = otherOrganization.id;

    adminUserId = await createUser(ADMIN_EMAIL, "ADMIN");
    providerRoleUserId = await createUser(PROVIDER_EMAIL, "PROVIDER");
    noRoleUserId = await createUser(NO_ROLE_EMAIL);
    linkedUserId = await createUser(LINKED_USER_EMAIL);
    secondLinkedUserId = await createUser(SECOND_LINKED_USER_EMAIL);

    const otherOrganizationUser = await prisma.user.create({
      data: {
        organizationId: otherOrganizationId,
        email: OTHER_ORG_USER_EMAIL,
        passwordHash: "not-used-for-token-fixture",
        firstName: "Other",
        lastName: "Organization",
        status: "ACTIVE",
      },

      select: {
        id: true,
      },
    });

    otherOrganizationUserId = otherOrganizationUser.id;

    adminToken = await accessTokenService.sign(adminUserId, organizationId);
    providerToken = await accessTokenService.sign(
      providerRoleUserId,
      organizationId,
    );
    noRoleToken = await accessTokenService.sign(noRoleUserId, organizationId);
  });

  afterAll(async () => {
    await cleanupProviderFixture();

    await prisma.$disconnect();
  });

  it("returns 401 without a token", async () => {
    const response = await request(app).get("/api/v1/providers").expect(401);

    expect(response.body.error.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("requires provider.read for GET providers", async () => {
    const response = await request(app)
      .get("/api/v1/providers")
      .set("Authorization", `Bearer ${noRoleToken}`)
      .expect(403);

    expect(response.body.error.code).toBe("PERMISSION_DENIED");
  });

  it("requires provider.create for POST providers", async () => {
    const response = await request(app)
      .post("/api/v1/providers")
      .set("Authorization", `Bearer ${providerToken}`)
      .send({
        firstName: "Denied",
        lastName: "Create",
      })
      .expect(403);

    expect(response.body.error.code).toBe("PERMISSION_DENIED");
  });

  it("creates a provider without userId or svbProviderId", async () => {
    const response = await request(app)
      .post("/api/v1/providers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        userId: null,
        svbProviderId: null,
        firstName: "Test",
        lastName: "NoSvb",
        licenseNumber: "TEST-LIC-NOSVB",
        specialty: "General Dentistry",
        email: "test.nosvb.provider@local.invalid",
        phone: "555-0100",
      })
      .expect(201);

    expect(response.body.data.id).toEqual(expect.any(String));
    expect(response.body.data.organizationId).toBe(organizationId.toString());
    expect(response.body.data.userId).toBeNull();
    expect(response.body.data.user).toBeNull();
    expect(response.body.data.svbProviderId).toBeNull();
    expect(response.body.data.isActive).toBe(true);

    providerWithoutUserId = response.body.data.id;
  });

  it("creates a provider linked to a user", async () => {
    const response = await request(app)
      .post("/api/v1/providers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        userId: linkedUserId.toString(),
        svbProviderId: "TEST-PROV-001",
        firstName: "Maria",
        lastName: "Martina",
        licenseNumber: "TEST-LIC-001",
        specialty: "Orthodontics",
        email: "maria.provider@local.invalid",
        phone: "555-0101",
        isActive: true,
      })
      .expect(201);

    expect(response.body.data.id).toEqual(expect.any(String));
    expect(response.body.data.userId).toBe(linkedUserId.toString());
    expect(response.body.data.user.id).toBe(linkedUserId.toString());
    expect(response.body.data.svbProviderId).toBe("TEST-PROV-001");

    linkedProviderId = response.body.data.id;
  });

  it("gets provider detail by id", async () => {
    const response = await request(app)
      .get(`/api/v1/providers/${linkedProviderId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.data.id).toBe(linkedProviderId);
    expect(response.body.data.user.email).toBe(LINKED_USER_EMAIL);
    expect(response.body.data.user.passwordHash).toBeUndefined();
  });

  it("lists providers with pagination", async () => {
    await request(app)
      .post("/api/v1/providers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        svbProviderId: "TEST-PROV-002",
        firstName: "Ana",
        lastName: "Pagination",
        licenseNumber: "TEST-LIC-002",
      })
      .expect(201);

    const response = await request(app)
      .get("/api/v1/providers?page=1&pageSize=2")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.data).toHaveLength(2);
    expect(response.body.meta.page).toBe(1);
    expect(response.body.meta.pageSize).toBe(2);
    expect(response.body.meta.total).toBeGreaterThanOrEqual(3);
  });

  it("searches by name, svbProviderId, and licenseNumber", async () => {
    const byName = await request(app)
      .get("/api/v1/providers?q=Maria")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(byName.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: linkedProviderId,
        }),
      ]),
    );

    const bySvbProviderId = await request(app)
      .get("/api/v1/providers?q=TEST-PROV-001")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(bySvbProviderId.body.data[0].id).toBe(linkedProviderId);

    const byLicense = await request(app)
      .get("/api/v1/providers?q=TEST-LIC-001")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(byLicense.body.data[0].id).toBe(linkedProviderId);
  });

  it("patches provider fields and toggles isActive", async () => {
    const response = await request(app)
      .patch(`/api/v1/providers/${linkedProviderId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        specialty: "Pediatric Dentistry",
        phone: "555-0199",
        isActive: false,
      })
      .expect(200);

    expect(response.body.data.specialty).toBe("Pediatric Dentistry");
    expect(response.body.data.phone).toBe("555-0199");
    expect(response.body.data.isActive).toBe(false);

    const activeAgain = await request(app)
      .patch(`/api/v1/providers/${linkedProviderId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        isActive: true,
      })
      .expect(200);

    expect(activeAgain.body.data.isActive).toBe(true);
  });

  it("requires provider.update for PATCH providers", async () => {
    const response = await request(app)
      .patch(`/api/v1/providers/${linkedProviderId}`)
      .set("Authorization", `Bearer ${providerToken}`)
      .send({
        phone: "555-0000",
      })
      .expect(403);

    expect(response.body.error.code).toBe("PERMISSION_DENIED");
  });

  it("returns 404 for missing providers", async () => {
    const response = await request(app)
      .get("/api/v1/providers/999999999999")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(404);

    expect(response.body.error.code).toBe("PROVIDER_NOT_FOUND");
  });

  it("returns 400 for invalid provider ids", async () => {
    const response = await request(app)
      .get("/api/v1/providers/not-a-number")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(400);

    expect(response.body.error.code).toBe("INVALID_ID");
  });

  it("rejects duplicate svbProviderId in the same organization", async () => {
    const response = await request(app)
      .post("/api/v1/providers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        svbProviderId: "TEST-PROV-001",
        firstName: "Duplicate",
        lastName: "Provider",
      })
      .expect(409);

    expect(response.body.error.code).toBe(
      "PROVIDER_SVB_ID_ALREADY_EXISTS",
    );
  });

  it("rejects userId already associated to another provider", async () => {
    const response = await request(app)
      .post("/api/v1/providers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        userId: linkedUserId.toString(),
        svbProviderId: "TEST-PROV-USER-DUP",
        firstName: "Duplicate",
        lastName: "User",
      })
      .expect(409);

    expect(response.body.error.code).toBe(
      "USER_ALREADY_LINKED_TO_PROVIDER",
    );
  });

  it("rejects a userId from another organization", async () => {
    const response = await request(app)
      .post("/api/v1/providers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        userId: otherOrganizationUserId.toString(),
        svbProviderId: "TEST-PROV-OTHER-ORG",
        firstName: "Other",
        lastName: "Organization",
      })
      .expect(404);

    expect(response.body.error.code).toBe("USER_NOT_FOUND");
  });

  it("can relink provider to another valid user", async () => {
    const response = await request(app)
      .patch(`/api/v1/providers/${linkedProviderId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        userId: secondLinkedUserId.toString(),
      })
      .expect(200);

    expect(response.body.data.userId).toBe(secondLinkedUserId.toString());
    expect(response.body.data.user.id).toBe(secondLinkedUserId.toString());
  });

  it("writes provider create and update audits", async () => {
    const audits = await prisma.auditLog.findMany({
      where: {
        actorUserId: adminUserId,
        entityType: "PROVIDER",
        action: {
          in: ["PROVIDER_CREATE", "PROVIDER_UPDATE"],
        },
      },

      select: {
        action: true,
        oldValues: true,
        newValues: true,
      },
    });

    expect(audits.map((audit) => audit.action)).toEqual(
      expect.arrayContaining(["PROVIDER_CREATE", "PROVIDER_UPDATE"]),
    );

    expect(
      audits.find((audit) => audit.action === "PROVIDER_CREATE")?.newValues,
    ).not.toBeNull();

    expect(
      audits.find((audit) => audit.action === "PROVIDER_UPDATE")?.oldValues,
    ).not.toBeNull();
  });
});
