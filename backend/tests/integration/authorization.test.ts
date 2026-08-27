import request from "supertest";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { app } from "../../src/app.js";
import { Prisma } from "../../src/generated/prisma/client.js";
import { prisma } from "../../src/infrastructure/database/prisma.js";
import { accessTokenService } from "../../src/modules/auth/access-token.service.js";
import { authorizationService } from "../../src/modules/authorizations/authorization.service.js";
import { parseDateOnly } from "../../src/shared/utils/date-only.js";

const ADMIN_EMAIL = "authorization.admin.integration@local.invalid";
const RECEPTION_EMAIL = "authorization.reception.integration@local.invalid";
const PROVIDER_EMAIL = "authorization.provider.integration@local.invalid";
const NO_ROLE_EMAIL = "authorization.norole.integration@local.invalid";
const OTHER_ORG_EMAIL = "authorization.other.integration@local.invalid";
const OTHER_ORG_LEGAL_NAME = "TEST Authorization Other Organization";

let organizationId: bigint;
let otherOrganizationId: bigint;
let payerId: bigint;
let adminUserId: bigint;
let receptionUserId: bigint;
let providerUserId: bigint;
let adminToken: string;
let receptionToken: string;
let providerToken: string;
let noRoleToken: string;
let patientId: bigint;
let secondPatientId: bigint;
let otherOrganizationPatientId: bigint;
let insuranceId: bigint;
let secondInsuranceId: bigint;
let otherPatientInsuranceId: bigint;
let procedureId: bigint;
let secondProcedureId: bigint;
let authorizationId: string;
let authorizationPk: bigint;
let authorizationItemPk: bigint;

async function cleanupAuthorizationFixture() {
  const users = await prisma.user.findMany({
    where: {
      email: {
        in: [
          ADMIN_EMAIL,
          RECEPTION_EMAIL,
          PROVIDER_EMAIL,
          NO_ROLE_EMAIL,
          OTHER_ORG_EMAIL,
        ],
      },
    },
    select: {
      id: true,
    },
  });
  const userIds = users.map((user) => user.id);

  const authorizations = await prisma.svbAuthorization.findMany({
    where: {
      OR: [
        {
          authorizationId: {
            startsWith: "TEST-AUTH-",
          },
        },
        {
          patient: {
            patientNumber: {
              startsWith: "TEST-AUTH-PAT",
            },
          },
        },
        {
          patient: {
            organization: {
              legalName: OTHER_ORG_LEGAL_NAME,
            },
          },
        },
      ],
    },
    select: {
      id: true,
    },
  });
  const authorizationIds = authorizations.map(
    (authorization) => authorization.id,
  );

  const items = await prisma.svbAuthorizationItem.findMany({
    where: {
      authorizationId: {
        in: authorizationIds,
      },
    },
    select: {
      id: true,
    },
  });
  const itemIds = items.map((item) => item.id);

  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        {
          actorUserId: {
            in: userIds,
          },
        },
        {
          entityType: {
            in: ["SVB_AUTHORIZATION", "SVB_AUTHORIZATION_ITEM"],
          },
          entityId: {
            in: [...authorizationIds, ...itemIds],
          },
        },
        {
          entityKey: {
            contains: "TEST-AUTH-",
          },
        },
      ],
    },
  });

  await prisma.svbAuthorizationItem.deleteMany({
    where: {
      authorizationId: {
        in: authorizationIds,
      },
    },
  });

  await prisma.svbAuthorization.deleteMany({
    where: {
      id: {
        in: authorizationIds,
      },
    },
  });

  await prisma.patientInsurance.deleteMany({
    where: {
      insuredId: {
        startsWith: "TEST-AUTH-INS",
      },
    },
  });

  await prisma.patient.deleteMany({
    where: {
      OR: [
        {
          patientNumber: {
            startsWith: "TEST-AUTH-PAT",
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

  await prisma.svbProcedure.deleteMany({
    where: {
      code: {
        startsWith: "TEST-AUTH-PROC",
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

  await prisma.organization.deleteMany({
    where: {
      legalName: OTHER_ORG_LEGAL_NAME,
    },
  });
}

async function createUser(email: string, roleCode?: string, orgId = organizationId) {
  const user = await prisma.user.create({
    data: {
      organizationId: orgId,
      email,
      passwordHash: "not-used-for-token-fixture",
      firstName: "Authorization",
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

async function createPatient(patientNumber: string, orgId = organizationId) {
  const patient = await prisma.patient.create({
    data: {
      organizationId: orgId,
      patientNumber,
      firstName: "Authorization",
      lastName: "Patient",
      status: "ACTIVE",
    },
    select: {
      id: true,
    },
  });

  return patient.id;
}

async function createInsurance(patient: bigint, insuredId: string) {
  const insurance = await prisma.patientInsurance.create({
    data: {
      patientId: patient,
      payerId,
      insuredId,
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
      validTo: new Date("2026-12-31T00:00:00.000Z"),
      status: "ACTIVE",
      isPrimary: true,
    },
    select: {
      id: true,
    },
  });

  return insurance.id;
}

async function createProcedure(code: string) {
  const procedure = await prisma.svbProcedure.create({
    data: {
      code,
      description: `TEST Authorization procedure ${code}`,
      category: "TEST-AUTH-CAT",
      unit: "VISIT",
      requiresAuthorization: true,
      requiresReferral: false,
      isActive: true,
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
      validTo: new Date("2026-12-31T00:00:00.000Z"),
    },
    select: {
      id: true,
    },
  });

  return procedure.id;
}

async function createAuthorizationFixture(input: {
  patient: bigint;
  insurance: bigint;
  externalId: string;
  status?: "PENDING" | "APPROVED" | "PARTIALLY_USED" | "EXHAUSTED" | "EXPIRED" | "CANCELLED";
  validFrom?: Date | null;
  validTo?: Date | null;
}) {
  const authorization = await prisma.svbAuthorization.create({
    data: {
      patientId: input.patient,
      patientInsuranceId: input.insurance,
      authorizationId: input.externalId,
      status: input.status ?? "APPROVED",
      validFrom:
        input.validFrom === undefined
          ? new Date("2026-01-01T00:00:00.000Z")
          : input.validFrom,
      validTo:
        input.validTo === undefined
          ? new Date("2026-12-31T00:00:00.000Z")
          : input.validTo,
      issuedAt: new Date("2026-01-02T10:00:00.000Z"),
      notes: "TEST-AUTH fixture",
      createdByUserId: adminUserId,
    },
    select: {
      id: true,
    },
  });

  return authorization.id;
}

async function createItemFixture(input: {
  authorization: bigint;
  procedure?: bigint | null;
  authorizedQuantity?: string | null;
  usedQuantity?: string;
  validFrom?: Date | null;
  validTo?: Date | null;
}) {
  const procedure =
    input.procedure === undefined || input.procedure === null
      ? null
      : await prisma.svbProcedure.findUniqueOrThrow({
          where: {
            id: input.procedure,
          },
          select: {
            code: true,
          },
        });

  const item = await prisma.svbAuthorizationItem.create({
    data: {
      authorizationId: input.authorization,
      svbProcedureId: input.procedure ?? null,
      procedureCodeSnapshot: procedure?.code ?? null,
      authorizedQuantity:
        input.authorizedQuantity === undefined
          ? "3.50"
          : input.authorizedQuantity,
      usedQuantity: input.usedQuantity ?? "1.25",
      validFrom:
        input.validFrom === undefined
          ? new Date("2026-01-01T00:00:00.000Z")
          : input.validFrom,
      validTo:
        input.validTo === undefined
          ? new Date("2026-12-31T00:00:00.000Z")
          : input.validTo,
      notes: "TEST-AUTH item fixture",
    },
    select: {
      id: true,
    },
  });

  return item.id;
}

function authBody(externalId: string, insId = insuranceId, patId = patientId) {
  return {
    patientId: patId.toString(),
    patientInsuranceId: insId.toString(),
    authorizationId: externalId,
    status: "APPROVED",
    validFrom: "2026-01-01",
    validTo: "2026-12-31",
    issuedAt: "2026-01-02T10:00:00.000Z",
    notes: "TEST-AUTH created",
    metadata: {
      source: "integration",
    },
  };
}

describe("SVB Authorization API", () => {
  beforeAll(async () => {
    await cleanupAuthorizationFixture();

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

    const payer = await prisma.payer.findFirstOrThrow({
      where: {
        isActive: true,
      },
      select: {
        id: true,
      },
    });
    payerId = payer.id;

    const otherOrganization = await prisma.organization.create({
      data: {
        legalName: OTHER_ORG_LEGAL_NAME,
        tradeName: "TEST Authorization Other Org",
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
    receptionUserId = await createUser(RECEPTION_EMAIL, "RECEPTION");
    providerUserId = await createUser(PROVIDER_EMAIL, "PROVIDER");
    const noRoleUserId = await createUser(NO_ROLE_EMAIL);
    await createUser(OTHER_ORG_EMAIL, undefined, otherOrganizationId);

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

    patientId = await createPatient("TEST-AUTH-PAT-001");
    secondPatientId = await createPatient("TEST-AUTH-PAT-002");
    otherOrganizationPatientId = await createPatient(
      "TEST-AUTH-PAT-OTHER",
      otherOrganizationId,
    );
    insuranceId = await createInsurance(patientId, "TEST-AUTH-INS-001");
    secondInsuranceId = await createInsurance(patientId, "TEST-AUTH-INS-002");
    otherPatientInsuranceId = await createInsurance(
      secondPatientId,
      "TEST-AUTH-INS-OTHER-PATIENT",
    );
    await createInsurance(
      otherOrganizationPatientId,
      "TEST-AUTH-INS-OTHER-ORG",
    );

    procedureId = await createProcedure("TEST-AUTH-PROC-001");
    secondProcedureId = await createProcedure("TEST-AUTH-PROC-002");

    authorizationPk = await createAuthorizationFixture({
      patient: patientId,
      insurance: insuranceId,
      externalId: "TEST-AUTH-BASE",
    });
    authorizationId = authorizationPk.toString();
    authorizationItemPk = await createItemFixture({
      authorization: authorizationPk,
      procedure: procedureId,
    });
  });

  afterAll(async () => {
    await cleanupAuthorizationFixture();

    await prisma.$disconnect();
  });

  it("requires authentication and enforces authorization permissions", async () => {
    await request(app).get("/api/v1/authorizations").expect(401);

    await request(app)
      .get("/api/v1/authorizations")
      .set("Authorization", `Bearer ${noRoleToken}`)
      .expect(403);

    await request(app)
      .post("/api/v1/authorizations")
      .set("Authorization", `Bearer ${providerToken}`)
      .send(authBody("TEST-AUTH-PROVIDER-DENIED"))
      .expect(403);

    await request(app)
      .patch(`/api/v1/authorizations/${authorizationId}`)
      .set("Authorization", `Bearer ${providerToken}`)
      .send({ notes: "denied" })
      .expect(403);
  });

  it("allows RECEPTION read/create/update and PROVIDER read", async () => {
    await request(app)
      .get("/api/v1/authorizations")
      .set("Authorization", `Bearer ${providerToken}`)
      .expect(200);

    const created = await request(app)
      .post("/api/v1/authorizations")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send(authBody("TEST-AUTH-RBAC"))
      .expect(201);

    await request(app)
      .patch(`/api/v1/authorizations/${created.body.data.id}`)
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({ notes: "TEST-AUTH reception update" })
      .expect(200);
  });

  it("creates authorization with actor-derived createdByUserId and date validation", async () => {
    const created = await request(app)
      .post("/api/v1/authorizations")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(authBody("TEST-AUTH-CREATE"))
      .expect(201);

    expect(created.body.data).toMatchObject({
      patientId: patientId.toString(),
      patientInsuranceId: insuranceId.toString(),
      authorizationId: "TEST-AUTH-CREATE",
      status: "APPROVED",
      validFrom: "2026-01-01",
      validTo: "2026-12-31",
      createdByUserId: adminUserId.toString(),
    });
    expect(typeof created.body.data.id).toBe("string");

    await request(app)
      .post("/api/v1/authorizations")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        ...authBody("TEST-AUTH-BAD-PERIOD"),
        validFrom: "2026-12-31",
        validTo: "2026-01-01",
      })
      .expect(400)
      .expect((response) => {
        expect(response.body.error.code).toBe("INVALID_AUTHORIZATION_PERIOD");
      });
  });

  it("rejects patient, insurance, mismatch, cross-org, and duplicate authorization cases", async () => {
    await request(app)
      .post("/api/v1/authorizations")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(authBody("TEST-AUTH-NO-PATIENT", insuranceId, 999999999999n))
      .expect(404)
      .expect((response) => {
        expect(response.body.error.code).toBe("PATIENT_NOT_FOUND");
      });

    await request(app)
      .post("/api/v1/authorizations")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(authBody("TEST-AUTH-NO-INSURANCE", 999999999999n))
      .expect(404)
      .expect((response) => {
        expect(response.body.error.code).toBe("INSURANCE_NOT_FOUND");
      });

    await request(app)
      .post("/api/v1/authorizations")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(authBody("TEST-AUTH-MISMATCH", otherPatientInsuranceId))
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe(
          "AUTHORIZATION_INSURANCE_PATIENT_MISMATCH",
        );
      });

    await request(app)
      .post("/api/v1/authorizations")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(
        authBody(
          "TEST-AUTH-CROSS-ORG",
          otherPatientInsuranceId,
          otherOrganizationPatientId,
        ),
      )
      .expect(404);

    await request(app)
      .post("/api/v1/authorizations")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(authBody("TEST-AUTH-BASE"))
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("AUTHORIZATION_ALREADY_EXISTS");
      });

    await request(app)
      .post("/api/v1/authorizations")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(authBody("TEST-AUTH-BASE", secondInsuranceId))
      .expect(201);
  });

  it("lists, filters, searches, and gets authorization detail", async () => {
    const list = await request(app)
      .get(
        `/api/v1/authorizations?patientId=${patientId.toString()}&patientInsuranceId=${insuranceId.toString()}&status=APPROVED&serviceDate=2026-08-01&q=TEST-AUTH-BASE&page=1&pageSize=1`,
      )
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].id).toBe(authorizationId);
    expect(list.body.meta.total).toBeGreaterThanOrEqual(1);

    const detail = await request(app)
      .get(`/api/v1/authorizations/${authorizationId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(detail.body.data.patient.id).toBe(patientId.toString());
    expect(detail.body.data.patientInsurance.id).toBe(insuranceId.toString());
    expect(detail.body.data.items[0].id).toBe(authorizationItemPk.toString());

    await request(app)
      .get("/api/v1/authorizations/not-a-number")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(400);

    await request(app)
      .get("/api/v1/authorizations/999999999999")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(404);
  });

  it("patches authorization while keeping identity fields immutable", async () => {
    const response = await request(app)
      .patch(`/api/v1/authorizations/${authorizationId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        patientId: secondPatientId.toString(),
        authorizationId: "SHOULD-NOT-CHANGE",
        status: "EXPIRED",
        validTo: "2026-12-30",
        notes: "TEST-AUTH updated",
        metadata: {
          corrected: true,
        },
      })
      .expect(200);

    expect(response.body.data).toMatchObject({
      id: authorizationId,
      patientId: patientId.toString(),
      authorizationId: "TEST-AUTH-BASE",
      status: "EXPIRED",
      validTo: "2026-12-30",
      notes: "TEST-AUTH updated",
    });

    await request(app)
      .patch(`/api/v1/authorizations/${authorizationId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "PARTIALLY_USED" })
      .expect(400);
  });

  it("creates and lists authorization items with procedure snapshots and Decimal strings", async () => {
    await request(app)
      .patch(`/api/v1/authorizations/${authorizationId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "APPROVED", validTo: "2026-12-31" })
      .expect(200);

    const specific = await request(app)
      .post(`/api/v1/authorizations/${authorizationId}/items`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        svbProcedureId: secondProcedureId.toString(),
        authorizedQuantity: "2.00",
        validFrom: "2026-01-01",
        validTo: "2026-12-31",
        notes: "TEST-AUTH specific",
        usedQuantity: "9.99",
        procedureCodeSnapshot: "CLIENT-VALUE",
      })
      .expect(201);

    expect(specific.body.data).toMatchObject({
      svbProcedureId: secondProcedureId.toString(),
      procedureCodeSnapshot: "TEST-AUTH-PROC-002",
      authorizedQuantity: "2.00",
      usedQuantity: "0.00",
      remainingQuantity: "2.00",
    });

    const generic = await request(app)
      .post(`/api/v1/authorizations/${authorizationId}/items`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        svbProcedureId: null,
        authorizedQuantity: null,
        notes: "TEST-AUTH generic",
      })
      .expect(201);

    expect(generic.body.data).toMatchObject({
      svbProcedureId: null,
      procedureCodeSnapshot: null,
      authorizedQuantity: null,
      remainingQuantity: null,
    });

    const list = await request(app)
      .get(`/api/v1/authorizations/${authorizationId}/items`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(list.body.data.length).toBeGreaterThanOrEqual(3);

    await request(app)
      .post(`/api/v1/authorizations/${authorizationId}/items`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ svbProcedureId: "999999999999" })
      .expect(404)
      .expect((response) => {
        expect(response.body.error.code).toBe("SVB_PROCEDURE_NOT_FOUND");
      });
  });

  it("patches items and protects consumed quantities/history", async () => {
    const patchItem = await createItemFixture({
      authorization: authorizationPk,
      procedure: procedureId,
      authorizedQuantity: "3.50",
      usedQuantity: "1.25",
    });

    const updated = await request(app)
      .patch(`/api/v1/authorizations/${authorizationId}/items/${patchItem.toString()}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        authorizedQuantity: "3.00",
        validFrom: "2026-02-01",
        notes: "TEST-AUTH item updated",
        usedQuantity: "0.00",
      })
      .expect(200);

    expect(updated.body.data).toMatchObject({
      id: patchItem.toString(),
      authorizedQuantity: "3.00",
      usedQuantity: "1.25",
      remainingQuantity: "1.75",
      validFrom: "2026-02-01",
    });

    await request(app)
      .patch(`/api/v1/authorizations/${authorizationId}/items/${patchItem.toString()}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ authorizedQuantity: "1.00" })
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe(
          "AUTHORIZATION_QUANTITY_EXCEEDED",
        );
      });

    await request(app)
      .patch(`/api/v1/authorizations/${authorizationId}/items/${patchItem.toString()}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ svbProcedureId: secondProcedureId.toString() })
      .expect(409);

    await request(app)
      .patch(`/api/v1/authorizations/${authorizationId}/items/${patchItem.toString()}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ validFrom: "2026-12-31", validTo: "2026-01-01" })
      .expect(400)
      .expect((response) => {
        expect(response.body.error.code).toBe(
          "INVALID_AUTHORIZATION_ITEM_PERIOD",
        );
      });
  });

  it("resolves applicable authorization items and never consumes quantity", async () => {
    const before = await prisma.svbAuthorizationItem.findUniqueOrThrow({
      where: {
        id: authorizationItemPk,
      },
      select: {
        usedQuantity: true,
      },
    });

    const result = await authorizationService.resolveApplicableAuthorizationItem({
      patientId,
      patientInsuranceId: insuranceId,
      svbProcedureId: procedureId,
      authorizationItemId: authorizationItemPk,
      serviceDate: parseDateOnly("2026-01-01", "serviceDate"),
      requestedQuantity: "2.25",
    });

    expect(result.remainingQuantity).toBe("2.25");

    const after = await prisma.svbAuthorizationItem.findUniqueOrThrow({
      where: {
        id: authorizationItemPk,
      },
      select: {
        usedQuantity: true,
      },
    });

    expect(after.usedQuantity.toFixed(2)).toBe(before.usedQuantity.toFixed(2));
  });

  it("accepts PARTIALLY_USED and generic unlimited items in the resolver", async () => {
    const partialAuthorization = await createAuthorizationFixture({
      patient: patientId,
      insurance: insuranceId,
      externalId: "TEST-AUTH-PARTIAL",
      status: "PARTIALLY_USED",
    });
    const genericItem = await createItemFixture({
      authorization: partialAuthorization,
      procedure: null,
      authorizedQuantity: null,
      usedQuantity: "0.00",
    });

    const result = await authorizationService.resolveApplicableAuthorizationItem({
      patientId,
      patientInsuranceId: insuranceId,
      svbProcedureId: secondProcedureId,
      authorizationItemId: genericItem,
      serviceDate: parseDateOnly("2026-12-31", "serviceDate"),
      requestedQuantity: new Prisma.Decimal("99.99"),
    });

    expect(result.svbProcedureId).toBeNull();
    expect(result.remainingQuantity).toBeNull();
  });

  it("rejects non-usable authorization statuses in the resolver", async () => {
    for (const status of ["PENDING", "EXHAUSTED", "EXPIRED", "CANCELLED"] as const) {
      const auth = await createAuthorizationFixture({
        patient: patientId,
        insurance: insuranceId,
        externalId: `TEST-AUTH-${status}`,
        status,
      });
      const item = await createItemFixture({
        authorization: auth,
        procedure: procedureId,
        usedQuantity: status === "EXHAUSTED" ? "3.50" : "0.00",
      });

      await expect(
        authorizationService.resolveApplicableAuthorizationItem({
          patientId,
          patientInsuranceId: insuranceId,
          svbProcedureId: procedureId,
          authorizationItemId: item,
          serviceDate: parseDateOnly("2026-08-01", "serviceDate"),
          requestedQuantity: "1.00",
        }),
      ).rejects.toMatchObject({
        code: "AUTHORIZATION_NOT_USABLE",
      });
    }
  });

  it("rejects resolver patient, insurance, date, procedure, and quantity mismatches", async () => {
    await expect(
      authorizationService.resolveApplicableAuthorizationItem({
        patientId: secondPatientId,
        patientInsuranceId: insuranceId,
        svbProcedureId: procedureId,
        authorizationItemId: authorizationItemPk,
        serviceDate: parseDateOnly("2026-08-01", "serviceDate"),
        requestedQuantity: "1.00",
      }),
    ).rejects.toMatchObject({ code: "AUTHORIZATION_PATIENT_MISMATCH" });

    await expect(
      authorizationService.resolveApplicableAuthorizationItem({
        patientId,
        patientInsuranceId: secondInsuranceId,
        svbProcedureId: procedureId,
        authorizationItemId: authorizationItemPk,
        serviceDate: parseDateOnly("2026-08-01", "serviceDate"),
        requestedQuantity: "1.00",
      }),
    ).rejects.toMatchObject({ code: "AUTHORIZATION_INSURANCE_MISMATCH" });

    await expect(
      authorizationService.resolveApplicableAuthorizationItem({
        patientId,
        patientInsuranceId: insuranceId,
        svbProcedureId: procedureId,
        authorizationItemId: authorizationItemPk,
        serviceDate: parseDateOnly("2027-01-01", "serviceDate"),
        requestedQuantity: "1.00",
      }),
    ).rejects.toMatchObject({ code: "AUTHORIZATION_NOT_VALID" });

    const shortItem = await createItemFixture({
      authorization: authorizationPk,
      procedure: procedureId,
      validFrom: new Date("2026-02-01T00:00:00.000Z"),
      validTo: new Date("2026-02-28T00:00:00.000Z"),
    });

    await expect(
      authorizationService.resolveApplicableAuthorizationItem({
        patientId,
        patientInsuranceId: insuranceId,
        svbProcedureId: procedureId,
        authorizationItemId: shortItem,
        serviceDate: parseDateOnly("2026-03-01", "serviceDate"),
        requestedQuantity: "1.00",
      }),
    ).rejects.toMatchObject({ code: "AUTHORIZATION_ITEM_NOT_VALID" });

    await expect(
      authorizationService.resolveApplicableAuthorizationItem({
        patientId,
        patientInsuranceId: insuranceId,
        svbProcedureId: secondProcedureId,
        authorizationItemId: authorizationItemPk,
        serviceDate: parseDateOnly("2026-08-01", "serviceDate"),
        requestedQuantity: "1.00",
      }),
    ).rejects.toMatchObject({ code: "AUTHORIZATION_PROCEDURE_MISMATCH" });

    await expect(
      authorizationService.resolveApplicableAuthorizationItem({
        patientId,
        patientInsuranceId: insuranceId,
        svbProcedureId: procedureId,
        authorizationItemId: authorizationItemPk,
        serviceDate: parseDateOnly("2026-08-01", "serviceDate"),
        requestedQuantity: "2.26",
      }),
    ).rejects.toMatchObject({ code: "AUTHORIZATION_QUANTITY_EXCEEDED" });
  });

  it("rejects ambiguous automatic resolver selection", async () => {
    const ambiguousAuthorization = await createAuthorizationFixture({
      patient: patientId,
      insurance: insuranceId,
      externalId: "TEST-AUTH-AMBIGUOUS",
    });
    await createItemFixture({
      authorization: ambiguousAuthorization,
      procedure: secondProcedureId,
      authorizedQuantity: "5.00",
      usedQuantity: "0.00",
    });
    await createItemFixture({
      authorization: ambiguousAuthorization,
      procedure: null,
      authorizedQuantity: "5.00",
      usedQuantity: "0.00",
    });

    await expect(
      authorizationService.resolveApplicableAuthorizationItem({
        patientId,
        patientInsuranceId: insuranceId,
        svbProcedureId: secondProcedureId,
        serviceDate: parseDateOnly("2026-08-01", "serviceDate"),
        requestedQuantity: "1.00",
      }),
    ).rejects.toMatchObject({ code: "AUTHORIZATION_ITEM_AMBIGUOUS" });
  });

  it("writes audit logs for authorization and item mutations", async () => {
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entityType: {
          in: ["SVB_AUTHORIZATION", "SVB_AUTHORIZATION_ITEM"],
        },
        entityKey: {
          contains: "TEST-AUTH",
        },
      },
      select: {
        action: true,
        actorUserId: true,
        entityId: true,
        entityKey: true,
        oldValues: true,
        newValues: true,
        correlationId: true,
      },
    });

    expect(auditLogs.map((auditLog) => auditLog.action)).toEqual(
      expect.arrayContaining([
        "AUTHORIZATION_CREATE",
        "AUTHORIZATION_UPDATE",
        "AUTHORIZATION_ITEM_CREATE",
        "AUTHORIZATION_ITEM_UPDATE",
      ]),
    );
    expect(auditLogs.some((auditLog) => auditLog.actorUserId !== null)).toBe(
      true,
    );
    expect(auditLogs.some((auditLog) => auditLog.entityId !== null)).toBe(true);
    expect(auditLogs.some((auditLog) => auditLog.entityKey !== null)).toBe(true);
    expect(auditLogs.some((auditLog) => auditLog.newValues !== null)).toBe(true);
    expect(auditLogs.some((auditLog) => auditLog.oldValues !== null)).toBe(true);
    expect(auditLogs.some((auditLog) => auditLog.correlationId !== null)).toBe(
      true,
    );
  });
});
