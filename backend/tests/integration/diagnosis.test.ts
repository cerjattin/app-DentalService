import request from "supertest";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { app } from "../../src/app.js";
import { prisma } from "../../src/infrastructure/database/prisma.js";
import { accessTokenService } from "../../src/modules/auth/access-token.service.js";

const ADMIN_EMAIL = "diagnosis.admin.integration@local.invalid";
const RECEPTION_EMAIL = "diagnosis.reception.integration@local.invalid";
const PROVIDER_EMAIL = "diagnosis.provider.integration@local.invalid";
const NO_ROLE_EMAIL = "diagnosis.norole.integration@local.invalid";
const OTHER_ORG_EMAIL = "diagnosis.other-org.integration@local.invalid";
const OTHER_ORG_LEGAL_NAME = "TEST Diagnosis Other Organization";

let organizationId: bigint;
let otherOrganizationId: bigint;
let adminUserId: bigint;
let providerUserId: bigint;
let adminToken: string;
let receptionToken: string;
let providerToken: string;
let noRoleToken: string;
let patientId: bigint;
let providerId: bigint;
let locationId: bigint;
let openEncounterId: bigint;
let secondOpenEncounterId: bigint;
let completedEncounterId: bigint;
let voidEncounterId: bigint;
let otherOrganizationEncounterId: bigint;
let diagnosisCodeId: bigint;
let secondDiagnosisCodeId: bigint;
let thirdDiagnosisCodeId: bigint;
let inactiveDiagnosisCodeId: bigint;
let notCurrentDiagnosisCodeId: bigint;
let assignedDiagnosisId: string;
let secondaryDiagnosisId: string;

async function cleanupDiagnosisFixture() {
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

  const appointments = await prisma.appointment.findMany({
    where: {
      OR: [
        {
          appointmentNumber: {
            startsWith: "TEST-DX-APT",
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

  const encounters = await prisma.clinicalEncounter.findMany({
    where: {
      OR: [
        {
          appointmentId: {
            in: appointmentIds,
          },
        },
        {
          createdByUserId: {
            in: userIds,
          },
        },
      ],
    },
    select: {
      id: true,
    },
  });

  const encounterIds = encounters.map((encounter) => encounter.id);

  const encounterDiagnoses = await prisma.encounterDiagnosis.findMany({
    where: {
      OR: [
        {
          encounterId: {
            in: encounterIds,
          },
        },
        {
          diagnosisCode: {
            code: {
              startsWith: "TEST-DX",
            },
          },
        },
      ],
    },
    select: {
      id: true,
    },
  });

  const encounterDiagnosisIds = encounterDiagnoses.map(
    (diagnosis) => diagnosis.id,
  );

  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        {
          actorUserId: {
            in: userIds,
          },
        },
        {
          entityType: "ENCOUNTER_DIAGNOSIS",
          entityId: {
            in: encounterDiagnosisIds,
          },
        },
        {
          entityType: "ENCOUNTER_DIAGNOSIS",
          entityKey: {
            contains: "TEST-DX",
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

  await prisma.encounterDiagnosis.deleteMany({
    where: {
      id: {
        in: encounterDiagnosisIds,
      },
    },
  });

  await prisma.clinicalEncounter.deleteMany({
    where: {
      id: {
        in: encounterIds,
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

  await prisma.provider.deleteMany({
    where: {
      OR: [
        {
          svbProviderId: {
            startsWith: "TEST-DX-PROV",
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

  await prisma.patient.deleteMany({
    where: {
      OR: [
        {
          patientNumber: {
            startsWith: "TEST-DX-PAT",
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

  await prisma.clinicLocation.deleteMany({
    where: {
      OR: [
        {
          code: {
            startsWith: "TEST-DX-LOC",
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

  await prisma.diagnosisCode.deleteMany({
    where: {
      codeSystem: "TEST",
      code: {
        startsWith: "TEST-DX",
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
      firstName: "Diagnosis",
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

async function createDiagnosisCode(
  code: string,
  options: {
    isActive?: boolean;
    validFrom?: Date;
    validTo?: Date;
  } = {},
) {
  const diagnosisCode = await prisma.diagnosisCode.create({
    data: {
      codeSystem: "TEST",
      code,
      description: `Test diagnosis ${code}`,
      isActive: options.isActive ?? true,
      validFrom: options.validFrom ?? new Date("2026-01-01T00:00:00.000Z"),
      validTo: options.validTo ?? new Date("2026-12-31T00:00:00.000Z"),
    },
    select: {
      id: true,
    },
  });

  return diagnosisCode.id;
}

async function createEncounterFixture(
  appointmentNumber: string,
  status: "OPEN" | "COMPLETED" | "VOID",
  scheduledStartAt: string,
  orgId = organizationId,
) {
  const patient = await prisma.patient.create({
    data: {
      organizationId: orgId,
      patientNumber: `TEST-DX-PAT-${appointmentNumber}`,
      firstName: "Diagnosis",
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
      code: `TEST-DX-LOC-${appointmentNumber}`,
      name: `TEST Diagnosis Location ${appointmentNumber}`,
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
      svbProviderId: `TEST-DX-PROV-${appointmentNumber}`,
      firstName: "Diagnosis",
      lastName: "Provider",
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  const start = new Date(scheduledStartAt);

  const appointment = await prisma.appointment.create({
    data: {
      organizationId: orgId,
      appointmentNumber,
      patientId: patient.id,
      providerId: provider.id,
      clinicLocationId: location.id,
      scheduledStartAt: start,
      scheduledEndAt: new Date(start.getTime() + 1_800_000),
      status: "IN_PROGRESS",
      startedAt: new Date(),
      createdByUserId: adminUserId,
      reason: "TEST-DX fixture",
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
      chiefComplaint: "TEST-DX complaint",
      clinicalNotes: "TEST-DX notes",
      createdByUserId: adminUserId,
    },
    select: {
      id: true,
    },
  });

  return encounter.id;
}

function postDiagnosis(
  encounterId: bigint,
  diagnosisCodeId: bigint,
  token = providerToken,
  isPrimary = false,
) {
  return request(app)
    .post(`/api/v1/clinical-encounters/${encounterId.toString()}/diagnoses`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      diagnosisCodeId: diagnosisCodeId.toString(),
      isPrimary,
      notes: "TEST-DX assignment notes",
    });
}

describe("Diagnosis API", () => {
  beforeAll(async () => {
    await cleanupDiagnosisFixture();

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
        tradeName: "TEST Diagnosis Other Org",
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

    await prisma.user.create({
      data: {
        organizationId: otherOrganizationId,
        email: OTHER_ORG_EMAIL,
        passwordHash: "not-used-for-token-fixture",
        firstName: "Other",
        lastName: "Org",
        status: "ACTIVE",
      },
    });

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

    diagnosisCodeId = await createDiagnosisCode("TEST-DX-001");
    secondDiagnosisCodeId = await createDiagnosisCode("TEST-DX-002");
    thirdDiagnosisCodeId = await createDiagnosisCode("TEST-DX-003");
    inactiveDiagnosisCodeId = await createDiagnosisCode("TEST-DX-INACTIVE", {
      isActive: false,
    });
    notCurrentDiagnosisCodeId = await createDiagnosisCode("TEST-DX-FUTURE", {
      validFrom: new Date("2027-01-01T00:00:00.000Z"),
      validTo: new Date("2027-12-31T00:00:00.000Z"),
    });

    const basePatient = await prisma.patient.create({
      data: {
        organizationId,
        patientNumber: "TEST-DX-PAT-BASE",
        firstName: "Base",
        lastName: "Patient",
        status: "ACTIVE",
      },
      select: {
        id: true,
      },
    });

    patientId = basePatient.id;

    const baseLocation = await prisma.clinicLocation.create({
      data: {
        organizationId,
        code: "TEST-DX-LOC-BASE",
        name: "TEST Diagnosis Base Location",
        countryCode: "CW",
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    locationId = baseLocation.id;

    const baseProvider = await prisma.provider.create({
      data: {
        organizationId,
        userId: providerUserId,
        svbProviderId: "TEST-DX-PROV-BASE",
        firstName: "Diagnosis",
        lastName: "Provider",
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    providerId = baseProvider.id;

    const baseAppointment = await prisma.appointment.create({
      data: {
        organizationId,
        appointmentNumber: "TEST-DX-APT-BASE",
        patientId,
        providerId,
        clinicLocationId: locationId,
        scheduledStartAt: new Date("2026-11-01T09:00:00-04:00"),
        scheduledEndAt: new Date("2026-11-01T09:30:00-04:00"),
        status: "IN_PROGRESS",
        startedAt: new Date(),
        createdByUserId: adminUserId,
        reason: "TEST-DX base",
      },
      select: {
        id: true,
      },
    });

    const openEncounter = await prisma.clinicalEncounter.create({
      data: {
        appointmentId: baseAppointment.id,
        providerId,
        status: "OPEN",
        startedAt: new Date(),
        chiefComplaint: "TEST-DX base complaint",
        clinicalNotes: "TEST-DX base notes",
        createdByUserId: providerUserId,
      },
      select: {
        id: true,
      },
    });

    openEncounterId = openEncounter.id;

    secondOpenEncounterId = await createEncounterFixture(
      "TEST-DX-APT-SECOND",
      "OPEN",
      "2026-11-01T10:00:00-04:00",
    );
    completedEncounterId = await createEncounterFixture(
      "TEST-DX-APT-COMPLETED",
      "COMPLETED",
      "2026-11-01T11:00:00-04:00",
    );
    voidEncounterId = await createEncounterFixture(
      "TEST-DX-APT-VOID",
      "VOID",
      "2026-11-01T12:00:00-04:00",
    );
    otherOrganizationEncounterId = await createEncounterFixture(
      "TEST-DX-APT-OTHER",
      "OPEN",
      "2026-11-01T13:00:00-04:00",
      otherOrganizationId,
    );
  });

  afterAll(async () => {
    await cleanupDiagnosisFixture();

    await prisma.$disconnect();
  });

  it("requires authentication and diagnosis.read", async () => {
    await request(app).get("/api/v1/diagnosis-codes").expect(401);

    const response = await request(app)
      .get("/api/v1/diagnosis-codes")
      .set("Authorization", `Bearer ${noRoleToken}`)
      .expect(403);

    expect(response.body.error.code).toBe("PERMISSION_DENIED");
  });

  it("lists, searches, filters, and gets diagnosis codes", async () => {
    const list = await request(app)
      .get("/api/v1/diagnosis-codes?q=TEST-DX-001&page=1&pageSize=1")
      .set("Authorization", `Bearer ${receptionToken}`)
      .expect(200);

    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].id).toBe(diagnosisCodeId.toString());
    expect(list.body.data[0].validFrom).toBe("2026-01-01");
    expect(list.body.meta.total).toBeGreaterThanOrEqual(1);

    const filtered = await request(app)
      .get("/api/v1/diagnosis-codes?codeSystem=TEST&isActive=true")
      .set("Authorization", `Bearer ${providerToken}`)
      .expect(200);

    expect(filtered.body.data.length).toBeGreaterThanOrEqual(1);

    const detail = await request(app)
      .get(`/api/v1/diagnosis-codes/${diagnosisCodeId.toString()}`)
      .set("Authorization", `Bearer ${providerToken}`)
      .expect(200);

    expect(detail.body.data).toMatchObject({
      id: diagnosisCodeId.toString(),
      codeSystem: "TEST",
      code: "TEST-DX-001",
      isActive: true,
    });
  });

  it("allows RECEPTION read and denies assignment mutations", async () => {
    await request(app)
      .get(`/api/v1/clinical-encounters/${openEncounterId.toString()}/diagnoses`)
      .set("Authorization", `Bearer ${receptionToken}`)
      .expect(200);

    await postDiagnosis(openEncounterId, diagnosisCodeId, receptionToken).expect(
      403,
    );
  });

  it("assigns diagnosis with snapshots and actor fields", async () => {
    const response = await postDiagnosis(
      openEncounterId,
      diagnosisCodeId,
      providerToken,
      true,
    ).expect(201);

    assignedDiagnosisId = response.body.data.id;

    expect(response.body.data).toMatchObject({
      encounterId: openEncounterId.toString(),
      diagnosisCodeId: diagnosisCodeId.toString(),
      isPrimary: true,
      codeSnapshot: "TEST-DX-001",
      descriptionSnapshot: "Test diagnosis TEST-DX-001",
      createdByUserId: providerUserId.toString(),
    });
    expect(response.body.data.diagnosisCode.id).toBe(
      diagnosisCodeId.toString(),
    );
  });

  it("assigns secondary diagnosis and lists encounter diagnoses", async () => {
    const response = await postDiagnosis(
      openEncounterId,
      secondDiagnosisCodeId,
    ).expect(201);

    secondaryDiagnosisId = response.body.data.id;

    expect(response.body.data.isPrimary).toBe(false);

    const list = await request(app)
      .get(`/api/v1/clinical-encounters/${openEncounterId.toString()}/diagnoses`)
      .set("Authorization", `Bearer ${providerToken}`)
      .expect(200);

    expect(list.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: assignedDiagnosisId }),
        expect.objectContaining({ id: secondaryDiagnosisId }),
      ]),
    );
  });

  it("new primary demotes previous primary", async () => {
    const response = await postDiagnosis(
      openEncounterId,
      thirdDiagnosisCodeId,
      providerToken,
      true,
    ).expect(201);

    expect(response.body.data.isPrimary).toBe(true);

    const primaryCount = await prisma.encounterDiagnosis.count({
      where: {
        encounterId: openEncounterId,
        isPrimary: true,
      },
    });

    const previousPrimary = await prisma.encounterDiagnosis.findUniqueOrThrow({
      where: {
        id: BigInt(assignedDiagnosisId),
      },
      select: {
        isPrimary: true,
      },
    });

    expect(primaryCount).toBe(1);
    expect(previousPrimary.isPrimary).toBe(false);
  });

  it("patches notes and can set primary", async () => {
    const response = await request(app)
      .patch(
        `/api/v1/clinical-encounters/${openEncounterId.toString()}/diagnoses/${secondaryDiagnosisId}`,
      )
      .set("Authorization", `Bearer ${providerToken}`)
      .send({
        notes: "TEST-DX updated notes",
        isPrimary: true,
      })
      .expect(200);

    expect(response.body.data.notes).toBe("TEST-DX updated notes");
    expect(response.body.data.isPrimary).toBe(true);

    const primaryCount = await prisma.encounterDiagnosis.count({
      where: {
        encounterId: openEncounterId,
        isPrimary: true,
      },
    });

    expect(primaryCount).toBe(1);
  });

  it("deletes primary without promoting another diagnosis", async () => {
    await request(app)
      .delete(
        `/api/v1/clinical-encounters/${openEncounterId.toString()}/diagnoses/${secondaryDiagnosisId}`,
      )
      .set("Authorization", `Bearer ${providerToken}`)
      .expect(200);

    const primaryCount = await prisma.encounterDiagnosis.count({
      where: {
        encounterId: openEncounterId,
        isPrimary: true,
      },
    });

    expect(primaryCount).toBe(0);
  });

  it("rejects duplicate, inactive, and not-current diagnosis codes", async () => {
    await postDiagnosis(openEncounterId, diagnosisCodeId)
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("DIAGNOSIS_ALREADY_ASSIGNED");
      });

    await postDiagnosis(openEncounterId, inactiveDiagnosisCodeId)
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("DIAGNOSIS_CODE_INACTIVE");
      });

    await postDiagnosis(openEncounterId, notCurrentDiagnosisCodeId)
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("DIAGNOSIS_CODE_NOT_VALID");
      });
  });

  it("rejects missing diagnosis code and invalid ids", async () => {
    await postDiagnosis(openEncounterId, 999999999999n)
      .expect(404)
      .expect((response) => {
        expect(response.body.error.code).toBe("DIAGNOSIS_CODE_NOT_FOUND");
      });

    await request(app)
      .get("/api/v1/diagnosis-codes/not-a-number")
      .set("Authorization", `Bearer ${providerToken}`)
      .expect(400)
      .expect((response) => {
        expect(response.body.error.code).toBe("INVALID_ID");
      });
  });

  it("rejects missing and cross-organization encounters", async () => {
    await postDiagnosis(999999999999n, diagnosisCodeId)
      .expect(404)
      .expect((response) => {
        expect(response.body.error.code).toBe("CLINICAL_ENCOUNTER_NOT_FOUND");
      });

    await postDiagnosis(otherOrganizationEncounterId, diagnosisCodeId)
      .expect(404)
      .expect((response) => {
        expect(response.body.error.code).toBe("CLINICAL_ENCOUNTER_NOT_FOUND");
      });
  });

  it("rejects mutations for completed and void encounters", async () => {
    const completedDiagnosis = await prisma.encounterDiagnosis.create({
      data: {
        encounterId: completedEncounterId,
        diagnosisCodeId,
        isPrimary: true,
        codeSnapshot: "TEST-DX-001",
        descriptionSnapshot: "Test diagnosis TEST-DX-001",
        notes: "TEST-DX completed",
        createdByUserId: providerUserId,
      },
      select: {
        id: true,
      },
    });

    const voidDiagnosis = await prisma.encounterDiagnosis.create({
      data: {
        encounterId: voidEncounterId,
        diagnosisCodeId,
        isPrimary: true,
        codeSnapshot: "TEST-DX-001",
        descriptionSnapshot: "Test diagnosis TEST-DX-001",
        notes: "TEST-DX void",
        createdByUserId: providerUserId,
      },
      select: {
        id: true,
      },
    });

    await postDiagnosis(completedEncounterId, secondDiagnosisCodeId)
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe(
          "CLINICAL_ENCOUNTER_NOT_EDITABLE",
        );
      });

    await request(app)
      .patch(
        `/api/v1/clinical-encounters/${completedEncounterId.toString()}/diagnoses/${completedDiagnosis.id.toString()}`,
      )
      .set("Authorization", `Bearer ${providerToken}`)
      .send({ notes: "TEST-DX denied" })
      .expect(409);

    await request(app)
      .delete(
        `/api/v1/clinical-encounters/${completedEncounterId.toString()}/diagnoses/${completedDiagnosis.id.toString()}`,
      )
      .set("Authorization", `Bearer ${providerToken}`)
      .expect(409);

    await postDiagnosis(voidEncounterId, secondDiagnosisCodeId).expect(409);

    await request(app)
      .delete(
        `/api/v1/clinical-encounters/${voidEncounterId.toString()}/diagnoses/${voidDiagnosis.id.toString()}`,
      )
      .set("Authorization", `Bearer ${providerToken}`)
      .expect(409);
  });

  it("returns ENCOUNTER_DIAGNOSIS_NOT_FOUND for missing assignment", async () => {
    await request(app)
      .patch(
        `/api/v1/clinical-encounters/${openEncounterId.toString()}/diagnoses/999999999999`,
      )
      .set("Authorization", `Bearer ${providerToken}`)
      .send({ notes: "TEST-DX missing" })
      .expect(404)
      .expect((response) => {
        expect(response.body.error.code).toBe(
          "ENCOUNTER_DIAGNOSIS_NOT_FOUND",
        );
      });
  });

  it("allows PROVIDER read and assign according to seed", async () => {
    const response = await postDiagnosis(
      secondOpenEncounterId,
      diagnosisCodeId,
      providerToken,
      true,
    ).expect(201);

    await request(app)
      .get(
        `/api/v1/clinical-encounters/${secondOpenEncounterId.toString()}/diagnoses`,
      )
      .set("Authorization", `Bearer ${providerToken}`)
      .expect(200);

    await request(app)
      .delete(
        `/api/v1/clinical-encounters/${secondOpenEncounterId.toString()}/diagnoses/${response.body.data.id}`,
      )
      .set("Authorization", `Bearer ${providerToken}`)
      .expect(200);
  });

  it("keeps at most one primary under concurrent assignments", async () => {
    const concurrentEncounterId = await createEncounterFixture(
      "TEST-DX-APT-CONCURRENT",
      "OPEN",
      "2026-11-01T14:00:00-04:00",
    );

    const firstCodeId = await createDiagnosisCode("TEST-DX-CONCURRENT-A");
    const secondCodeId = await createDiagnosisCode("TEST-DX-CONCURRENT-B");

    const [first, second] = await Promise.all([
      postDiagnosis(concurrentEncounterId, firstCodeId, providerToken, true),
      postDiagnosis(concurrentEncounterId, secondCodeId, providerToken, true),
    ]);

    expect([201, 409]).toContain(first.status);
    expect([201, 409]).toContain(second.status);
    expect([first.status, second.status]).toContain(201);

    const primaryCount = await prisma.encounterDiagnosis.count({
      where: {
        encounterId: concurrentEncounterId,
        isPrimary: true,
      },
    });

    expect(primaryCount).toBeLessThanOrEqual(1);
  });

  it("writes audit logs for assign, update, and remove", async () => {
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entityType: "ENCOUNTER_DIAGNOSIS",
        entityKey: {
          contains: "TEST-DX",
        },
      },
      select: {
        action: true,
        oldValues: true,
        newValues: true,
      },
    });

    expect(auditLogs.map((auditLog) => auditLog.action)).toEqual(
      expect.arrayContaining([
        "ENCOUNTER_DIAGNOSIS_ASSIGN",
        "ENCOUNTER_DIAGNOSIS_UPDATE",
      ]),
    );

    expect(auditLogs.some((auditLog) => auditLog.newValues !== null)).toBe(true);
    expect(auditLogs.some((auditLog) => auditLog.oldValues !== null)).toBe(true);
    expect(
      auditLogs.find(
        (auditLog) => auditLog.action === "ENCOUNTER_DIAGNOSIS_REMOVE",
      )?.oldValues,
    ).toBeTruthy();
  });
});
