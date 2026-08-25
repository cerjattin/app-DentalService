import request from "supertest";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { app } from "../../src/app.js";

import { prisma } from "../../src/infrastructure/database/prisma.js";

import { accessTokenService } from "../../src/modules/auth/access-token.service.js";

const RECEPTION_EMAIL = "insurance.reception.integration@local.invalid";
const PROVIDER_EMAIL = "insurance.provider.integration@local.invalid";
const PATIENT_NUMBER = "TEST-INSURANCE-001";
const SECOND_PATIENT_NUMBER = "TEST-INSURANCE-002";
const INSURED_ID = "SVB-TEST-INS-2026";

let organizationId: bigint;
let payerId: bigint;
let patientId: bigint;
let secondPatientId: bigint;
let receptionUserId: bigint;
let receptionToken: string;
let providerToken: string;
let insuranceId: string;
let nonOverlappingInsuranceId: string;
let replacementPrimaryInsuranceId: string;

async function cleanupInsuranceFixture() {
  const users = await prisma.user.findMany({
    where: {
      email: {
        in: [RECEPTION_EMAIL, PROVIDER_EMAIL],
      },
    },

    select: {
      id: true,
    },
  });

  const userIds = users.map((user) => user.id);

  const patients = await prisma.patient.findMany({
    where: {
      patientNumber: {
        in: [PATIENT_NUMBER, SECOND_PATIENT_NUMBER],
      },
    },

    select: {
      id: true,
    },
  });

  const patientIds = patients.map((patient) => patient.id);

  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        {
          actorUserId: {
            in: userIds,
          },
        },
        {
          entityType: "PATIENT_INSURANCE",
          entityKey: {
            startsWith: "SVB-TEST-INS",
          },
        },
      ],
    },
  });

  await prisma.patientInsurance.deleteMany({
    where: {
      patientId: {
        in: patientIds,
      },
    },
  });

  await prisma.patient.deleteMany({
    where: {
      id: {
        in: patientIds,
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

async function createUserWithRole(email: string, roleCode: string) {
  const role = await prisma.role.findUniqueOrThrow({
    where: {
      code: roleCode,
    },

    select: {
      id: true,
    },
  });

  const user = await prisma.user.create({
    data: {
      organizationId,
      email,
      passwordHash: "not-used-for-token-fixture",
      firstName: "Insurance",
      lastName: roleCode,
      status: "ACTIVE",
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

  return user.id;
}

describe("Patient insurance / SVB coverage API", () => {
  beforeAll(async () => {
    await cleanupInsuranceFixture();

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

    const payer = await prisma.payer.findUniqueOrThrow({
      where: {
        code: "SVB",
      },

      select: {
        id: true,
      },
    });

    payerId = payer.id;

    receptionUserId = await createUserWithRole(RECEPTION_EMAIL, "RECEPTION");
    const providerUserId = await createUserWithRole(PROVIDER_EMAIL, "PROVIDER");

    receptionToken = await accessTokenService.sign(
      receptionUserId,
      organizationId,
    );

    providerToken = await accessTokenService.sign(providerUserId, organizationId);

    const patient = await prisma.patient.create({
      data: {
        organizationId,
        patientNumber: PATIENT_NUMBER,
        firstName: "Sprint",
        lastName: "Insurance",
        status: "ACTIVE",
      },

      select: {
        id: true,
      },
    });

    const secondPatient = await prisma.patient.create({
      data: {
        organizationId,
        patientNumber: SECOND_PATIENT_NUMBER,
        firstName: "Sprint",
        lastName: "Coverage",
        status: "ACTIVE",
      },

      select: {
        id: true,
      },
    });

    patientId = patient.id;
    secondPatientId = secondPatient.id;
  });

  afterAll(async () => {
    await cleanupInsuranceFixture();

    await prisma.$disconnect();
  });

  it("returns 401 without a token", async () => {
    const response = await request(app).get("/api/v1/payers").expect(401);

    expect(response.body.error.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("lists active payers for users with insurance.read", async () => {
    const response = await request(app)
      .get("/api/v1/payers")
      .set("Authorization", `Bearer ${receptionToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);

    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: payerId.toString(),
          code: "SVB",
          payerType: "STATE_INSURANCE",
        }),
      ]),
    );

    const providerResponse = await request(app)
      .get("/api/v1/payers")
      .set("Authorization", `Bearer ${providerToken}`)
      .expect(200);

    expect(providerResponse.body.data.length).toBeGreaterThan(0);
  });

  it("creates insurance coverage as RECEPTION", async () => {
    const response = await request(app)
      .post(`/api/v1/patients/${patientId.toString()}/insurance`)
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        payerId: payerId.toString(),
        insuredId: INSURED_ID,
        validFrom: "2026-01-01",
        validTo: "2026-12-31",
        status: "ACTIVE",
        isPrimary: true,
      })
      .expect(201);

    expect(response.body.data.id).toEqual(expect.any(String));
    expect(response.body.data.patientId).toBe(patientId.toString());
    expect(response.body.data.payerId).toBe(payerId.toString());
    expect(response.body.data.insuredId).toBe(INSURED_ID);
    expect(response.body.data.validFrom).toBe("2026-01-01");
    expect(response.body.data.validTo).toBe("2026-12-31");
    expect(response.body.data.isPrimary).toBe(true);

    insuranceId = response.body.data.id;
  });

  it("lists patient insurance", async () => {
    const response = await request(app)
      .get(`/api/v1/patients/${patientId.toString()}/insurance`)
      .set("Authorization", `Bearer ${receptionToken}`)
      .expect(200);

    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: insuranceId,
          payerId: payerId.toString(),
        }),
      ]),
    );
  });

  it("gets insurance detail", async () => {
    const response = await request(app)
      .get(
        `/api/v1/patients/${patientId.toString()}/insurance/${insuranceId}`,
      )
      .set("Authorization", `Bearer ${receptionToken}`)
      .expect(200);

    expect(response.body.data.id).toBe(insuranceId);
    expect(response.body.data.payer.id).toBe(payerId.toString());
  });

  it("rejects invalid insurance periods", async () => {
    const response = await request(app)
      .post(`/api/v1/patients/${patientId.toString()}/insurance`)
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        payerId: payerId.toString(),
        insuredId: "SVB-TEST-INS-BAD-PERIOD",
        validFrom: "2027-01-01",
        validTo: "2026-12-31",
      })
      .expect(400);

    expect(response.body.error.code).toBe("INVALID_INSURANCE_PERIOD");
  });

  it("rejects invalid payers", async () => {
    const response = await request(app)
      .post(`/api/v1/patients/${patientId.toString()}/insurance`)
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        payerId: "999999999999",
        insuredId: "SVB-TEST-INS-BAD-PAYER",
        validFrom: "2027-01-01",
        validTo: "2027-12-31",
      })
      .expect(400);

    expect(response.body.error.code).toBe("INVALID_PAYER");
  });

  it("returns patient not found for another or missing patient", async () => {
    const response = await request(app)
      .get("/api/v1/patients/999999999999/insurance")
      .set("Authorization", `Bearer ${receptionToken}`)
      .expect(404);

    expect(response.body.error.code).toBe("PATIENT_NOT_FOUND");
  });

  it("returns insurance not found for missing coverage", async () => {
    const response = await request(app)
      .get(
        `/api/v1/patients/${patientId.toString()}/insurance/999999999999`,
      )
      .set("Authorization", `Bearer ${receptionToken}`)
      .expect(404);

    expect(response.body.error.code).toBe("INSURANCE_NOT_FOUND");
  });

  it("rejects overlapping equivalent periods", async () => {
    const response = await request(app)
      .post(`/api/v1/patients/${patientId.toString()}/insurance`)
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        payerId: payerId.toString(),
        insuredId: INSURED_ID,
        validFrom: "2026-06-01",
        validTo: "2027-05-31",
      })
      .expect(409);

    expect(response.body.error.code).toBe("INSURANCE_PERIOD_OVERLAP");
  });

  it("accepts non-overlapping equivalent periods", async () => {
    const response = await request(app)
      .post(`/api/v1/patients/${patientId.toString()}/insurance`)
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        payerId: payerId.toString(),
        insuredId: INSURED_ID,
        validFrom: "2027-01-01",
        validTo: "2027-12-31",
        isPrimary: false,
      })
      .expect(201);

    expect(response.body.data.validFrom).toBe("2027-01-01");

    nonOverlappingInsuranceId = response.body.data.id;
  });

  it("updates insurance coverage and audits the change", async () => {
    const response = await request(app)
      .patch(
        `/api/v1/patients/${patientId.toString()}/insurance/${nonOverlappingInsuranceId}`,
      )
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        status: "SUSPENDED",
        validTo: "2027-11-30",
      })
      .expect(200);

    expect(response.body.data.status).toBe("SUSPENDED");
    expect(response.body.data.validTo).toBe("2027-11-30");
  });

  it("replaces the previous primary coverage", async () => {
    const response = await request(app)
      .post(`/api/v1/patients/${patientId.toString()}/insurance`)
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        payerId: payerId.toString(),
        insuredId: "SVB-TEST-INS-PRIMARY",
        validFrom: "2026-01-01",
        validTo: "2026-12-31",
        isPrimary: true,
      })
      .expect(201);

    replacementPrimaryInsuranceId = response.body.data.id;

    const rows = await prisma.patientInsurance.findMany({
      where: {
        patientId,
      },

      select: {
        id: true,
        isPrimary: true,
      },
    });

    expect(rows.filter((row) => row.isPrimary)).toHaveLength(1);
    expect(
      rows.find((row) => row.id.toString() === replacementPrimaryInsuranceId)
        ?.isPrimary,
    ).toBe(true);
    expect(rows.find((row) => row.id.toString() === insuranceId)?.isPrimary).toBe(
      false,
    );
  });

  it("verifies insurance without changing status and audits verification", async () => {
    const before = await prisma.patientInsurance.findUniqueOrThrow({
      where: {
        id: BigInt(insuranceId),
      },

      select: {
        status: true,
      },
    });

    const response = await request(app)
      .post(
        `/api/v1/patients/${patientId.toString()}/insurance/${insuranceId}/verify`,
      )
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        verificationSource: "MANUAL_SVB_CHECK",
      })
      .expect(200);

    expect(response.body.data.status).toBe(before.status);
    expect(response.body.data.verifiedAt).toEqual(expect.any(String));
    expect(response.body.data.verificationSource).toBe("MANUAL_SVB_CHECK");
    expect(response.body.data.verifiedBy.id).toBe(receptionUserId.toString());
  });

  it("allows PROVIDER reads but denies mutation without permission", async () => {
    await request(app)
      .get(`/api/v1/patients/${patientId.toString()}/insurance`)
      .set("Authorization", `Bearer ${providerToken}`)
      .expect(200);

    const response = await request(app)
      .patch(
        `/api/v1/patients/${patientId.toString()}/insurance/${insuranceId}`,
      )
      .set("Authorization", `Bearer ${providerToken}`)
      .send({
        status: "ACTIVE",
      })
      .expect(403);

    expect(response.body.error.code).toBe("PERMISSION_DENIED");
  });

  it("keeps patient isolation by patientId", async () => {
    const response = await request(app)
      .get(
        `/api/v1/patients/${secondPatientId.toString()}/insurance/${insuranceId}`,
      )
      .set("Authorization", `Bearer ${receptionToken}`)
      .expect(404);

    expect(response.body.error.code).toBe("INSURANCE_NOT_FOUND");
  });

  it("writes audit logs for create, update, and verify", async () => {
    const audits = await prisma.auditLog.findMany({
      where: {
        entityType: "PATIENT_INSURANCE",
        action: {
          in: ["INSURANCE_CREATE", "INSURANCE_UPDATE", "INSURANCE_VERIFY"],
        },
        actorUserId: receptionUserId,
      },

      select: {
        action: true,
        entityKey: true,
        oldValues: true,
        newValues: true,
      },
    });

    expect(audits.map((audit) => audit.action)).toEqual(
      expect.arrayContaining([
        "INSURANCE_CREATE",
        "INSURANCE_UPDATE",
        "INSURANCE_VERIFY",
      ]),
    );

    expect(
      audits.find((audit) => audit.action === "INSURANCE_CREATE")?.newValues,
    ).not.toBeNull();

    expect(
      audits.find((audit) => audit.action === "INSURANCE_UPDATE")?.oldValues,
    ).not.toBeNull();

    expect(
      audits.find((audit) => audit.action === "INSURANCE_VERIFY")?.newValues,
    ).not.toBeNull();
  });
});
