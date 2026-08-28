import { Prisma } from "../../generated/prisma/client.js";

import { prisma } from "../../infrastructure/database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { parseDateOnly } from "../../shared/utils/date-only.js";

import { auditService, auditTechnicalFields } from "../audit/audit.service.js";
import type {
  AuthenticatedRequestContext,
  RequestSecurityMetadata,
} from "../auth/auth.types.js";
import { numberSequenceService } from "../number-sequences/number-sequence.service.js";

import {
  invoiceItemSelect,
  invoiceRepository,
  invoiceSelect,
  invoiceStatusHistorySelect,
  invoiceVersionSelect,
  type InvoiceRecord,
} from "./invoice.repository.js";
import type {
  CancelInvoiceInput,
  ListInvoicesQuery,
} from "./invoice.schemas.js";
import {
  buildInvoiceSignatureCanonicalContent,
  computeInvoiceContentHash,
} from "./invoice-signature-canonicalizer.js";
import {
  toInvoiceItemResponse,
  toInvoiceResponse,
  toInvoiceStatusHistoryResponse,
  toInvoiceVersionResponse,
} from "./invoice.types.js";

const BILLABLE_PROCEDURE_STATUS = "PERFORMED";

function serviceDateInCuracao(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Curacao",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (year === undefined || month === undefined || day === undefined) {
    throw new AppError(
      500,
      "INTERNAL_SERVER_ERROR",
      "Unable to resolve invoice date",
    );
  }

  return parseDateOnly(`${year}-${month}-${day}`, "invoiceDate");
}

function patientName(patient: {
  firstName: string;
  middleName: string | null;
  lastName: string;
  secondLastName: string | null;
}) {
  return [
    patient.firstName,
    patient.middleName,
    patient.lastName,
    patient.secondLastName,
  ]
    .filter((value): value is string => value !== null && value.trim() !== "")
    .join(" ");
}

function detailInvoiceNumber(invoiceNumber: string, lineNumber: number) {
  return `${invoiceNumber}-${lineNumber.toString().padStart(2, "0")}`;
}

function assertDecimalEquals(
  left: Prisma.Decimal,
  right: Prisma.Decimal,
  code: string,
  message: string,
) {
  if (!left.equals(right)) {
    throw new AppError(409, code, message);
  }
}

function requireProviderSnapshot(providerIdSnapshot: string | null) {
  if (providerIdSnapshot === null) {
    throw new AppError(
      409,
      "INVOICE_PROVIDER_SNAPSHOT_REQUIRED",
      "Provider SVB snapshot is required for invoice items",
    );
  }

  return providerIdSnapshot;
}

function isSerializableConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

function mapUniqueInvoiceError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw new AppError(
      409,
      "INVOICE_ALREADY_EXISTS",
      "Invoice already exists for this appointment",
    );
  }

  throw error;
}

async function serializableTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10_000,
        timeout: 10_000,
      });
    } catch (error) {
      if (!isSerializableConflict(error)) {
        throw error;
      }

      lastError = error;
    }
  }

  throw lastError;
}

function toAuditValues(invoice: InvoiceRecord) {
  return {
    appointmentId: invoice.appointmentId.toString(),
    patientId: invoice.patientId.toString(),
    patientInsuranceId: invoice.patientInsuranceId.toString(),
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    currentVersionId: invoice.currentVersionId?.toString() ?? null,
    versionNumber: invoice.currentVersion?.versionNumber ?? null,
    itemCount: invoice.currentVersion?.items.length ?? 0,
    totalAmount: invoice.currentVersion?.totalAmount.toFixed(2) ?? null,
  } satisfies Prisma.InputJsonObject;
}

function requireInvoiceNumber(invoiceNumber: string | null) {
  if (invoiceNumber === null || invoiceNumber.trim() === "") {
    throw new AppError(409, "INVOICE_NOT_PREPARABLE", "Invoice number is required");
  }

  return invoiceNumber;
}

function assertCurrentVersion(invoice: InvoiceRecord, versionId: bigint) {
  if (invoice.currentVersionId !== versionId || invoice.currentVersion === null) {
    throw new AppError(
      409,
      "INVOICE_VERSION_NOT_CURRENT",
      "Invoice version is not the current version",
    );
  }

  if (invoice.currentVersion.id !== versionId) {
    throw new AppError(
      409,
      "INVOICE_VERSION_NOT_CURRENT",
      "Invoice version is not the current version",
    );
  }

  return invoice.currentVersion;
}

function assertVersionBelongsToInvoice(invoice: InvoiceRecord, versionId: bigint) {
  const version = invoice.versions.find((entry) => entry.id === versionId);

  if (version === undefined && invoice.currentVersion?.id !== versionId) {
    throw new AppError(
      404,
      "INVOICE_VERSION_NOT_FOUND",
      "Invoice version not found",
    );
  }
}

function assertInvoiceVersionReadyForCanonicalization(
  invoice: InvoiceRecord,
  versionId: bigint,
) {
  const invoiceNumber = requireInvoiceNumber(invoice.invoiceNumber);
  const version = assertCurrentVersion(invoice, versionId);

  if (version.items.length === 0) {
    throw new AppError(
      409,
      "INVOICE_NOT_PREPARABLE",
      "Invoice version must contain at least one item",
    );
  }

  if (version.declarantIdSnapshot === null || version.declarantIdSnapshot.trim() === "") {
    throw new AppError(
      409,
      "INVOICE_DECLARANT_ID_REQUIRED",
      "Invoice declarant ID snapshot is required",
    );
  }

  if (version.insuredIdSnapshot.trim() === "") {
    throw new AppError(
      409,
      "INVOICE_INSURED_ID_REQUIRED",
      "Invoice insured ID snapshot is required",
    );
  }

  let totalAmount = new Prisma.Decimal("0.00");

  for (const item of version.items) {
    if (item.invoiceVersionId !== version.id) {
      throw new AppError(
        409,
        "INVOICE_NOT_PREPARABLE",
        "Invoice item does not belong to the requested version",
      );
    }

    if (item.providerIdSnapshot.trim() === "") {
      throw new AppError(
        409,
        "INVOICE_PROVIDER_SNAPSHOT_REQUIRED",
        "Provider SVB snapshot is required for invoice items",
      );
    }

    if (item.insuredIdSnapshot.trim() === "") {
      throw new AppError(
        409,
        "INVOICE_INSURED_ID_REQUIRED",
        "Invoice item insured ID snapshot is required",
      );
    }

    if (
      item.procedureCodeSnapshot.trim() === "" ||
      item.procedureDescriptionSnapshot.trim() === ""
    ) {
      throw new AppError(
        409,
        "INVOICE_NOT_PREPARABLE",
        "Procedure snapshots are required for invoice items",
      );
    }

    if (item.currencyCodeSnapshot !== version.currencyCode) {
      throw new AppError(
        409,
        "INVOICE_NOT_PREPARABLE",
        "Invoice item currency does not match the invoice version",
      );
    }

    if (item.quantity.lte(0) || item.amount.lt(0) || item.unitTariffSnapshot.lt(0)) {
      throw new AppError(
        409,
        "INVOICE_NOT_PREPARABLE",
        "Invoice item quantities and amounts must be valid",
      );
    }

    totalAmount = totalAmount.plus(item.amount);
  }

  assertDecimalEquals(
    totalAmount,
    version.totalAmount,
    "INVOICE_NOT_PREPARABLE",
    "Invoice total does not match item amounts",
  );

  return { invoiceNumber, version };
}

function canonicalInput(invoice: InvoiceRecord, versionId: bigint) {
  const { invoiceNumber, version } =
    assertInvoiceVersionReadyForCanonicalization(invoice, versionId);

  return {
    invoiceNumber,
    version,
  };
}

function rawCanonicalInput(invoice: InvoiceRecord, versionId: bigint) {
  return {
    invoiceNumber: requireInvoiceNumber(invoice.invoiceNumber),
    version: assertCurrentVersion(invoice, versionId),
  };
}

function assertSignatureReady(invoice: InvoiceRecord, versionId: bigint) {
  const version = assertCurrentVersion(invoice, versionId);

  if (
    invoice.status !== "PENDING_SIGNATURE" ||
    version.status !== "PENDING_SIGNATURE" ||
    version.contentHash === null ||
    version.lockedAt === null
  ) {
    throw new AppError(
      409,
      "INVOICE_VERSION_NOT_SIGNATURE_READY",
      "Invoice version is not ready for signature",
    );
  }

  return version;
}

function verifyStoredContentHash(invoice: InvoiceRecord, versionId: bigint) {
  const version = assertCurrentVersion(invoice, versionId);
  const computedHash = computeInvoiceContentHash(
    rawCanonicalInput(invoice, versionId),
  );

  if (version.contentHash !== computedHash) {
    throw new AppError(
      409,
      "INVOICE_CONTENT_INTEGRITY_MISMATCH",
      "Invoice signature content no longer matches its stored hash",
    );
  }

  return computedHash;
}

export class InvoiceService {
  async list(query: ListInvoicesQuery, actor: AuthenticatedRequestContext) {
    const skip = (query.page - 1) * query.pageSize;

    const where: Prisma.InvoiceWhereInput = {
      organizationId: actor.organizationId,

      ...(query.status !== undefined ? { status: query.status } : {}),

      ...(query.patientId !== undefined
        ? { patientId: BigInt(query.patientId) }
        : {}),

      ...(query.appointmentId !== undefined
        ? { appointmentId: BigInt(query.appointmentId) }
        : {}),

      ...(query.patientInsuranceId !== undefined
        ? { patientInsuranceId: BigInt(query.patientInsuranceId) }
        : {}),

      ...(query.from !== undefined || query.to !== undefined
        ? {
            createdAt: {
              ...(query.from !== undefined ? { gte: new Date(query.from) } : {}),
              ...(query.to !== undefined ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),

      ...(query.q !== undefined
        ? {
            OR: [
              { invoiceNumber: { contains: query.q } },
              { appointment: { appointmentNumber: { contains: query.q } } },
              { patient: { patientNumber: { contains: query.q } } },
              { patient: { firstName: { contains: query.q } } },
              { patient: { lastName: { contains: query.q } } },
              { patientInsurance: { insuredId: { contains: query.q } } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        select: invoiceSelect,
        orderBy: { createdAt: "desc" },
        skip,
        take: query.pageSize,
      }),
      prisma.invoice.count({ where }),
    ]);

    return {
      invoices: rows.map(toInvoiceResponse),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async getById(invoiceId: bigint, actor: AuthenticatedRequestContext) {
    const invoice = await invoiceRepository.findById(
      invoiceId,
      actor.organizationId,
    );

    if (!invoice) {
      throw new AppError(404, "INVOICE_NOT_FOUND", "Invoice not found");
    }

    return toInvoiceResponse(invoice);
  }

  async listVersions(invoiceId: bigint, actor: AuthenticatedRequestContext) {
    const invoice = await invoiceRepository.findById(
      invoiceId,
      actor.organizationId,
    );

    if (!invoice) {
      throw new AppError(404, "INVOICE_NOT_FOUND", "Invoice not found");
    }

    const versions = await prisma.invoiceVersion.findMany({
      where: { invoiceId },
      select: invoiceVersionSelect,
      orderBy: { versionNumber: "asc" },
    });

    return versions.map(toInvoiceVersionResponse);
  }

  async getVersion(
    invoiceId: bigint,
    versionId: bigint,
    actor: AuthenticatedRequestContext,
  ) {
    const invoice = await invoiceRepository.findById(
      invoiceId,
      actor.organizationId,
    );

    if (!invoice) {
      throw new AppError(404, "INVOICE_NOT_FOUND", "Invoice not found");
    }

    const version = await prisma.invoiceVersion.findFirst({
      where: { id: versionId, invoiceId },
      select: invoiceVersionSelect,
    });

    if (!version) {
      throw new AppError(
        404,
        "INVOICE_VERSION_NOT_FOUND",
        "Invoice version not found",
      );
    }

    return toInvoiceVersionResponse(version);
  }

  async listItems(
    invoiceId: bigint,
    versionId: bigint,
    actor: AuthenticatedRequestContext,
  ) {
    await this.getVersion(invoiceId, versionId, actor);

    const items = await prisma.invoiceItem.findMany({
      where: { invoiceVersionId: versionId },
      select: invoiceItemSelect,
      orderBy: { lineNumber: "asc" },
    });

    return items.map(toInvoiceItemResponse);
  }

  async listStatusHistory(
    invoiceId: bigint,
    actor: AuthenticatedRequestContext,
  ) {
    const invoice = await invoiceRepository.findById(
      invoiceId,
      actor.organizationId,
    );

    if (!invoice) {
      throw new AppError(404, "INVOICE_NOT_FOUND", "Invoice not found");
    }

    const rows = await prisma.invoiceStatusHistory.findMany({
      where: { invoiceId },
      select: invoiceStatusHistorySelect,
      orderBy: { changedAt: "asc" },
    });

    return rows.map(toInvoiceStatusHistoryResponse);
  }

  async getSignatureContent(
    invoiceId: bigint,
    versionId: bigint,
    actor: AuthenticatedRequestContext,
  ) {
    const invoice = await invoiceRepository.findById(
      invoiceId,
      actor.organizationId,
    );

    if (!invoice) {
      throw new AppError(404, "INVOICE_NOT_FOUND", "Invoice not found");
    }

    assertVersionBelongsToInvoice(invoice, versionId);
    const version = assertCurrentVersion(invoice, versionId);

    if (
      !["PENDING_SIGNATURE", "SIGNED", "CLOSED"].includes(version.status) ||
      version.contentHash === null ||
      version.lockedAt === null
    ) {
      throw new AppError(
        409,
        "INVOICE_VERSION_NOT_SIGNATURE_READY",
        "Invoice version is not ready for signature content",
      );
    }

    const rawInput = rawCanonicalInput(invoice, versionId);
    const content = buildInvoiceSignatureCanonicalContent(rawInput);
    const computedHash = computeInvoiceContentHash(rawInput);

    if (computedHash !== version.contentHash) {
      throw new AppError(
        409,
        "INVOICE_CONTENT_INTEGRITY_MISMATCH",
        "Invoice signature content no longer matches its stored hash",
      );
    }

    return {
      schema: content.schema,
      contentHash: version.contentHash,
      lockedAt: version.lockedAt.toISOString(),
      content,
    };
  }

  async prepareForSignature(
    invoiceId: bigint,
    versionId: bigint,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    const invoice = await serializableTransaction(async (tx) => {
      const current = await invoiceRepository.findById(
        invoiceId,
        actor.organizationId,
        tx,
      );

      if (!current) {
        throw new AppError(404, "INVOICE_NOT_FOUND", "Invoice not found");
      }

      assertVersionBelongsToInvoice(current, versionId);

      if (
        current.status === "PENDING_SIGNATURE" &&
        current.currentVersion?.id === versionId
      ) {
        throw new AppError(
          409,
          "INVOICE_ALREADY_PREPARED_FOR_SIGNATURE",
          "Invoice version is already prepared for signature",
        );
      }

      if (current.status !== "DRAFT") {
        throw new AppError(
          409,
          "INVOICE_NOT_PREPARABLE",
          "Invoice is not preparable for signature",
        );
      }

      const version = assertCurrentVersion(current, versionId);

      if (
        version.status !== "DRAFT" ||
        version.contentHash !== null ||
        version.lockedAt !== null
      ) {
        throw new AppError(
          409,
          "INVOICE_NOT_PREPARABLE",
          "Invoice version is not preparable for signature",
        );
      }

      const contentHash = computeInvoiceContentHash(
        canonicalInput(current, versionId),
      );
      const lockedAt = new Date();

      await tx.invoiceVersion.update({
        where: { id: version.id },
        data: {
          status: "PENDING_SIGNATURE",
          contentHash,
          lockedAt,
        },
      });

      await tx.invoice.update({
        where: { id: current.id },
        data: { status: "PENDING_SIGNATURE" },
      });

      await tx.invoiceStatusHistory.create({
        data: {
          invoiceId: current.id,
          invoiceVersionId: version.id,
          oldStatus: "DRAFT",
          newStatus: "PENDING_SIGNATURE",
          changedByUserId: actor.userId,
          metadata: { source: "invoice.prepare_signature" },
        },
      });

      const prepared = await invoiceRepository.findById(
        current.id,
        actor.organizationId,
        tx,
      );

      if (!prepared) {
        throw new AppError(
          500,
          "INTERNAL_SERVER_ERROR",
          "Invoice could not be read after signature preparation",
        );
      }

      await auditService.writeWithinTransaction(tx, {
        organizationId: actor.organizationId,
        actorUserId: actor.userId,
        action: "INVOICE_PREPARE_SIGNATURE",
        entityType: "INVOICE",
        entityId: prepared.id,
        entityKey: requireInvoiceNumber(prepared.invoiceNumber),
        oldValues: {
          status: "DRAFT",
          versionStatus: "DRAFT",
          contentHash: null,
        },
        newValues: {
          status: "PENDING_SIGNATURE",
          versionStatus: "PENDING_SIGNATURE",
          contentHash,
          lockedAt: lockedAt.toISOString(),
        },
        ...auditTechnicalFields(metadata),
      });

      return prepared;
    });

    return toInvoiceResponse(invoice);
  }

  async createFromAppointment(
    appointmentId: bigint,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    try {
      const invoice = await serializableTransaction(async (tx) => {
        const appointment = await tx.appointment.findFirst({
          where: {
            id: appointmentId,
            organizationId: actor.organizationId,
          },
          select: {
            id: true,
            organizationId: true,
            appointmentNumber: true,
            patientId: true,
            scheduledStartAt: true,
            status: true,
            patient: {
              select: {
                id: true,
                patientNumber: true,
                firstName: true,
                middleName: true,
                lastName: true,
                secondLastName: true,
                documentType: true,
                documentNumber: true,
              },
            },
            organization: {
              select: {
                declarantId: true,
              },
            },
            clinicalEncounter: {
              select: {
                id: true,
                appointmentId: true,
                status: true,
                procedures: {
                  where: {
                    status: BILLABLE_PROCEDURE_STATUS,
                  },
                  select: {
                    id: true,
                    encounterId: true,
                    patientInsuranceId: true,
                    svbProcedureId: true,
                    svbTariffId: true,
                    authorizationItemId: true,
                    diagnosisId: true,
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
                    performedAt: true,
                    additionalNote: true,
                    svbTariff: {
                      select: {
                        svbProcedureId: true,
                      },
                    },
                    diagnosis: {
                      select: {
                        encounterId: true,
                      },
                    },
                  },
                  orderBy: [{ performedAt: "asc" }, { id: "asc" }],
                },
              },
            },
          },
        });

        if (!appointment) {
          throw new AppError(
            404,
            "APPOINTMENT_NOT_FOUND",
            "Appointment not found",
          );
        }

        if (appointment.status !== "COMPLETED") {
          throw new AppError(
            409,
            "APPOINTMENT_NOT_BILLABLE",
            "Appointment is not billable",
          );
        }

        if (appointment.clinicalEncounter === null) {
          throw new AppError(
            409,
            "CLINICAL_ENCOUNTER_REQUIRED",
            "Clinical encounter is required before billing",
          );
        }

        if (appointment.clinicalEncounter.appointmentId !== appointment.id) {
          throw new AppError(
            409,
            "INVOICE_ITEM_WRONG_APPOINTMENT",
            "Clinical encounter does not belong to this appointment",
          );
        }

        if (appointment.clinicalEncounter.status === "OPEN") {
          throw new AppError(
            409,
            "CLINICAL_ENCOUNTER_NOT_COMPLETED",
            "Clinical encounter is not completed",
          );
        }

        if (appointment.clinicalEncounter.status !== "COMPLETED") {
          throw new AppError(
            409,
            "CLINICAL_ENCOUNTER_NOT_BILLABLE",
            "Clinical encounter is not billable",
          );
        }

        const existingInvoice = await tx.invoice.findUnique({
          where: {
            appointmentId,
          },
          select: {
            id: true,
          },
        });

        if (existingInvoice) {
          throw new AppError(
            409,
            "INVOICE_ALREADY_EXISTS",
            "Invoice already exists for this appointment",
          );
        }

        const procedures = appointment.clinicalEncounter.procedures;

        if (procedures.length === 0) {
          throw new AppError(
            409,
            "INVOICE_NO_BILLABLE_PROCEDURES",
            "No billable procedures were found",
          );
        }

        const insuranceIds = new Set(
          procedures.map((procedure) => procedure.patientInsuranceId.toString()),
        );

        if (insuranceIds.size !== 1) {
          throw new AppError(
            409,
            "INVOICE_MULTIPLE_INSURANCES",
            "Billable procedures reference multiple insurance coverages",
          );
        }

        const patientInsuranceId = procedures[0]?.patientInsuranceId;

        if (patientInsuranceId === undefined) {
          throw new AppError(
            409,
            "INVOICE_NO_BILLABLE_PROCEDURES",
            "No billable procedures were found",
          );
        }

        const insurance = await tx.patientInsurance.findFirst({
          where: {
            id: patientInsuranceId,
            patientId: appointment.patientId,
            patient: {
              organizationId: actor.organizationId,
            },
          },
          select: {
            id: true,
            insuredId: true,
          },
        });

        if (insurance === null) {
          throw new AppError(
            409,
            "INVOICE_INSURANCE_PATIENT_MISMATCH",
            "Invoice insurance does not belong to the appointment patient",
          );
        }

        const currencyCodes = new Set(
          procedures.map((procedure) => procedure.currencyCodeSnapshot),
        );

        if (currencyCodes.size !== 1) {
          throw new AppError(
            409,
            "INVOICE_MIXED_CURRENCIES",
            "Billable procedures reference multiple currencies",
          );
        }

        const currencyCode = procedures[0]?.currencyCodeSnapshot;

        if (currencyCode === undefined) {
          throw new AppError(
            409,
            "INVOICE_MIXED_CURRENCIES",
            "Unable to determine invoice currency",
          );
        }

        const insuredIds = new Set(
          procedures.map((procedure) => procedure.insuredIdSnapshot),
        );

        if (insuredIds.size !== 1 || !insuredIds.has(insurance.insuredId)) {
          throw new AppError(
            409,
            "INVOICE_INSURANCE_PATIENT_MISMATCH",
            "Procedure insurance snapshots do not match invoice insurance",
          );
        }

        const allocatedNumber =
          await numberSequenceService.allocateWithinTransaction(tx, {
            organizationId: actor.organizationId,
            sequenceType: "INVOICE",
          });

        let totalAmount = new Prisma.Decimal("0.00");

        for (const procedure of procedures) {
          if (procedure.svbTariff.svbProcedureId !== procedure.svbProcedureId) {
            throw new AppError(
              409,
              "INVOICE_ITEM_TARIFF_PROCEDURE_MISMATCH",
              "Procedure tariff does not belong to the procedure",
            );
          }

          requireProviderSnapshot(procedure.providerIdSnapshot);

          if (
            procedure.diagnosisId !== null &&
            procedure.diagnosis?.encounterId !== appointment.clinicalEncounter.id
          ) {
            throw new AppError(
              409,
              "INVOICE_ITEM_WRONG_APPOINTMENT",
              "Procedure diagnosis does not belong to the appointment encounter",
            );
          }

          assertDecimalEquals(
            procedure.unitTariffSnapshot.mul(procedure.quantity),
            procedure.amount,
            "INVOICE_ITEM_AMOUNT_MISMATCH",
            "Encounter procedure amount does not match unit tariff and quantity",
          );

          totalAmount = totalAmount.plus(procedure.amount);
        }

        if (totalAmount.lt(0)) {
          throw new AppError(
            409,
            "INVOICE_ITEM_AMOUNT_MISMATCH",
            "Invoice total cannot be negative",
          );
        }

        const invoice = await tx.invoice.create({
          data: {
            organizationId: actor.organizationId,
            appointmentId: appointment.id,
            patientId: appointment.patientId,
            patientInsuranceId,
            invoiceNumber: allocatedNumber.formatted,
            status: "DRAFT",
            createdByUserId: actor.userId,
          },
          select: {
            id: true,
          },
        });

        const version = await tx.invoiceVersion.create({
          data: {
            invoiceId: invoice.id,
            versionNumber: 1,
            versionType: "ORIGINAL",
            supersedesVersionId: null,
            status: "DRAFT",
            invoiceDate: serviceDateInCuracao(appointment.scheduledStartAt),
            currencyCode,
            totalAmount,
            declarantIdSnapshot: appointment.organization.declarantId,
            patientNameSnapshot: patientName(appointment.patient),
            patientDocumentTypeSnapshot: appointment.patient.documentType,
            patientDocumentNumberSnapshot: appointment.patient.documentNumber,
            insuredIdSnapshot: insurance.insuredId,
            contentHash: null,
            preparedByUserId: actor.userId,
            lockedAt: null,
            signedAt: null,
            closedAt: null,
            supersededAt: null,
          },
          select: {
            id: true,
            invoiceId: true,
          },
        });

        if (version.invoiceId !== invoice.id) {
          throw new AppError(
            500,
            "INTERNAL_SERVER_ERROR",
            "Invoice current version invariant failed",
          );
        }

        let lineNumber = 1;

        for (const procedure of procedures) {
          await tx.invoiceItem.create({
            data: {
              invoiceVersionId: version.id,
              lineNumber,
              detailInvoiceNumber: detailInvoiceNumber(
                allocatedNumber.formatted,
                lineNumber,
              ),
              encounterProcedureId: procedure.id,
              sourceInvoiceItemId: null,
              svbProcedureId: procedure.svbProcedureId,
              svbTariffId: procedure.svbTariffId,
              serviceDateSnapshot: serviceDateInCuracao(
                appointment.scheduledStartAt,
              ),
              procedureCodeSnapshot: procedure.procedureCodeSnapshot,
              procedureDescriptionSnapshot:
                procedure.procedureDescriptionSnapshot,
              providerIdSnapshot: requireProviderSnapshot(
                procedure.providerIdSnapshot,
              ),
              insuredIdSnapshot: procedure.insuredIdSnapshot,
              unitTariffSnapshot: procedure.unitTariffSnapshot,
              currencyCodeSnapshot: procedure.currencyCodeSnapshot,
              quantity: procedure.quantity,
              amount: procedure.amount,
              authorizationIdSnapshot: procedure.authorizationIdSnapshot,
              diagnosticCodeSnapshot: procedure.diagnosticCodeSnapshot,
              treatmentIdSnapshot: procedure.treatmentIdSnapshot,
              accidentFormNumberSnapshot:
                procedure.accidentFormNumberSnapshot,
              numberOfTreatmentsSnapshot:
                procedure.numberOfTreatmentsSnapshot,
              assistanceSnapshot: procedure.assistanceSnapshot,
              referrerIdSnapshot: procedure.referrerIdSnapshot,
              policlinicSnapshot: procedure.policlinicSnapshot,
              additionalNote: procedure.additionalNote,
            },
          });

          lineNumber += 1;
        }

        await tx.invoice.update({
          where: {
            id: invoice.id,
          },
          data: {
            currentVersionId: version.id,
          },
        });

        await tx.invoiceStatusHistory.create({
          data: {
            invoiceId: invoice.id,
            invoiceVersionId: version.id,
            oldStatus: null,
            newStatus: "DRAFT",
            changedByUserId: actor.userId,
            metadata: {
              source: "invoice.create",
            },
          },
        });

        const created = await invoiceRepository.findById(
          invoice.id,
          actor.organizationId,
          tx,
        );

        if (!created) {
          throw new AppError(
            500,
            "INTERNAL_SERVER_ERROR",
            "Invoice could not be read after creation",
          );
        }

        await auditService.writeWithinTransaction(tx, {
          organizationId: actor.organizationId,
          actorUserId: actor.userId,
          action: "INVOICE_CREATE",
          entityType: "INVOICE",
          entityId: created.id,
          entityKey: created.invoiceNumber ?? created.id.toString(),
          newValues: toAuditValues(created),
          ...auditTechnicalFields(metadata),
        });

        return created;
      });

      return toInvoiceResponse(invoice);
    } catch (error) {
      mapUniqueInvoiceError(error);
    }
  }

  async cancel(
    invoiceId: bigint,
    input: CancelInvoiceInput,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    const invoice = await prisma.$transaction(async (tx) => {
      const current = await invoiceRepository.findById(
        invoiceId,
        actor.organizationId,
        tx,
      );

      if (!current) {
        throw new AppError(404, "INVOICE_NOT_FOUND", "Invoice not found");
      }

      if (current.status !== "DRAFT" || current.currentVersion === null) {
        throw new AppError(
          409,
          "INVOICE_NOT_CANCELLABLE",
          "Invoice is not cancellable",
        );
      }

      if (current.currentVersion.status !== "DRAFT") {
        throw new AppError(
          409,
          "INVOICE_NOT_CANCELLABLE",
          "Invoice is not cancellable",
        );
      }

      await tx.invoiceVersion.update({
        where: {
          id: current.currentVersion.id,
        },
        data: {
          status: "VOID",
        },
      });

      await tx.invoice.update({
        where: {
          id: current.id,
        },
        data: {
          status: "CANCELLED",
          cancelledByUserId: actor.userId,
          cancelledAt: new Date(),
          cancellationReason: input.reason,
        },
      });

      await tx.invoiceStatusHistory.create({
        data: {
          invoiceId: current.id,
          invoiceVersionId: current.currentVersion.id,
          oldStatus: "DRAFT",
          newStatus: "CANCELLED",
          reason: input.reason,
          changedByUserId: actor.userId,
          metadata: {
            source: "invoice.cancel",
          },
        },
      });

      const cancelled = await invoiceRepository.findById(
        current.id,
        actor.organizationId,
        tx,
      );

      if (!cancelled) {
        throw new AppError(
          500,
          "INTERNAL_SERVER_ERROR",
          "Invoice could not be read after cancellation",
        );
      }

      await auditService.writeWithinTransaction(tx, {
        organizationId: actor.organizationId,
        actorUserId: actor.userId,
        action: "INVOICE_CANCEL",
        entityType: "INVOICE",
        entityId: cancelled.id,
        entityKey: cancelled.invoiceNumber ?? cancelled.id.toString(),
        oldValues: toAuditValues(current),
        newValues: toAuditValues(cancelled),
        reason: input.reason,
        ...auditTechnicalFields(metadata),
      });

      return cancelled;
    });

    return toInvoiceResponse(invoice);
  }

  async confirmSigned(
    invoiceId: bigint,
    versionId: bigint,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    const invoice = await serializableTransaction(async (tx) => {
      const current = await invoiceRepository.findById(
        invoiceId,
        actor.organizationId,
        tx,
      );

      if (!current) {
        throw new AppError(404, "INVOICE_NOT_FOUND", "Invoice not found");
      }

      assertVersionBelongsToInvoice(current, versionId);

      if (current.status === "SIGNED" && current.currentVersion?.id === versionId) {
        throw new AppError(
          409,
          "INVOICE_ALREADY_SIGNED",
          "Invoice version is already signed",
        );
      }

      const version = assertSignatureReady(current, versionId);
      verifyStoredContentHash(current, versionId);

      const signatures = await tx.signature.findMany({
        where: {
          invoiceVersionId: version.id,
          status: "VALID",
        },
        select: {
          id: true,
          patientId: true,
          signatureDocumentId: true,
          signedContentHash: true,
          signatureHash: true,
          signatureDocument: {
            select: {
              id: true,
              organizationId: true,
              documentType: true,
              sha256: true,
              sizeBytes: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      if (signatures.length === 0) {
        throw new AppError(
          409,
          "VALID_SIGNATURE_REQUIRED",
          "At least one valid signature is required",
        );
      }

      let hashMismatch = false;
      const validSignature = signatures.find((signature) => {
        const document = signature.signatureDocument;
        const matches =
          signature.patientId === current.patientId &&
          signature.signedContentHash === version.contentHash &&
          document.organizationId === current.organizationId &&
          document.documentType === "SIGNATURE" &&
          document.sizeBytes > 0n &&
          signature.signatureHash === document.sha256;

        if (!matches) {
          hashMismatch =
            hashMismatch ||
            signature.signedContentHash !== version.contentHash ||
            signature.signatureHash !== document.sha256;
        }

        return matches;
      });

      if (validSignature === undefined) {
        throw new AppError(
          409,
          hashMismatch
            ? "SIGNATURE_CONTENT_HASH_MISMATCH"
            : "VALID_SIGNATURE_REQUIRED",
          hashMismatch
            ? "Signature hash does not match invoice content or document"
            : "At least one valid signature is required",
        );
      }

      const signedAt = new Date();

      await tx.invoiceVersion.update({
        where: { id: version.id },
        data: {
          status: "SIGNED",
          signedAt,
        },
      });

      await tx.invoice.update({
        where: { id: current.id },
        data: {
          status: "SIGNED",
        },
      });

      await tx.invoiceStatusHistory.create({
        data: {
          invoiceId: current.id,
          invoiceVersionId: version.id,
          oldStatus: "PENDING_SIGNATURE",
          newStatus: "SIGNED",
          changedByUserId: actor.userId,
          metadata: { source: "invoice.sign" },
        },
      });

      const signed = await invoiceRepository.findById(
        current.id,
        actor.organizationId,
        tx,
      );

      if (!signed) {
        throw new AppError(
          500,
          "INTERNAL_SERVER_ERROR",
          "Invoice could not be read after signing",
        );
      }

      await auditService.writeWithinTransaction(tx, {
        organizationId: actor.organizationId,
        actorUserId: actor.userId,
        action: "INVOICE_SIGN",
        entityType: "INVOICE",
        entityId: signed.id,
        entityKey: requireInvoiceNumber(signed.invoiceNumber),
        oldValues: {
          invoiceStatus: "PENDING_SIGNATURE",
          versionStatus: "PENDING_SIGNATURE",
        },
        newValues: {
          invoiceStatus: "SIGNED",
          versionStatus: "SIGNED",
          signedAt: signedAt.toISOString(),
          contentHash: version.contentHash,
          validSignatureId: validSignature.id.toString(),
        },
        ...auditTechnicalFields(metadata),
      });

      return signed;
    });

    return toInvoiceResponse(invoice);
  }
}

export const invoiceService = new InvoiceService();
