import request from "supertest";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { app } from "../../src/app.js";
import { Prisma } from "../../src/generated/prisma/client.js";
import { prisma } from "../../src/infrastructure/database/prisma.js";
import { accessTokenService } from "../../src/modules/auth/access-token.service.js";
import {
  buildInvoiceSignatureCanonicalContent,
  computeInvoiceContentHash,
} from "../../src/modules/invoices/invoice-signature-canonicalizer.js";
import { getDefaultSequenceYear } from "../../src/modules/number-sequences/number-sequence-year.js";

const ADMIN_EMAIL = "invoice.admin@local.invalid";
const RECEPTION_EMAIL = "invoice.reception@local.invalid";
const PROVIDER_EMAIL = "invoice.provider@local.invalid";
const NO_ROLE_EMAIL = "invoice.norole@local.invalid";
const OTHER_ORG_LEGAL_NAME = "TEST Invoice Other Organization";

let organizationId: bigint;
let otherOrganizationId: bigint;
let payerId: bigint;
let adminUserId: bigint;
let receptionUserId: bigint;
let adminToken: string;
let receptionToken: string;
let providerToken: string;
let noRoleToken: string;
let patientId: bigint;
let providerId: bigint;
let locationId: bigint;
let insuranceId: bigint;
let procedureAId: bigint;
let procedureBId: bigint;
let tariffAId: bigint;
let tariffBId: bigint;
let createdInvoiceId: string;
let createdVersionId: string;
let createdInvoiceNumber: string;

async function cleanupInvoiceFixture() {
  const users = await prisma.user.findMany({
    where: {
      email: {
        in: [ADMIN_EMAIL, RECEPTION_EMAIL, PROVIDER_EMAIL, NO_ROLE_EMAIL],
      },
    },
    select: { id: true },
  });
  const userIds = users.map((user) => user.id);

  const invoices = await prisma.invoice.findMany({
    where: {
      OR: [
        { appointment: { appointmentNumber: { startsWith: "TEST-INV-APT" } } },
        { organization: { legalName: OTHER_ORG_LEGAL_NAME } },
      ],
    },
    select: {
      id: true,
      invoiceNumber: true,
      versions: { select: { id: true } },
    },
  });
  const invoiceIds = invoices.map((invoice) => invoice.id);
  const invoiceNumbers = invoices
    .map((invoice) => invoice.invoiceNumber)
    .filter((value): value is string => value !== null);
  const versionIds = invoices.flatMap((invoice) =>
    invoice.versions.map((version) => version.id),
  );

  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { actorUserId: { in: userIds } },
        { entityType: "INVOICE", entityId: { in: invoiceIds } },
        { entityKey: { in: invoiceNumbers } },
      ],
    },
  });
  await prisma.invoiceStatusHistory.deleteMany({
    where: { invoiceId: { in: invoiceIds } },
  });
  await prisma.signature.deleteMany({
    where: {
      OR: [
        { invoiceVersionId: { in: versionIds } },
        { signatureDocument: { storageUri: { startsWith: "test://invoice-signature/" } } },
      ],
    },
  });
  await prisma.document.deleteMany({
    where: { storageUri: { startsWith: "test://invoice-signature/" } },
  });
  await prisma.invoiceCorrection.deleteMany({
    where: { invoiceId: { in: invoiceIds } },
  });
  await prisma.invoiceItem.deleteMany({
    where: {
      invoiceVersionId: { in: versionIds },
      sourceInvoiceItemId: { not: null },
    },
  });
  await prisma.invoiceItem.deleteMany({
    where: {
      invoiceVersionId: { in: versionIds },
      sourceInvoiceItemId: null,
    },
  });
  await prisma.invoice.updateMany({
    where: { id: { in: invoiceIds } },
    data: { currentVersionId: null },
  });
  await prisma.invoiceVersion.updateMany({
    where: {
      id: { in: versionIds },
      supersedesVersionId: { in: versionIds },
    },
    data: { supersedesVersionId: null },
  });
  await prisma.invoiceVersion.deleteMany({
    where: { id: { in: versionIds } },
  });
  await prisma.invoice.deleteMany({
    where: { id: { in: invoiceIds } },
  });

  const appointments = await prisma.appointment.findMany({
    where: {
      OR: [
        { appointmentNumber: { startsWith: "TEST-INV-APT" } },
        { organization: { legalName: OTHER_ORG_LEGAL_NAME } },
      ],
    },
    select: { id: true },
  });
  const appointmentIds = appointments.map((appointment) => appointment.id);

  const encounterProcedures = await prisma.encounterProcedure.findMany({
    where: {
      OR: [
        { procedureCodeSnapshot: { startsWith: "TEST-INV-PROC" } },
        { encounter: { appointmentId: { in: appointmentIds } } },
      ],
    },
    select: { id: true },
  });
  const encounterProcedureIds = encounterProcedures.map(
    (procedure) => procedure.id,
  );

  await prisma.invoiceItem.deleteMany({
    where: {
      encounterProcedureId: {
        in: encounterProcedureIds,
      },
    },
  });

  await prisma.encounterProcedure.deleteMany({
    where: {
      OR: [
        { procedureCodeSnapshot: { startsWith: "TEST-INV-PROC" } },
        { encounter: { appointmentId: { in: appointmentIds } } },
      ],
    },
  });
  await prisma.encounterDiagnosis.deleteMany({
    where: { encounter: { appointmentId: { in: appointmentIds } } },
  });
  await prisma.clinicalEncounter.deleteMany({
    where: { appointmentId: { in: appointmentIds } },
  });
  await prisma.appointmentStatusHistory.deleteMany({
    where: { appointmentId: { in: appointmentIds } },
  });
  await prisma.appointment.deleteMany({
    where: { id: { in: appointmentIds } },
  });
  await prisma.patientInsurance.deleteMany({
    where: { insuredId: { startsWith: "TEST-INV-INS" } },
  });
  await prisma.svbTariff.deleteMany({
    where: { svbProcedure: { code: { startsWith: "TEST-INV-PROC" } } },
  });
  await prisma.svbProcedure.deleteMany({
    where: { code: { startsWith: "TEST-INV-PROC" } },
  });
  await prisma.provider.deleteMany({
    where: { svbProviderId: { startsWith: "TEST-INV-PROV" } },
  });
  await prisma.patient.deleteMany({
    where: { patientNumber: { startsWith: "TEST-INV-PAT" } },
  });
  await prisma.clinicLocation.deleteMany({
    where: { code: { startsWith: "TEST-INV-LOC" } },
  });
  await prisma.userRole.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: userIds } },
  });
  await prisma.organization.deleteMany({
    where: { legalName: OTHER_ORG_LEGAL_NAME },
  });
}

async function createUser(email: string, roleCode?: string) {
  const user = await prisma.user.create({
    data: {
      organizationId,
      email,
      passwordHash: "not-used-for-token-fixture",
      firstName: "Invoice",
      lastName: roleCode ?? "NoRole",
      status: "ACTIVE",
    },
    select: { id: true },
  });

  if (roleCode !== undefined) {
    const role = await prisma.role.findUniqueOrThrow({
      where: { code: roleCode },
      select: { id: true },
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

async function createProcedure(code: string, amount: string, currency = "ANG") {
  const procedure = await prisma.svbProcedure.create({
    data: {
      code,
      description: `TEST Invoice procedure ${code}`,
      category: "TEST-INV",
      unit: "VISIT",
      requiresAuthorization: false,
      requiresReferral: false,
      isActive: true,
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
      validTo: new Date("2026-12-31T00:00:00.000Z"),
    },
    select: { id: true },
  });

  const tariff = await prisma.svbTariff.create({
    data: {
      svbProcedureId: procedure.id,
      amount,
      currencyCode: currency,
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
      validTo: new Date("2026-12-31T00:00:00.000Z"),
      isActive: true,
    },
    select: { id: true },
  });

  return { procedureId: procedure.id, tariffId: tariff.id };
}

async function createAppointmentAggregate(input: {
  suffix: string;
  appointmentStatus?: "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  encounterStatus?: "OPEN" | "COMPLETED" | "VOID" | null;
  orgId?: bigint;
  procedureCount?: number;
}) {
  const orgId = input.orgId ?? organizationId;
  const patient = await prisma.patient.create({
    data: {
      organizationId: orgId,
      patientNumber: `TEST-INV-PAT-${input.suffix}`,
      firstName: "Maria",
      middleName: "Elena",
      lastName: "Martina",
      secondLastName: "Lopez",
      documentType: "PASSPORT",
      documentNumber: `TEST-DOC-${input.suffix}`,
      status: "ACTIVE",
    },
    select: { id: true },
  });

  const provider = await prisma.provider.create({
    data: {
      organizationId: orgId,
      svbProviderId: `TEST-INV-PROV-${input.suffix}`,
      firstName: "Invoice",
      lastName: "Provider",
      isActive: true,
    },
    select: { id: true },
  });

  const location = await prisma.clinicLocation.create({
    data: {
      organizationId: orgId,
      code: `TEST-INV-LOC-${input.suffix}`,
      name: `TEST Invoice Location ${input.suffix}`,
      countryCode: "CW",
      isActive: true,
    },
    select: { id: true },
  });

  const insurance = await prisma.patientInsurance.create({
    data: {
      patientId: patient.id,
      payerId,
      insuredId: `TEST-INV-INS-${input.suffix}`,
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
      validTo: new Date("2026-12-31T00:00:00.000Z"),
      status: "ACTIVE",
      isPrimary: true,
    },
    select: { id: true },
  });

  const appointment = await prisma.appointment.create({
    data: {
      organizationId: orgId,
      appointmentNumber: `TEST-INV-APT-${input.suffix}`,
      patientId: patient.id,
      providerId: provider.id,
      clinicLocationId: location.id,
      scheduledStartAt: new Date("2026-09-15T09:00:00-04:00"),
      scheduledEndAt: new Date("2026-09-15T09:30:00-04:00"),
      status: input.appointmentStatus ?? "COMPLETED",
      completedAt:
        input.appointmentStatus === undefined ||
        input.appointmentStatus === "COMPLETED"
          ? new Date()
          : null,
      createdByUserId: adminUserId,
    },
    select: { id: true },
  });

  if (input.encounterStatus === null) {
    return { appointmentId: appointment.id, insuranceId: insurance.id };
  }

  const encounter = await prisma.clinicalEncounter.create({
    data: {
      appointmentId: appointment.id,
      providerId: provider.id,
      status: input.encounterStatus ?? "COMPLETED",
      startedAt: new Date(),
      completedAt:
        input.encounterStatus === undefined ||
        input.encounterStatus === "COMPLETED"
          ? new Date()
          : null,
      createdByUserId: adminUserId,
    },
    select: { id: true },
  });

  const count = input.procedureCount ?? 1;

  for (let index = 0; index < count; index += 1) {
    const svbProcedureId = index === 0 ? procedureAId : procedureBId;
    const svbTariffId = index === 0 ? tariffAId : tariffBId;
    const unit = new Prisma.Decimal(index === 0 ? "100.00" : "25.50");
    const quantity = new Prisma.Decimal(index === 0 ? "1.00" : "2.00");

    await prisma.encounterProcedure.create({
      data: {
        encounterId: encounter.id,
        patientInsuranceId: insurance.id,
        svbProcedureId,
        svbTariffId,
        performedByProviderId: provider.id,
        procedureCodeSnapshot:
          index === 0 ? "TEST-INV-PROC-A" : "TEST-INV-PROC-B",
        procedureDescriptionSnapshot:
          index === 0
            ? "TEST Invoice procedure TEST-INV-PROC-A"
            : "TEST Invoice procedure TEST-INV-PROC-B",
        providerIdSnapshot: `TEST-INV-PROV-${input.suffix}`,
        insuredIdSnapshot: `TEST-INV-INS-${input.suffix}`,
        unitTariffSnapshot: unit,
        currencyCodeSnapshot: "ANG",
        quantity,
        amount: unit.mul(quantity),
        performedAt: new Date(
          Date.parse("2026-09-15T13:05:00.000Z") + index * 60_000,
        ),
        additionalNote: `TEST-INV note ${index + 1}`,
        status: "PERFORMED",
        createdByUserId: adminUserId,
      },
    });
  }

  return {
    appointmentId: appointment.id,
    encounterId: encounter.id,
    insuranceId: insurance.id,
  };
}

function createInvoice(appointmentId: bigint, token = providerToken) {
  return request(app)
    .post(`/api/v1/appointments/${appointmentId.toString()}/invoice`)
    .set("Authorization", `Bearer ${token}`)
    .send({});
}

async function createInvoiceFixture(suffix: string, procedureCount = 1) {
  const aggregate = await createAppointmentAggregate({
    suffix,
    procedureCount,
  });
  const response = await createInvoice(aggregate.appointmentId).expect(201);
  await prisma.invoiceVersion.update({
    where: { id: BigInt(response.body.data.currentVersionId as string) },
    data: { declarantIdSnapshot: "TEST-DECLARANT-001" },
  });

  return {
    invoiceId: response.body.data.id as string,
    versionId: response.body.data.currentVersionId as string,
    invoiceNumber: response.body.data.invoiceNumber as string,
  };
}

function prepareInvoice(invoiceId: string, versionId: string, token = providerToken) {
  return request(app)
    .post(
      `/api/v1/invoices/${invoiceId}/versions/${versionId}/prepare-signature`,
    )
    .set("Authorization", `Bearer ${token}`)
    .send({});
}

async function createSignatureDocument(input: {
  suffix: string;
  orgId?: bigint;
  documentType?: "SIGNATURE" | "INVOICE_PDF" | "SUPPORTING_DOCUMENT";
  sha256?: string;
  sizeBytes?: bigint;
}) {
  return prisma.document.create({
    data: {
      organizationId: input.orgId ?? organizationId,
      documentType: input.documentType ?? "SIGNATURE",
      storageProvider: "LOCAL",
      storageUri: `test://invoice-signature/${input.suffix}-${Date.now().toString()}`,
      originalFilename: `TEST-SIGN-${input.suffix}.png`,
      mimeType: "image/png",
      sizeBytes: input.sizeBytes ?? 128n,
      sha256:
        input.sha256 ??
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      createdByUserId: adminUserId,
    },
    select: { id: true, sha256: true },
  });
}

function closeInvoice(invoiceId: string, versionId: string, token = receptionToken) {
  return request(app)
    .post(`/api/v1/invoices/${invoiceId}/versions/${versionId}/close`)
    .set("Authorization", `Bearer ${token}`)
    .send({});
}

async function createSignedInvoiceFixture(suffix: string) {
  const fixture = await createInvoiceFixture(suffix, 1);
  const prepared = await prepareInvoice(fixture.invoiceId, fixture.versionId)
    .expect(200);
  const contentHash = prepared.body.data.currentVersion.contentHash as string;
  const lockedAt = prepared.body.data.currentVersion.lockedAt as string;
  const document = await createSignatureDocument({ suffix });
  const signature = await request(app)
    .post(
      `/api/v1/invoices/${fixture.invoiceId}/versions/${fixture.versionId}/signatures`,
    )
    .set("Authorization", `Bearer ${providerToken}`)
    .send({
      signatureDocumentId: document.id.toString(),
      signatureType: "PATIENT",
      captureMethod: "SIGNATURE_PAD",
      expectedContentHash: contentHash,
    })
    .expect(201);
  const signed = await request(app)
    .post(`/api/v1/invoices/${fixture.invoiceId}/versions/${fixture.versionId}/sign`)
    .set("Authorization", `Bearer ${providerToken}`)
    .send({})
    .expect(200);

  return {
    ...fixture,
    contentHash,
    lockedAt,
    signedAt: signed.body.data.currentVersion.signedAt as string,
    documentId: document.id,
    signatureId: BigInt(signature.body.data.id as string),
  };
}

async function createClosedInvoiceFixture(suffix: string) {
  const fixture = await createSignedInvoiceFixture(suffix);
  await closeInvoice(fixture.invoiceId, fixture.versionId).expect(200);

  return fixture;
}

function requestCorrection(invoiceId: string, token = receptionToken) {
  return request(app)
    .post(`/api/v1/invoices/${invoiceId}/corrections`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      reasonCode: "TEST-CORRECTION",
      reasonText: "TEST invoice correction request",
      metadata: { fixture: true },
    });
}

function approveCorrection(
  invoiceId: string,
  correctionId: string,
  token = adminToken,
) {
  return request(app)
    .post(`/api/v1/invoices/${invoiceId}/corrections/${correctionId}/approve`)
    .set("Authorization", `Bearer ${token}`)
    .send({});
}

function createCorrectionReplacement(
  invoiceId: string,
  correctionId: string,
  token = adminToken,
) {
  return request(app)
    .post(
      `/api/v1/invoices/${invoiceId}/corrections/${correctionId}/replacement`,
    )
    .set("Authorization", `Bearer ${token}`)
    .send({});
}

async function signInvoiceVersion(input: {
  invoiceId: string;
  versionId: string;
  contentHash: string;
  suffix: string;
}) {
  const document = await createSignatureDocument({ suffix: input.suffix });
  await request(app)
    .post(
      `/api/v1/invoices/${input.invoiceId}/versions/${input.versionId}/signatures`,
    )
    .set("Authorization", `Bearer ${providerToken}`)
    .send({
      signatureDocumentId: document.id.toString(),
      signatureType: "PATIENT",
      captureMethod: "SIGNATURE_PAD",
      expectedContentHash: input.contentHash,
    })
    .expect(201);

  return request(app)
    .post(`/api/v1/invoices/${input.invoiceId}/versions/${input.versionId}/sign`)
    .set("Authorization", `Bearer ${providerToken}`)
    .send({})
    .expect(200);
}

async function loadCanonicalSource(invoiceId: string) {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: BigInt(invoiceId) },
    select: {
      invoiceNumber: true,
      currentVersion: {
        select: {
          versionNumber: true,
          versionType: true,
          invoiceDate: true,
          currencyCode: true,
          totalAmount: true,
          declarantIdSnapshot: true,
          patientNameSnapshot: true,
          patientDocumentTypeSnapshot: true,
          patientDocumentNumberSnapshot: true,
          insuredIdSnapshot: true,
          items: {
            select: {
              lineNumber: true,
              detailInvoiceNumber: true,
              serviceDateSnapshot: true,
              procedureCodeSnapshot: true,
              procedureDescriptionSnapshot: true,
              providerIdSnapshot: true,
              insuredIdSnapshot: true,
              unitTariffSnapshot: true,
              currencyCodeSnapshot: true,
              quantity: true,
              amount: true,
              authorizationIdSnapshot: true,
              diagnosticCodeSnapshot: true,
              treatmentIdSnapshot: true,
              accidentFormNumberSnapshot: true,
              numberOfTreatmentsSnapshot: true,
              assistanceSnapshot: true,
              referrerIdSnapshot: true,
              policlinicSnapshot: true,
              additionalNote: true,
            },
          },
        },
      },
    },
  });

  if (invoice.invoiceNumber === null || invoice.currentVersion === null) {
    throw new Error("Invoice fixture is missing invoiceNumber or currentVersion");
  }

  return {
    invoiceNumber: invoice.invoiceNumber,
    version: invoice.currentVersion,
  };
}

describe("Invoice API", () => {
  beforeAll(async () => {
    await cleanupInvoiceFixture();

    const organization = await prisma.organization.findFirstOrThrow({
      where: {
        legalName: "Odontho Services B.V.",
        isActive: true,
      },
      select: { id: true },
    });
    organizationId = organization.id;

    const payer = await prisma.payer.findFirstOrThrow({
      where: { isActive: true },
      select: { id: true },
    });
    payerId = payer.id;

    otherOrganizationId = (
      await prisma.organization.create({
        data: {
          legalName: OTHER_ORG_LEGAL_NAME,
          tradeName: "TEST Invoice Other Org",
          countryCode: "CW",
          timezone: "America/Curacao",
          isActive: true,
        },
        select: { id: true },
      })
    ).id;

    adminUserId = await createUser(ADMIN_EMAIL, "ADMIN");
    receptionUserId = await createUser(RECEPTION_EMAIL, "RECEPTION");
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

    const patient = await prisma.patient.create({
      data: {
        organizationId,
        patientNumber: "TEST-INV-PAT-BASE",
        firstName: "Maria",
        middleName: "Elena",
        lastName: "Martina",
        secondLastName: "Lopez",
        documentType: "PASSPORT",
        documentNumber: "TEST-INV-DOC-BASE",
        status: "ACTIVE",
      },
      select: { id: true },
    });
    patientId = patient.id;

    providerId = (
      await prisma.provider.create({
        data: {
          organizationId,
          svbProviderId: "TEST-INV-PROV-BASE",
          firstName: "Invoice",
          lastName: "Provider",
          isActive: true,
        },
        select: { id: true },
      })
    ).id;

    locationId = (
      await prisma.clinicLocation.create({
        data: {
          organizationId,
          code: "TEST-INV-LOC-BASE",
          name: "TEST Invoice Base Location",
          countryCode: "CW",
          isActive: true,
        },
        select: { id: true },
      })
    ).id;

    insuranceId = (
      await prisma.patientInsurance.create({
        data: {
          patientId,
          payerId,
          insuredId: "TEST-INV-INS-BASE",
          validFrom: new Date("2026-01-01T00:00:00.000Z"),
          validTo: new Date("2026-12-31T00:00:00.000Z"),
          status: "ACTIVE",
          isPrimary: true,
        },
        select: { id: true },
      })
    ).id;

    const procedureA = await createProcedure("TEST-INV-PROC-A", "100.00");
    procedureAId = procedureA.procedureId;
    tariffAId = procedureA.tariffId;
    const procedureB = await createProcedure("TEST-INV-PROC-B", "25.50");
    procedureBId = procedureB.procedureId;
    tariffBId = procedureB.tariffId;
  });

  afterAll(async () => {
    await cleanupInvoiceFixture();
    await prisma.$disconnect();
  });

  it("requires auth and invoice permissions according to seed", async () => {
    const aggregate = await createAppointmentAggregate({
      suffix: "RBAC",
      procedureCount: 1,
    });

    await request(app)
      .get("/api/v1/invoices")
      .expect(401);

    await request(app)
      .get("/api/v1/invoices")
      .set("Authorization", `Bearer ${noRoleToken}`)
      .expect(403);

    await request(app)
      .get("/api/v1/invoices")
      .set("Authorization", `Bearer ${receptionToken}`)
      .expect(200);

    await createInvoice(aggregate.appointmentId, noRoleToken).expect(403);
    await createInvoice(aggregate.appointmentId, providerToken).expect(201);

    await request(app)
      .post(`/api/v1/invoices/999999999999/cancel`)
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({ reason: "TEST-INV denied" })
      .expect(403);
  });

  it("creates one invoice with original version and multiple line items", async () => {
    const aggregate = await createAppointmentAggregate({
      suffix: "MULTI",
      procedureCount: 2,
    });

    const response = await createInvoice(aggregate.appointmentId).expect(201);

    createdInvoiceId = response.body.data.id;
    createdVersionId = response.body.data.currentVersionId;
    createdInvoiceNumber = response.body.data.invoiceNumber;

    expect(response.body.data).toMatchObject({
      appointmentId: aggregate.appointmentId.toString(),
      patientInsuranceId: aggregate.insuranceId.toString(),
      status: "DRAFT",
      currentVersion: {
        versionNumber: 1,
        versionType: "ORIGINAL",
        status: "DRAFT",
        invoiceDate: "2026-09-15",
        currencyCode: "ANG",
        totalAmount: "151.00",
        patientNameSnapshot: "Maria Elena Martina Lopez",
        patientDocumentTypeSnapshot: "PASSPORT",
        insuredIdSnapshot: "TEST-INV-INS-MULTI",
        contentHash: null,
      },
    });
    expect(response.body.data.currentVersion.items).toHaveLength(2);
    expect(response.body.data.currentVersion.items[0]).toMatchObject({
      lineNumber: 1,
      detailInvoiceNumber: `${createdInvoiceNumber}-01`,
      sourceInvoiceItemId: null,
      procedureCodeSnapshot: "TEST-INV-PROC-A",
      providerIdSnapshot: "TEST-INV-PROV-MULTI",
      unitTariffSnapshot: "100.00",
      quantity: "1.00",
      amount: "100.00",
    });
    expect(response.body.data.currentVersion.items[1]).toMatchObject({
      lineNumber: 2,
      detailInvoiceNumber: `${createdInvoiceNumber}-02`,
      procedureCodeSnapshot: "TEST-INV-PROC-B",
      quantity: "2.00",
      amount: "51.00",
    });

    const invoiceCount = await prisma.invoice.count({
      where: { appointmentId: aggregate.appointmentId },
    });
    const versionCount = await prisma.invoiceVersion.count({
      where: { invoiceId: BigInt(createdInvoiceId), versionNumber: 1 },
    });
    const itemCount = await prisma.invoiceItem.count({
      where: { invoiceVersionId: BigInt(createdVersionId) },
    });

    expect(invoiceCount).toBe(1);
    expect(versionCount).toBe(1);
    expect(itemCount).toBe(2);
  });

  it("gets invoices, versions, items, and status history", async () => {
    const list = await request(app)
      .get(`/api/v1/invoices?q=${createdInvoiceNumber}&page=1&pageSize=1`)
      .set("Authorization", `Bearer ${providerToken}`)
      .expect(200);

    expect(list.body.data).toHaveLength(1);
    expect(list.body.meta.total).toBeGreaterThanOrEqual(1);

    const detail = await request(app)
      .get(`/api/v1/invoices/${createdInvoiceId}`)
      .set("Authorization", `Bearer ${providerToken}`)
      .expect(200);

    expect(detail.body.data.currentVersion.id).toBe(createdVersionId);

    const versions = await request(app)
      .get(`/api/v1/invoices/${createdInvoiceId}/versions`)
      .set("Authorization", `Bearer ${providerToken}`)
      .expect(200);
    expect(versions.body.data).toHaveLength(1);

    const version = await request(app)
      .get(`/api/v1/invoices/${createdInvoiceId}/versions/${createdVersionId}`)
      .set("Authorization", `Bearer ${providerToken}`)
      .expect(200);
    expect(version.body.data.items).toHaveLength(2);

    const items = await request(app)
      .get(
        `/api/v1/invoices/${createdInvoiceId}/versions/${createdVersionId}/items`,
      )
      .set("Authorization", `Bearer ${providerToken}`)
      .expect(200);
    expect(items.body.data.map((item: { lineNumber: number }) => item.lineNumber))
      .toEqual([1, 2]);

    const history = await request(app)
      .get(`/api/v1/invoices/${createdInvoiceId}/status-history`)
      .set("Authorization", `Bearer ${providerToken}`)
      .expect(200);
    expect(history.body.data[0]).toMatchObject({
      oldStatus: null,
      newStatus: "DRAFT",
      invoiceVersionId: createdVersionId,
    });
  });

  it("rejects invalid ids, missing invoices, and version mismatch", async () => {
    await request(app)
      .get("/api/v1/invoices/not-a-number")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(400);

    await request(app)
      .get("/api/v1/invoices/999999999999")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(404);

    const other = await createAppointmentAggregate({
      suffix: "VERSION-MISMATCH",
      procedureCount: 1,
    });
    const otherInvoice = await createInvoice(other.appointmentId).expect(201);

    await request(app)
      .get(
        `/api/v1/invoices/${createdInvoiceId}/versions/${otherInvoice.body.data.currentVersionId}`,
      )
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(404)
      .expect((response) => {
        expect(response.body.error.code).toBe("INVOICE_VERSION_NOT_FOUND");
      });
  });

  it("rejects non-billable appointments and encounters", async () => {
    const notCompleted = await createAppointmentAggregate({
      suffix: "NOT-COMPLETED",
      appointmentStatus: "IN_PROGRESS",
      encounterStatus: "COMPLETED",
    });
    await createInvoice(notCompleted.appointmentId)
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("APPOINTMENT_NOT_BILLABLE");
      });

    const noEncounter = await createAppointmentAggregate({
      suffix: "NO-ENCOUNTER",
      encounterStatus: null,
    });
    await createInvoice(noEncounter.appointmentId)
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("CLINICAL_ENCOUNTER_REQUIRED");
      });

    const openEncounter = await createAppointmentAggregate({
      suffix: "OPEN-ENCOUNTER",
      encounterStatus: "OPEN",
    });
    await createInvoice(openEncounter.appointmentId)
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe(
          "CLINICAL_ENCOUNTER_NOT_COMPLETED",
        );
      });

    const voidEncounter = await createAppointmentAggregate({
      suffix: "VOID-ENCOUNTER",
      encounterStatus: "VOID",
    });
    await createInvoice(voidEncounter.appointmentId)
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe(
          "CLINICAL_ENCOUNTER_NOT_BILLABLE",
        );
      });
  });

  it("rejects no procedures, mixed insurance, mixed currency, and invalid snapshots", async () => {
    const empty = await createAppointmentAggregate({
      suffix: "NO-PROC",
      procedureCount: 0,
    });
    await createInvoice(empty.appointmentId)
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("INVOICE_NO_BILLABLE_PROCEDURES");
      });

    const mixedInsurance = await createAppointmentAggregate({
      suffix: "MIXED-INS",
      procedureCount: 1,
    });
    const otherInsurance = await prisma.patientInsurance.create({
      data: {
        patientId,
        payerId,
        insuredId: "TEST-INV-INS-MIXED-OTHER",
        validFrom: new Date("2026-01-01T00:00:00.000Z"),
        validTo: new Date("2026-12-31T00:00:00.000Z"),
        status: "ACTIVE",
        isPrimary: false,
      },
      select: { id: true },
    });
    const encounter = await prisma.clinicalEncounter.findUniqueOrThrow({
      where: { appointmentId: mixedInsurance.appointmentId },
      select: { id: true },
    });
    await prisma.encounterProcedure.create({
      data: {
        encounterId: encounter.id,
        patientInsuranceId: otherInsurance.id,
        svbProcedureId: procedureBId,
        svbTariffId: tariffBId,
        performedByProviderId: providerId,
        procedureCodeSnapshot: "TEST-INV-PROC-B",
        procedureDescriptionSnapshot: "TEST Invoice procedure TEST-INV-PROC-B",
        providerIdSnapshot: "TEST-INV-PROV-BASE",
        insuredIdSnapshot: "TEST-INV-INS-MIXED-OTHER",
        unitTariffSnapshot: "25.50",
        currencyCodeSnapshot: "ANG",
        quantity: "1.00",
        amount: "25.50",
        performedAt: new Date(),
        status: "PERFORMED",
        createdByUserId: adminUserId,
      },
    });
    await createInvoice(mixedInsurance.appointmentId)
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("INVOICE_MULTIPLE_INSURANCES");
      });

    const mixedCurrency = await createAppointmentAggregate({
      suffix: "MIXED-CUR",
      procedureCount: 1,
    });
    const usdProcedure = await createProcedure("TEST-INV-PROC-USD", "10.00", "USD");
    const mixedEncounter = await prisma.clinicalEncounter.findUniqueOrThrow({
      where: { appointmentId: mixedCurrency.appointmentId },
      select: { id: true },
    });
    await prisma.encounterProcedure.create({
      data: {
        encounterId: mixedEncounter.id,
        patientInsuranceId: mixedCurrency.insuranceId,
        svbProcedureId: usdProcedure.procedureId,
        svbTariffId: usdProcedure.tariffId,
        performedByProviderId: providerId,
        procedureCodeSnapshot: "TEST-INV-PROC-USD",
        procedureDescriptionSnapshot: "TEST Invoice procedure TEST-INV-PROC-USD",
        providerIdSnapshot: "TEST-INV-PROV-BASE",
        insuredIdSnapshot: "TEST-INV-INS-MIXED-CUR",
        unitTariffSnapshot: "10.00",
        currencyCodeSnapshot: "USD",
        quantity: "1.00",
        amount: "10.00",
        performedAt: new Date(),
        status: "PERFORMED",
        createdByUserId: adminUserId,
      },
    });
    await createInvoice(mixedCurrency.appointmentId)
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("INVOICE_MIXED_CURRENCIES");
      });

    const badAmount = await createAppointmentAggregate({
      suffix: "BAD-AMOUNT",
      procedureCount: 1,
    });
    await prisma.encounterProcedure.updateMany({
      where: {
        encounter: { appointmentId: badAmount.appointmentId },
      },
      data: {
        amount: "999.99",
      },
    });
    await createInvoice(badAmount.appointmentId)
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("INVOICE_ITEM_AMOUNT_MISMATCH");
      });
  });

  it("excludes PLANNED and VOID procedures from original invoice", async () => {
    const aggregate = await createAppointmentAggregate({
      suffix: "FILTER",
      procedureCount: 1,
    });
    const encounter = await prisma.clinicalEncounter.findUniqueOrThrow({
      where: { appointmentId: aggregate.appointmentId },
      select: { id: true },
    });

    for (const status of ["PLANNED", "VOID"] as const) {
      await prisma.encounterProcedure.create({
        data: {
          encounterId: encounter.id,
          patientInsuranceId: aggregate.insuranceId,
          svbProcedureId: procedureBId,
          svbTariffId: tariffBId,
          performedByProviderId: providerId,
          procedureCodeSnapshot: `TEST-INV-PROC-${status}`,
          procedureDescriptionSnapshot: `TEST Invoice ${status}`,
          providerIdSnapshot: "TEST-INV-PROV-BASE",
          insuredIdSnapshot: "TEST-INV-INS-FILTER",
          unitTariffSnapshot: "25.50",
          currencyCodeSnapshot: "ANG",
          quantity: "1.00",
          amount: "25.50",
          performedAt: new Date(),
          status,
          createdByUserId: adminUserId,
        },
      });
    }

    const response = await createInvoice(aggregate.appointmentId).expect(201);

    expect(response.body.data.currentVersion.items).toHaveLength(1);
    expect(response.body.data.currentVersion.items[0].procedureCodeSnapshot).toBe(
      "TEST-INV-PROC-A",
    );
  });

  it("keeps invoice snapshots immutable after master data changes", async () => {
    await prisma.patient.update({
      where: { id: patientId },
      data: { firstName: "Changed" },
    });
    await prisma.svbProcedure.update({
      where: { id: procedureAId },
      data: { description: "Changed procedure" },
    });
    await prisma.svbTariff.update({
      where: { id: tariffAId },
      data: { amount: "999.99" },
    });
    await prisma.provider.update({
      where: { id: providerId },
      data: { svbProviderId: "TEST-INV-PROV-CHANGED" },
    });

    const version = await request(app)
      .get(`/api/v1/invoices/${createdInvoiceId}/versions/${createdVersionId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(version.body.data.patientNameSnapshot).toBe(
      "Maria Elena Martina Lopez",
    );
    expect(version.body.data.items[0]).toMatchObject({
      procedureCodeSnapshot: "TEST-INV-PROC-A",
      procedureDescriptionSnapshot: "TEST Invoice procedure TEST-INV-PROC-A",
      providerIdSnapshot: "TEST-INV-PROV-MULTI",
      insuredIdSnapshot: "TEST-INV-INS-MULTI",
      unitTariffSnapshot: "100.00",
      currencyCodeSnapshot: "ANG",
    });
  });

  it("rejects duplicate and concurrent invoice creation for one appointment", async () => {
    const duplicate = await createAppointmentAggregate({
      suffix: "DUPLICATE",
      procedureCount: 1,
    });

    await createInvoice(duplicate.appointmentId).expect(201);
    await createInvoice(duplicate.appointmentId)
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("INVOICE_ALREADY_EXISTS");
      });

    const concurrent = await createAppointmentAggregate({
      suffix: "CONCURRENT",
      procedureCount: 1,
    });
    const [first, second] = await Promise.all([
      createInvoice(concurrent.appointmentId),
      createInvoice(concurrent.appointmentId),
    ]);

    expect([201, 409]).toContain(first.status);
    expect([201, 409]).toContain(second.status);
    expect([first.status, second.status].filter((status) => status === 201))
      .toHaveLength(1);

    const count = await prisma.invoice.count({
      where: { appointmentId: concurrent.appointmentId },
    });
    expect(count).toBe(1);
  });

  it("rolls back invoice number and aggregate when creation fails after allocation", async () => {
    const rollback = await createAppointmentAggregate({
      suffix: "ROLLBACK",
      procedureCount: 1,
    });
    await prisma.encounterProcedure.updateMany({
      where: {
        encounter: { appointmentId: rollback.appointmentId },
      },
      data: {
        providerIdSnapshot: null,
      },
    });

    const before = await prisma.numberSequence.findUniqueOrThrow({
      where: {
        organizationId_sequenceType_sequenceYear: {
          organizationId,
          sequenceType: "INVOICE",
          sequenceYear: getDefaultSequenceYear("INVOICE"),
        },
      },
      select: { currentValue: true },
    });

    await createInvoice(rollback.appointmentId)
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe(
          "INVOICE_PROVIDER_SNAPSHOT_REQUIRED",
        );
      });

    const after = await prisma.numberSequence.findUniqueOrThrow({
      where: {
        organizationId_sequenceType_sequenceYear: {
          organizationId,
          sequenceType: "INVOICE",
          sequenceYear: getDefaultSequenceYear("INVOICE"),
        },
      },
      select: { currentValue: true },
    });

    expect(after.currentValue).toBe(before.currentValue);
    await expect(
      prisma.invoice.findUnique({
        where: { appointmentId: rollback.appointmentId },
      }),
    ).resolves.toBeNull();
  });

  it("cancels DRAFT invoices without deleting versions or items", async () => {
    const cancellable = await createAppointmentAggregate({
      suffix: "CANCEL",
      procedureCount: 1,
    });
    const created = await createInvoice(cancellable.appointmentId).expect(201);

    await request(app)
      .post(`/api/v1/invoices/${created.body.data.id}/cancel`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "TEST-INV cancellation" })
      .expect(200)
      .expect((response) => {
        expect(response.body.data.status).toBe("CANCELLED");
        expect(response.body.data.currentVersion.status).toBe("VOID");
        expect(response.body.data.cancellationReason).toBe(
          "TEST-INV cancellation",
        );
      });

    await request(app)
      .post(`/api/v1/invoices/${created.body.data.id}/cancel`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "TEST-INV twice" })
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("INVOICE_NOT_CANCELLABLE");
      });

    const itemCount = await prisma.invoiceItem.count({
      where: { invoiceVersion: { invoiceId: BigInt(created.body.data.id) } },
    });
    expect(itemCount).toBe(1);
  });

  it("canonicalizes signature content deterministically and changes hash for signed fields", async () => {
    const fixture = await createInvoiceFixture("CANON", 2);
    const canonical = await loadCanonicalSource(fixture.invoiceId);
    const reversed = {
      invoiceNumber: canonical.invoiceNumber,
      version: {
        ...canonical.version,
        items: [...canonical.version.items].reverse(),
      },
    };

    const firstHash = computeInvoiceContentHash(canonical);
    const secondHash = computeInvoiceContentHash(canonical);
    const reversedHash = computeInvoiceContentHash(reversed);
    const changedAmount = {
      invoiceNumber: canonical.invoiceNumber,
      version: {
        ...canonical.version,
        totalAmount: new Prisma.Decimal("152.00"),
      },
    };
    const changedInvoiceNumber = {
      invoiceNumber: `${canonical.invoiceNumber}-X`,
      version: canonical.version,
    };
    const changedProcedure = {
      invoiceNumber: canonical.invoiceNumber,
      version: {
        ...canonical.version,
        items: canonical.version.items.map((item, index) =>
          index === 0
            ? { ...item, procedureCodeSnapshot: "TEST-INV-PROC-CHANGED" }
            : item,
        ),
      },
    };

    expect(firstHash).toMatch(/^[a-f0-9]{64}$/);
    expect(secondHash).toBe(firstHash);
    expect(reversedHash).toBe(firstHash);
    expect(computeInvoiceContentHash(changedAmount)).not.toBe(firstHash);
    expect(computeInvoiceContentHash(changedInvoiceNumber)).not.toBe(firstHash);
    expect(computeInvoiceContentHash(changedProcedure)).not.toBe(firstHash);
    const firstItem = buildInvoiceSignatureCanonicalContent(canonical).items[0];
    expect(firstItem).toMatchObject({ unitTariff: "100.00" });
  });

  it("prepares a draft invoice for signature and exposes verified signature content", async () => {
    const fixture = await createInvoiceFixture("PREPARE", 1);

    const response = await prepareInvoice(
      fixture.invoiceId,
      fixture.versionId,
      receptionToken,
    ).expect(200);

    expect(response.body.data).toMatchObject({
      id: fixture.invoiceId,
      status: "PENDING_SIGNATURE",
      currentVersion: {
        id: fixture.versionId,
        status: "PENDING_SIGNATURE",
      },
    });
    expect(response.body.data.currentVersion.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(response.body.data.currentVersion.lockedAt).not.toBeNull();

    const content = await request(app)
      .get(
        `/api/v1/invoices/${fixture.invoiceId}/versions/${fixture.versionId}/signature-content`,
      )
      .set("Authorization", `Bearer ${providerToken}`)
      .expect(200);

    expect(content.body.data).toMatchObject({
      schema: "odontho.invoice-signature.v1",
      contentHash: response.body.data.currentVersion.contentHash,
      content: {
        schema: "odontho.invoice-signature.v1",
        invoice: {
          invoiceNumber: fixture.invoiceNumber,
          declarantId: "TEST-DECLARANT-001",
        },
      },
    });

    const history = await prisma.invoiceStatusHistory.findFirst({
      where: {
        invoiceId: BigInt(fixture.invoiceId),
        oldStatus: "DRAFT",
        newStatus: "PENDING_SIGNATURE",
      },
    });
    expect(history?.invoiceVersionId).toBe(BigInt(fixture.versionId));

    const audit = await prisma.auditLog.findFirst({
      where: {
        action: "INVOICE_PREPARE_SIGNATURE",
        entityId: BigInt(fixture.invoiceId),
      },
    });
    expect(audit?.newValues).not.toBeNull();
  });

  it("rejects prepare when required signature master snapshots are missing", async () => {
    const missingDeclarant = await createInvoiceFixture("MISS-DECL", 1);
    await prisma.invoiceVersion.update({
      where: { id: BigInt(missingDeclarant.versionId) },
      data: { declarantIdSnapshot: null },
    });
    await prepareInvoice(missingDeclarant.invoiceId, missingDeclarant.versionId)
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("INVOICE_DECLARANT_ID_REQUIRED");
      });

    const missingProvider = await createInvoiceFixture("MISS-PROV", 1);
    await prisma.invoiceItem.updateMany({
      where: { invoiceVersionId: BigInt(missingProvider.versionId) },
      data: { providerIdSnapshot: "" },
    });
    await prepareInvoice(missingProvider.invoiceId, missingProvider.versionId)
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("INVOICE_PROVIDER_SNAPSHOT_REQUIRED");
      });

    const missingInsured = await createInvoiceFixture("MISS-INS", 1);
    await prisma.invoiceVersion.update({
      where: { id: BigInt(missingInsured.versionId) },
      data: { insuredIdSnapshot: "" },
    });
    await prepareInvoice(missingInsured.invoiceId, missingInsured.versionId)
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("INVOICE_INSURED_ID_REQUIRED");
      });
  });

  it("captures and lists signatures with document validation and patient derivation", async () => {
    const fixture = await createInvoiceFixture("CAPTURE", 1);
    const prepared = await prepareInvoice(fixture.invoiceId, fixture.versionId)
      .expect(200);
    const contentHash = prepared.body.data.currentVersion.contentHash as string;
    const document = await createSignatureDocument({ suffix: "CAPTURE" });

    await request(app)
      .post(
        `/api/v1/invoices/${fixture.invoiceId}/versions/${fixture.versionId}/signatures`,
      )
      .set("Authorization", `Bearer ${providerToken}`)
      .send({
        signatureDocumentId: document.id.toString(),
        signatureType: "PATIENT",
        captureMethod: "SIGNATURE_PAD",
        expectedContentHash: contentHash,
        signerName: "Ignored Client Name",
        signerRelationship: "Ignored",
        deviceIdentifier: "TEST-PAD-1",
        metadata: { station: "front-desk" },
        patientId: "999999",
      })
      .expect(201)
      .expect((response) => {
        expect(response.body.data).toMatchObject({
          invoiceVersionId: fixture.versionId,
          signatureDocumentId: document.id.toString(),
          signatureType: "PATIENT",
          signerName: "Maria Elena Martina Lopez",
          signerRelationship: null,
          signedContentHash: contentHash,
          signatureHash: document.sha256,
          status: "VALID",
        });
        expect(response.body.data.patientId).not.toBe("999999");
      });

    const list = await request(app)
      .get(
        `/api/v1/invoices/${fixture.invoiceId}/versions/${fixture.versionId}/signatures`,
      )
      .set("Authorization", `Bearer ${receptionToken}`)
      .expect(200);
    expect(list.body.data).toHaveLength(1);

    await request(app)
      .post(
        `/api/v1/invoices/${fixture.invoiceId}/versions/${fixture.versionId}/signatures`,
      )
      .set("Authorization", `Bearer ${providerToken}`)
      .send({
        signatureDocumentId: document.id.toString(),
        signatureType: "PATIENT",
        captureMethod: "SIGNATURE_PAD",
        expectedContentHash: contentHash,
      })
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("SIGNATURE_DOCUMENT_ALREADY_USED");
      });
  });

  it("rejects invalid signature documents and stale content hashes", async () => {
    const fixture = await createInvoiceFixture("DOC-VALID", 1);
    const prepared = await prepareInvoice(fixture.invoiceId, fixture.versionId)
      .expect(200);
    const contentHash = prepared.body.data.currentVersion.contentHash as string;
    const wrongOrg = await createSignatureDocument({
      suffix: "WRONG-ORG",
      orgId: otherOrganizationId,
    });
    const wrongType = await createSignatureDocument({
      suffix: "WRONG-TYPE",
      documentType: "INVOICE_PDF",
    });
    const invalidHash = await createSignatureDocument({
      suffix: "BAD-HASH",
      sha256: "not-a-valid-sha256",
    });
    const staleHash = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

    for (const documentId of [wrongOrg.id, wrongType.id, invalidHash.id]) {
      const expectedCode =
        documentId === wrongOrg.id
          ? "SIGNATURE_DOCUMENT_NOT_FOUND"
          : "SIGNATURE_DOCUMENT_INVALID";

      await request(app)
        .post(
          `/api/v1/invoices/${fixture.invoiceId}/versions/${fixture.versionId}/signatures`,
        )
        .set("Authorization", `Bearer ${providerToken}`)
        .send({
          signatureDocumentId: documentId.toString(),
          signatureType: "PATIENT",
          captureMethod: "SIGNATURE_PAD",
          expectedContentHash: contentHash,
        })
        .expect(documentId === wrongOrg.id ? 404 : 409)
        .expect((response) => {
          expect(response.body.error.code).toBe(expectedCode);
        });
    }

    const validDocument = await createSignatureDocument({ suffix: "STALE" });
    await request(app)
      .post(
        `/api/v1/invoices/${fixture.invoiceId}/versions/${fixture.versionId}/signatures`,
      )
      .set("Authorization", `Bearer ${providerToken}`)
      .send({
        signatureDocumentId: validDocument.id.toString(),
        signatureType: "PATIENT",
        captureMethod: "SIGNATURE_PAD",
        expectedContentHash: staleHash,
      })
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("SIGNATURE_CONTENT_HASH_MISMATCH");
      });
  });

  it("confirms signed invoices only with valid signatures and rejects corrupted content", async () => {
    const unsigned = await createInvoiceFixture("NO-SIGN", 1);
    await prepareInvoice(unsigned.invoiceId, unsigned.versionId).expect(200);
    await request(app)
      .post(`/api/v1/invoices/${unsigned.invoiceId}/versions/${unsigned.versionId}/sign`)
      .set("Authorization", `Bearer ${providerToken}`)
      .send({})
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("VALID_SIGNATURE_REQUIRED");
      });

    const corrupted = await createInvoiceFixture("CORRUPT", 1);
    await prepareInvoice(corrupted.invoiceId, corrupted.versionId).expect(200);
    await prisma.invoiceItem.updateMany({
      where: { invoiceVersionId: BigInt(corrupted.versionId) },
      data: { amount: "101.00" },
    });
    await request(app)
      .get(
        `/api/v1/invoices/${corrupted.invoiceId}/versions/${corrupted.versionId}/signature-content`,
      )
      .set("Authorization", `Bearer ${providerToken}`)
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe(
          "INVOICE_CONTENT_INTEGRITY_MISMATCH",
        );
      });

    const signable = await createInvoiceFixture("SIGN", 1);
    const prepared = await prepareInvoice(signable.invoiceId, signable.versionId)
      .expect(200);
    const document = await createSignatureDocument({ suffix: "SIGN" });
    const signature = await request(app)
      .post(
        `/api/v1/invoices/${signable.invoiceId}/versions/${signable.versionId}/signatures`,
      )
      .set("Authorization", `Bearer ${providerToken}`)
      .send({
        signatureDocumentId: document.id.toString(),
        signatureType: "LEGAL_REPRESENTATIVE",
        captureMethod: "TOUCHSCREEN",
        expectedContentHash: prepared.body.data.currentVersion.contentHash,
        signerName: "TEST Legal Representative",
        signerRelationship: "Mother",
      })
      .expect(201);

    await request(app)
      .post(`/api/v1/invoices/${signable.invoiceId}/versions/${signable.versionId}/sign`)
      .set("Authorization", `Bearer ${providerToken}`)
      .send({})
      .expect(200)
      .expect((response) => {
        expect(response.body.data.status).toBe("SIGNED");
        expect(response.body.data.currentVersion.status).toBe("SIGNED");
        expect(response.body.data.currentVersion.signedAt).not.toBeNull();
      });

    await request(app)
      .post(`/api/v1/invoices/${signable.invoiceId}/versions/${signable.versionId}/sign`)
      .set("Authorization", `Bearer ${providerToken}`)
      .send({})
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("INVOICE_ALREADY_SIGNED");
      });

    const audit = await prisma.auditLog.findFirst({
      where: { action: "INVOICE_SIGN", entityId: BigInt(signable.invoiceId) },
    });
    expect(audit?.newValues).not.toBeNull();
    expect(signature.body.data.status).toBe("VALID");
  });

  it("rejects invalid signature evidence before sign", async () => {
    const fixture = await createInvoiceFixture("BAD-SIG", 1);
    const prepared = await prepareInvoice(fixture.invoiceId, fixture.versionId)
      .expect(200);
    const document = await createSignatureDocument({ suffix: "BAD-SIG" });
    const signature = await request(app)
      .post(
        `/api/v1/invoices/${fixture.invoiceId}/versions/${fixture.versionId}/signatures`,
      )
      .set("Authorization", `Bearer ${providerToken}`)
      .send({
        signatureDocumentId: document.id.toString(),
        signatureType: "PATIENT",
        captureMethod: "MOUSE",
        expectedContentHash: prepared.body.data.currentVersion.contentHash,
      })
      .expect(201);

    await prisma.signature.update({
      where: { id: BigInt(signature.body.data.id) },
      data: { signedContentHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
    });

    await request(app)
      .post(`/api/v1/invoices/${fixture.invoiceId}/versions/${fixture.versionId}/sign`)
      .set("Authorization", `Bearer ${providerToken}`)
      .send({})
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("SIGNATURE_CONTENT_HASH_MISMATCH");
      });

    await prisma.signature.update({
      where: { id: BigInt(signature.body.data.id) },
      data: {
        signedContentHash: prepared.body.data.currentVersion.contentHash,
        signatureHash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      },
    });

    await request(app)
      .post(`/api/v1/invoices/${fixture.invoiceId}/versions/${fixture.versionId}/sign`)
      .set("Authorization", `Bearer ${providerToken}`)
      .send({})
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("SIGNATURE_CONTENT_HASH_MISMATCH");
      });
  });

  it("voids valid signatures before sign and prevents void after sign", async () => {
    const fixture = await createInvoiceFixture("VOID", 1);
    const prepared = await prepareInvoice(fixture.invoiceId, fixture.versionId)
      .expect(200);
    const document = await createSignatureDocument({ suffix: "VOID" });
    const signature = await request(app)
      .post(
        `/api/v1/invoices/${fixture.invoiceId}/versions/${fixture.versionId}/signatures`,
      )
      .set("Authorization", `Bearer ${providerToken}`)
      .send({
        signatureDocumentId: document.id.toString(),
        signatureType: "PATIENT",
        captureMethod: "SIGNATURE_PAD",
        expectedContentHash: prepared.body.data.currentVersion.contentHash,
      })
      .expect(201);

    await request(app)
      .post(
        `/api/v1/invoices/${fixture.invoiceId}/versions/${fixture.versionId}/signatures/${signature.body.data.id}/void`,
      )
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "TEST signature recaptured" })
      .expect(200)
      .expect((response) => {
        expect(response.body.data.status).toBe("VOID");
        expect(response.body.data.voidReason).toBe("TEST signature recaptured");
        expect(response.body.data.voidedByUserId).toBe(adminUserId.toString());
      });

    await request(app)
      .post(`/api/v1/invoices/${fixture.invoiceId}/versions/${fixture.versionId}/sign`)
      .set("Authorization", `Bearer ${providerToken}`)
      .send({})
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("VALID_SIGNATURE_REQUIRED");
      });

    const signed = await createInvoiceFixture("VOID-SIGNED", 1);
    const signedPrepared = await prepareInvoice(signed.invoiceId, signed.versionId)
      .expect(200);
    const signedDocument = await createSignatureDocument({ suffix: "VOID-SIGNED" });
    const signedSignature = await request(app)
      .post(
        `/api/v1/invoices/${signed.invoiceId}/versions/${signed.versionId}/signatures`,
      )
      .set("Authorization", `Bearer ${providerToken}`)
      .send({
        signatureDocumentId: signedDocument.id.toString(),
        signatureType: "PATIENT",
        captureMethod: "SIGNATURE_PAD",
        expectedContentHash: signedPrepared.body.data.currentVersion.contentHash,
      })
      .expect(201);
    await request(app)
      .post(`/api/v1/invoices/${signed.invoiceId}/versions/${signed.versionId}/sign`)
      .set("Authorization", `Bearer ${providerToken}`)
      .send({})
      .expect(200);
    await request(app)
      .post(
        `/api/v1/invoices/${signed.invoiceId}/versions/${signed.versionId}/signatures/${signedSignature.body.data.id}/void`,
      )
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "TEST after signed" })
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("SIGNATURE_NOT_VOIDABLE");
      });
  });

  it("enforces signature RBAC and prepare/sign concurrency", async () => {
    const rbac = await createInvoiceFixture("SIGN-RBAC", 1);

    await request(app)
      .post(
        `/api/v1/invoices/${rbac.invoiceId}/versions/${rbac.versionId}/prepare-signature`,
      )
      .send({})
      .expect(401);

    await prepareInvoice(rbac.invoiceId, rbac.versionId, noRoleToken).expect(403);

    const concurrent = await createInvoiceFixture("PREP-CONCURRENT", 1);
    const [firstPrepare, secondPrepare] = await Promise.all([
      prepareInvoice(concurrent.invoiceId, concurrent.versionId),
      prepareInvoice(concurrent.invoiceId, concurrent.versionId),
    ]);
    expect([200, 409]).toContain(firstPrepare.status);
    expect([200, 409]).toContain(secondPrepare.status);
    expect([firstPrepare.status, secondPrepare.status].filter((status) => status === 200))
      .toHaveLength(1);

    const historyCount = await prisma.invoiceStatusHistory.count({
      where: {
        invoiceId: BigInt(concurrent.invoiceId),
        newStatus: "PENDING_SIGNATURE",
      },
    });
    expect(historyCount).toBe(1);

    const signable = await createInvoiceFixture("SIGN-CONCURRENT", 1);
    const prepared = await prepareInvoice(signable.invoiceId, signable.versionId)
      .expect(200);
    const document = await createSignatureDocument({ suffix: "SIGN-CONCURRENT" });
    await request(app)
      .post(
        `/api/v1/invoices/${signable.invoiceId}/versions/${signable.versionId}/signatures`,
      )
      .set("Authorization", `Bearer ${providerToken}`)
      .send({
        signatureDocumentId: document.id.toString(),
        signatureType: "PATIENT",
        captureMethod: "SIGNATURE_PAD",
        expectedContentHash: prepared.body.data.currentVersion.contentHash,
      })
      .expect(201);

    const [firstSign, secondSign] = await Promise.all([
      request(app)
        .post(`/api/v1/invoices/${signable.invoiceId}/versions/${signable.versionId}/sign`)
        .set("Authorization", `Bearer ${providerToken}`)
        .send({}),
      request(app)
        .post(`/api/v1/invoices/${signable.invoiceId}/versions/${signable.versionId}/sign`)
        .set("Authorization", `Bearer ${providerToken}`)
        .send({}),
    ]);
    expect([200, 409]).toContain(firstSign.status);
    expect([200, 409]).toContain(secondSign.status);
    expect([firstSign.status, secondSign.status].filter((status) => status === 200))
      .toHaveLength(1);

    const signedHistoryCount = await prisma.invoiceStatusHistory.count({
      where: {
        invoiceId: BigInt(signable.invoiceId),
        newStatus: "SIGNED",
      },
    });
    expect(signedHistoryCount).toBe(1);
  });

  it("closes a signed invoice without changing locked signature content", async () => {
    const fixture = await createSignedInvoiceFixture("CLOSE-OK");

    await closeInvoice(fixture.invoiceId, fixture.versionId, adminToken)
      .expect(200)
      .expect((response) => {
        expect(response.body.data.status).toBe("CLOSED");
        expect(response.body.data.currentVersion.status).toBe("CLOSED");
        expect(response.body.data.currentVersion.closedAt).not.toBeNull();
        expect(response.body.data.currentVersion.contentHash).toBe(
          fixture.contentHash,
        );
        expect(response.body.data.currentVersion.lockedAt).toBe(
          fixture.lockedAt,
        );
        expect(response.body.data.currentVersion.signedAt).toBe(
          fixture.signedAt,
        );
      });

    await request(app)
      .get(
        `/api/v1/invoices/${fixture.invoiceId}/versions/${fixture.versionId}/signature-content`,
      )
      .set("Authorization", `Bearer ${providerToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.data.contentHash).toBe(fixture.contentHash);
      });

    const history = await prisma.invoiceStatusHistory.findFirst({
      where: {
        invoiceId: BigInt(fixture.invoiceId),
        oldStatus: "SIGNED",
        newStatus: "CLOSED",
      },
    });
    expect(history?.invoiceVersionId).toBe(BigInt(fixture.versionId));

    const audit = await prisma.auditLog.findFirst({
      where: {
        action: "INVOICE_CLOSE",
        entityId: BigInt(fixture.invoiceId),
      },
    });
    expect(audit?.oldValues).not.toBeNull();
    expect(audit?.newValues).not.toBeNull();
  });

  it("enforces invoice close RBAC and concurrency", async () => {
    const rbac = await createSignedInvoiceFixture("CLOSE-RBAC");

    await request(app)
      .post(`/api/v1/invoices/${rbac.invoiceId}/versions/${rbac.versionId}/close`)
      .send({})
      .expect(401);

    await closeInvoice(rbac.invoiceId, rbac.versionId, providerToken)
      .expect(403);
    await closeInvoice(rbac.invoiceId, rbac.versionId, receptionToken)
      .expect(200);
    await closeInvoice(rbac.invoiceId, rbac.versionId, receptionToken)
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("INVOICE_ALREADY_CLOSED");
      });

    const concurrent = await createSignedInvoiceFixture("CLOSE-CONCURRENT");
    const [firstClose, secondClose] = await Promise.all([
      closeInvoice(concurrent.invoiceId, concurrent.versionId, receptionToken),
      closeInvoice(concurrent.invoiceId, concurrent.versionId, receptionToken),
    ]);
    expect([200, 409]).toContain(firstClose.status);
    expect([200, 409]).toContain(secondClose.status);
    expect([firstClose.status, secondClose.status].filter((status) => status === 200))
      .toHaveLength(1);
    expect(
      [firstClose, secondClose]
        .filter((response) => response.status === 409)
        .every((response) => response.body.error.code === "INVOICE_ALREADY_CLOSED"),
    ).toBe(true);

    const historyCount = await prisma.invoiceStatusHistory.count({
      where: {
        invoiceId: BigInt(concurrent.invoiceId),
        oldStatus: "SIGNED",
        newStatus: "CLOSED",
      },
    });
    expect(historyCount).toBe(1);

    const auditCount = await prisma.auditLog.count({
      where: {
        action: "INVOICE_CLOSE",
        entityId: BigInt(concurrent.invoiceId),
      },
    });
    expect(auditCount).toBe(1);
  });

  it("rejects close when signed invoice content or totals were corrupted", async () => {
    const contentCorrupted = await createSignedInvoiceFixture("CLOSE-CONTENT");
    await prisma.invoiceItem.updateMany({
      where: { invoiceVersionId: BigInt(contentCorrupted.versionId) },
      data: { additionalNote: "TEST altered after signature" },
    });
    await closeInvoice(contentCorrupted.invoiceId, contentCorrupted.versionId)
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe(
          "INVOICE_CONTENT_INTEGRITY_MISMATCH",
        );
      });

    const itemCorrupted = await createSignedInvoiceFixture("CLOSE-ITEM");
    await prisma.invoiceItem.updateMany({
      where: { invoiceVersionId: BigInt(itemCorrupted.versionId) },
      data: { amount: "101.00" },
    });
    await closeInvoice(itemCorrupted.invoiceId, itemCorrupted.versionId)
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("INVOICE_ITEM_AMOUNT_MISMATCH");
      });

    const totalCorrupted = await createSignedInvoiceFixture("CLOSE-TOTAL");
    await prisma.invoiceVersion.update({
      where: { id: BigInt(totalCorrupted.versionId) },
      data: { totalAmount: "999.99" },
    });
    await closeInvoice(totalCorrupted.invoiceId, totalCorrupted.versionId)
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("INVOICE_TOTAL_MISMATCH");
      });

    const remaining = await prisma.invoice.findUniqueOrThrow({
      where: { id: BigInt(totalCorrupted.invoiceId) },
      select: {
        status: true,
        currentVersion: { select: { status: true, closedAt: true } },
      },
    });
    expect(remaining.status).toBe("SIGNED");
    expect(remaining.currentVersion?.status).toBe("SIGNED");
    expect(remaining.currentVersion?.closedAt).toBeNull();

    const rollbackHistoryCount = await prisma.invoiceStatusHistory.count({
      where: {
        invoiceId: BigInt(totalCorrupted.invoiceId),
        newStatus: "CLOSED",
      },
    });
    expect(rollbackHistoryCount).toBe(0);
  });

  it("rejects close when signature state or evidence is invalid", async () => {
    const missingSignedAt = await createSignedInvoiceFixture("CLOSE-NO-SIGNEDAT");
    await prisma.invoiceVersion.update({
      where: { id: BigInt(missingSignedAt.versionId) },
      data: { signedAt: null },
    });
    await closeInvoice(missingSignedAt.invoiceId, missingSignedAt.versionId)
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("INVOICE_SIGNATURE_STATE_INVALID");
      });

    const voidOnly = await createSignedInvoiceFixture("CLOSE-VOID-SIG");
    await prisma.signature.update({
      where: { id: voidOnly.signatureId },
      data: {
        status: "VOID",
        voidedAt: new Date(),
        voidedByUserId: adminUserId,
        voidReason: "TEST invalidated after sign",
      },
    });
    await closeInvoice(voidOnly.invoiceId, voidOnly.versionId)
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("VALID_SIGNATURE_REQUIRED");
      });

    const wrongContentHash = await createSignedInvoiceFixture("CLOSE-BAD-HASH");
    await prisma.signature.update({
      where: { id: wrongContentHash.signatureId },
      data: { signedContentHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
    });
    await closeInvoice(wrongContentHash.invoiceId, wrongContentHash.versionId)
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("SIGNATURE_CONTENT_HASH_MISMATCH");
      });

    const wrongDocumentHash = await createSignedInvoiceFixture("CLOSE-BAD-DOC");
    await prisma.document.update({
      where: { id: wrongDocumentHash.documentId },
      data: { sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
    });
    await closeInvoice(wrongDocumentHash.invoiceId, wrongDocumentHash.versionId)
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("SIGNATURE_EVIDENCE_INVALID");
      });

    const wrongDocumentOrg = await createSignedInvoiceFixture("CLOSE-BAD-ORG");
    await prisma.document.update({
      where: { id: wrongDocumentOrg.documentId },
      data: { organizationId: otherOrganizationId },
    });
    await closeInvoice(wrongDocumentOrg.invoiceId, wrongDocumentOrg.versionId)
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("SIGNATURE_EVIDENCE_INVALID");
      });
  });

  it("rejects close for non-current or non-signed versions", async () => {
    const draft = await createInvoiceFixture("CLOSE-DRAFT", 1);
    await closeInvoice(draft.invoiceId, draft.versionId)
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("INVOICE_NOT_CLOSABLE");
      });

    const prepared = await createInvoiceFixture("CLOSE-PREPARED", 1);
    await prepareInvoice(prepared.invoiceId, prepared.versionId).expect(200);
    await closeInvoice(prepared.invoiceId, prepared.versionId)
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("INVOICE_NOT_CLOSABLE");
      });

    const signed = await createSignedInvoiceFixture("CLOSE-WRONG-VERSION");
    await closeInvoice(signed.invoiceId, "999999999999")
      .expect(404)
      .expect((response) => {
        expect(response.body.error.code).toBe("INVOICE_VERSION_NOT_FOUND");
      });
  });

  it("manages correction request, reject, cancel, list, detail, and RBAC", async () => {
    const closed = await createClosedInvoiceFixture("CORR-REQUEST");

    await request(app)
      .get(`/api/v1/invoices/${closed.invoiceId}/corrections`)
      .expect(401)
      .expect((response) => {
        expect(response.body.error.code).toBe("AUTHENTICATION_REQUIRED");
      });

    await request(app)
      .get(`/api/v1/invoices/${closed.invoiceId}/corrections`)
      .set("Authorization", `Bearer ${noRoleToken}`)
      .expect(403)
      .expect((response) => {
        expect(response.body.error.code).toBe("PERMISSION_DENIED");
      });

    const requested = await requestCorrection(closed.invoiceId)
      .expect(201)
      .expect((response) => {
        expect(response.body.data).toMatchObject({
          invoiceId: closed.invoiceId,
          sourceVersionId: closed.versionId,
          replacementVersionId: null,
          reasonCode: "TEST-CORRECTION",
          reasonText: "TEST invoice correction request",
          status: "REQUESTED",
          requestedByUserId: receptionUserId.toString(),
        });
        expect(typeof response.body.data.id).toBe("string");
      });
    const correctionId = requested.body.data.id as string;

    await requestCorrection(closed.invoiceId)
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("INVOICE_CORRECTION_ALREADY_ACTIVE");
      });

    await request(app)
      .post(`/api/v1/invoices/${closed.invoiceId}/corrections`)
      .set("Authorization", `Bearer ${providerToken}`)
      .send({ reasonCode: "TEST", reasonText: "TEST denied" })
      .expect(403);

    await request(app)
      .post(`/api/v1/invoices/${closed.invoiceId}/corrections/${correctionId}/approve`)
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({})
      .expect(403);

    await request(app)
      .get(`/api/v1/invoices/${closed.invoiceId}/corrections`)
      .set("Authorization", `Bearer ${providerToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].id).toBe(correctionId);
      });

    await request(app)
      .get(`/api/v1/invoices/${closed.invoiceId}/corrections/${correctionId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.data.sourceVersion).toMatchObject({
          id: closed.versionId,
          status: "CLOSED",
        });
      });

    await request(app)
      .post(`/api/v1/invoices/${closed.invoiceId}/corrections/${correctionId}/reject`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "TEST rejected" })
      .expect(200)
      .expect((response) => {
        expect(response.body.data.status).toBe("REJECTED");
        expect(response.body.data.resolvedByUserId).toBe(adminUserId.toString());
      });

    await request(app)
      .get(`/api/v1/invoices/${closed.invoiceId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.data.status).toBe("CLOSED");
        expect(response.body.data.currentVersion.status).toBe("CLOSED");
      });

    const cancelRequested = await requestCorrection(closed.invoiceId).expect(201);
    await request(app)
      .post(
        `/api/v1/invoices/${closed.invoiceId}/corrections/${cancelRequested.body.data.id}/cancel`,
      )
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "TEST cancelled" })
      .expect(200)
      .expect((response) => {
        expect(response.body.data.status).toBe("CANCELLED");
      });

    const history = await prisma.invoiceStatusHistory.findMany({
      where: { invoiceId: BigInt(closed.invoiceId) },
      select: { oldStatus: true, newStatus: true },
    });
    expect(history).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          oldStatus: "CLOSED",
          newStatus: "CORRECTION_REQUIRED",
        }),
        expect.objectContaining({
          oldStatus: "CORRECTION_REQUIRED",
          newStatus: "CLOSED",
        }),
      ]),
    );
  });

  it("creates, edits, signs, closes, and applies a correction replacement", async () => {
    const closed = await createClosedInvoiceFixture("CORR-FLOW");
    const requested = await requestCorrection(closed.invoiceId).expect(201);
    const correctionId = requested.body.data.id as string;
    await approveCorrection(closed.invoiceId, correctionId).expect(200);

    const replacementResponse = await createCorrectionReplacement(
      closed.invoiceId,
      correctionId,
    )
      .expect(201)
      .expect((response) => {
        expect(response.body.data.status).toBe("APPROVED");
        expect(response.body.data.replacementVersionId).not.toBeNull();
        expect(response.body.data.sourceVersion.status).toBe("CLOSED");
      });
    const replacementVersionId = replacementResponse.body.data
      .replacementVersionId as string;

    const versions = await request(app)
      .get(`/api/v1/invoices/${closed.invoiceId}/versions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(versions.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: closed.versionId,
          versionNumber: 1,
          versionType: "ORIGINAL",
          status: "CLOSED",
        }),
        expect.objectContaining({
          id: replacementVersionId,
          versionNumber: 2,
          versionType: "CORRECTION",
          status: "DRAFT",
        }),
      ]),
    );

    const sourceItems = await request(app)
      .get(`/api/v1/invoices/${closed.invoiceId}/versions/${closed.versionId}/items`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    const replacementItems = await request(app)
      .get(
        `/api/v1/invoices/${closed.invoiceId}/versions/${replacementVersionId}/items`,
      )
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    const sourceItem = sourceItems.body.data[0];
    const replacementItem = replacementItems.body.data[0];
    expect(replacementItem.sourceInvoiceItemId).toBe(sourceItem.id);

    await request(app)
      .patch(
        `/api/v1/invoices/${closed.invoiceId}/versions/${closed.versionId}/items/${sourceItem.id}`,
      )
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ quantity: "2.00" })
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("INVOICE_VERSION_NOT_CURRENT");
      });

    await request(app)
      .patch(
        `/api/v1/invoices/${closed.invoiceId}/versions/${replacementVersionId}/items/${replacementItem.id}`,
      )
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        quantity: "2.00",
        unitTariffSnapshot: "125.25",
        additionalNote: "TEST corrected amount",
      })
      .expect(200)
      .expect((response) => {
        expect(response.body.data.quantity).toBe("2.00");
        expect(response.body.data.unitTariffSnapshot).toBe("125.25");
        expect(response.body.data.amount).toBe("250.50");
      });

    const sourceAfterPatch = await prisma.invoiceItem.findUniqueOrThrow({
      where: { id: BigInt(sourceItem.id as string) },
      select: { quantity: true, amount: true },
    });
    expect(sourceAfterPatch.quantity.toFixed(2)).toBe("1.00");
    expect(sourceAfterPatch.amount.toFixed(2)).toBe("100.00");

    await request(app)
      .post(`/api/v1/invoices/${closed.invoiceId}/versions/${replacementVersionId}/sign`)
      .set("Authorization", `Bearer ${providerToken}`)
      .send({})
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("INVOICE_VERSION_NOT_SIGNATURE_READY");
      });

    const prepared = await prepareInvoice(
      closed.invoiceId,
      replacementVersionId,
      providerToken,
    )
      .expect(200)
      .expect((response) => {
        expect(response.body.data.status).toBe("PENDING_SIGNATURE");
        expect(response.body.data.currentVersion.id).toBe(replacementVersionId);
        expect(response.body.data.currentVersion.contentHash).not.toBe(
          closed.contentHash,
        );
      });

    await closeInvoice(closed.invoiceId, replacementVersionId)
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("INVOICE_NOT_CLOSABLE");
      });

    await signInvoiceVersion({
      invoiceId: closed.invoiceId,
      versionId: replacementVersionId,
      contentHash: prepared.body.data.currentVersion.contentHash as string,
      suffix: "CORR-FLOW-REPLACEMENT",
    });

    const sourceBeforeClose = await prisma.invoiceVersion.findUniqueOrThrow({
      where: { id: BigInt(closed.versionId) },
      select: { status: true, supersededAt: true },
    });
    expect(sourceBeforeClose.status).toBe("CLOSED");
    expect(sourceBeforeClose.supersededAt).toBeNull();

    await closeInvoice(closed.invoiceId, replacementVersionId)
      .expect(403)
      .expect((response) => {
        expect(response.body.error.code).toBe("PERMISSION_DENIED");
      });

    await closeInvoice(closed.invoiceId, replacementVersionId, adminToken)
      .expect(200)
      .expect((response) => {
        expect(response.body.data.status).toBe("CLOSED");
        expect(response.body.data.currentVersion.id).toBe(replacementVersionId);
        expect(response.body.data.currentVersion.status).toBe("CLOSED");
        expect(response.body.data.currentVersion.totalAmount).toBe("250.50");
      });

    const sourceAfterClose = await prisma.invoiceVersion.findUniqueOrThrow({
      where: { id: BigInt(closed.versionId) },
      select: { status: true, supersededAt: true },
    });
    expect(sourceAfterClose.status).toBe("SUPERSEDED");
    expect(sourceAfterClose.supersededAt).not.toBeNull();

    const applied = await prisma.invoiceCorrection.findUniqueOrThrow({
      where: { id: BigInt(correctionId) },
      select: {
        status: true,
        replacementVersionId: true,
        resolvedByUserId: true,
        resolvedAt: true,
      },
    });
    expect(applied).toMatchObject({
      status: "APPLIED",
      replacementVersionId: BigInt(replacementVersionId),
      resolvedByUserId: adminUserId,
    });
    expect(applied.resolvedAt).not.toBeNull();

    const logs = await prisma.auditLog.findMany({
      where: {
        entityType: { in: ["INVOICE_CORRECTION", "INVOICE_ITEM"] },
        entityKey: closed.invoiceNumber,
      },
      select: { action: true, oldValues: true, newValues: true },
    });
    expect(logs.map((log) => log.action)).toEqual(
      expect.arrayContaining([
        "INVOICE_CORRECTION_REQUEST",
        "INVOICE_CORRECTION_APPROVE",
        "INVOICE_CORRECTION_REPLACEMENT_CREATE",
        "INVOICE_CORRECTION_APPLY",
      ]),
    );
    expect(logs.some((log) => log.oldValues !== null)).toBe(true);
    expect(logs.some((log) => log.newValues !== null)).toBe(true);

    const itemLog = await prisma.auditLog.findFirst({
      where: {
        action: "INVOICE_CORRECTION_ITEM_UPDATE",
        entityId: BigInt(replacementItem.id as string),
      },
      select: { oldValues: true, newValues: true, correlationId: true },
    });
    expect(itemLog?.oldValues).not.toBeNull();
    expect(itemLog?.newValues).not.toBeNull();
    expect(itemLog?.correlationId).not.toBeNull();
  });

  it("prevents concurrent duplicate correction replacements", async () => {
    const closed = await createClosedInvoiceFixture("CORR-CONCURRENT");
    const requested = await requestCorrection(closed.invoiceId).expect(201);
    const correctionId = requested.body.data.id as string;
    await approveCorrection(closed.invoiceId, correctionId).expect(200);

    const [first, second] = await Promise.all([
      createCorrectionReplacement(closed.invoiceId, correctionId),
      createCorrectionReplacement(closed.invoiceId, correctionId),
    ]);

    expect([201, 409]).toContain(first.status);
    expect([201, 409]).toContain(second.status);
    expect([first.status, second.status].filter((status) => status === 201))
      .toHaveLength(1);

    const failure = [first, second].find((response) => response.status === 409);
    expect(failure?.body.error.code).toBe(
      "INVOICE_CORRECTION_REPLACEMENT_ALREADY_EXISTS",
    );

    const count = await prisma.invoiceVersion.count({
      where: {
        invoiceId: BigInt(closed.invoiceId),
        versionType: "CORRECTION",
      },
    });
    expect(count).toBe(1);
  });

  it("writes invoice audit logs", async () => {
    const logs = await prisma.auditLog.findMany({
      where: {
        entityType: "INVOICE",
        entityKey: {
          not: null,
        },
      },
      select: {
        action: true,
        oldValues: true,
        newValues: true,
        correlationId: true,
      },
    });

    expect(logs.map((log) => log.action)).toEqual(
      expect.arrayContaining([
        "INVOICE_CREATE",
        "INVOICE_CANCEL",
        "INVOICE_PREPARE_SIGNATURE",
        "INVOICE_SIGN",
        "INVOICE_CLOSE",
      ]),
    );
    expect(logs.some((log) => log.newValues !== null)).toBe(true);
    expect(logs.some((log) => log.oldValues !== null)).toBe(true);
    expect(logs.some((log) => log.correlationId !== null)).toBe(true);

    const signatureLogs = await prisma.auditLog.findMany({
      where: {
        entityType: "SIGNATURE",
      },
      select: {
        action: true,
        oldValues: true,
        newValues: true,
        correlationId: true,
      },
    });
    expect(signatureLogs.map((log) => log.action)).toEqual(
      expect.arrayContaining(["SIGNATURE_CAPTURE", "SIGNATURE_VOID"]),
    );
    expect(signatureLogs.some((log) => log.newValues !== null)).toBe(true);
  });
});
