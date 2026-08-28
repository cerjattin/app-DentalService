import { Prisma } from "../../generated/prisma/client.js";

import { prisma } from "../../infrastructure/database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { parseDateOnly } from "../../shared/utils/date-only.js";

import { auditService, auditTechnicalFields } from "../audit/audit.service.js";
import type {
  AuthenticatedRequestContext,
  RequestSecurityMetadata,
} from "../auth/auth.types.js";
import { invoiceDocumentSelect } from "../documents/document.repository.js";
import {
  documentStorage,
  sha256Hex,
  storageUriFromKey,
} from "../documents/document.storage.js";
import { toInvoiceDocumentResponse } from "../documents/document.types.js";
import { generateInvoicePdfBytes } from "../documents/invoice-pdf.generator.js";
import { numberSequenceService } from "../number-sequences/number-sequence.service.js";

import {
  invoiceItemSelect,
  invoiceCorrectionSelect,
  invoiceRepository,
  invoiceSelect,
  invoiceStatusHistorySelect,
  invoiceVersionSelect,
  type InvoiceRecord,
} from "./invoice.repository.js";
import type {
  CancelInvoiceInput,
  ListInvoicesQuery,
  RequestInvoiceCorrectionInput,
  ResolveInvoiceCorrectionInput,
  UpdateCorrectionInvoiceItemInput,
} from "./invoice.schemas.js";
import {
  buildInvoiceSignatureCanonicalContent,
  computeInvoiceContentHash,
} from "./invoice-signature-canonicalizer.js";
import {
  toInvoiceItemResponse,
  toInvoiceCorrectionResponse,
  toInvoiceResponse,
  toInvoiceStatusHistoryResponse,
  toInvoiceVersionResponse,
} from "./invoice.types.js";

const BILLABLE_PROCEDURE_STATUS = "PERFORMED";
const SHA_256_HEX = /^[a-f0-9]{64}$/;
const ACTIVE_CORRECTION_STATUSES = ["REQUESTED", "APPROVED"] as const;

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

function toCorrectionAuditValues(correction: {
  id: bigint;
  invoiceId: bigint;
  sourceVersionId: bigint;
  replacementVersionId: bigint | null;
  reasonCode: string;
  reasonText: string;
  status: string;
  requestedByUserId: bigint;
  approvedByUserId: bigint | null;
  resolvedByUserId: bigint | null;
}) {
  return {
    id: correction.id.toString(),
    invoiceId: correction.invoiceId.toString(),
    sourceVersionId: correction.sourceVersionId.toString(),
    replacementVersionId: correction.replacementVersionId?.toString() ?? null,
    reasonCode: correction.reasonCode,
    reasonText: correction.reasonText,
    status: correction.status,
    requestedByUserId: correction.requestedByUserId.toString(),
    approvedByUserId: correction.approvedByUserId?.toString() ?? null,
    resolvedByUserId: correction.resolvedByUserId?.toString() ?? null,
  } satisfies Prisma.InputJsonObject;
}

function ensureInvoiceNumber(invoice: InvoiceRecord) {
  return invoice.invoiceNumber ?? invoice.id.toString();
}

function mapCorrectionUniqueError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw new AppError(
      409,
      "INVOICE_CORRECTION_REPLACEMENT_ALREADY_EXISTS",
      "Invoice correction replacement already exists",
    );
  }

  throw error;
}

function requireInvoiceNumber(invoiceNumber: string | null) {
  if (invoiceNumber === null || invoiceNumber.trim() === "") {
    throw new AppError(409, "INVOICE_NOT_PREPARABLE", "Invoice number is required");
  }

  return invoiceNumber;
}

function requireInvoiceNumberForClose(invoiceNumber: string | null) {
  if (invoiceNumber === null || invoiceNumber.trim() === "") {
    throw new AppError(
      409,
      "INVOICE_SNAPSHOT_INCOMPLETE",
      "Invoice number snapshot is required",
    );
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

function assertClosedSourceForCorrection(invoice: InvoiceRecord) {
  const sourceVersion = invoice.currentVersion;

  if (
    invoice.status !== "CLOSED" ||
    sourceVersion === null ||
    sourceVersion.status !== "CLOSED"
  ) {
    throw new AppError(
      409,
      "INVOICE_CORRECTION_NOT_REQUESTABLE",
      "Only closed invoices can be corrected",
    );
  }

  return sourceVersion;
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

function assertInvoiceVersionReadyForClose(
  invoice: InvoiceRecord,
  versionId: bigint,
) {
  const invoiceNumber = requireInvoiceNumberForClose(invoice.invoiceNumber);
  const version = assertCurrentVersion(invoice, versionId);

  if (invoice.status === "CLOSED" || version.status === "CLOSED") {
    throw new AppError(
      409,
      "INVOICE_ALREADY_CLOSED",
      "Invoice version is already closed",
    );
  }

  if (invoice.status !== "SIGNED" || version.status !== "SIGNED") {
    throw new AppError(
      409,
      "INVOICE_NOT_CLOSABLE",
      "Invoice must be signed before closing",
    );
  }

  if (version.signedAt === null) {
    throw new AppError(
      409,
      "INVOICE_SIGNATURE_STATE_INVALID",
      "Signed invoice version is missing signedAt",
    );
  }

  if (
    version.lockedAt === null ||
    version.contentHash === null ||
    !SHA_256_HEX.test(version.contentHash)
  ) {
    throw new AppError(
      409,
      "INVOICE_CONTENT_NOT_LOCKED",
      "Invoice content must be locked before closing",
    );
  }

  if (version.declarantIdSnapshot === null || version.declarantIdSnapshot.trim() === "") {
    throw new AppError(
      409,
      "INVOICE_DECLARANT_ID_REQUIRED",
      "Invoice declarant ID snapshot is required",
    );
  }

  if (version.patientNameSnapshot.trim() === "" || version.currencyCode.trim() === "") {
    throw new AppError(
      409,
      "INVOICE_SNAPSHOT_INCOMPLETE",
      "Invoice header snapshots are incomplete",
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
        "INVOICE_SNAPSHOT_INCOMPLETE",
        "Invoice item does not belong to the requested version",
      );
    }

    if (
      item.detailInvoiceNumber === null ||
      item.detailInvoiceNumber.trim() === "" ||
      item.serviceDateSnapshot === null ||
      item.procedureCodeSnapshot.trim() === "" ||
      item.currencyCodeSnapshot.trim() === ""
    ) {
      throw new AppError(
        409,
        "INVOICE_SNAPSHOT_INCOMPLETE",
        "Invoice item snapshots are incomplete",
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

    if (item.currencyCodeSnapshot !== version.currencyCode) {
      throw new AppError(
        409,
        "INVOICE_CURRENCY_MISMATCH",
        "Invoice item currency does not match the invoice version",
      );
    }

    assertDecimalEquals(
      item.unitTariffSnapshot.mul(item.quantity),
      item.amount,
      "INVOICE_ITEM_AMOUNT_MISMATCH",
      "Invoice item amount does not match unit tariff and quantity",
    );

    totalAmount = totalAmount.plus(item.amount);
  }

  assertDecimalEquals(
    totalAmount,
    version.totalAmount,
    "INVOICE_TOTAL_MISMATCH",
    "Invoice total does not match item amounts",
  );

  const computedHash = computeInvoiceContentHash(
    rawCanonicalInput(invoice, versionId),
  );

  if (computedHash !== version.contentHash) {
    throw new AppError(
      409,
      "INVOICE_CONTENT_INTEGRITY_MISMATCH",
      "Invoice signature content no longer matches its stored hash",
    );
  }

  return {
    invoiceNumber,
    version,
    contentHash: version.contentHash,
  };
}

async function requireValidSignatureForClose(
  tx: Prisma.TransactionClient,
  invoice: InvoiceRecord,
  versionId: bigint,
  contentHash: string,
) {
  const signatures = await tx.signature.findMany({
    where: {
      invoiceVersionId: versionId,
      status: "VALID",
    },
    select: {
      id: true,
      patientId: true,
      signatureType: true,
      signerName: true,
      signerRelationship: true,
      captureMethod: true,
      signedAt: true,
      signedContentHash: true,
      signatureHash: true,
      signatureDocument: {
        select: {
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

  let contentHashMismatch = false;
  let evidenceInvalid = false;

  for (const signature of signatures) {
    const document = signature.signatureDocument;

    if (signature.patientId !== invoice.patientId) {
      evidenceInvalid = true;
      continue;
    }

    if (signature.signedContentHash !== contentHash) {
      contentHashMismatch = true;
      continue;
    }

    if (
      document.organizationId !== invoice.organizationId ||
      document.documentType !== "SIGNATURE" ||
      document.sizeBytes <= 0n ||
      !SHA_256_HEX.test(document.sha256) ||
      signature.signatureHash !== document.sha256
    ) {
      evidenceInvalid = true;
      continue;
    }

    return signature;
  }

  if (contentHashMismatch) {
    throw new AppError(
      409,
      "SIGNATURE_CONTENT_HASH_MISMATCH",
      "Signature hash does not match invoice content",
    );
  }

  if (evidenceInvalid) {
    throw new AppError(
      409,
      "SIGNATURE_EVIDENCE_INVALID",
      "Signature evidence is invalid",
    );
  }

  throw new AppError(
    409,
    "VALID_SIGNATURE_REQUIRED",
    "At least one valid signature is required",
  );
}

function assertInvoiceVersionReadyForPdf(
  invoice: InvoiceRecord,
  versionId: bigint,
) {
  const invoiceNumber = requireInvoiceNumberForClose(invoice.invoiceNumber);
  const version = assertCurrentVersion(invoice, versionId);

  if (invoice.status !== "CLOSED" || version.status !== "CLOSED") {
    throw new AppError(
      409,
      "INVOICE_PDF_NOT_GENERATABLE",
      "Invoice PDF can only be generated for a closed invoice version",
    );
  }

  if (
    version.closedAt === null ||
    version.lockedAt === null ||
    version.signedAt === null ||
    version.contentHash === null ||
    !SHA_256_HEX.test(version.contentHash)
  ) {
    throw new AppError(
      409,
      "INVOICE_CONTENT_NOT_LOCKED",
      "Invoice version is missing closed signature content metadata",
    );
  }

  const computedHash = computeInvoiceContentHash(
    rawCanonicalInput(invoice, versionId),
  );

  if (computedHash !== version.contentHash) {
    throw new AppError(
      409,
      "INVOICE_CONTENT_INTEGRITY_MISMATCH",
      "Invoice signature content no longer matches its stored hash",
    );
  }

  return {
    invoiceNumber,
    version,
    contentHash: version.contentHash,
  };
}

function invoicePdfStorageKey(input: {
  organizationId: bigint;
  invoiceId: bigint;
  versionId: bigint;
  contentHash: string;
}) {
  return [
    input.organizationId.toString(),
    "invoices",
    input.invoiceId.toString(),
    "versions",
    input.versionId.toString(),
    `${input.contentHash}.pdf`,
  ].join("/");
}

async function findExistingInvoicePdf(
  versionId: bigint,
  storageUri: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  return tx.invoiceDocument.findFirst({
    where: {
      invoiceVersionId: versionId,
      documentRole: "SIGNED_INVOICE_PDF",
      document: {
        documentType: "SIGNED_INVOICE_PDF",
        storageUri,
      },
    },
    select: invoiceDocumentSelect,
  });
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

  async listCorrections(invoiceId: bigint, actor: AuthenticatedRequestContext) {
    const invoice = await invoiceRepository.findById(
      invoiceId,
      actor.organizationId,
    );

    if (!invoice) {
      throw new AppError(404, "INVOICE_NOT_FOUND", "Invoice not found");
    }

    const rows = await prisma.invoiceCorrection.findMany({
      where: { invoiceId },
      select: invoiceCorrectionSelect,
      orderBy: { createdAt: "asc" },
    });

    return rows.map(toInvoiceCorrectionResponse);
  }

  async getCorrection(
    invoiceId: bigint,
    correctionId: bigint,
    actor: AuthenticatedRequestContext,
  ) {
    const correction = await prisma.invoiceCorrection.findFirst({
      where: {
        id: correctionId,
        invoiceId,
        invoice: { organizationId: actor.organizationId },
      },
      select: invoiceCorrectionSelect,
    });

    if (!correction) {
      throw new AppError(
        404,
        "INVOICE_CORRECTION_NOT_FOUND",
        "Invoice correction not found",
      );
    }

    return toInvoiceCorrectionResponse(correction);
  }

  async requestCorrection(
    invoiceId: bigint,
    input: RequestInvoiceCorrectionInput,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    const correction = await serializableTransaction(async (tx) => {
      const current = await invoiceRepository.findById(
        invoiceId,
        actor.organizationId,
        tx,
      );

      if (!current) {
        throw new AppError(404, "INVOICE_NOT_FOUND", "Invoice not found");
      }

      const activeCorrection = await tx.invoiceCorrection.findFirst({
        where: {
          invoiceId: current.id,
          status: { in: [...ACTIVE_CORRECTION_STATUSES] },
        },
        select: { id: true },
      });

      if (activeCorrection) {
        throw new AppError(
          409,
          "INVOICE_CORRECTION_ALREADY_ACTIVE",
          "Invoice already has an active correction",
        );
      }

      const sourceVersion = assertClosedSourceForCorrection(current);

      const created = await tx.invoiceCorrection.create({
        data: {
          invoiceId: current.id,
          sourceVersionId: sourceVersion.id,
          reasonCode: input.reasonCode,
          reasonText: input.reasonText,
          requestedByUserId: actor.userId,
          ...(input.metadata !== undefined
            ? { metadata: input.metadata as Prisma.InputJsonObject }
            : {}),
        },
        select: invoiceCorrectionSelect,
      });

      await tx.invoice.update({
        where: { id: current.id },
        data: { status: "CORRECTION_REQUIRED" },
      });

      await tx.invoiceStatusHistory.create({
        data: {
          invoiceId: current.id,
          invoiceVersionId: sourceVersion.id,
          oldStatus: "CLOSED",
          newStatus: "CORRECTION_REQUIRED",
          changedByUserId: actor.userId,
          metadata: { source: "invoice.correction.request" },
        },
      });

      await auditService.writeWithinTransaction(tx, {
        organizationId: actor.organizationId,
        actorUserId: actor.userId,
        action: "INVOICE_CORRECTION_REQUEST",
        entityType: "INVOICE_CORRECTION",
        entityId: created.id,
        entityKey: ensureInvoiceNumber(current),
        newValues: toCorrectionAuditValues(created),
        ...auditTechnicalFields(metadata),
      });

      return created;
    });

    return toInvoiceCorrectionResponse(correction);
  }

  async approveCorrection(
    invoiceId: bigint,
    correctionId: bigint,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    const correction = await serializableTransaction(async (tx) => {
      const current = await invoiceRepository.findById(
        invoiceId,
        actor.organizationId,
        tx,
      );

      if (!current) {
        throw new AppError(404, "INVOICE_NOT_FOUND", "Invoice not found");
      }

      const existing = await tx.invoiceCorrection.findFirst({
        where: { id: correctionId, invoiceId: current.id },
        select: invoiceCorrectionSelect,
      });

      if (!existing) {
        throw new AppError(
          404,
          "INVOICE_CORRECTION_NOT_FOUND",
          "Invoice correction not found",
        );
      }

      if (existing.status !== "REQUESTED") {
        throw new AppError(
          409,
          "INVOICE_CORRECTION_NOT_APPROVABLE",
          "Only requested corrections can be approved",
        );
      }

      const updated = await tx.invoiceCorrection.update({
        where: { id: existing.id },
        data: {
          status: "APPROVED",
          approvedByUserId: actor.userId,
          approvedAt: new Date(),
        },
        select: invoiceCorrectionSelect,
      });

      await auditService.writeWithinTransaction(tx, {
        organizationId: actor.organizationId,
        actorUserId: actor.userId,
        action: "INVOICE_CORRECTION_APPROVE",
        entityType: "INVOICE_CORRECTION",
        entityId: updated.id,
        entityKey: ensureInvoiceNumber(current),
        oldValues: toCorrectionAuditValues(existing),
        newValues: toCorrectionAuditValues(updated),
        ...auditTechnicalFields(metadata),
      });

      return updated;
    });

    return toInvoiceCorrectionResponse(correction);
  }

  async rejectCorrection(
    invoiceId: bigint,
    correctionId: bigint,
    input: ResolveInvoiceCorrectionInput,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    return this.resolveRequestedCorrection(
      invoiceId,
      correctionId,
      "REJECTED",
      "INVOICE_CORRECTION_REJECT",
      input,
      actor,
      metadata,
    );
  }

  async cancelCorrection(
    invoiceId: bigint,
    correctionId: bigint,
    input: ResolveInvoiceCorrectionInput,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    return this.resolveRequestedCorrection(
      invoiceId,
      correctionId,
      "CANCELLED",
      "INVOICE_CORRECTION_CANCEL",
      input,
      actor,
      metadata,
    );
  }

  private async resolveRequestedCorrection(
    invoiceId: bigint,
    correctionId: bigint,
    status: "REJECTED" | "CANCELLED",
    action: "INVOICE_CORRECTION_REJECT" | "INVOICE_CORRECTION_CANCEL",
    input: ResolveInvoiceCorrectionInput,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    const correction = await serializableTransaction(async (tx) => {
      const current = await invoiceRepository.findById(
        invoiceId,
        actor.organizationId,
        tx,
      );

      if (!current) {
        throw new AppError(404, "INVOICE_NOT_FOUND", "Invoice not found");
      }

      const existing = await tx.invoiceCorrection.findFirst({
        where: { id: correctionId, invoiceId: current.id },
        select: invoiceCorrectionSelect,
      });

      if (!existing) {
        throw new AppError(
          404,
          "INVOICE_CORRECTION_NOT_FOUND",
          "Invoice correction not found",
        );
      }

      if (existing.status !== "REQUESTED") {
        throw new AppError(
          409,
          "INVOICE_CORRECTION_NOT_RESOLVABLE",
          "Only requested corrections can be resolved this way",
        );
      }

      const updated = await tx.invoiceCorrection.update({
        where: { id: existing.id },
        data: {
          status,
          resolvedByUserId: actor.userId,
          resolvedAt: new Date(),
        },
        select: invoiceCorrectionSelect,
      });

      const remainingActive = await tx.invoiceCorrection.count({
        where: {
          invoiceId: current.id,
          id: { not: existing.id },
          status: { in: [...ACTIVE_CORRECTION_STATUSES] },
        },
      });

      if (remainingActive === 0 && current.status === "CORRECTION_REQUIRED") {
        await tx.invoice.update({
          where: { id: current.id },
          data: { status: "CLOSED" },
        });

        await tx.invoiceStatusHistory.create({
          data: {
            invoiceId: current.id,
            invoiceVersionId: existing.sourceVersionId,
            oldStatus: "CORRECTION_REQUIRED",
            newStatus: "CLOSED",
            ...(input.reason !== undefined ? { reason: input.reason } : {}),
            changedByUserId: actor.userId,
            metadata: { source: "invoice.correction.resolve" },
          },
        });
      }

      await auditService.writeWithinTransaction(tx, {
        organizationId: actor.organizationId,
        actorUserId: actor.userId,
        action,
        entityType: "INVOICE_CORRECTION",
        entityId: updated.id,
        entityKey: ensureInvoiceNumber(current),
        oldValues: toCorrectionAuditValues(existing),
        newValues: toCorrectionAuditValues(updated),
        ...auditTechnicalFields(metadata),
      });

      return updated;
    });

    return toInvoiceCorrectionResponse(correction);
  }

  async createCorrectionReplacement(
    invoiceId: bigint,
    correctionId: bigint,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    try {
      const correction = await serializableTransaction(async (tx) => {
        const current = await invoiceRepository.findById(
          invoiceId,
          actor.organizationId,
          tx,
        );

        if (!current) {
          throw new AppError(404, "INVOICE_NOT_FOUND", "Invoice not found");
        }

        const existing = await tx.invoiceCorrection.findFirst({
          where: { id: correctionId, invoiceId: current.id },
          select: invoiceCorrectionSelect,
        });

        if (!existing) {
          throw new AppError(
            404,
            "INVOICE_CORRECTION_NOT_FOUND",
            "Invoice correction not found",
          );
        }

        if (existing.status !== "APPROVED") {
          throw new AppError(
            409,
            "INVOICE_CORRECTION_NOT_APPROVED",
            "Invoice correction must be approved before replacement",
          );
        }

        if (existing.replacementVersionId !== null) {
          throw new AppError(
            409,
            "INVOICE_CORRECTION_REPLACEMENT_ALREADY_EXISTS",
            "Invoice correction replacement already exists",
          );
        }

        const source = await tx.invoiceVersion.findFirst({
          where: {
            id: existing.sourceVersionId,
            invoiceId: current.id,
          },
          select: invoiceVersionSelect,
        });

        if (!source || source.status !== "CLOSED") {
          throw new AppError(
            409,
            "INVOICE_CORRECTION_SOURCE_INVALID",
            "Correction source invoice version must remain closed",
          );
        }

        const latestVersion = await tx.invoiceVersion.findFirst({
          where: { invoiceId: current.id },
          select: { versionNumber: true },
          orderBy: { versionNumber: "desc" },
        });
        const versionNumber = (latestVersion?.versionNumber ?? 0) + 1;

        const replacement = await tx.invoiceVersion.create({
          data: {
            invoiceId: current.id,
            versionNumber,
            versionType: "CORRECTION",
            supersedesVersionId: source.id,
            status: "DRAFT",
            invoiceDate: source.invoiceDate,
            currencyCode: source.currencyCode,
            totalAmount: source.totalAmount,
            declarantIdSnapshot: source.declarantIdSnapshot,
            patientNameSnapshot: source.patientNameSnapshot,
            patientDocumentTypeSnapshot: source.patientDocumentTypeSnapshot,
            patientDocumentNumberSnapshot: source.patientDocumentNumberSnapshot,
            insuredIdSnapshot: source.insuredIdSnapshot,
            preparedByUserId: actor.userId,
          },
          select: invoiceVersionSelect,
        });

        for (const item of source.items) {
          await tx.invoiceItem.create({
            data: {
              invoiceVersionId: replacement.id,
              lineNumber: item.lineNumber,
              detailInvoiceNumber: item.detailInvoiceNumber,
              encounterProcedureId: item.encounterProcedureId,
              sourceInvoiceItemId: item.id,
              svbProcedureId: item.svbProcedureId,
              svbTariffId: item.svbTariffId,
              serviceDateSnapshot: item.serviceDateSnapshot,
              procedureCodeSnapshot: item.procedureCodeSnapshot,
              procedureDescriptionSnapshot: item.procedureDescriptionSnapshot,
              providerIdSnapshot: item.providerIdSnapshot,
              insuredIdSnapshot: item.insuredIdSnapshot,
              unitTariffSnapshot: item.unitTariffSnapshot,
              currencyCodeSnapshot: item.currencyCodeSnapshot,
              quantity: item.quantity,
              amount: item.amount,
              authorizationIdSnapshot: item.authorizationIdSnapshot,
              diagnosticCodeSnapshot: item.diagnosticCodeSnapshot,
              treatmentIdSnapshot: item.treatmentIdSnapshot,
              accidentFormNumberSnapshot: item.accidentFormNumberSnapshot,
              numberOfTreatmentsSnapshot: item.numberOfTreatmentsSnapshot,
              assistanceSnapshot: item.assistanceSnapshot,
              referrerIdSnapshot: item.referrerIdSnapshot,
              policlinicSnapshot: item.policlinicSnapshot,
              additionalNote: item.additionalNote,
            },
          });
        }

        const updated = await tx.invoiceCorrection.update({
          where: { id: existing.id },
          data: { replacementVersionId: replacement.id },
          select: invoiceCorrectionSelect,
        });

        await tx.invoice.update({
          where: { id: current.id },
          data: {
            currentVersionId: replacement.id,
            status: "CORRECTION_REQUIRED",
          },
        });

        await auditService.writeWithinTransaction(tx, {
          organizationId: actor.organizationId,
          actorUserId: actor.userId,
          action: "INVOICE_CORRECTION_REPLACEMENT_CREATE",
          entityType: "INVOICE_CORRECTION",
          entityId: updated.id,
          entityKey: ensureInvoiceNumber(current),
          oldValues: toCorrectionAuditValues(existing),
          newValues: toCorrectionAuditValues(updated),
          ...auditTechnicalFields(metadata),
        });

        return updated;
      });

      return toInvoiceCorrectionResponse(correction);
    } catch (error) {
      mapCorrectionUniqueError(error);
    }
  }

  async updateCorrectionItem(
    invoiceId: bigint,
    versionId: bigint,
    itemId: bigint,
    input: UpdateCorrectionInvoiceItemInput,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    const item = await serializableTransaction(async (tx) => {
      const current = await invoiceRepository.findById(
        invoiceId,
        actor.organizationId,
        tx,
      );

      if (!current) {
        throw new AppError(404, "INVOICE_NOT_FOUND", "Invoice not found");
      }

      assertVersionBelongsToInvoice(current, versionId);
      const version = assertCurrentVersion(current, versionId);

      if (version.versionType !== "CORRECTION" || version.status !== "DRAFT") {
        throw new AppError(
          409,
          "INVOICE_CORRECTION_ITEM_NOT_EDITABLE",
          "Only current draft correction invoice items can be edited",
        );
      }

      const existing = await tx.invoiceItem.findFirst({
        where: { id: itemId, invoiceVersionId: version.id },
        select: invoiceItemSelect,
      });

      if (!existing) {
        throw new AppError(404, "INVOICE_ITEM_NOT_FOUND", "Invoice item not found");
      }

      if (
        input.currencyCodeSnapshot !== undefined &&
        input.currencyCodeSnapshot !== version.currencyCode
      ) {
        throw new AppError(
          409,
          "INVOICE_CURRENCY_MISMATCH",
          "Invoice item currency does not match the invoice version",
        );
      }

      const unitTariff =
        input.unitTariffSnapshot !== undefined
          ? new Prisma.Decimal(input.unitTariffSnapshot)
          : existing.unitTariffSnapshot;
      const quantity =
        input.quantity !== undefined
          ? new Prisma.Decimal(input.quantity)
          : existing.quantity;
      const amount = unitTariff.mul(quantity);

      const data: Prisma.InvoiceItemUpdateInput = { amount };

      if (input.detailInvoiceNumber !== undefined) {
        data.detailInvoiceNumber = input.detailInvoiceNumber;
      }
      if (input.serviceDateSnapshot !== undefined) {
        data.serviceDateSnapshot = parseDateOnly(
          input.serviceDateSnapshot,
          "serviceDateSnapshot",
        );
      }
      if (input.procedureCodeSnapshot !== undefined) {
        data.procedureCodeSnapshot = input.procedureCodeSnapshot;
      }
      if (input.procedureDescriptionSnapshot !== undefined) {
        data.procedureDescriptionSnapshot = input.procedureDescriptionSnapshot;
      }
      if (input.providerIdSnapshot !== undefined) {
        data.providerIdSnapshot = input.providerIdSnapshot;
      }
      if (input.insuredIdSnapshot !== undefined) {
        data.insuredIdSnapshot = input.insuredIdSnapshot;
      }
      if (input.unitTariffSnapshot !== undefined) {
        data.unitTariffSnapshot = unitTariff;
      }
      if (input.currencyCodeSnapshot !== undefined) {
        data.currencyCodeSnapshot = input.currencyCodeSnapshot;
      }
      if (input.quantity !== undefined) {
        data.quantity = quantity;
      }
      if (input.authorizationIdSnapshot !== undefined) {
        data.authorizationIdSnapshot = input.authorizationIdSnapshot;
      }
      if (input.diagnosticCodeSnapshot !== undefined) {
        data.diagnosticCodeSnapshot = input.diagnosticCodeSnapshot;
      }
      if (input.treatmentIdSnapshot !== undefined) {
        data.treatmentIdSnapshot = input.treatmentIdSnapshot;
      }
      if (input.accidentFormNumberSnapshot !== undefined) {
        data.accidentFormNumberSnapshot = input.accidentFormNumberSnapshot;
      }
      if (input.numberOfTreatmentsSnapshot !== undefined) {
        data.numberOfTreatmentsSnapshot = input.numberOfTreatmentsSnapshot;
      }
      if (input.assistanceSnapshot !== undefined) {
        data.assistanceSnapshot = input.assistanceSnapshot;
      }
      if (input.referrerIdSnapshot !== undefined) {
        data.referrerIdSnapshot = input.referrerIdSnapshot;
      }
      if (input.policlinicSnapshot !== undefined) {
        data.policlinicSnapshot = input.policlinicSnapshot;
      }
      if (input.additionalNote !== undefined) {
        data.additionalNote = input.additionalNote;
      }

      const updated = await tx.invoiceItem.update({
        where: { id: existing.id },
        data,
        select: invoiceItemSelect,
      });

      const versionItems = await tx.invoiceItem.findMany({
        where: { invoiceVersionId: version.id },
        select: { amount: true },
      });
      const totalAmount = versionItems.reduce(
        (total, row) => total.plus(row.amount),
        new Prisma.Decimal("0.00"),
      );

      await tx.invoiceVersion.update({
        where: { id: version.id },
        data: { totalAmount },
      });

      await auditService.writeWithinTransaction(tx, {
        organizationId: actor.organizationId,
        actorUserId: actor.userId,
        action: "INVOICE_CORRECTION_ITEM_UPDATE",
        entityType: "INVOICE_ITEM",
        entityId: updated.id,
        entityKey: `${ensureInvoiceNumber(current)}:${updated.lineNumber}`,
        oldValues: {
          ...toInvoiceItemResponse(existing),
          invoiceTotalAmount: version.totalAmount.toFixed(2),
        },
        newValues: {
          ...toInvoiceItemResponse(updated),
          invoiceTotalAmount: totalAmount.toFixed(2),
        },
        ...auditTechnicalFields(metadata),
      });

      return updated;
    });

    return toInvoiceItemResponse(item);
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

      const version = assertCurrentVersion(current, versionId);
      const preparableOriginal =
        current.status === "DRAFT" && version.versionType === "ORIGINAL";
      const preparableCorrection =
        current.status === "CORRECTION_REQUIRED" &&
        version.versionType === "CORRECTION";

      if (!preparableOriginal && !preparableCorrection) {
        throw new AppError(
          409,
          "INVOICE_NOT_PREPARABLE",
          "Invoice is not preparable for signature",
        );
      }

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
          oldStatus: current.status,
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
          status: current.status,
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

  async close(
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
      const { invoiceNumber, version, contentHash } =
        assertInvoiceVersionReadyForClose(current, versionId);
      const validSignature = await requireValidSignatureForClose(
        tx,
        current,
        version.id,
        contentHash,
      );
      const closedAt = new Date();
      const correction =
        version.versionType === "CORRECTION"
          ? await tx.invoiceCorrection.findFirst({
              where: {
                invoiceId: current.id,
                replacementVersionId: version.id,
                status: "APPROVED",
              },
              select: invoiceCorrectionSelect,
            })
          : null;

      if (version.versionType === "CORRECTION") {
        if (!actor.permissions.includes("invoice.apply_correction")) {
          throw new AppError(
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        }

        if (
          correction === null ||
          version.supersedesVersionId === null ||
          correction.sourceVersionId !== version.supersedesVersionId
        ) {
          throw new AppError(
            409,
            "INVOICE_CORRECTION_SOURCE_INVALID",
            "Correction replacement is not linked to an approved source",
          );
        }

        const source = await tx.invoiceVersion.findFirst({
          where: {
            id: correction.sourceVersionId,
            invoiceId: current.id,
          },
          select: { id: true, status: true },
        });

        if (!source || source.status !== "CLOSED") {
          throw new AppError(
            409,
            "INVOICE_CORRECTION_SOURCE_INVALID",
            "Correction source invoice version must remain closed",
          );
        }
      }

      await tx.invoiceVersion.update({
        where: { id: version.id },
        data: {
          status: "CLOSED",
          closedAt,
        },
      });

      await tx.invoice.update({
        where: { id: current.id },
        data: {
          status: "CLOSED",
        },
      });

      if (correction !== null) {
        await tx.invoiceVersion.update({
          where: { id: correction.sourceVersionId },
          data: {
            status: "SUPERSEDED",
            supersededAt: closedAt,
          },
        });

        const applied = await tx.invoiceCorrection.update({
          where: { id: correction.id },
          data: {
            status: "APPLIED",
            resolvedByUserId: actor.userId,
            resolvedAt: closedAt,
          },
          select: invoiceCorrectionSelect,
        });

        await auditService.writeWithinTransaction(tx, {
          organizationId: actor.organizationId,
          actorUserId: actor.userId,
          action: "INVOICE_CORRECTION_APPLY",
          entityType: "INVOICE_CORRECTION",
          entityId: applied.id,
          entityKey: invoiceNumber,
          oldValues: toCorrectionAuditValues(correction),
          newValues: toCorrectionAuditValues(applied),
          ...auditTechnicalFields(metadata),
        });
      }

      await tx.invoiceStatusHistory.create({
        data: {
          invoiceId: current.id,
          invoiceVersionId: version.id,
          oldStatus: "SIGNED",
          newStatus: "CLOSED",
          changedByUserId: actor.userId,
          metadata: { source: "invoice.close" },
        },
      });

      const closed = await invoiceRepository.findById(
        current.id,
        actor.organizationId,
        tx,
      );

      if (!closed) {
        throw new AppError(
          500,
          "INTERNAL_SERVER_ERROR",
          "Invoice could not be read after closing",
        );
      }

      await auditService.writeWithinTransaction(tx, {
        organizationId: actor.organizationId,
        actorUserId: actor.userId,
        action: "INVOICE_CLOSE",
        entityType: "INVOICE",
        entityId: closed.id,
        entityKey: invoiceNumber,
        oldValues: {
          invoiceStatus: "SIGNED",
          versionStatus: "SIGNED",
          contentHash,
          totalAmount: version.totalAmount.toFixed(2),
        },
        newValues: {
          invoiceStatus: "CLOSED",
          versionStatus: "CLOSED",
          contentHash,
          totalAmount: version.totalAmount.toFixed(2),
          closedAt: closedAt.toISOString(),
          validSignatureId: validSignature.id.toString(),
        },
        ...auditTechnicalFields(metadata),
      });

      return closed;
    });

    return toInvoiceResponse(invoice);
  }

  async generatePdf(
    invoiceId: bigint,
    versionId: bigint,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    const current = await invoiceRepository.findById(
      invoiceId,
      actor.organizationId,
    );

    if (!current) {
      throw new AppError(404, "INVOICE_NOT_FOUND", "Invoice not found");
    }

    assertVersionBelongsToInvoice(current, versionId);
    const { invoiceNumber, version, contentHash } =
      assertInvoiceVersionReadyForPdf(current, versionId);
    const storageKey = invoicePdfStorageKey({
      organizationId: actor.organizationId,
      invoiceId: current.id,
      versionId: version.id,
      contentHash,
    });
    const storageUri = storageUriFromKey(storageKey);
    const existing = await findExistingInvoicePdf(version.id, storageUri);

    if (existing !== null) {
      return toInvoiceDocumentResponse(existing);
    }

    const validSignature = await prisma.$transaction((tx) =>
      requireValidSignatureForClose(tx, current, version.id, contentHash),
    );
    const pdfBytes = await generateInvoicePdfBytes({
      invoice: current,
      version,
      contentHash,
      signature: validSignature,
    });
    const documentSha256 = sha256Hex(pdfBytes);

    await documentStorage.write(storageKey, pdfBytes);

    try {
      const invoiceDocument = await serializableTransaction(async (tx) => {
        const existingInsideTx = await findExistingInvoicePdf(
          version.id,
          storageUri,
          tx,
        );

        if (existingInsideTx !== null) {
          return existingInsideTx;
        }

        const document = await tx.document.create({
          data: {
            organizationId: actor.organizationId,
            documentType: "SIGNED_INVOICE_PDF",
            storageProvider: "LOCAL",
            storageUri,
            originalFilename: `${invoiceNumber}-v${version.versionNumber}.pdf`,
            mimeType: "application/pdf",
            sizeBytes: BigInt(pdfBytes.length),
            sha256: documentSha256,
            metadata: {
              invoiceId: current.id.toString(),
              invoiceVersionId: version.id.toString(),
              invoiceNumber,
              versionNumber: version.versionNumber,
              contentHash,
              layout: "technical_invoice_document",
              source: "invoice.pdf.generate",
            },
            createdByUserId: actor.userId,
          },
          select: {
            id: true,
          },
        });

        const row = await tx.invoiceDocument.create({
          data: {
            invoiceVersionId: version.id,
            documentId: document.id,
            documentRole: "SIGNED_INVOICE_PDF",
          },
          select: invoiceDocumentSelect,
        });

        await auditService.writeWithinTransaction(tx, {
          organizationId: actor.organizationId,
          actorUserId: actor.userId,
          action: "INVOICE_PDF_GENERATE",
          entityType: "INVOICE",
          entityId: current.id,
          entityKey: invoiceNumber,
          metadata: {
            invoiceId: current.id.toString(),
            versionId: version.id.toString(),
            documentId: document.id.toString(),
            contentHash,
            documentSha256,
          },
          newValues: {
            invoiceVersionId: version.id.toString(),
            documentId: document.id.toString(),
            documentType: "SIGNED_INVOICE_PDF",
            documentRole: "SIGNED_INVOICE_PDF",
            storageProvider: "LOCAL",
            sizeBytes: pdfBytes.length.toString(),
            sha256: documentSha256,
          },
          ...auditTechnicalFields(metadata),
        });

        return row;
      });

      return toInvoiceDocumentResponse(invoiceDocument);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const raced = await findExistingInvoicePdf(version.id, storageUri);
        if (raced !== null) {
          return toInvoiceDocumentResponse(raced);
        }
      }

      await documentStorage.remove(storageUri);
      throw error;
    }
  }
}

export const invoiceService = new InvoiceService();
