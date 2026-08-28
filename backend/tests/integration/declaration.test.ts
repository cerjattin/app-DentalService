import { rm } from "node:fs/promises";
import path from "node:path";

import request from "supertest";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { app } from "../../src/app.js";
import { prisma } from "../../src/infrastructure/database/prisma.js";
import { accessTokenService } from "../../src/modules/auth/access-token.service.js";

const ADMIN_EMAIL = "declaration.admin@local.invalid";
const RECEPTION_EMAIL = "declaration.reception@local.invalid";
const PROVIDER_EMAIL = "declaration.provider@local.invalid";
const NO_ROLE_EMAIL = "declaration.norole@local.invalid";
const OTHER_EMAIL = "declaration.other@local.invalid";
const OTHER_ORG_LEGAL_NAME = "TEST Declaration Other Organization";

let organizationId: bigint;
let otherOrganizationId: bigint;
let adminUserId: bigint;
let otherUserId: bigint;
let adminToken: string;
let receptionToken: string;
let providerToken: string;
let noRoleToken: string;
let payerId: bigint;
let otherPayerId: bigint;
let invoiceItemId: bigint;
let otherPayerInvoiceItemId: bigint;
let otherOrganizationInvoiceItemId: bigint;
let declarationId: string;

async function cleanupDeclarationFixture() {
  const users = await prisma.user.findMany({
    where: {
      email: {
        in: [
          ADMIN_EMAIL,
          RECEPTION_EMAIL,
          PROVIDER_EMAIL,
          NO_ROLE_EMAIL,
          OTHER_EMAIL,
        ],
      },
    },
    select: {
      id: true,
    },
  });
  const userIds = users.map((user) => user.id);

  const declarationBatches = await prisma.declarationBatch.findMany({
    where: {
      OR: [
        {
          declarationNumber: {
            startsWith: "TEST-DECL",
          },
        },
        {
          notes: {
            contains: "TEST-DECL",
          },
        },
      ],
    },
    select: {
      id: true,
      exports: {
        select: {
          documentId: true,
        },
      },
    },
  });
  const declarationIds = declarationBatches.map((batch) => batch.id);
  const documentIds = declarationBatches.flatMap((batch) =>
    batch.exports.map((item) => item.documentId),
  );

  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { actorUserId: { in: userIds } },
        { entityType: { startsWith: "DECLARATION" } },
      ],
    },
  });
  await prisma.declarationSubmission.deleteMany({
    where: {
      declarationBatchId: {
        in: declarationIds,
      },
    },
  });
  await prisma.declarationExport.deleteMany({
    where: {
      declarationBatchId: {
        in: declarationIds,
      },
    },
  });
  await prisma.document.deleteMany({
    where: {
      OR: [
        { id: { in: documentIds } },
        { originalFilename: { startsWith: "TEST-DECL" } },
      ],
    },
  });
  await prisma.declarationItem.deleteMany({
    where: {
      declarationBatchId: {
        in: declarationIds,
      },
    },
  });
  await prisma.declarationBatchStatusHistory.deleteMany({
    where: {
      declarationBatchId: {
        in: declarationIds,
      },
    },
  });
  await prisma.declarationBatch.deleteMany({
    where: {
      id: {
        in: declarationIds,
      },
    },
  });

  const invoices = await prisma.invoice.findMany({
    where: {
      OR: [
        { invoiceNumber: { startsWith: "TEST-DECL-INV" } },
        { organization: { legalName: OTHER_ORG_LEGAL_NAME } },
      ],
    },
    select: {
      id: true,
      versions: {
        select: {
          id: true,
        },
      },
    },
  });
  const invoiceIds = invoices.map((invoice) => invoice.id);
  const versionIds = invoices.flatMap((invoice) =>
    invoice.versions.map((version) => version.id),
  );

  await prisma.invoiceItem.deleteMany({
    where: {
      invoiceVersionId: {
        in: versionIds,
      },
    },
  });
  await prisma.invoice.updateMany({
    where: {
      id: {
        in: invoiceIds,
      },
    },
    data: {
      currentVersionId: null,
    },
  });
  await prisma.invoiceVersion.deleteMany({
    where: {
      id: {
        in: versionIds,
      },
    },
  });
  await prisma.invoice.deleteMany({
    where: {
      id: {
        in: invoiceIds,
      },
    },
  });

  const appointments = await prisma.appointment.findMany({
    where: {
      OR: [
        { appointmentNumber: { startsWith: "TEST-DECL-APT" } },
        { organization: { legalName: OTHER_ORG_LEGAL_NAME } },
      ],
    },
    select: {
      id: true,
    },
  });
  const appointmentIds = appointments.map((appointment) => appointment.id);

  await prisma.encounterProcedure.deleteMany({
    where: {
      encounter: {
        appointmentId: {
          in: appointmentIds,
        },
      },
    },
  });
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
        startsWith: "00000",
      },
    },
  });
  await prisma.svbTariff.deleteMany({
    where: {
      svbProcedure: {
        code: {
          startsWith: "TEST-DECL-PROC",
        },
      },
    },
  });
  await prisma.svbProcedure.deleteMany({
    where: {
      code: {
        startsWith: "TEST-DECL-PROC",
      },
    },
  });
  await prisma.provider.deleteMany({
    where: {
      lastName: {
        startsWith: "Provider ",
      },
    },
  });
  await prisma.clinicLocation.deleteMany({
    where: {
      code: {
        startsWith: "TEST-DECL-LOC",
      },
    },
  });
  await prisma.patient.deleteMany({
    where: {
      patientNumber: {
        startsWith: "TEST-DECL-PAT",
      },
    },
  });
  await prisma.payer.deleteMany({
    where: {
      code: {
        startsWith: "TEST-DECL-PAYER",
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

  if (process.env.NODE_ENV === "test") {
    await rm(
      path.resolve(
        process.cwd(),
        process.env.DOCUMENT_STORAGE_PATH ?? "storage/documents",
      ),
      { recursive: true, force: true },
    );
  }
}

async function createUser(
  email: string,
  roleCode?: string,
  orgId = organizationId,
) {
  const user = await prisma.user.create({
    data: {
      organizationId: orgId,
      email,
      passwordHash: "not-used-for-token-fixture",
      firstName: "Declaration",
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

async function createInvoiceFixture(input: {
  orgId: bigint;
  payer: bigint;
  createdBy: bigint;
  suffix: string;
  declarantId?: string | null;
  invoiceStatus?: "DRAFT" | "CLOSED";
  versionStatus?: "DRAFT" | "CLOSED";
}) {
  const patient = await prisma.patient.create({
    data: {
      organizationId: input.orgId,
      patientNumber: `TEST-DECL-PAT-${input.suffix}`,
      firstName: "Test",
      lastName: `Declaration ${input.suffix}`,
      status: "ACTIVE",
    },
    select: {
      id: true,
    },
  });
  const insurance = await prisma.patientInsurance.create({
    data: {
      patientId: patient.id,
      payerId: input.payer,
      insuredId: `00000${input.suffix.padStart(4, "0")}`.slice(0, 9),
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
      status: "ACTIVE",
      isPrimary: true,
    },
    select: {
      id: true,
    },
  });
  const provider = await prisma.provider.create({
    data: {
      organizationId: input.orgId,
      svbProviderId:
        input.suffix === "0001" ? "12345" : `1${input.suffix}`,
      firstName: "Test",
      lastName: `Provider ${input.suffix}`,
      isActive: true,
    },
    select: {
      id: true,
      svbProviderId: true,
    },
  });
  const location = await prisma.clinicLocation.create({
    data: {
      organizationId: input.orgId,
      code: `TEST-DECL-LOC-${input.suffix}`,
      name: `Declaration Location ${input.suffix}`,
      isActive: true,
    },
    select: {
      id: true,
    },
  });
  const appointment = await prisma.appointment.create({
    data: {
      organizationId: input.orgId,
      appointmentNumber: `TEST-DECL-APT-${input.suffix}`,
      patientId: patient.id,
      providerId: provider.id,
      clinicLocationId: location.id,
      scheduledStartAt: new Date("2026-08-20T13:00:00.000Z"),
      scheduledEndAt: new Date("2026-08-20T13:30:00.000Z"),
      status: "COMPLETED",
      checkedInAt: new Date("2026-08-20T12:55:00.000Z"),
      startedAt: new Date("2026-08-20T13:00:00.000Z"),
      completedAt: new Date("2026-08-20T13:30:00.000Z"),
      createdByUserId: input.createdBy,
    },
    select: {
      id: true,
    },
  });
  const encounter = await prisma.clinicalEncounter.create({
    data: {
      appointmentId: appointment.id,
      providerId: provider.id,
      status: "COMPLETED",
      startedAt: new Date("2026-08-20T13:00:00.000Z"),
      completedAt: new Date("2026-08-20T13:25:00.000Z"),
      createdByUserId: input.createdBy,
    },
    select: {
      id: true,
    },
  });
  const procedure = await prisma.svbProcedure.create({
    data: {
      code: `TEST-DECL-PROC-${input.suffix}`,
      description: `Declaration procedure ${input.suffix}`,
      category: "TEST-DECL",
      unit: "VISIT",
      isActive: true,
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
    },
    select: {
      id: true,
      code: true,
    },
  });
  const tariff = await prisma.svbTariff.create({
    data: {
      svbProcedureId: procedure.id,
      amount: "1234.50",
      currencyCode: "ANG",
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
      isActive: true,
    },
    select: {
      id: true,
    },
  });
  const encounterProcedure = await prisma.encounterProcedure.create({
    data: {
      encounterId: encounter.id,
      patientInsuranceId: insurance.id,
      svbProcedureId: procedure.id,
      svbTariffId: tariff.id,
      performedByProviderId: provider.id,
      procedureCodeSnapshot: procedure.code,
      procedureDescriptionSnapshot: "Declaration procedure",
      providerIdSnapshot: provider.svbProviderId,
      insuredIdSnapshot: `00000${input.suffix.padStart(4, "0")}`.slice(0, 9),
      unitTariffSnapshot: "1234.50",
      currencyCodeSnapshot: "ANG",
      quantity: "1.00",
      amount: "1234.50",
      authorizationIdSnapshot: "AUTH-DECL",
      diagnosticCodeSnapshot: "K02",
      treatmentIdSnapshot: "T123456",
      numberOfTreatmentsSnapshot: 1,
      assistanceSnapshot: "Y",
      policlinicSnapshot: "P",
      performedAt: new Date("2026-08-20T13:15:00.000Z"),
      status: "PERFORMED",
      createdByUserId: input.createdBy,
    },
    select: {
      id: true,
    },
  });
  const invoice = await prisma.invoice.create({
    data: {
      organizationId: input.orgId,
      appointmentId: appointment.id,
      patientId: patient.id,
      patientInsuranceId: insurance.id,
      invoiceNumber: `TEST-DECL-INV-${input.suffix}`,
      status: input.invoiceStatus ?? "CLOSED",
      createdByUserId: input.createdBy,
    },
    select: {
      id: true,
    },
  });
  const version = await prisma.invoiceVersion.create({
    data: {
      invoiceId: invoice.id,
      versionNumber: 1,
      versionType: "ORIGINAL",
      status: input.versionStatus ?? "CLOSED",
      invoiceDate: new Date("2026-08-20T00:00:00.000Z"),
      currencyCode: "ANG",
      totalAmount: "1234.50",
      declarantIdSnapshot:
        input.declarantId === undefined ? "12345" : input.declarantId,
      patientNameSnapshot: "Test Declaration",
      insuredIdSnapshot: `00000${input.suffix.padStart(4, "0")}`.slice(0, 9),
      preparedByUserId: input.createdBy,
      closedAt: new Date("2026-08-20T14:00:00.000Z"),
    },
    select: {
      id: true,
    },
  });
  const item = await prisma.invoiceItem.create({
    data: {
      invoiceVersionId: version.id,
      lineNumber: 1,
      detailInvoiceNumber: `DET-${input.suffix}`,
      encounterProcedureId: encounterProcedure.id,
      svbProcedureId: procedure.id,
      svbTariffId: tariff.id,
      serviceDateSnapshot: new Date("2026-08-20T00:00:00.000Z"),
      procedureCodeSnapshot: procedure.code,
      procedureDescriptionSnapshot: "Declaration procedure",
      providerIdSnapshot: provider.svbProviderId ?? "12345",
      insuredIdSnapshot: `00000${input.suffix.padStart(4, "0")}`.slice(0, 9),
      unitTariffSnapshot: "1234.50",
      currencyCodeSnapshot: "ANG",
      quantity: "1.00",
      amount: "1234.50",
      authorizationIdSnapshot: "AUTH-DECL",
      diagnosticCodeSnapshot: "K02",
      treatmentIdSnapshot: "T123456",
      numberOfTreatmentsSnapshot: 1,
      assistanceSnapshot: "Y",
      policlinicSnapshot: "P",
      additionalNote: "TEST-DECL note",
    },
    select: {
      id: true,
    },
  });

  await prisma.invoice.update({
    where: {
      id: invoice.id,
    },
    data: {
      currentVersionId: version.id,
    },
  });

  return item.id;
}

async function createDeclaration(declarantIdSnapshot: string | null = "12345") {
  const response = await request(app)
    .post("/api/v1/declarations")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      payerId: payerId.toString(),
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
      declarantIdSnapshot,
      notes: "TEST-DECL batch",
    })
    .expect(201);

  return response.body.data.id as string;
}

describe("Declaration API", () => {
  beforeAll(async () => {
    await cleanupDeclarationFixture();

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
        tradeName: OTHER_ORG_LEGAL_NAME,
        declarantId: "99999",
        timezone: "America/Curacao",
        isActive: true,
      },
      select: {
        id: true,
      },
    });
    otherOrganizationId = otherOrganization.id;

    payerId = (
      await prisma.payer.create({
        data: {
          code: "TEST-DECL-PAYER-A",
          name: "TEST Declaration Payer A",
          payerType: "STATE_INSURANCE",
          isActive: true,
        },
        select: {
          id: true,
        },
      })
    ).id;
    otherPayerId = (
      await prisma.payer.create({
        data: {
          code: "TEST-DECL-PAYER-B",
          name: "TEST Declaration Payer B",
          payerType: "STATE_INSURANCE",
          isActive: true,
        },
        select: {
          id: true,
        },
      })
    ).id;

    adminUserId = await createUser(ADMIN_EMAIL, "ADMIN");
    const receptionUserId = await createUser(RECEPTION_EMAIL, "RECEPTION");
    const providerUserId = await createUser(PROVIDER_EMAIL, "PROVIDER");
    const noRoleUserId = await createUser(NO_ROLE_EMAIL);
    otherUserId = await createUser(
      OTHER_EMAIL,
      undefined,
      otherOrganizationId,
    );

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

    invoiceItemId = await createInvoiceFixture({
      orgId: organizationId,
      payer: payerId,
      createdBy: adminUserId,
      suffix: "0001",
    });
    otherPayerInvoiceItemId = await createInvoiceFixture({
      orgId: organizationId,
      payer: otherPayerId,
      createdBy: adminUserId,
      suffix: "0002",
    });
    otherOrganizationInvoiceItemId = await createInvoiceFixture({
      orgId: otherOrganizationId,
      payer: payerId,
      createdBy: otherUserId,
      suffix: "0003",
    });
  });

  afterAll(async () => {
    await cleanupDeclarationFixture();
    await prisma.$disconnect();
  });

  it("creates a declaration batch with generated declaration number", async () => {
    const response = await request(app)
      .post("/api/v1/declarations")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        payerId: payerId.toString(),
        periodStart: "2026-08-01",
        periodEnd: "2026-08-31",
        declarantIdSnapshot: "12345",
        notes: "TEST-DECL primary",
      })
      .expect(201);

    declarationId = response.body.data.id;

    expect(response.body.data.id).toEqual(expect.any(String));
    expect(response.body.data.payerId).toBe(payerId.toString());
    expect(response.body.data.status).toBe("DRAFT");
    expect(response.body.data.declarationNumber).toEqual(expect.any(String));
  });

  it("lists and gets declaration detail", async () => {
    const list = await request(app)
      .get("/api/v1/declarations?q=TEST-DECL")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(list.body.meta.total).toBeGreaterThanOrEqual(1);

    const detail = await request(app)
      .get(`/api/v1/declarations/${declarationId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(detail.body.data.id).toBe(declarationId);
    expect(detail.body.data.payer.id).toBe(payerId.toString());
  });

  it("adds an eligible invoice item and freezes exact snapshots", async () => {
    const response = await request(app)
      .post(`/api/v1/declarations/${declarationId}/items`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        invoiceItemId: invoiceItemId.toString(),
      })
      .expect(201);

    expect(response.body.data.invoiceItemId).toBe(invoiceItemId.toString());
    expect(response.body.data.providerIdSnapshot).toBe("12345");
    expect(response.body.data.insuredIdSnapshot).toMatch(/^\d{9}$/);
    expect(response.body.data.amountSnapshot).toBe("1234.50");

    await request(app)
      .post(`/api/v1/declarations/${declarationId}/items`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        invoiceItemId: invoiceItemId.toString(),
      })
      .expect(409);
  });

  it("rejects wrong payer and cross-organization invoice items", async () => {
    await request(app)
      .post(`/api/v1/declarations/${declarationId}/items`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        invoiceItemId: otherPayerInvoiceItemId.toString(),
      })
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("DECLARATION_ITEM_WRONG_PAYER");
      });

    await request(app)
      .post(`/api/v1/declarations/${declarationId}/items`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        invoiceItemId: otherOrganizationInvoiceItemId.toString(),
      })
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe(
          "DECLARATION_ITEM_WRONG_ORGANIZATION",
        );
      });
  });

  it("marks a declaration ready and blocks further item mutation", async () => {
    const response = await request(app)
      .post(`/api/v1/declarations/${declarationId}/ready`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.data.status).toBe("READY");

    await request(app)
      .post(`/api/v1/declarations/${declarationId}/items`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        invoiceItemId: otherPayerInvoiceItemId.toString(),
      })
      .expect(409)
      .expect((itemResponse) => {
        expect(itemResponse.body.error.code).toBe("DECLARATION_NOT_EDITABLE");
      });
  });

  it("exports CSV idempotently and records document metadata", async () => {
    const first = await request(app)
      .post(`/api/v1/declarations/${declarationId}/exports`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        format: "CSV",
      })
      .expect(201);

    const second = await request(app)
      .post(`/api/v1/declarations/${declarationId}/exports`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        format: "CSV",
      })
      .expect(201);

    expect(second.body.data.id).toBe(first.body.data.id);
    expect(first.body.data.format).toBe("CSV");
    expect(first.body.data.recordCount).toBe(1);
    expect(first.body.data.document.documentType).toBe("DECLARATION_EXPORT");
    expect(first.body.data.document.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(first.body.data.document.storageUri).toBeUndefined();

    const detail = await request(app)
      .get(`/api/v1/declarations/${declarationId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(detail.body.data.status).toBe("EXPORTED");
  });

  it("exports TXT, JSON, and XML adapters", async () => {
    const targetDeclarationId = await createDeclaration("12345");
    await request(app)
      .post(`/api/v1/declarations/${targetDeclarationId}/items`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        invoiceItemId: otherPayerInvoiceItemId.toString(),
      })
      .expect(409);

    const freshInvoiceItemId = await createInvoiceFixture({
      orgId: organizationId,
      payer: payerId,
      createdBy: adminUserId,
      suffix: "0004",
    });

    await request(app)
      .post(`/api/v1/declarations/${targetDeclarationId}/items`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        invoiceItemId: freshInvoiceItemId.toString(),
      })
      .expect(201);
    await request(app)
      .post(`/api/v1/declarations/${targetDeclarationId}/ready`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    for (const format of ["TXT", "JSON", "XML"]) {
      await request(app)
        .post(`/api/v1/declarations/${targetDeclarationId}/exports`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          format,
        })
        .expect(201)
        .expect((response) => {
          expect(response.body.data.format).toBe(format);
        });
    }
  });

  it("rejects unsupported export formats", async () => {
    await request(app)
      .post(`/api/v1/declarations/${declarationId}/exports`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        format: "XLSX",
      })
      .expect(400)
      .expect((response) => {
        expect(response.body.error.code).toBe("UNSUPPORTED_EXPORT_FORMAT");
      });
  });

  it("rejects empty and incomplete declarations at READY", async () => {
    const emptyDeclarationId = await createDeclaration("12345");
    await request(app)
      .post(`/api/v1/declarations/${emptyDeclarationId}/ready`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe("DECLARATION_EMPTY");
      });

    const incompleteItemId = await createInvoiceFixture({
      orgId: organizationId,
      payer: payerId,
      createdBy: adminUserId,
      suffix: "0005",
      declarantId: null,
    });
    const incompleteDeclarationId = await createDeclaration(null);
    await request(app)
      .post(`/api/v1/declarations/${incompleteDeclarationId}/items`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        invoiceItemId: incompleteItemId.toString(),
      })
      .expect(201);
    await request(app)
      .post(`/api/v1/declarations/${incompleteDeclarationId}/ready`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(409)
      .expect((response) => {
        expect(response.body.error.code).toBe(
          "DECLARATION_SVB_DATA_INCOMPLETE",
        );
      });
  });

  it("validates period, missing declaration, invalid id, auth, and RBAC", async () => {
    await request(app)
      .post("/api/v1/declarations")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        payerId: payerId.toString(),
        periodStart: "2026-09-01",
        periodEnd: "2026-08-31",
      })
      .expect(400);

    await request(app)
      .get("/api/v1/declarations/not-a-number")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(400);

    await request(app)
      .get("/api/v1/declarations/999999999999")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(404);

    await request(app).get("/api/v1/declarations").expect(401);

    await request(app)
      .get("/api/v1/declarations")
      .set("Authorization", `Bearer ${receptionToken}`)
      .expect(200);

    await request(app)
      .post("/api/v1/declarations")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        payerId: payerId.toString(),
      })
      .expect(403);

    await request(app)
      .post(`/api/v1/declarations/${declarationId}/exports`)
      .set("Authorization", `Bearer ${providerToken}`)
      .send({
        format: "TXT",
      })
      .expect(403);

    await request(app)
      .get("/api/v1/declarations")
      .set("Authorization", `Bearer ${noRoleToken}`)
      .expect(403);
  });

  it("writes audit logs for create, item add, ready, and export", async () => {
    const logs = await prisma.auditLog.findMany({
      where: {
        actorUserId: adminUserId,
        action: {
          in: [
            "DECLARATION_CREATE",
            "DECLARATION_ITEM_ADD",
            "DECLARATION_READY",
            "DECLARATION_EXPORT",
          ],
        },
      },
      select: {
        action: true,
        entityId: true,
        entityKey: true,
        newValues: true,
        correlationId: true,
      },
    });

    expect(logs.map((log) => log.action)).toEqual(
      expect.arrayContaining([
        "DECLARATION_CREATE",
        "DECLARATION_ITEM_ADD",
        "DECLARATION_READY",
        "DECLARATION_EXPORT",
      ]),
    );
    expect(logs.every((log) => log.entityId !== null)).toBe(true);
    expect(logs.every((log) => log.entityKey !== null)).toBe(true);
    expect(logs.some((log) => log.newValues !== null)).toBe(true);
    expect(logs.some((log) => log.correlationId !== null)).toBe(true);
  });
});
