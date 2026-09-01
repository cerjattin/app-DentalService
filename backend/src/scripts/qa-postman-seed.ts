import "dotenv/config";

import { readFile, writeFile } from "node:fs/promises";

import argon2 from "argon2";

import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../infrastructure/database/prisma.js";

const QA = "QA-POSTMAN";
const QA_PASSWORD = "QaPostman!2026";
// QA-only SVB layout fixtures. Synthetic E2E values; not production defaults.
const QA_DECLARANT_ID = "54321";
const QA_INSURED_ID = "900101001";
const QA_TREATMENT_ID = "QAT0001";
const QA_NUMBER_OF_TREATMENTS = "1";
const QA_ASSISTANCE = "N";
const QA_POLICLINIC = "P";
const SERVICE_DATE = new Date("2027-03-10T00:00:00.000Z");
const POSTMAN_ENVIRONMENT_PATH = new URL(
  "../../postman/ODONTHO_LOCAL.postman_environment.json",
  import.meta.url,
);

const users = [
  {
    role: "ADMIN",
    email: "qa-postman.admin@local.invalid",
    firstName: "QA",
    lastName: "Admin",
  },
  {
    role: "RECEPTION",
    email: "qa-postman.reception@local.invalid",
    firstName: "QA",
    lastName: "Reception",
  },
  {
    role: "PROVIDER",
    email: "qa-postman.provider@local.invalid",
    firstName: "QA",
    lastName: "Provider",
  },
] as const;

function currentCuracaoYear() {
  const value = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Curacao",
    year: "numeric",
  }).format(new Date());

  return Number(value);
}

type PostmanEnvironmentValue = {
  key: string;
  value: string;
  type?: string;
  enabled?: boolean;
  [property: string]: unknown;
};

type PostmanEnvironment = {
  values: PostmanEnvironmentValue[];
  [property: string]: unknown;
};

async function updatePostmanEnvironment(values: Record<string, string>) {
  const rawEnvironment = await readFile(POSTMAN_ENVIRONMENT_PATH, "utf8");
  const environment = JSON.parse(rawEnvironment) as PostmanEnvironment;
  const existingValues = new Map(
    environment.values.map((value) => [value.key, value]),
  );

  for (const [key, value] of Object.entries(values)) {
    const current = existingValues.get(key);

    if (current !== undefined) {
      current.value = value;
      continue;
    }

    const newValue = {
      key,
      value,
      type: "default",
      enabled: true,
    };

    environment.values.push(newValue);
    existingValues.set(key, newValue);
  }

  await writeFile(
    POSTMAN_ENVIRONMENT_PATH,
    `${JSON.stringify(environment, null, 2)}\n`,
    "utf8",
  );
}

async function ensureUser(input: {
  organizationId: bigint;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  passwordHash: string;
}) {
  const role = await prisma.role.findUniqueOrThrow({
    where: {
      code: input.role,
    },
    select: {
      id: true,
    },
  });

  const user = await prisma.user.upsert({
    where: {
      email: input.email,
    },
    create: {
      organizationId: input.organizationId,
      email: input.email,
      passwordHash: input.passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      status: "ACTIVE",
      passwordChangedAt: new Date(),
    },
    update: {
      organizationId: input.organizationId,
      passwordHash: input.passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      status: "ACTIVE",
      archivedAt: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
      passwordChangedAt: new Date(),
    },
    select: {
      id: true,
      email: true,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: role.id,
      },
    },
    create: {
      userId: user.id,
      roleId: role.id,
      assignedByUserId: null,
    },
    update: {},
  });

  return user;
}

async function ensureNumberSequences(organizationId: bigint) {
  const year = currentCuracaoYear();
  const sequences = [
    { sequenceType: "PATIENT", sequenceYear: 0, prefix: "QAP-" },
    { sequenceType: "APPOINTMENT", sequenceYear: year, prefix: "QAA-" },
    { sequenceType: "INVOICE", sequenceYear: year, prefix: "QAI-" },
    { sequenceType: "DECLARATION", sequenceYear: year, prefix: "QAD-" },
  ] as const;

  for (const sequence of sequences) {
    await prisma.numberSequence.upsert({
      where: {
        organizationId_sequenceType_sequenceYear: {
          organizationId,
          sequenceType: sequence.sequenceType,
          sequenceYear: sequence.sequenceYear,
        },
      },
      create: {
        organizationId,
        sequenceType: sequence.sequenceType,
        sequenceYear: sequence.sequenceYear,
        prefix: sequence.prefix,
        currentValue: 0n,
        padding: 6,
      },
      update: {
        prefix: sequence.prefix,
        padding: 6,
      },
    });
  }
}

async function main() {
  const passwordHash = await argon2.hash(QA_PASSWORD, {
    type: argon2.argon2id,
  });

  const organization = await prisma.organization.upsert({
    where: {
      declarantId: "QA-POSTMAN-DECLARANT",
    },
    create: {
      legalName: `${QA} Organization`,
      tradeName: `${QA} Dental QA`,
      declarantId: "QA-POSTMAN-DECLARANT",
      registrationNumber: "QA-POSTMAN-REG",
      email: "qa-postman.org@local.invalid",
      phone: "+5999000000",
      addressLine1: "QA Postman Street 1",
      city: "Willemstad",
      countryCode: "CW",
      timezone: "America/Curacao",
      isActive: true,
    },
    update: {
      legalName: `${QA} Organization`,
      tradeName: `${QA} Dental QA`,
      declarantId: "QA-POSTMAN-DECLARANT",
      registrationNumber: "QA-POSTMAN-REG",
      email: "qa-postman.org@local.invalid",
      phone: "+5999000000",
      addressLine1: "QA Postman Street 1",
      city: "Willemstad",
      countryCode: "CW",
      timezone: "America/Curacao",
      isActive: true,
      archivedAt: null,
    },
    select: {
      id: true,
    },
  });

  const otherOrganization = await prisma.organization.upsert({
    where: {
      declarantId: "QA-POSTMAN-OTHER-DECL",
    },
    create: {
      legalName: `${QA} Other Organization`,
      tradeName: `${QA} Other Dental QA`,
      declarantId: "QA-POSTMAN-OTHER-DECL",
      timezone: "America/Curacao",
      isActive: true,
    },
    update: {
      legalName: `${QA} Other Organization`,
      tradeName: `${QA} Other Dental QA`,
      timezone: "America/Curacao",
      isActive: true,
      archivedAt: null,
    },
    select: {
      id: true,
    },
  });

  await ensureNumberSequences(organization.id);
  await ensureNumberSequences(otherOrganization.id);

  const admin = await ensureUser({
    organizationId: organization.id,
    email: users[0].email,
    firstName: users[0].firstName,
    lastName: users[0].lastName,
    role: users[0].role,
    passwordHash,
  });
  const reception = await ensureUser({
    organizationId: organization.id,
    email: users[1].email,
    firstName: users[1].firstName,
    lastName: users[1].lastName,
    role: users[1].role,
    passwordHash,
  });
  const providerUser = await ensureUser({
    organizationId: organization.id,
    email: users[2].email,
    firstName: users[2].firstName,
    lastName: users[2].lastName,
    role: users[2].role,
    passwordHash,
  });

  const location = await prisma.clinicLocation.upsert({
    where: {
      organizationId_code: {
        organizationId: organization.id,
        code: "QA-POSTMAN-LOC",
      },
    },
    create: {
      organizationId: organization.id,
      code: "QA-POSTMAN-LOC",
      name: "QA Postman Clinic",
      policlinicCode: QA_POLICLINIC,
      addressLine1: "QA Postman Street 1",
      city: "Willemstad",
      countryCode: "CW",
      isActive: true,
    },
    update: {
      name: "QA Postman Clinic",
      policlinicCode: QA_POLICLINIC,
      isActive: true,
      archivedAt: null,
    },
    select: {
      id: true,
    },
  });

  const provider = await prisma.provider.upsert({
    where: {
      organizationId_svbProviderId: {
        organizationId: organization.id,
        svbProviderId: "12345",
      },
    },
    create: {
      organizationId: organization.id,
      userId: providerUser.id,
      svbProviderId: "12345",
      firstName: "QA",
      lastName: "Clinician",
      licenseNumber: "QA-POSTMAN-LIC",
      specialty: "General Dentistry",
      email: "qa-postman.provider@local.invalid",
      phone: "+5999000001",
      isActive: true,
    },
    update: {
      userId: providerUser.id,
      firstName: "QA",
      lastName: "Clinician",
      licenseNumber: "QA-POSTMAN-LIC",
      specialty: "General Dentistry",
      email: "qa-postman.provider@local.invalid",
      phone: "+5999000001",
      isActive: true,
      archivedAt: null,
    },
    select: {
      id: true,
    },
  });

  const payer = await prisma.payer.upsert({
    where: {
      code: "QA-POSTMAN-SVB",
    },
    create: {
      code: "QA-POSTMAN-SVB",
      name: "QA Postman SVB Payer",
      payerType: "STATE_INSURANCE",
      isActive: true,
    },
    update: {
      name: "QA Postman SVB Payer",
      payerType: "STATE_INSURANCE",
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  const patient = await prisma.patient.upsert({
    where: {
      organizationId_patientNumber: {
        organizationId: organization.id,
        patientNumber: "QA-POSTMAN-PAT-001",
      },
    },
    create: {
      organizationId: organization.id,
      patientNumber: "QA-POSTMAN-PAT-001",
      firstName: "QA",
      lastName: "Patient",
      dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
      sex: "UNKNOWN",
      documentType: "QA",
      documentNumber: "QA-POSTMAN-DOC-001",
      email: "qa-postman.patient@local.invalid",
      phone: "+5999000002",
      status: "ACTIVE",
    },
    update: {
      firstName: "QA",
      lastName: "Patient",
      email: "qa-postman.patient@local.invalid",
      phone: "+5999000002",
      status: "ACTIVE",
      archivedAt: null,
    },
    select: {
      id: true,
    },
  });

  const treatmentCase = await prisma.treatmentCase.upsert({
    where: {
      patientId_treatmentId: {
        patientId: patient.id,
        treatmentId: QA_TREATMENT_ID,
      },
    },
    create: {
      organizationId: organization.id,
      patientId: patient.id,
      treatmentId: QA_TREATMENT_ID,
      treatmentType: "QA",
      description: "QA Postman treatment case",
      status: "ACTIVE",
      startedAt: new Date("2027-01-01T00:00:00.000Z"),
      createdByUserId: admin.id,
    },
    update: {
      organizationId: organization.id,
      treatmentType: "QA",
      description: "QA Postman treatment case",
      status: "ACTIVE",
      startedAt: new Date("2027-01-01T00:00:00.000Z"),
      completedAt: null,
    },
    select: {
      id: true,
    },
  });

  const insurance = await prisma.patientInsurance.upsert({
    where: {
      patientId_payerId_insuredId_validFrom: {
        patientId: patient.id,
        payerId: payer.id,
        insuredId: QA_INSURED_ID,
        validFrom: new Date("2027-01-01T00:00:00.000Z"),
      },
    },
    create: {
      patientId: patient.id,
      payerId: payer.id,
      insuredId: QA_INSURED_ID,
      validFrom: new Date("2027-01-01T00:00:00.000Z"),
      validTo: new Date("2027-12-31T00:00:00.000Z"),
      status: "ACTIVE",
      isPrimary: true,
      verifiedAt: new Date(),
      verifiedByUserId: reception.id,
      verificationSource: "QA_POSTMAN_SEED",
    },
    update: {
      validTo: new Date("2027-12-31T00:00:00.000Z"),
      status: "ACTIVE",
      isPrimary: true,
      verifiedAt: new Date(),
      verifiedByUserId: reception.id,
      verificationSource: "QA_POSTMAN_SEED",
    },
    select: {
      id: true,
    },
  });

  const diagnosis = await prisma.diagnosisCode.upsert({
    where: {
      codeSystem_code: {
        codeSystem: "QA-POSTMAN",
        code: "QA-DX-001",
      },
    },
    create: {
      codeSystem: "QA-POSTMAN",
      code: "QA-DX-001",
      description: "QA Postman diagnosis",
      isActive: true,
      validFrom: new Date("2027-01-01T00:00:00.000Z"),
    },
    update: {
      description: "QA Postman diagnosis",
      isActive: true,
      validFrom: new Date("2027-01-01T00:00:00.000Z"),
      validTo: null,
    },
    select: {
      id: true,
    },
  });

  const noAuthProcedure = await prisma.svbProcedure.upsert({
    where: {
      code: "QA-NOAUTH",
    },
    create: {
      code: "QA-NOAUTH",
      description: "QA procedure without authorization",
      category: "QA",
      unit: "SESSION",
      requiresAuthorization: false,
      requiresReferral: false,
      isActive: true,
      validFrom: new Date("2027-01-01T00:00:00.000Z"),
    },
    update: {
      description: "QA procedure without authorization",
      category: "QA",
      unit: "SESSION",
      requiresAuthorization: false,
      requiresReferral: false,
      isActive: true,
      validFrom: new Date("2027-01-01T00:00:00.000Z"),
      validTo: null,
    },
    select: {
      id: true,
    },
  });

  const authProcedure = await prisma.svbProcedure.upsert({
    where: {
      code: "QA-AUTH",
    },
    create: {
      code: "QA-AUTH",
      description: "QA procedure requiring authorization",
      category: "QA",
      unit: "SESSION",
      requiresAuthorization: true,
      requiresReferral: false,
      isActive: true,
      validFrom: new Date("2027-01-01T00:00:00.000Z"),
    },
    update: {
      description: "QA procedure requiring authorization",
      category: "QA",
      unit: "SESSION",
      requiresAuthorization: true,
      requiresReferral: false,
      isActive: true,
      validFrom: new Date("2027-01-01T00:00:00.000Z"),
      validTo: null,
    },
    select: {
      id: true,
    },
  });

  const [noAuthTariff, authTariff] = await Promise.all([
    prisma.svbTariff.upsert({
      where: {
        svbProcedureId_currencyCode_validFrom: {
          svbProcedureId: noAuthProcedure.id,
          currencyCode: "ANG",
          validFrom: new Date("2027-01-01T00:00:00.000Z"),
        },
      },
      create: {
        svbProcedureId: noAuthProcedure.id,
        currencyCode: "ANG",
        amount: new Prisma.Decimal("75.00"),
        validFrom: new Date("2027-01-01T00:00:00.000Z"),
        validTo: null,
        isActive: true,
      },
      update: {
        amount: new Prisma.Decimal("75.00"),
        validTo: null,
        isActive: true,
      },
      select: {
        id: true,
      },
    }),
    prisma.svbTariff.upsert({
      where: {
        svbProcedureId_currencyCode_validFrom: {
          svbProcedureId: authProcedure.id,
          currencyCode: "ANG",
          validFrom: new Date("2027-01-01T00:00:00.000Z"),
        },
      },
      create: {
        svbProcedureId: authProcedure.id,
        currencyCode: "ANG",
        amount: new Prisma.Decimal("125.50"),
        validFrom: new Date("2027-01-01T00:00:00.000Z"),
        validTo: null,
        isActive: true,
      },
      update: {
        amount: new Prisma.Decimal("125.50"),
        validTo: null,
        isActive: true,
      },
      select: {
        id: true,
      },
    }),
  ]);

  const authorization = await prisma.svbAuthorization.upsert({
    where: {
      patientInsuranceId_authorizationId: {
        patientInsuranceId: insurance.id,
        authorizationId: "QA-POSTMAN-AUTH-001",
      },
    },
    create: {
      patientId: patient.id,
      patientInsuranceId: insurance.id,
      authorizationId: "QA-POSTMAN-AUTH-001",
      status: "APPROVED",
      validFrom: new Date("2027-01-01T00:00:00.000Z"),
      validTo: new Date("2027-12-31T00:00:00.000Z"),
      issuedAt: new Date("2027-01-02T12:00:00.000Z"),
      notes: "QA Postman authorization",
      metadata: {
        source: "qa-postman-seed",
      },
      createdByUserId: admin.id,
    },
    update: {
      patientId: patient.id,
      status: "APPROVED",
      validFrom: new Date("2027-01-01T00:00:00.000Z"),
      validTo: new Date("2027-12-31T00:00:00.000Z"),
      issuedAt: new Date("2027-01-02T12:00:00.000Z"),
      notes: "QA Postman authorization",
      metadata: {
        source: "qa-postman-seed",
      },
    },
    select: {
      id: true,
    },
  });

  const existingAuthItem = await prisma.svbAuthorizationItem.findFirst({
    where: {
      authorizationId: authorization.id,
      svbProcedureId: authProcedure.id,
      notes: "QA Postman authorized item",
    },
    select: {
      id: true,
    },
  });

  const authorizationItem =
    existingAuthItem ??
    (await prisma.svbAuthorizationItem.create({
      data: {
        authorizationId: authorization.id,
        svbProcedureId: authProcedure.id,
        procedureCodeSnapshot: "QA-AUTH",
        authorizedQuantity: new Prisma.Decimal("10.00"),
        usedQuantity: new Prisma.Decimal("0.00"),
        validFrom: new Date("2027-01-01T00:00:00.000Z"),
        validTo: new Date("2027-12-31T00:00:00.000Z"),
        notes: "QA Postman authorized item",
      },
      select: {
        id: true,
      },
    }));

  const normalAppointment = await prisma.appointment.upsert({
    where: {
      organizationId_appointmentNumber: {
        organizationId: organization.id,
        appointmentNumber: "QA-POSTMAN-APT-NORMAL",
      },
    },
    create: {
      organizationId: organization.id,
      appointmentNumber: "QA-POSTMAN-APT-NORMAL",
      patientId: patient.id,
      providerId: provider.id,
      clinicLocationId: location.id,
      treatmentCaseId: treatmentCase.id,
      scheduledStartAt: new Date("2027-03-10T13:00:00.000Z"),
      scheduledEndAt: new Date("2027-03-10T13:30:00.000Z"),
      status: "SCHEDULED",
      reason: "QA Postman normal appointment",
      createdByUserId: reception.id,
    },
    update: {
      patientId: patient.id,
      providerId: provider.id,
      clinicLocationId: location.id,
      treatmentCaseId: treatmentCase.id,
      scheduledStartAt: new Date("2027-03-10T13:00:00.000Z"),
      scheduledEndAt: new Date("2027-03-10T13:30:00.000Z"),
      status: "SCHEDULED",
      reason: "QA Postman normal appointment",
      cancelledAt: null,
      cancellationReason: null,
      checkedInAt: null,
      startedAt: null,
      completedAt: null,
    },
    select: {
      id: true,
    },
  });

  const overlapAppointment = await prisma.appointment.upsert({
    where: {
      organizationId_appointmentNumber: {
        organizationId: organization.id,
        appointmentNumber: "QA-POSTMAN-APT-OVERLAP",
      },
    },
    create: {
      organizationId: organization.id,
      appointmentNumber: "QA-POSTMAN-APT-OVERLAP",
      patientId: patient.id,
      providerId: provider.id,
      clinicLocationId: location.id,
      treatmentCaseId: treatmentCase.id,
      scheduledStartAt: new Date("2027-03-11T13:00:00.000Z"),
      scheduledEndAt: new Date("2027-03-11T13:30:00.000Z"),
      status: "CONFIRMED",
      reason: "QA Postman overlap guard",
      createdByUserId: reception.id,
    },
    update: {
      scheduledStartAt: new Date("2027-03-11T13:00:00.000Z"),
      scheduledEndAt: new Date("2027-03-11T13:30:00.000Z"),
      status: "CONFIRMED",
      cancelledAt: null,
      cancellationReason: null,
    },
    select: {
      id: true,
    },
  });

  const cancelledAppointment = await prisma.appointment.upsert({
    where: {
      organizationId_appointmentNumber: {
        organizationId: organization.id,
        appointmentNumber: "QA-POSTMAN-APT-CANCELLED",
      },
    },
    create: {
      organizationId: organization.id,
      appointmentNumber: "QA-POSTMAN-APT-CANCELLED",
      patientId: patient.id,
      providerId: provider.id,
      clinicLocationId: location.id,
      treatmentCaseId: treatmentCase.id,
      scheduledStartAt: new Date("2027-03-12T13:00:00.000Z"),
      scheduledEndAt: new Date("2027-03-12T13:30:00.000Z"),
      status: "CANCELLED",
      reason: "QA Postman cancelled appointment",
      createdByUserId: reception.id,
      cancelledAt: new Date(),
      cancellationReason: "QA Postman cancellation",
    },
    update: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancellationReason: "QA Postman cancellation",
    },
    select: {
      id: true,
    },
  });

  const noShowAppointment = await prisma.appointment.upsert({
    where: {
      organizationId_appointmentNumber: {
        organizationId: organization.id,
        appointmentNumber: "QA-POSTMAN-APT-NO-SHOW",
      },
    },
    create: {
      organizationId: organization.id,
      appointmentNumber: "QA-POSTMAN-APT-NO-SHOW",
      patientId: patient.id,
      providerId: provider.id,
      clinicLocationId: location.id,
      treatmentCaseId: treatmentCase.id,
      scheduledStartAt: new Date("2027-03-13T13:00:00.000Z"),
      scheduledEndAt: new Date("2027-03-13T13:30:00.000Z"),
      status: "NO_SHOW",
      reason: "QA Postman no-show appointment",
      createdByUserId: reception.id,
    },
    update: {
      status: "NO_SHOW",
      scheduledStartAt: new Date("2027-03-13T13:00:00.000Z"),
      scheduledEndAt: new Date("2027-03-13T13:30:00.000Z"),
    },
    select: {
      id: true,
    },
  });

  const output = {
    baseUrl: "http://localhost:3000",
    password: QA_PASSWORD,
    organizationId: organization.id.toString(),
    otherOrganizationId: otherOrganization.id.toString(),
    adminEmail: admin.email,
    receptionEmail: reception.email,
    providerEmail: providerUser.email,
    clinicLocationId: location.id.toString(),
    providerId: provider.id.toString(),
    payerId: payer.id.toString(),
    patientId: patient.id.toString(),
    treatmentCaseId: treatmentCase.id.toString(),
    insuranceId: insurance.id.toString(),
    diagnosisCodeId: diagnosis.id.toString(),
    procedureNoAuthId: noAuthProcedure.id.toString(),
    procedureAuthId: authProcedure.id.toString(),
    noAuthorizationTariffId: noAuthTariff.id.toString(),
    authorizationTariffId: authTariff.id.toString(),
    authorizationId: authorization.id.toString(),
    authorizationItemId: authorizationItem.id.toString(),
    normalAppointmentId: normalAppointment.id.toString(),
    overlapAppointmentId: overlapAppointment.id.toString(),
    cancelledAppointmentId: cancelledAppointment.id.toString(),
    noShowAppointmentId: noShowAppointment.id.toString(),
    serviceDate: SERVICE_DATE.toISOString().slice(0, 10),
    qaDeclarantId: QA_DECLARANT_ID,
    qaTreatmentId: QA_TREATMENT_ID,
    qaNumberOfTreatments: QA_NUMBER_OF_TREATMENTS,
    qaAssistance: QA_ASSISTANCE,
    qaPoliclinic: QA_POLICLINIC,
  };

  await updatePostmanEnvironment({
    baseUrl: output.baseUrl,
    qaPassword: output.password,
    organizationId: output.organizationId,
    otherOrganizationId: output.otherOrganizationId,
    clinicLocationId: output.clinicLocationId,
    providerId: output.providerId,
    payerId: output.payerId,
    patientId: output.patientId,
    treatmentCaseId: output.treatmentCaseId,
    insuranceId: output.insuranceId,
    diagnosisCodeId: output.diagnosisCodeId,
    procedureNoAuthId: output.procedureNoAuthId,
    procedureAuthId: output.procedureAuthId,
    noAuthorizationTariffId: output.noAuthorizationTariffId,
    authorizationTariffId: output.authorizationTariffId,
    authorizationId: output.authorizationId,
    authorizationItemId: output.authorizationItemId,
    appointmentId: output.normalAppointmentId,
    overlapAppointmentId: output.overlapAppointmentId,
    cancelledAppointmentId: output.cancelledAppointmentId,
    noShowAppointmentId: output.noShowAppointmentId,
    serviceDate: output.serviceDate,
    qaDeclarantId: output.qaDeclarantId,
    qaTreatmentId: output.qaTreatmentId,
    qaNumberOfTreatments: output.qaNumberOfTreatments,
    qaAssistance: output.qaAssistance,
    qaPoliclinic: output.qaPoliclinic,
  });

  console.log(JSON.stringify(output, null, 2));
}

main()
  .catch((error) => {
    console.error("QA Postman seed failed");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
