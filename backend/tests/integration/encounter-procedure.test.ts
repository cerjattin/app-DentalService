import request from "supertest";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { app } from "../../src/app.js";
import { Prisma } from "../../src/generated/prisma/client.js";
import { prisma } from "../../src/infrastructure/database/prisma.js";
import { accessTokenService } from "../../src/modules/auth/access-token.service.js";

const ADMIN_EMAIL = "encounter-procedure.admin@local.invalid";
const RECEPTION_EMAIL = "encounter-procedure.reception@local.invalid";
const PROVIDER_EMAIL = "encounter-procedure.provider@local.invalid";
const NO_ROLE_EMAIL = "encounter-procedure.norole@local.invalid";
const OTHER_ORG_LEGAL_NAME = "TEST EP Other Organization";

let organizationId: bigint;
let otherOrganizationId: bigint;
let payerId: bigint;
let adminUserId: bigint;
let providerUserId: bigint;
let adminToken: string;
let receptionToken: string;
let providerToken: string;
let noRoleToken: string;
let patientId: bigint;
let secondPatientId: bigint;
let providerId: bigint;
let locationId: bigint;
let openEncounterId: bigint;
let completedEncounterId: bigint;
let otherOrgEncounterId: bigint;
let insuranceId: bigint;
let secondPatientInsuranceId: bigint;
let inactiveInsuranceId: bigint;
let noAuthProcedureId: bigint;
let authProcedureId: bigint;
let diagnosisId: bigint;
let otherEncounterDiagnosisId: bigint;
let authorizationPk: bigint;
let authorizationItemPk: bigint;
let createdProcedureId: string;

async function cleanupEncounterProcedureFixture() {
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

  const procedures = await prisma.encounterProcedure.findMany({
    where: {
      OR: [
        {
          procedureCodeSnapshot: {
            startsWith: "TEST-EP-",
          },
        },
        {
          encounter: {
            appointment: {
              appointmentNumber: {
                startsWith: "TEST-EP-APT",
              },
            },
          },
        },
      ],
    },
    select: {
      id: true,
    },
  });
  const procedureIds = procedures.map((procedure) => procedure.id);

  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        {
          actorUserId: {
            in: userIds,
          },
        },
        {
          entityType: "ENCOUNTER_PROCEDURE",
          entityId: {
            in: procedureIds,
          },
        },
        {
          entityKey: {
            contains: "TEST-EP",
          },
        },
      ],
    },
  });

  await prisma.encounterProcedure.deleteMany({
    where: {
      id: {
        in: procedureIds,
      },
    },
  });

  const authorizations = await prisma.svbAuthorization.findMany({
    where: {
      authorizationId: {
        startsWith: "TEST-EP-AUTH",
      },
    },
    select: {
      id: true,
    },
  });
  const authorizationIds = authorizations.map(
    (authorization) => authorization.id,
  );

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

  await prisma.encounterDiagnosis.deleteMany({
    where: {
      codeSnapshot: {
        startsWith: "TEST-EP-DX",
      },
    },
  });

  const appointments = await prisma.appointment.findMany({
    where: {
      OR: [
        {
          appointmentNumber: {
            startsWith: "TEST-EP-APT",
          },
        },
        {
          organization: {
            legalName: OTHER_ORG_LEGAL_NAME,
          },
        },
      ],
    },
    select: {
      id: true,
    },
  });
  const appointmentIds = appointments.map((appointment) => appointment.id);

  await prisma.clinicalEncounter.deleteMany({
    where: {
      appointmentId: {
        in: appointmentIds,
      },
    },
  });
  await prisma.appointmentStatusHistory.deleteMany({
    where: {
      appointmentId: {
        in: appointmentIds,
      },
    },
  });
  await prisma.appointment.deleteMany({
    where: {
      id: {
        in: appointmentIds,
      },
    },
  });

  await prisma.patientInsurance.deleteMany({
    where: {
      insuredId: {
        startsWith: "TEST-EP-INS",
      },
    },
  });
  await prisma.svbTariff.deleteMany({
    where: {
      svbProcedure: {
        code: {
          startsWith: "TEST-EP-PROC",
        },
      },
    },
  });
  await prisma.svbProcedure.deleteMany({
    where: {
      code: {
        startsWith: "TEST-EP-PROC",
      },
    },
  });
  await prisma.diagnosisCode.deleteMany({
    where: {
      code: {
        startsWith: "TEST-EP-DX",
      },
    },
  });
  await prisma.provider.deleteMany({
    where: {
      svbProviderId: {
        startsWith: "TEST-EP-PROV",
      },
    },
  });
  await prisma.patient.deleteMany({
    where: {
      patientNumber: {
        startsWith: "TEST-EP-PAT",
      },
    },
  });
  await prisma.clinicLocation.deleteMany({
    where: {
      code: {
        startsWith: "TEST-EP-LOC",
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

async function createUser(email: string, roleCode?: string) {
  const user = await prisma.user.create({
    data: {
      organizationId,
      email,
      passwordHash: "not-used-for-token-fixture",
      firstName: "Encounter",
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

async function createEncounterFixture(
  suffix: string,
  status: "OPEN" | "COMPLETED",
  orgId = organizationId,
) {
  const patient = await prisma.patient.create({
    data: {
      organizationId: orgId,
      patientNumber: `TEST-EP-PAT-${suffix}`,
      firstName: "Encounter",
      lastName: "Patient",
      status: "ACTIVE",
    },
    select: {
      id: true,
    },
  });

  const location = await prisma.clinicLocation.create({
    data: {
      organizationId: orgId,
      code: `TEST-EP-LOC-${suffix}`,
      name: `TEST EP Location ${suffix}`,
      countryCode: "CW",
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  const provider = await prisma.provider.create({
    data: {
      organizationId: orgId,
      svbProviderId: `TEST-EP-PROV-${suffix}`,
      firstName: "Encounter",
      lastName: "Provider",
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  const appointment = await prisma.appointment.create({
    data: {
      organizationId: orgId,
      appointmentNumber: `TEST-EP-APT-${suffix}`,
      patientId: patient.id,
      providerId: provider.id,
      clinicLocationId: location.id,
      scheduledStartAt: new Date("2026-08-20T09:00:00-04:00"),
      scheduledEndAt: new Date("2026-08-20T09:30:00-04:00"),
      status: "IN_PROGRESS",
      startedAt: new Date(),
      createdByUserId: adminUserId,
    },
    select: {
      id: true,
      providerId: true,
    },
  });

  const encounter = await prisma.clinicalEncounter.create({
    data: {
      appointmentId: appointment.id,
      providerId: appointment.providerId,
      status,
      startedAt: new Date(),
      completedAt: status === "COMPLETED" ? new Date() : null,
      chiefComplaint: "TEST-EP complaint",
      clinicalNotes: "TEST-EP notes",
      createdByUserId: adminUserId,
    },
    select: {
      id: true,
    },
  });

  return {
    encounterId: encounter.id,
    patientId: patient.id,
  };
}

async function createProcedureFixture(input: {
  code: string;
  amount: string;
  requiresAuthorization?: boolean;
}) {
  const procedure = await prisma.svbProcedure.create({
    data: {
      code: input.code,
      description: `TEST EP procedure ${input.code}`,
      category: "TEST-EP",
      unit: "VISIT",
      requiresAuthorization: input.requiresAuthorization ?? false,
      requiresReferral: false,
      isActive: true,
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
      validTo: new Date("2026-12-31T00:00:00.000Z"),
    },
    select: {
      id: true,
    },
  });

  await prisma.svbTariff.create({
    data: {
      svbProcedureId: procedure.id,
      amount: input.amount,
      currencyCode: "ANG",
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
      validTo: new Date("2026-12-31T00:00:00.000Z"),
      isActive: true,
    },
  });

  return procedure.id;
}

async function createAuthorizationItemFixture(input: {
  externalId: string;
  authorizedQuantity: string | null;
  usedQuantity?: string;
}) {
  const authorization = await prisma.svbAuthorization.create({
    data: {
      patientId,
      patientInsuranceId: insuranceId,
      authorizationId: input.externalId,
      status: "APPROVED",
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
      validTo: new Date("2026-12-31T00:00:00.000Z"),
      issuedAt: new Date("2026-01-02T10:00:00.000Z"),
      createdByUserId: adminUserId,
    },
    select: {
      id: true,
    },
  });

  const item = await prisma.svbAuthorizationItem.create({
    data: {
      authorizationId: authorization.id,
      svbProcedureId: authProcedureId,
      procedureCodeSnapshot: "TEST-EP-PROC-AUTH",
      authorizedQuantity: input.authorizedQuantity,
      usedQuantity: input.usedQuantity ?? "0.00",
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
      validTo: new Date("2026-12-31T00:00:00.000Z"),
    },
    select: {
      id: true,
    },
  });

  return {
    authorizationId: authorization.id,
    itemId: item.id,
  };
}

function createProcedureRequest(
  encounterId: bigint,
  body: {
    patientInsuranceId?: string;
    svbProcedureId?: string;
    authorizationItemId?: string | null;
    diagnosisId?: string | null;
    quantity?: string;
    additionalNote?: string | null;
  },
  token = providerToken,
) {
  return request(app)
    .post(`/api/v1/clinical-encounters/${encounterId.toString()}/procedures`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      patientInsuranceId: insuranceId.toString(),
      svbProcedureId: noAuthProcedureId.toString(),
      quantity: "1.00",
      ...body,
    });
}

describe("Encounter Procedure API", () => {
  beforeAll(async () => {
    await cleanupEncounterProcedureFixture();

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
        tradeName: "TEST EP Other Org",
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
    const receptionUserId = await createUser(RECEPTION_EMAIL, "RECEPTION");
    providerUserId = await createUser(PROVIDER_EMAIL, "PROVIDER");
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

    const patient = await prisma.patient.create({
      data: {
        organizationId,
        patientNumber: "TEST-EP-PAT-BASE",
        firstName: "Encounter",
        lastName: "Patient",
        status: "ACTIVE",
      },
      select: {
        id: true,
      },
    });
    patientId = patient.id;
    secondPatientId = (
      await prisma.patient.create({
        data: {
          organizationId,
          patientNumber: "TEST-EP-PAT-SECOND",
          firstName: "Other",
          lastName: "Patient",
          status: "ACTIVE",
        },
        select: {
          id: true,
        },
      })
    ).id;

    const location = await prisma.clinicLocation.create({
      data: {
        organizationId,
        code: "TEST-EP-LOC-BASE",
        name: "TEST EP Base Location",
        countryCode: "CW",
        isActive: true,
      },
      select: {
        id: true,
      },
    });
    locationId = location.id;

    const provider = await prisma.provider.create({
      data: {
        organizationId,
        userId: providerUserId,
        svbProviderId: "TEST-EP-PROV-BASE",
        firstName: "Encounter",
        lastName: "Provider",
        isActive: true,
      },
      select: {
        id: true,
      },
    });
    providerId = provider.id;

    const appointment = await prisma.appointment.create({
      data: {
        organizationId,
        appointmentNumber: "TEST-EP-APT-BASE",
        patientId,
        providerId,
        clinicLocationId: locationId,
        scheduledStartAt: new Date("2026-08-20T09:00:00-04:00"),
        scheduledEndAt: new Date("2026-08-20T09:30:00-04:00"),
        status: "IN_PROGRESS",
        startedAt: new Date(),
        createdByUserId: adminUserId,
      },
      select: {
        id: true,
      },
    });

    openEncounterId = (
      await prisma.clinicalEncounter.create({
        data: {
          appointmentId: appointment.id,
          providerId,
          status: "OPEN",
          startedAt: new Date(),
          chiefComplaint: "TEST-EP complaint",
          clinicalNotes: "TEST-EP notes",
          createdByUserId: providerUserId,
        },
        select: {
          id: true,
        },
      })
    ).id;

    completedEncounterId = (
      await createEncounterFixture("COMPLETED", "COMPLETED")
    ).encounterId;
    otherOrgEncounterId = (
      await createEncounterFixture("OTHER", "OPEN", otherOrganizationId)
    ).encounterId;

    insuranceId = (
      await prisma.patientInsurance.create({
        data: {
          patientId,
          payerId,
          insuredId: "TEST-EP-INS-BASE",
          validFrom: new Date("2026-01-01T00:00:00.000Z"),
          validTo: new Date("2026-12-31T00:00:00.000Z"),
          status: "ACTIVE",
          isPrimary: true,
        },
        select: {
          id: true,
        },
      })
    ).id;
    secondPatientInsuranceId = (
      await prisma.patientInsurance.create({
        data: {
          patientId: secondPatientId,
          payerId,
          insuredId: "TEST-EP-INS-OTHER-PATIENT",
          validFrom: new Date("2026-01-01T00:00:00.000Z"),
          validTo: new Date("2026-12-31T00:00:00.000Z"),
          status: "ACTIVE",
          isPrimary: true,
        },
        select: {
          id: true,
        },
      })
    ).id;
    inactiveInsuranceId = (
      await prisma.patientInsurance.create({
        data: {
          patientId,
          payerId,
          insuredId: "TEST-EP-INS-INACTIVE",
          validFrom: new Date("2026-01-01T00:00:00.000Z"),
          validTo: new Date("2026-12-31T00:00:00.000Z"),
          status: "INACTIVE",
          isPrimary: false,
        },
        select: {
          id: true,
        },
      })
    ).id;

    noAuthProcedureId = await createProcedureFixture({
      code: "TEST-EP-PROC-NOAUTH",
      amount: "1234.50",
    });
    authProcedureId = await createProcedureFixture({
      code: "TEST-EP-PROC-AUTH",
      amount: "50.00",
      requiresAuthorization: true,
    });

    const diagnosisCode = await prisma.diagnosisCode.create({
      data: {
        codeSystem: "TEST",
        code: "TEST-EP-DX-001",
        description: "TEST EP diagnosis",
        isActive: true,
        validFrom: new Date("2026-01-01T00:00:00.000Z"),
        validTo: new Date("2026-12-31T00:00:00.000Z"),
      },
      select: {
        id: true,
      },
    });
    diagnosisId = (
      await prisma.encounterDiagnosis.create({
        data: {
          encounterId: openEncounterId,
          diagnosisCodeId: diagnosisCode.id,
          isPrimary: true,
          codeSnapshot: "TEST-EP-DX-001",
          descriptionSnapshot: "TEST EP diagnosis",
          createdByUserId: providerUserId,
        },
        select: {
          id: true,
        },
      })
    ).id;
    otherEncounterDiagnosisId = (
      await prisma.encounterDiagnosis.create({
        data: {
          encounterId: completedEncounterId,
          diagnosisCodeId: diagnosisCode.id,
          isPrimary: true,
          codeSnapshot: "TEST-EP-DX-001",
          descriptionSnapshot: "TEST EP diagnosis",
          createdByUserId: providerUserId,
        },
        select: {
          id: true,
        },
      })
    ).id;

    const authorization = await createAuthorizationItemFixture({
      externalId: "TEST-EP-AUTH-BASE",
      authorizedQuantity: "3.50",
      usedQuantity: "1.25",
    });
    authorizationPk = authorization.authorizationId;
    authorizationItemPk = authorization.itemId;
  });

  afterAll(async () => {
    await cleanupEncounterProcedureFixture();
    await prisma.$disconnect();
  });

  it("requires authentication and procedure.read/update permissions", async () => {
    await request(app)
      .get(`/api/v1/clinical-encounters/${openEncounterId.toString()}/procedures`)
      .expect(401);

    await request(app)
      .get(`/api/v1/clinical-encounters/${openEncounterId.toString()}/procedures`)
      .set("Authorization", `Bearer ${noRoleToken}`)
      .expect(403);

    await request(app)
      .get(`/api/v1/clinical-encounters/${openEncounterId.toString()}/procedures`)
      .set("Authorization", `Bearer ${receptionToken}`)
      .expect(200);

    await createProcedureRequest(
      openEncounterId,
      {
        additionalNote: "TEST-EP denied",
      },
      receptionToken,
    ).expect(403);
  });

  it("creates a performed procedure with immutable snapshots and Decimal strings", async () => {
    const response = await createProcedureRequest(openEncounterId, {
      diagnosisId: diagnosisId.toString(),
      quantity: "1.00",
      additionalNote: "TEST-EP create",
    }).expect(201);

    createdProcedureId = response.body.data.id;

    expect(response.body.data).toMatchObject({
      encounterId: openEncounterId.toString(),
      patientInsuranceId: insuranceId.toString(),
      svbProcedureId: noAuthProcedureId.toString(),
      performedByProviderId: providerId.toString(),
      procedureCodeSnapshot: "TEST-EP-PROC-NOAUTH",
      procedureDescriptionSnapshot: "TEST EP procedure TEST-EP-PROC-NOAUTH",
      providerIdSnapshot: "TEST-EP-PROV-BASE",
      insuredIdSnapshot: "TEST-EP-INS-BASE",
      unitTariffSnapshot: "1234.50",
      currencyCodeSnapshot: "ANG",
      quantity: "1.00",
      amount: "1234.50",
      diagnosticCodeSnapshot: "TEST-EP-DX-001",
      authorizationItemId: null,
      status: "PERFORMED",
      createdByUserId: providerUserId.toString(),
    });
    expect(typeof response.body.data.id).toBe("string");
    expect(response.body.data.svbTariff.amount).toBe("1234.50");
  });

  it("lists, gets detail, and patches editable notes/diagnosis", async () => {
    const list = await request(app)
      .get(`/api/v1/clinical-encounters/${openEncounterId.toString()}/procedures`)
      .set("Authorization", `Bearer ${providerToken}`)
      .expect(200);

    expect(list.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: createdProcedureId }),
      ]),
    );

    const detail = await request(app)
      .get(
        `/api/v1/clinical-encounters/${openEncounterId.toString()}/procedures/${createdProcedureId}`,
      )
      .set("Authorization", `Bearer ${providerToken}`)
      .expect(200);

    expect(detail.body.data.patientInsurance.id).toBe(insuranceId.toString());

    const updated = await request(app)
      .patch(
        `/api/v1/clinical-encounters/${openEncounterId.toString()}/procedures/${createdProcedureId}`,
      )
      .set("Authorization", `Bearer ${providerToken}`)
      .send({
        diagnosisId: null,
        additionalNote: "TEST-EP updated",
        quantity: "9.99",
      })
      .expect(200);

    expect(updated.body.data.additionalNote).toBe("TEST-EP updated");
    expect(updated.body.data.diagnosisId).toBeNull();
    expect(updated.body.data.quantity).toBe("1.00");
  });

  it("validates encounter, procedure, insurance, diagnosis, and quantity", async () => {
    await createProcedureRequest(999999999999n, {}).expect(404);

    await createProcedureRequest(openEncounterId, {
      svbProcedureId: "999999999999",
    })
      .expect(404)
      .expect((response) => {
        expect(response.body.error.code).toBe("SVB_PROCEDURE_NOT_FOUND");
      });

    await createProcedureRequest(openEncounterId, {
      patientInsuranceId: "999999999999",
    })
      .expect(404)
      .expect((response) => {
        expect(response.body.error.code).toBe("PATIENT_INSURANCE_NOT_FOUND");
      });

    await createProcedureRequest(openEncounterId, {
      patientInsuranceId: secondPatientInsuranceId.toString(),
    })
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe(
          "PROCEDURE_INSURANCE_PATIENT_MISMATCH",
        );
      });

    await createProcedureRequest(openEncounterId, {
      patientInsuranceId: inactiveInsuranceId.toString(),
    })
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("INSURANCE_NOT_VALID");
      });

    await createProcedureRequest(openEncounterId, {
      diagnosisId: otherEncounterDiagnosisId.toString(),
    })
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe(
          "PROCEDURE_DIAGNOSIS_ENCOUNTER_MISMATCH",
        );
      });

    await createProcedureRequest(openEncounterId, {
      quantity: "0.00",
    })
      .expect(400)
      .expect((response) => {
        expect(response.body.error.code).toBe("INVALID_PROCEDURE_QUANTITY");
      });
  });

  it("rejects closed and cross-organization encounters", async () => {
    await createProcedureRequest(completedEncounterId, {})
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe(
          "CLINICAL_ENCOUNTER_NOT_EDITABLE",
        );
      });

    await createProcedureRequest(otherOrgEncounterId, {})
      .expect(404)
      .expect((response) => {
        expect(response.body.error.code).toBe("CLINICAL_ENCOUNTER_NOT_FOUND");
      });
  });

  it("requires authorization when the SVB procedure requires it", async () => {
    await createProcedureRequest(openEncounterId, {
      svbProcedureId: authProcedureId.toString(),
      authorizationItemId: null,
    })
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe(
          "PROCEDURE_AUTHORIZATION_REQUIRED",
        );
      });
  });

  it("consumes authorization quantity and recalculates amount/status", async () => {
    const response = await createProcedureRequest(openEncounterId, {
      svbProcedureId: authProcedureId.toString(),
      authorizationItemId: authorizationItemPk.toString(),
      quantity: "2.25",
    }).expect(201);

    expect(response.body.data).toMatchObject({
      authorizationItemId: authorizationItemPk.toString(),
      authorizationIdSnapshot: "TEST-EP-AUTH-BASE",
      unitTariffSnapshot: "50.00",
      quantity: "2.25",
      amount: "112.50",
    });

    const item = await prisma.svbAuthorizationItem.findUniqueOrThrow({
      where: {
        id: authorizationItemPk,
      },
      select: {
        usedQuantity: true,
      },
    });
    const authorization = await prisma.svbAuthorization.findUniqueOrThrow({
      where: {
        id: authorizationPk,
      },
      select: {
        status: true,
      },
    });

    expect(item.usedQuantity.toFixed(2)).toBe("3.50");
    expect(authorization.status).toBe("EXHAUSTED");

    await request(app)
      .delete(
        `/api/v1/clinical-encounters/${openEncounterId.toString()}/procedures/${response.body.data.id}`,
      )
      .set("Authorization", `Bearer ${providerToken}`)
      .expect(200);

    const released = await prisma.svbAuthorizationItem.findUniqueOrThrow({
      where: {
        id: authorizationItemPk,
      },
      select: {
        usedQuantity: true,
      },
    });

    expect(released.usedQuantity.toFixed(2)).toBe("1.25");
  });

  it("rejects over-consumption and concurrent duplicate consumption", async () => {
    await createProcedureRequest(openEncounterId, {
      svbProcedureId: authProcedureId.toString(),
      authorizationItemId: authorizationItemPk.toString(),
      quantity: "2.26",
    })
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe(
          "AUTHORIZATION_QUANTITY_EXCEEDED",
        );
      });

    const concurrent = await createAuthorizationItemFixture({
      externalId: "TEST-EP-AUTH-CONCURRENT",
      authorizedQuantity: "1.00",
    });

    const [first, second] = await Promise.all([
      createProcedureRequest(openEncounterId, {
        svbProcedureId: authProcedureId.toString(),
        authorizationItemId: concurrent.itemId.toString(),
        quantity: "1.00",
        additionalNote: "TEST-EP concurrent A",
      }),
      createProcedureRequest(openEncounterId, {
        svbProcedureId: authProcedureId.toString(),
        authorizationItemId: concurrent.itemId.toString(),
        quantity: "1.00",
        additionalNote: "TEST-EP concurrent B",
      }),
    ]);

    expect([201, 409]).toContain(first.status);
    expect([201, 409]).toContain(second.status);
    expect([first.status, second.status].filter((status) => status === 201))
      .toHaveLength(1);

    const persisted = await prisma.encounterProcedure.count({
      where: {
        authorizationItemId: concurrent.itemId,
      },
    });
    const item = await prisma.svbAuthorizationItem.findUniqueOrThrow({
      where: {
        id: concurrent.itemId,
      },
      select: {
        usedQuantity: true,
      },
    });

    expect(persisted).toBe(1);
    expect(item.usedQuantity.toFixed(2)).toBe("1.00");
  });

  it("removes an unbilled procedure and writes audit logs", async () => {
    const created = await createProcedureRequest(openEncounterId, {
      additionalNote: "TEST-EP remove",
    }).expect(201);

    await request(app)
      .delete(
        `/api/v1/clinical-encounters/${openEncounterId.toString()}/procedures/${created.body.data.id}`,
      )
      .set("Authorization", `Bearer ${providerToken}`)
      .expect(200);

    const removed = await prisma.encounterProcedure.findUnique({
      where: {
        id: BigInt(created.body.data.id),
      },
      select: {
        id: true,
      },
    });

    expect(removed).toBeNull();

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entityType: "ENCOUNTER_PROCEDURE",
        entityKey: {
          contains: "TEST-EP",
        },
      },
      select: {
        action: true,
        oldValues: true,
        newValues: true,
        correlationId: true,
      },
    });

    expect(auditLogs.map((auditLog) => auditLog.action)).toEqual(
      expect.arrayContaining([
        "ENCOUNTER_PROCEDURE_CREATE",
        "ENCOUNTER_PROCEDURE_UPDATE",
        "ENCOUNTER_PROCEDURE_REMOVE",
      ]),
    );
    expect(auditLogs.some((auditLog) => auditLog.oldValues !== null)).toBe(true);
    expect(auditLogs.some((auditLog) => auditLog.newValues !== null)).toBe(true);
    expect(auditLogs.some((auditLog) => auditLog.correlationId !== null)).toBe(
      true,
    );
  });

  it("returns INVALID_ID for invalid route ids", async () => {
    await request(app)
      .get("/api/v1/clinical-encounters/not-a-number/procedures")
      .set("Authorization", `Bearer ${providerToken}`)
      .expect(400)
      .expect((response) => {
        expect(response.body.error.code).toBe("INVALID_ID");
      });
  });
});
