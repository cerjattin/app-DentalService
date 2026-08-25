import request from "supertest";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { app } from "../../src/app.js";
import { prisma } from "../../src/infrastructure/database/prisma.js";
import { accessTokenService } from "../../src/modules/auth/access-token.service.js";

const ADMIN_EMAIL = "appointment.admin.integration@local.invalid";
const PROVIDER_EMAIL = "appointment.provider.integration@local.invalid";
const NO_ROLE_EMAIL = "appointment.norole.integration@local.invalid";
const OTHER_ORG_EMAIL = "appointment.other-org.integration@local.invalid";
const OTHER_ORG_LEGAL_NAME = "TEST Appointment Other Organization";

let organizationId: bigint;
let otherOrganizationId: bigint;
let adminUserId: bigint;
let adminToken: string;
let providerToken: string;
let noRoleToken: string;
let patientId: bigint;
let otherOrganizationPatientId: bigint;
let providerId: bigint;
let secondProviderId: bigint;
let inactiveProviderId: bigint;
let locationId: bigint;
let inactiveLocationId: bigint;
let appointmentId: string;
let cancelledAppointmentId: string;
let adjacentAppointmentId: string;

async function cleanupAppointmentFixture() {
  const users = await prisma.user.findMany({
    where: {
      email: {
        in: [ADMIN_EMAIL, PROVIDER_EMAIL, NO_ROLE_EMAIL, OTHER_ORG_EMAIL],
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
            startsWith: "APT-",
          },
          patient: {
            patientNumber: {
              startsWith: "TEST-APT",
            },
          },
        },
        {
          reason: {
            startsWith: "TEST-APT",
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

  await prisma.appointmentStatusHistory.deleteMany({
    where: {
      appointmentId: {
        in: appointmentIds,
      },
    },
  });

  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        {
          actorUserId: {
            in: userIds,
          },
        },
        {
          entityType: "APPOINTMENT",
          entityId: {
            in: appointmentIds,
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
            startsWith: "TEST-APT-PROV",
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
            startsWith: "TEST-APT",
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
            startsWith: "TEST-APT",
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
      firstName: "Appointment",
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

function postAppointment(start: string, end: string, token = adminToken) {
  return request(app)
    .post("/api/v1/appointments")
    .set("Authorization", `Bearer ${token}`)
    .send({
      clinicLocationId: locationId.toString(),
      patientId: patientId.toString(),
      providerId: providerId.toString(),
      scheduledStart: start,
      scheduledEnd: end,
      reason: "TEST-APT create",
      notes: "TEST-APT notes",
    });
}

describe("Appointments API", () => {
  beforeAll(async () => {
    await cleanupAppointmentFixture();

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
        tradeName: "TEST Appointment Other Org",
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
    const providerUserId = await createUser(PROVIDER_EMAIL, "PROVIDER");
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
    providerToken = await accessTokenService.sign(
      providerUserId,
      organizationId,
    );
    noRoleToken = await accessTokenService.sign(noRoleUserId, organizationId);

    const patient = await prisma.patient.create({
      data: {
        organizationId,
        patientNumber: "TEST-APT-PATIENT-001",
        firstName: "Test",
        lastName: "Appointment",
        documentNumber: "TEST-APT-DOC-001",
        status: "ACTIVE",
      },
      select: {
        id: true,
      },
    });

    patientId = patient.id;

    const otherPatient = await prisma.patient.create({
      data: {
        organizationId: otherOrganizationId,
        patientNumber: "TEST-APT-OTHER-PATIENT",
        firstName: "Other",
        lastName: "Patient",
        status: "ACTIVE",
      },
      select: {
        id: true,
      },
    });

    otherOrganizationPatientId = otherPatient.id;

    const provider = await prisma.provider.create({
      data: {
        organizationId,
        svbProviderId: "TEST-APT-PROV-001",
        firstName: "Provider",
        lastName: "Calendar",
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
        svbProviderId: "TEST-APT-PROV-002",
        firstName: "Second",
        lastName: "Provider",
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    secondProviderId = secondProvider.id;

    const inactiveProvider = await prisma.provider.create({
      data: {
        organizationId,
        svbProviderId: "TEST-APT-PROV-INACTIVE",
        firstName: "Inactive",
        lastName: "Provider",
        isActive: false,
      },
      select: {
        id: true,
      },
    });

    inactiveProviderId = inactiveProvider.id;

    const location = await prisma.clinicLocation.create({
      data: {
        organizationId,
        code: "TEST-APT-LOC-001",
        name: "TEST Appointment Location",
        countryCode: "CW",
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    locationId = location.id;

    const inactiveLocation = await prisma.clinicLocation.create({
      data: {
        organizationId,
        code: "TEST-APT-LOC-INACTIVE",
        name: "TEST Inactive Appointment Location",
        countryCode: "CW",
        isActive: false,
      },
      select: {
        id: true,
      },
    });

    inactiveLocationId = inactiveLocation.id;
  });

  afterAll(async () => {
    await cleanupAppointmentFixture();

    await prisma.$disconnect();
  });

  it("returns 401 without token and 403 without appointment.read", async () => {
    await request(app).get("/api/v1/appointments").expect(401);

    const response = await request(app)
      .get("/api/v1/appointments")
      .set("Authorization", `Bearer ${noRoleToken}`)
      .expect(403);

    expect(response.body.error.code).toBe("PERMISSION_DENIED");
  });

  it("requires appointment.create for POST", async () => {
    const response = await postAppointment(
      "2026-09-01T08:00:00-04:00",
      "2026-09-01T08:30:00-04:00",
      providerToken,
    ).expect(403);

    expect(response.body.error.code).toBe("PERMISSION_DENIED");
  });

  it("creates an appointment with generated appointmentNumber and string ids", async () => {
    const response = await postAppointment(
      "2026-09-01T09:00:00-04:00",
      "2026-09-01T09:30:00-04:00",
    ).expect(201);

    expect(response.body.data.id).toEqual(expect.any(String));
    expect(response.body.data.appointmentNumber).toMatch(/^APT-\d+$/);
    expect(response.body.data.patientId).toBe(patientId.toString());
    expect(response.body.data.providerId).toBe(providerId.toString());
    expect(response.body.data.clinicLocationId).toBe(locationId.toString());

    appointmentId = response.body.data.id;
  });

  it("gets appointment detail", async () => {
    const response = await request(app)
      .get(`/api/v1/appointments/${appointmentId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.data.id).toBe(appointmentId);
    expect(response.body.data.patient.patientNumber).toBe(
      "TEST-APT-PATIENT-001",
    );
    expect(response.body.data.provider.id).toBe(providerId.toString());
    expect(response.body.data.location.id).toBe(locationId.toString());
  });

  it("lists appointments with pagination and filters", async () => {
    const byPatient = await request(app)
      .get(`/api/v1/appointments?patientId=${patientId.toString()}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(byPatient.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: appointmentId,
        }),
      ]),
    );

    const byProviderAndDate = await request(app)
      .get(
        `/api/v1/appointments?providerId=${providerId.toString()}&date=2026-09-01&page=1&pageSize=1`,
      )
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(byProviderAndDate.body.data).toHaveLength(1);
    expect(byProviderAndDate.body.meta.total).toBeGreaterThanOrEqual(1);

    const byRange = await request(app)
      .get(
        "/api/v1/appointments?from=2026-09-01T00:00:00-04:00&to=2026-09-02T00:00:00-04:00",
      )
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(byRange.body.data.length).toBeGreaterThanOrEqual(1);

    const byQuery = await request(app)
      .get("/api/v1/appointments?q=TEST-APT-PATIENT")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(byQuery.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it("rejects invalid entities and appointment periods", async () => {
    let response = await request(app)
      .post("/api/v1/appointments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        clinicLocationId: locationId.toString(),
        patientId: "999999999999",
        providerId: providerId.toString(),
        scheduledStart: "2026-09-01T10:00:00-04:00",
        scheduledEnd: "2026-09-01T10:30:00-04:00",
      })
      .expect(404);

    expect(response.body.error.code).toBe("PATIENT_NOT_FOUND");

    response = await request(app)
      .post("/api/v1/appointments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        clinicLocationId: locationId.toString(),
        patientId: otherOrganizationPatientId.toString(),
        providerId: providerId.toString(),
        scheduledStart: "2026-09-01T10:00:00-04:00",
        scheduledEnd: "2026-09-01T10:30:00-04:00",
      })
      .expect(404);

    expect(response.body.error.code).toBe("PATIENT_NOT_FOUND");

    response = await request(app)
      .post("/api/v1/appointments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        clinicLocationId: locationId.toString(),
        patientId: patientId.toString(),
        providerId: "999999999999",
        scheduledStart: "2026-09-01T10:00:00-04:00",
        scheduledEnd: "2026-09-01T10:30:00-04:00",
      })
      .expect(404);

    expect(response.body.error.code).toBe("PROVIDER_NOT_FOUND");

    response = await request(app)
      .post("/api/v1/appointments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        clinicLocationId: locationId.toString(),
        patientId: patientId.toString(),
        providerId: inactiveProviderId.toString(),
        scheduledStart: "2026-09-01T10:00:00-04:00",
        scheduledEnd: "2026-09-01T10:30:00-04:00",
      })
      .expect(409);

    expect(response.body.error.code).toBe("PROVIDER_INACTIVE");

    response = await request(app)
      .post("/api/v1/appointments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        clinicLocationId: "999999999999",
        patientId: patientId.toString(),
        providerId: providerId.toString(),
        scheduledStart: "2026-09-01T10:00:00-04:00",
        scheduledEnd: "2026-09-01T10:30:00-04:00",
      })
      .expect(404);

    expect(response.body.error.code).toBe("LOCATION_NOT_FOUND");

    response = await request(app)
      .post("/api/v1/appointments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        clinicLocationId: inactiveLocationId.toString(),
        patientId: patientId.toString(),
        providerId: providerId.toString(),
        scheduledStart: "2026-09-01T10:00:00-04:00",
        scheduledEnd: "2026-09-01T10:30:00-04:00",
      })
      .expect(409);

    expect(response.body.error.code).toBe("LOCATION_INACTIVE");

    response = await request(app)
      .post("/api/v1/appointments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        clinicLocationId: locationId.toString(),
        patientId: patientId.toString(),
        providerId: providerId.toString(),
        scheduledStart: "2026-09-01T10:30:00-04:00",
        scheduledEnd: "2026-09-01T10:30:00-04:00",
      })
      .expect(400);

    expect(response.body.error.code).toBe("INVALID_APPOINTMENT_PERIOD");
  });

  it("enforces provider overlap rules and allows adjacent slots", async () => {
    await postAppointment(
      "2026-09-01T09:15:00-04:00",
      "2026-09-01T09:45:00-04:00",
    )
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("APPOINTMENT_PROVIDER_OVERLAP");
      });

    await postAppointment(
      "2026-09-01T09:15:00-04:00",
      "2026-09-01T09:30:00-04:00",
    ).expect(409);

    await postAppointment(
      "2026-09-01T08:30:00-04:00",
      "2026-09-01T10:30:00-04:00",
    ).expect(409);

    const adjacent = await postAppointment(
      "2026-09-01T09:30:00-04:00",
      "2026-09-01T10:00:00-04:00",
    ).expect(201);

    adjacentAppointmentId = adjacent.body.data.id;
  });

  it("patches an appointment and excludes itself from overlap detection", async () => {
    const response = await request(app)
      .patch(`/api/v1/appointments/${appointmentId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        notes: "TEST-APT updated notes",
        scheduledStart: "2026-09-01T09:00:00-04:00",
        scheduledEnd: "2026-09-01T09:30:00-04:00",
      })
      .expect(200);

    expect(response.body.data.notes).toBe("TEST-APT updated notes");
  });

  it("requires appointment.update for PATCH appointments", async () => {
    const response = await request(app)
      .patch(`/api/v1/appointments/${appointmentId}`)
      .set("Authorization", `Bearer ${providerToken}`)
      .send({
        notes: "TEST-APT denied update",
      })
      .expect(403);

    expect(response.body.error.code).toBe("PERMISSION_DENIED");
  });

  it("rejects updating into an occupied slot", async () => {
    const response = await request(app)
      .patch(`/api/v1/appointments/${adjacentAppointmentId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        scheduledStart: "2026-09-01T09:15:00-04:00",
        scheduledEnd: "2026-09-01T09:45:00-04:00",
      })
      .expect(409);

    expect(response.body.error.code).toBe("APPOINTMENT_PROVIDER_OVERLAP");
  });

  it("changes status and lets cancelled appointments stop blocking slots", async () => {
    const response = await request(app)
      .patch(`/api/v1/appointments/${appointmentId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        status: "CANCELLED",
        reason: "TEST-APT patient cancelled",
      })
      .expect(200);

    expect(response.body.data.status).toBe("CANCELLED");

    cancelledAppointmentId = response.body.data.id;

    await postAppointment(
      "2026-09-01T09:00:00-04:00",
      "2026-09-01T09:30:00-04:00",
    ).expect(201);
  });

  it("rejects invalid status transitions", async () => {
    const response = await request(app)
      .patch(`/api/v1/appointments/${cancelledAppointmentId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        status: "SCHEDULED",
      })
      .expect(409);

    expect(response.body.error.code).toBe(
      "INVALID_APPOINTMENT_STATUS_TRANSITION",
    );
  });

  it("returns 404 and 400 for missing and invalid appointment ids", async () => {
    let response = await request(app)
      .get("/api/v1/appointments/999999999999")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(404);

    expect(response.body.error.code).toBe("APPOINTMENT_NOT_FOUND");

    response = await request(app)
      .get("/api/v1/appointments/not-a-number")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(400);

    expect(response.body.error.code).toBe("INVALID_ID");
  });

  it("rolls back appointment number allocation when create fails after allocation", async () => {
    const sequenceBefore = await prisma.numberSequence.findUniqueOrThrow({
      where: {
        organizationId_sequenceType_sequenceYear: {
          organizationId,
          sequenceType: "APPOINTMENT",
          sequenceYear: 2026,
        },
      },
      select: {
        currentValue: true,
      },
    });

    await postAppointment(
      "2026-09-01T09:10:00-04:00",
      "2026-09-01T09:20:00-04:00",
    ).expect(409);

    const sequenceAfter = await prisma.numberSequence.findUniqueOrThrow({
      where: {
        organizationId_sequenceType_sequenceYear: {
          organizationId,
          sequenceType: "APPOINTMENT",
          sequenceYear: 2026,
        },
      },
      select: {
        currentValue: true,
      },
    });

    expect(sequenceAfter.currentValue).toBe(sequenceBefore.currentValue);
  });

  it("prevents concurrent overlapping appointments for one provider", async () => {
    const [first, second] = await Promise.all([
      postAppointment("2026-09-02T09:00:00-04:00", "2026-09-02T09:30:00-04:00"),
      postAppointment("2026-09-02T09:00:00-04:00", "2026-09-02T09:30:00-04:00"),
    ]);

    const statuses = [first.status, second.status].sort();

    expect(statuses).toEqual([201, 409]);

    const count = await prisma.appointment.count({
      where: {
        providerId,
        scheduledStartAt: new Date("2026-09-02T13:00:00.000Z"),
        scheduledEndAt: new Date("2026-09-02T13:30:00.000Z"),
        status: {
          in: ["SCHEDULED", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS"],
        },
      },
    });

    expect(count).toBe(1);
  });

  it("allows another provider in the same slot", async () => {
    const response = await request(app)
      .post("/api/v1/appointments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        clinicLocationId: locationId.toString(),
        patientId: patientId.toString(),
        providerId: secondProviderId.toString(),
        scheduledStart: "2026-09-01T09:00:00-04:00",
        scheduledEnd: "2026-09-01T09:30:00-04:00",
        reason: "TEST-APT second provider",
      })
      .expect(201);

    expect(response.body.data.providerId).toBe(secondProviderId.toString());
  });

  it("writes appointment create, update, and status audits", async () => {
    const audits = await prisma.auditLog.findMany({
      where: {
        actorUserId: adminUserId,
        entityType: "APPOINTMENT",
        action: {
          in: [
            "APPOINTMENT_CREATE",
            "APPOINTMENT_UPDATE",
            "APPOINTMENT_STATUS_CHANGE",
          ],
        },
      },
      select: {
        action: true,
        oldValues: true,
        newValues: true,
      },
    });

    expect(audits.map((audit) => audit.action)).toEqual(
      expect.arrayContaining([
        "APPOINTMENT_CREATE",
        "APPOINTMENT_UPDATE",
        "APPOINTMENT_STATUS_CHANGE",
      ]),
    );

    expect(
      audits.find((audit) => audit.action === "APPOINTMENT_CREATE")?.newValues,
    ).not.toBeNull();
    expect(
      audits.find((audit) => audit.action === "APPOINTMENT_UPDATE")?.oldValues,
    ).not.toBeNull();
    expect(
      audits.find((audit) => audit.action === "APPOINTMENT_STATUS_CHANGE")
        ?.newValues,
    ).not.toBeNull();
  });
});
