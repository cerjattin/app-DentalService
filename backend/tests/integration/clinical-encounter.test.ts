import request from "supertest";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { app } from "../../src/app.js";
import { prisma } from "../../src/infrastructure/database/prisma.js";
import { accessTokenService } from "../../src/modules/auth/access-token.service.js";

const ADMIN_EMAIL = "clinical-encounter.admin.integration@local.invalid";
const RECEPTION_EMAIL = "clinical-encounter.reception.integration@local.invalid";
const PROVIDER_EMAIL = "clinical-encounter.provider.integration@local.invalid";
const NO_ROLE_EMAIL = "clinical-encounter.norole.integration@local.invalid";
const OTHER_ORG_EMAIL = "clinical-encounter.other-org.integration@local.invalid";
const OTHER_ORG_LEGAL_NAME = "TEST Clinical Encounter Other Organization";

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
let secondProviderId: bigint;
let locationId: bigint;
let appointmentId: bigint;
let secondAppointmentId: bigint;
let cancelledAppointmentId: bigint;
let noShowAppointmentId: bigint;
let completedAppointmentId: bigint;
let scheduledAppointmentId: bigint;
let otherOrganizationAppointmentId: bigint;
let encounterId: string;

async function cleanupClinicalEncounterFixture() {
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
            startsWith: "TEST-ENC",
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

  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        {
          actorUserId: {
            in: userIds,
          },
        },
        {
          entityType: "CLINICAL_ENCOUNTER",
          entityId: {
            in: encounterIds,
          },
        },
        {
          entityType: "CLINICAL_ENCOUNTER",
          entityKey: {
            startsWith: "TEST-ENC",
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
            startsWith: "TEST-ENC-PROV",
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
            startsWith: "TEST-ENC-PAT",
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
            startsWith: "TEST-ENC-LOC",
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
      firstName: "Clinical",
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

async function createAppointmentFixture(
  appointmentNumber: string,
  status:
    | "SCHEDULED"
    | "CONFIRMED"
    | "CHECKED_IN"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "CANCELLED"
    | "NO_SHOW",
  startsAt: string,
) {
  const start = new Date(startsAt);
  const end = new Date(start.getTime() + 1_800_000);

  const appointment = await prisma.appointment.create({
    data: {
      organizationId,
      appointmentNumber,
      patientId,
      providerId,
      clinicLocationId: locationId,
      scheduledStartAt: start,
      scheduledEndAt: end,
      status,
      createdByUserId: adminUserId,
      reason: "TEST-ENC fixture",
      notes: "TEST-ENC fixture notes",
      ...(status === "IN_PROGRESS" ? { startedAt: new Date() } : {}),
      ...(status === "COMPLETED" ? { completedAt: new Date() } : {}),
      ...(status === "CANCELLED"
        ? {
            cancelledAt: new Date(),
            cancellationReason: "TEST-ENC cancelled fixture",
          }
        : {}),
    },
    select: {
      id: true,
    },
  });

  return appointment.id;
}

function postEncounter(
  targetAppointmentId: bigint,
  token = providerToken,
  body: Record<string, unknown> = {
    chiefComplaint: "TEST-ENC chief complaint",
    clinicalNotes: "TEST-ENC clinical notes",
  },
) {
  return request(app)
    .post(
      `/api/v1/appointments/${targetAppointmentId.toString()}/clinical-encounter`,
    )
    .set("Authorization", `Bearer ${token}`)
    .send(body);
}

describe("Clinical Encounters API", () => {
  beforeAll(async () => {
    await cleanupClinicalEncounterFixture();

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
        tradeName: "TEST Clinical Encounter Other Org",
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
        lastName: "Organization",
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

    const patient = await prisma.patient.create({
      data: {
        organizationId,
        patientNumber: "TEST-ENC-PAT-001",
        firstName: "Test",
        lastName: "Encounter",
        documentNumber: "TEST-ENC-DOC-001",
        status: "ACTIVE",
      },
      select: {
        id: true,
      },
    });

    patientId = patient.id;

    const location = await prisma.clinicLocation.create({
      data: {
        organizationId,
        code: "TEST-ENC-LOC-001",
        name: "TEST Clinical Encounter Location",
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
        svbProviderId: "TEST-ENC-PROV-001",
        firstName: "Clinical",
        lastName: "Provider",
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    providerId = provider.id;

    const secondProvider = await prisma.provider.create({
      data: {
        organizationId,
        svbProviderId: "TEST-ENC-PROV-002",
        firstName: "Second",
        lastName: "Provider",
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    secondProviderId = secondProvider.id;

    appointmentId = await createAppointmentFixture(
      "TEST-ENC-APT-001",
      "IN_PROGRESS",
      "2026-10-01T09:00:00-04:00",
    );

    secondAppointmentId = await createAppointmentFixture(
      "TEST-ENC-APT-002",
      "IN_PROGRESS",
      "2026-10-01T10:00:00-04:00",
    );

    cancelledAppointmentId = await createAppointmentFixture(
      "TEST-ENC-APT-CANCELLED",
      "CANCELLED",
      "2026-10-01T11:00:00-04:00",
    );

    noShowAppointmentId = await createAppointmentFixture(
      "TEST-ENC-APT-NO-SHOW",
      "NO_SHOW",
      "2026-10-01T12:00:00-04:00",
    );

    completedAppointmentId = await createAppointmentFixture(
      "TEST-ENC-APT-COMPLETED",
      "COMPLETED",
      "2026-10-01T13:00:00-04:00",
    );

    scheduledAppointmentId = await createAppointmentFixture(
      "TEST-ENC-APT-SCHEDULED",
      "SCHEDULED",
      "2026-10-01T14:00:00-04:00",
    );

    const otherPatient = await prisma.patient.create({
      data: {
        organizationId: otherOrganizationId,
        patientNumber: "TEST-ENC-PAT-OTHER",
        firstName: "Other",
        lastName: "Patient",
        status: "ACTIVE",
      },
      select: {
        id: true,
      },
    });

    const otherLocation = await prisma.clinicLocation.create({
      data: {
        organizationId: otherOrganizationId,
        code: "TEST-ENC-LOC-OTHER",
        name: "TEST Other Clinical Encounter Location",
        countryCode: "CW",
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    const otherProvider = await prisma.provider.create({
      data: {
        organizationId: otherOrganizationId,
        svbProviderId: "TEST-ENC-PROV-OTHER",
        firstName: "Other",
        lastName: "Provider",
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    const otherAppointment = await prisma.appointment.create({
      data: {
        organizationId: otherOrganizationId,
        appointmentNumber: "TEST-ENC-APT-OTHER",
        patientId: otherPatient.id,
        providerId: otherProvider.id,
        clinicLocationId: otherLocation.id,
        scheduledStartAt: new Date("2026-10-01T15:00:00-04:00"),
        scheduledEndAt: new Date("2026-10-01T15:30:00-04:00"),
        status: "IN_PROGRESS",
        startedAt: new Date(),
        createdByUserId: adminUserId,
      },
      select: {
        id: true,
      },
    });

    otherOrganizationAppointmentId = otherAppointment.id;
  });

  afterAll(async () => {
    await cleanupClinicalEncounterFixture();

    await prisma.$disconnect();
  });

  it("returns 401 without token and 403 without encounter.read", async () => {
    await request(app).get("/api/v1/clinical-encounters").expect(401);

    const response = await request(app)
      .get("/api/v1/clinical-encounters")
      .set("Authorization", `Bearer ${noRoleToken}`)
      .expect(403);

    expect(response.body.error.code).toBe("PERMISSION_DENIED");
  });

  it("allows RECEPTION read and denies create/update/complete mutations", async () => {
    await request(app)
      .get("/api/v1/clinical-encounters")
      .set("Authorization", `Bearer ${receptionToken}`)
      .expect(200);

    await postEncounter(appointmentId, receptionToken).expect(403);

    const created = await postEncounter(appointmentId).expect(201);
    encounterId = created.body.data.id;

    await request(app)
      .patch(`/api/v1/clinical-encounters/${encounterId}`)
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        clinicalNotes: "TEST-ENC reception denied",
      })
      .expect(403);

    await request(app)
      .post(`/api/v1/clinical-encounters/${encounterId}/complete`)
      .set("Authorization", `Bearer ${receptionToken}`)
      .expect(403);
  });

  it("creates an OPEN encounter deriving provider and actor fields", async () => {
    const response = await request(app)
      .get(`/api/v1/clinical-encounters/${encounterId}`)
      .set("Authorization", `Bearer ${providerToken}`)
      .expect(200);

    expect(response.body.data.id).toEqual(expect.any(String));
    expect(response.body.data.appointmentId).toBe(appointmentId.toString());
    expect(response.body.data.providerId).toBe(providerId.toString());
    expect(response.body.data.createdByUserId).toBe(providerUserId.toString());
    expect(response.body.data.status).toBe("OPEN");
    expect(response.body.data.startedAt).toEqual(expect.any(String));
    expect(response.body.data.completedAt).toBeNull();
    expect(response.body.data.appointment.appointmentNumber).toBe(
      "TEST-ENC-APT-001",
    );
    expect(response.body.data.patient.patientNumber).toBe("TEST-ENC-PAT-001");
    expect(response.body.data.provider.svbProviderId).toBe(
      "TEST-ENC-PROV-001",
    );
  });

  it("ignores providerId in body and keeps appointment provider", async () => {
    const response = await postEncounter(secondAppointmentId, providerToken, {
      chiefComplaint: "TEST-ENC second complaint",
      providerId: secondProviderId.toString(),
    }).expect(201);

    expect(response.body.data.providerId).toBe(providerId.toString());
  });

  it("gets encounter by appointment", async () => {
    const response = await request(app)
      .get(
        `/api/v1/appointments/${appointmentId.toString()}/clinical-encounter`,
      )
      .set("Authorization", `Bearer ${receptionToken}`)
      .expect(200);

    expect(response.body.data.id).toBe(encounterId);
  });

  it("lists encounters with pagination and filters", async () => {
    const byStatus = await request(app)
      .get("/api/v1/clinical-encounters?status=OPEN&page=1&pageSize=1")
      .set("Authorization", `Bearer ${providerToken}`)
      .expect(200);

    expect(byStatus.body.data).toHaveLength(1);
    expect(byStatus.body.meta.total).toBeGreaterThanOrEqual(1);

    const byProvider = await request(app)
      .get(`/api/v1/clinical-encounters?providerId=${providerId.toString()}`)
      .set("Authorization", `Bearer ${providerToken}`)
      .expect(200);

    expect(byProvider.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: encounterId,
        }),
      ]),
    );

    const byPatient = await request(app)
      .get(`/api/v1/clinical-encounters?patientId=${patientId.toString()}`)
      .set("Authorization", `Bearer ${providerToken}`)
      .expect(200);

    expect(byPatient.body.meta.total).toBeGreaterThanOrEqual(1);

    const byQuery = await request(app)
      .get("/api/v1/clinical-encounters?q=TEST-ENC-APT-001")
      .set("Authorization", `Bearer ${providerToken}`)
      .expect(200);

    expect(byQuery.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: encounterId,
        }),
      ]),
    );
  });

  it("updates chiefComplaint and clinicalNotes while OPEN", async () => {
    const response = await request(app)
      .patch(`/api/v1/clinical-encounters/${encounterId}`)
      .set("Authorization", `Bearer ${providerToken}`)
      .send({
        chiefComplaint: "TEST-ENC updated complaint",
        clinicalNotes: "TEST-ENC updated notes",
      })
      .expect(200);

    expect(response.body.data.chiefComplaint).toBe(
      "TEST-ENC updated complaint",
    );
    expect(response.body.data.clinicalNotes).toBe("TEST-ENC updated notes");
  });

  it("rejects duplicate encounter for the same appointment", async () => {
    const response = await postEncounter(appointmentId).expect(409);

    expect(response.body.error.code).toBe(
      "CLINICAL_ENCOUNTER_ALREADY_EXISTS",
    );
  });

  it("rejects invalid appointment states and missing appointment", async () => {
    await postEncounter(999999999999n)
      .expect(404)
      .expect((response) => {
        expect(response.body.error.code).toBe("APPOINTMENT_NOT_FOUND");
      });

    await postEncounter(otherOrganizationAppointmentId)
      .expect(404)
      .expect((response) => {
        expect(response.body.error.code).toBe("APPOINTMENT_NOT_FOUND");
      });

    for (const blockedAppointmentId of [
      cancelledAppointmentId,
      noShowAppointmentId,
      completedAppointmentId,
      scheduledAppointmentId,
    ]) {
      await postEncounter(blockedAppointmentId)
        .expect(409)
        .expect((response) => {
          expect(response.body.error.code).toBe("INVALID_APPOINTMENT_STATUS");
        });
    }
  });

  it("rejects invalid encounter id", async () => {
    const response = await request(app)
      .get("/api/v1/clinical-encounters/not-a-number")
      .set("Authorization", `Bearer ${providerToken}`)
      .expect(400);

    expect(response.body.error.code).toBe("INVALID_ID");
  });

  it("completes encounter and makes it immutable", async () => {
    const response = await request(app)
      .post(`/api/v1/clinical-encounters/${encounterId}/complete`)
      .set("Authorization", `Bearer ${providerToken}`)
      .expect(200);

    expect(response.body.data.status).toBe("COMPLETED");
    expect(response.body.data.completedAt).toEqual(expect.any(String));

    await request(app)
      .patch(`/api/v1/clinical-encounters/${encounterId}`)
      .set("Authorization", `Bearer ${providerToken}`)
      .send({
        clinicalNotes: "TEST-ENC not editable",
      })
      .expect(409)
      .expect((patchResponse) => {
        expect(patchResponse.body.error.code).toBe(
          "CLINICAL_ENCOUNTER_NOT_EDITABLE",
        );
      });

    await request(app)
      .post(`/api/v1/clinical-encounters/${encounterId}/complete`)
      .set("Authorization", `Bearer ${providerToken}`)
      .expect(409)
      .expect((completeResponse) => {
        expect(completeResponse.body.error.code).toBe(
          "CLINICAL_ENCOUNTER_ALREADY_COMPLETED",
        );
      });
  });

  it("rejects VOID encounter completion as invalid status", async () => {
    const voidAppointmentId = await createAppointmentFixture(
      "TEST-ENC-APT-VOID",
      "IN_PROGRESS",
      "2026-10-01T16:00:00-04:00",
    );

    const encounter = await prisma.clinicalEncounter.create({
      data: {
        appointmentId: voidAppointmentId,
        providerId,
        status: "VOID",
        startedAt: new Date(),
        chiefComplaint: "TEST-ENC void",
        createdByUserId: providerUserId,
      },
      select: {
        id: true,
      },
    });

    await request(app)
      .post(`/api/v1/clinical-encounters/${encounter.id.toString()}/complete`)
      .set("Authorization", `Bearer ${providerToken}`)
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe(
          "INVALID_CLINICAL_ENCOUNTER_STATUS",
        );
      });
  });

  it("allows PROVIDER read/create/update/complete with existing permissions", async () => {
    const providerAppointmentId = await createAppointmentFixture(
      "TEST-ENC-APT-PROVIDER-RBAC",
      "IN_PROGRESS",
      "2026-10-01T17:00:00-04:00",
    );

    const created = await postEncounter(providerAppointmentId).expect(201);

    await request(app)
      .get(`/api/v1/clinical-encounters/${created.body.data.id}`)
      .set("Authorization", `Bearer ${providerToken}`)
      .expect(200);

    await request(app)
      .patch(`/api/v1/clinical-encounters/${created.body.data.id}`)
      .set("Authorization", `Bearer ${providerToken}`)
      .send({
        chiefComplaint: "TEST-ENC provider update",
      })
      .expect(200);

    await request(app)
      .post(`/api/v1/clinical-encounters/${created.body.data.id}/complete`)
      .set("Authorization", `Bearer ${providerToken}`)
      .expect(200);
  });

  it("keeps only one encounter under concurrent duplicate creation", async () => {
    const concurrentAppointmentId = await createAppointmentFixture(
      "TEST-ENC-APT-CONCURRENT",
      "IN_PROGRESS",
      "2026-10-01T18:00:00-04:00",
    );

    const [first, second] = await Promise.all([
      postEncounter(concurrentAppointmentId, providerToken, {
        chiefComplaint: "TEST-ENC concurrent A",
      }),
      postEncounter(concurrentAppointmentId, providerToken, {
        chiefComplaint: "TEST-ENC concurrent B",
      }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);

    const count = await prisma.clinicalEncounter.count({
      where: {
        appointmentId: concurrentAppointmentId,
      },
    });

    expect(count).toBe(1);
  });

  it("writes audit logs for create, update, and complete", async () => {
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entityType: "CLINICAL_ENCOUNTER",
        entityId: BigInt(encounterId),
      },
      select: {
        action: true,
        oldValues: true,
        newValues: true,
      },
    });

    expect(auditLogs.map((auditLog) => auditLog.action)).toEqual(
      expect.arrayContaining([
        "CLINICAL_ENCOUNTER_CREATE",
        "CLINICAL_ENCOUNTER_UPDATE",
        "CLINICAL_ENCOUNTER_COMPLETE",
      ]),
    );

    expect(
      auditLogs.find(
        (auditLog) => auditLog.action === "CLINICAL_ENCOUNTER_CREATE",
      )?.newValues,
    ).toBeTruthy();
    expect(
      auditLogs.find(
        (auditLog) => auditLog.action === "CLINICAL_ENCOUNTER_UPDATE",
      )?.oldValues,
    ).toBeTruthy();
    expect(
      auditLogs.find(
        (auditLog) => auditLog.action === "CLINICAL_ENCOUNTER_COMPLETE",
      )?.newValues,
    ).toBeTruthy();
  });
});
