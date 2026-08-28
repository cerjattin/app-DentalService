import { Prisma } from "../../generated/prisma/client.js";

import { prisma } from "../../infrastructure/database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { parseDateOnly } from "../../shared/utils/date-only.js";
import { auditService, auditTechnicalFields } from "../audit/audit.service.js";
import type {
  AuthenticatedRequestContext,
  RequestSecurityMetadata,
} from "../auth/auth.types.js";
import {
  documentStorage,
  sha256Hex,
} from "../documents/document.storage.js";
import { numberSequenceService } from "../number-sequences/number-sequence.service.js";

import type {
  AddDeclarationItemInput,
  CreateDeclarationExportInput,
  CreateDeclarationInput,
  ListDeclarationsQuery,
} from "./declaration.schemas.js";
import {
  declarationItemSelect,
  declarationRepository,
  declarationBatchSelect,
  declarationExportSelect,
  type DeclarationBatchRecord,
  type DeclarationItemRecord,
  type InvoiceItemForDeclarationRecord,
} from "./declaration.repository.js";
import {
  toDeclarationBatchResponse,
  toDeclarationExportResponse,
  toDeclarationItemResponse,
} from "./declaration.types.js";
import { renderCsvRows } from "./export/csv.adapter.js";
import {
  mapDeclarationItemToSvbRow,
  type SvbDeclarationRow,
} from "./export/declaration-row.mapper.js";
import { renderJsonRows } from "./export/json.adapter.js";
import { renderTxtRows } from "./export/txt.adapter.js";
import { renderXmlRows } from "./export/xml.adapter.js";

const SUPPORTED_EXPORT_FORMATS = ["CSV", "TXT", "JSON", "XML"] as const;
const SCHEMA_VERSION = "SVB_DECLARATION_ROW_V1";
const ADAPTER_VERSION = "svb-declaration-export-v1";

type SupportedExportFormat = (typeof SUPPORTED_EXPORT_FORMATS)[number];

function parseNullableDateOnly(
  value: string | null | undefined,
  fieldName: string,
) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return parseDateOnly(value, fieldName);
}

function assertValidPeriod(
  periodStart: Date | null,
  periodEnd: Date | null,
) {
  if (periodStart !== null && periodEnd !== null && periodEnd < periodStart) {
    throw new AppError(
      400,
      "INVALID_DECLARATION_PERIOD",
      "periodEnd must be greater than or equal to periodStart",
    );
  }
}

async function serializableTransaction<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await prisma.$transaction(callback, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034" &&
        attempt < 3
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new AppError(
    409,
    "TRANSACTION_CONFLICT",
    "Transaction could not be completed",
  );
}

function isSupportedExportFormat(
  format: string,
): format is SupportedExportFormat {
  return SUPPORTED_EXPORT_FORMATS.some((supported) => supported === format);
}

function mapDuplicateItemError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw new AppError(
      409,
      "DECLARATION_ITEM_ALREADY_EXISTS",
      "Invoice item is already included in this declaration",
    );
  }

  throw error;
}

function declarationAuditValues(row: DeclarationBatchRecord) {
  return {
    payerId: row.payerId.toString(),
    declarationNumber: row.declarationNumber,
    status: row.status,
    periodStart: row.periodStart?.toISOString().slice(0, 10) ?? null,
    periodEnd: row.periodEnd?.toISOString().slice(0, 10) ?? null,
    declarantIdSnapshot: row.declarantIdSnapshot,
    notes: row.notes,
  };
}

function declarationItemAuditValues(row: DeclarationItemRecord) {
  return {
    invoiceItemId: row.invoiceItemId.toString(),
    sequenceNumber: row.sequenceNumber,
    invoiceNumberSnapshot: row.invoiceNumberSnapshot,
    detailInvoiceNumberSnapshot: row.detailInvoiceNumberSnapshot,
    amountSnapshot: row.amountSnapshot.toFixed(2),
    lineStatus: row.lineStatus,
  };
}

function renderRows(
  format: SupportedExportFormat,
  declarationNumber: string | null,
  rows: SvbDeclarationRow[],
) {
  switch (format) {
    case "CSV":
      return {
        bytes: renderCsvRows(rows),
        extension: "csv",
        mimeType: "text/csv; charset=utf-8",
      };
    case "TXT":
      return {
        bytes: renderTxtRows(rows),
        extension: "txt",
        mimeType: "text/plain; charset=utf-8",
      };
    case "JSON":
      return {
        bytes: renderJsonRows({ declarationNumber, rows }),
        extension: "json",
        mimeType: "application/json",
      };
    case "XML":
      return {
        bytes: renderXmlRows({ declarationNumber, rows }),
        extension: "xml",
        mimeType: "application/xml",
      };
  }
}

function assertEditableDraft(batch: { status: string }) {
  if (batch.status !== "DRAFT") {
    throw new AppError(
      409,
      "DECLARATION_NOT_EDITABLE",
      "Declaration is not editable",
    );
  }
}

function assertReadyForExport(batch: { status: string }) {
  if (batch.status !== "READY" && batch.status !== "EXPORTED") {
    throw new AppError(
      409,
      "DECLARATION_NOT_READY",
      "Declaration must be READY before export",
    );
  }
}

function assertInvoiceItemEligible(
  batch: DeclarationBatchRecord,
  invoiceItem: InvoiceItemForDeclarationRecord | null,
): asserts invoiceItem is InvoiceItemForDeclarationRecord {
  if (!invoiceItem) {
    throw new AppError(
      409,
      "DECLARATION_ITEM_NOT_ELIGIBLE",
      "Invoice item is not eligible for declaration",
    );
  }

  const invoice = invoiceItem.invoiceVersion.invoice;

  if (invoice.organizationId !== batch.organizationId) {
    throw new AppError(
      409,
      "DECLARATION_ITEM_WRONG_ORGANIZATION",
      "Invoice item belongs to another organization",
    );
  }

  if (invoice.patientInsurance.payerId !== batch.payerId) {
    throw new AppError(
      409,
      "DECLARATION_ITEM_WRONG_PAYER",
      "Invoice item payer does not match declaration payer",
    );
  }

  if (
    invoice.status !== "CLOSED" ||
    invoiceItem.invoiceVersion.status !== "CLOSED" ||
    invoice.currentVersionId !== invoiceItem.invoiceVersionId
  ) {
    throw new AppError(
      409,
      "DECLARATION_ITEM_NOT_ELIGIBLE",
      "Invoice item is not eligible for declaration",
    );
  }
}

function snapshotDeclarant(
  batch: DeclarationBatchRecord,
  invoiceItem: InvoiceItemForDeclarationRecord,
) {
  return (
    batch.declarantIdSnapshot ??
    invoiceItem.invoiceVersion.declarantIdSnapshot ??
    ""
  );
}

export class DeclarationService {
  async list(query: ListDeclarationsQuery, actor: AuthenticatedRequestContext) {
    const where: Prisma.DeclarationBatchWhereInput = {
      organizationId: actor.organizationId,
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.payerId !== undefined ? { payerId: BigInt(query.payerId) } : {}),
      ...(query.q !== undefined
        ? {
            OR: [
              {
                declarationNumber: {
                  contains: query.q,
                },
              },
              {
                payer: {
                  name: {
                    contains: query.q,
                  },
                },
              },
              {
                payer: {
                  code: {
                    contains: query.q,
                  },
                },
              },
            ],
          }
        : {}),
    };

    const periodStart = parseNullableDateOnly(
      query.periodStart,
      "periodStart",
    );
    const periodEnd = parseNullableDateOnly(query.periodEnd, "periodEnd");
    if (periodStart !== undefined || periodEnd !== undefined) {
      where.AND = [
        ...(where.AND instanceof Array ? where.AND : []),
        ...(periodStart !== undefined && periodStart !== null
          ? [
              {
                periodEnd: {
                  gte: periodStart,
                },
              },
            ]
          : []),
        ...(periodEnd !== undefined && periodEnd !== null
          ? [
              {
                periodStart: {
                  lte: periodEnd,
                },
              },
            ]
          : []),
      ];
    }

    const [total, declarations] = await Promise.all([
      prisma.declarationBatch.count({ where }),
      prisma.declarationBatch.findMany({
        where,
        select: declarationBatchSelect,
        orderBy: {
          createdAt: "desc",
        },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return {
      declarations: declarations.map(toDeclarationBatchResponse),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async getById(declarationId: bigint, actor: AuthenticatedRequestContext) {
    const declaration = await declarationRepository.findById(
      declarationId,
      actor.organizationId,
    );

    if (!declaration) {
      throw new AppError(
        404,
        "DECLARATION_NOT_FOUND",
        "Declaration not found",
      );
    }

    return toDeclarationBatchResponse(declaration);
  }

  async create(
    input: CreateDeclarationInput,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    const periodStart =
      parseNullableDateOnly(input.periodStart, "periodStart") ?? null;
    const periodEnd =
      parseNullableDateOnly(input.periodEnd, "periodEnd") ?? null;
    assertValidPeriod(periodStart, periodEnd);

    const payerId = BigInt(input.payerId);

    const payer = await prisma.payer.findFirst({
      where: {
        id: payerId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!payer) {
      throw new AppError(400, "INVALID_PAYER", "Payer is invalid");
    }

    const declaration = await serializableTransaction(async (tx) => {
      const allocated = await numberSequenceService.allocateWithinTransaction(
        tx,
        {
          organizationId: actor.organizationId,
          sequenceType: "DECLARATION",
        },
      );

      const created = await tx.declarationBatch.create({
        data: {
          organizationId: actor.organizationId,
          payerId,
          declarationNumber: allocated.formatted,
          status: "DRAFT",
          periodStart,
          periodEnd,
          declarantIdSnapshot: input.declarantIdSnapshot ?? null,
          notes: input.notes ?? null,
          createdByUserId: actor.userId,
        },
        select: declarationBatchSelect,
      });

      await tx.declarationBatchStatusHistory.create({
        data: {
          declarationBatchId: created.id,
          oldStatus: null,
          newStatus: "DRAFT",
          changedByUserId: actor.userId,
          metadata: {
            source: "api",
          },
        },
      });

      await auditService.writeWithinTransaction(tx, {
        organizationId: actor.organizationId,
        actorUserId: actor.userId,
        action: "DECLARATION_CREATE",
        entityType: "DECLARATION_BATCH",
        entityId: created.id,
        entityKey: created.declarationNumber ?? created.id.toString(),
        newValues: declarationAuditValues(created),
        ...auditTechnicalFields(metadata),
      });

      return created;
    });

    return toDeclarationBatchResponse(declaration);
  }

  async listItems(declarationId: bigint, actor: AuthenticatedRequestContext) {
    const declaration = await declarationRepository.findById(
      declarationId,
      actor.organizationId,
    );

    if (!declaration) {
      throw new AppError(
        404,
        "DECLARATION_NOT_FOUND",
        "Declaration not found",
      );
    }

    return declaration.items.map(toDeclarationItemResponse);
  }

  async addItem(
    declarationId: bigint,
    input: AddDeclarationItemInput,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    const invoiceItemId = BigInt(input.invoiceItemId);

    try {
      const item = await serializableTransaction(async (tx) => {
        const declaration = await declarationRepository.findById(
          declarationId,
          actor.organizationId,
          tx,
        );

        if (!declaration) {
          throw new AppError(
            404,
            "DECLARATION_NOT_FOUND",
            "Declaration not found",
          );
        }

        assertEditableDraft(declaration);

        const duplicate = await declarationRepository.findItemByInvoiceItem(
          declaration.id,
          invoiceItemId,
          tx,
        );

        if (duplicate) {
          throw new AppError(
            409,
            "DECLARATION_ITEM_ALREADY_EXISTS",
            "Invoice item is already included in this declaration",
          );
        }

        const invoiceItem =
          await declarationRepository.findInvoiceItemForDeclaration(
            invoiceItemId,
            tx,
          );

        assertInvoiceItemEligible(declaration, invoiceItem);

        const maxSequence = await tx.declarationItem.aggregate({
          where: {
            declarationBatchId: declaration.id,
          },
          _max: {
            sequenceNumber: true,
          },
        });

        const created = await tx.declarationItem.create({
          data: {
            declarationBatchId: declaration.id,
            invoiceItemId,
            sequenceNumber: (maxSequence._max.sequenceNumber ?? 0) + 1,
            lineStatus: "PENDING",
            declarantIdSnapshot: snapshotDeclarant(declaration, invoiceItem),
            invoiceNumberSnapshot:
              invoiceItem.invoiceVersion.invoice.invoiceNumber ?? "",
            detailInvoiceNumberSnapshot:
              invoiceItem.detailInvoiceNumber ?? "",
            providerIdSnapshot: invoiceItem.providerIdSnapshot,
            serviceDateSnapshot: invoiceItem.serviceDateSnapshot,
            insuredIdSnapshot: invoiceItem.insuredIdSnapshot,
            accidentFormNumberSnapshot:
              invoiceItem.accidentFormNumberSnapshot,
            treatmentIdSnapshot: invoiceItem.treatmentIdSnapshot,
            amountSnapshot: invoiceItem.amount,
            authorizationIdSnapshot: invoiceItem.authorizationIdSnapshot,
            numberOfTreatmentsSnapshot:
              invoiceItem.numberOfTreatmentsSnapshot,
            assistanceSnapshot: invoiceItem.assistanceSnapshot,
            referrerIdSnapshot: invoiceItem.referrerIdSnapshot,
            diagnosticCodeSnapshot: invoiceItem.diagnosticCodeSnapshot,
            policlinicSnapshot: invoiceItem.policlinicSnapshot,
            additionalNoteSnapshot: invoiceItem.additionalNote,
          },
          select: declarationItemSelect,
        });

        await auditService.writeWithinTransaction(tx, {
          organizationId: actor.organizationId,
          actorUserId: actor.userId,
          action: "DECLARATION_ITEM_ADD",
          entityType: "DECLARATION_ITEM",
          entityId: created.id,
          entityKey: `${declaration.declarationNumber ?? declaration.id.toString()}:${created.sequenceNumber}`,
          newValues: declarationItemAuditValues(created),
          ...auditTechnicalFields(metadata),
        });

        return created;
      });

      return toDeclarationItemResponse(item);
    } catch (error) {
      mapDuplicateItemError(error);
    }
  }

  async markReady(
    declarationId: bigint,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    const declaration = await serializableTransaction(async (tx) => {
      const current = await declarationRepository.findById(
        declarationId,
        actor.organizationId,
        tx,
      );

      if (!current) {
        throw new AppError(
          404,
          "DECLARATION_NOT_FOUND",
          "Declaration not found",
        );
      }

      assertEditableDraft(current);

      if (current.items.length === 0) {
        throw new AppError(
          409,
          "DECLARATION_EMPTY",
          "Declaration must contain at least one item",
        );
      }

      current.items.map(mapDeclarationItemToSvbRow);

      const updated = await tx.declarationBatch.update({
        where: {
          id: current.id,
        },
        data: {
          status: "READY",
          readyAt: new Date(),
        },
        select: declarationBatchSelect,
      });

      await tx.declarationBatchStatusHistory.create({
        data: {
          declarationBatchId: current.id,
          oldStatus: current.status,
          newStatus: "READY",
          changedByUserId: actor.userId,
          metadata: {
            source: "api",
          },
        },
      });

      await auditService.writeWithinTransaction(tx, {
        organizationId: actor.organizationId,
        actorUserId: actor.userId,
        action: "DECLARATION_READY",
        entityType: "DECLARATION_BATCH",
        entityId: updated.id,
        entityKey: updated.declarationNumber ?? updated.id.toString(),
        oldValues: {
          status: current.status,
          readyAt: current.readyAt?.toISOString() ?? null,
        },
        newValues: {
          status: updated.status,
          readyAt: updated.readyAt?.toISOString() ?? null,
        },
        ...auditTechnicalFields(metadata),
      });

      return updated;
    });

    return toDeclarationBatchResponse(declaration);
  }

  async listExports(declarationId: bigint, actor: AuthenticatedRequestContext) {
    const declaration = await declarationRepository.findById(
      declarationId,
      actor.organizationId,
    );

    if (!declaration) {
      throw new AppError(
        404,
        "DECLARATION_NOT_FOUND",
        "Declaration not found",
      );
    }

    return declaration.exports.map(toDeclarationExportResponse);
  }

  async exportDeclaration(
    declarationId: bigint,
    input: CreateDeclarationExportInput,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    if (!isSupportedExportFormat(input.format)) {
      throw new AppError(
        400,
        "UNSUPPORTED_EXPORT_FORMAT",
        "Export format is not supported by this sprint",
      );
    }

    const declaration = await declarationRepository.findById(
      declarationId,
      actor.organizationId,
    );

    if (!declaration) {
      throw new AppError(
        404,
        "DECLARATION_NOT_FOUND",
        "Declaration not found",
      );
    }

    assertReadyForExport(declaration);

    if (declaration.items.length === 0) {
      throw new AppError(
        409,
        "DECLARATION_EMPTY",
        "Declaration must contain at least one item",
      );
    }

    const rows = declaration.items.map(mapDeclarationItemToSvbRow);
    const rendered = renderRows(
      input.format,
      declaration.declarationNumber,
      rows,
    );
    const contentHash = sha256Hex(rendered.bytes);

    const existing = await prisma.declarationExport.findFirst({
      where: {
        declarationBatchId: declaration.id,
        format: input.format,
        document: {
          sha256: contentHash,
        },
      },
      select: declarationExportSelect,
    });

    if (existing) {
      return toDeclarationExportResponse(existing);
    }

    const storageKey = [
      actor.organizationId.toString(),
      "declarations",
      declaration.id.toString(),
      input.format.toLowerCase(),
      `${contentHash}.${rendered.extension}`,
    ].join("/");

    const storageUri = await documentStorage.write(storageKey, rendered.bytes);
    let committed = false;

    try {
      const declarationExport = await serializableTransaction(async (tx) => {
        const current = await declarationRepository.findById(
          declarationId,
          actor.organizationId,
          tx,
        );

        if (!current) {
          throw new AppError(
            404,
            "DECLARATION_NOT_FOUND",
            "Declaration not found",
          );
        }

        assertReadyForExport(current);

        const duplicate = await tx.declarationExport.findFirst({
          where: {
            declarationBatchId: current.id,
            format: input.format,
            document: {
              sha256: contentHash,
            },
          },
          select: declarationExportSelect,
        });

        if (duplicate) {
          committed = true;
          return duplicate;
        }

        const document = await tx.document.create({
          data: {
            organizationId: actor.organizationId,
            documentType: "DECLARATION_EXPORT",
            storageProvider: "LOCAL",
            storageUri,
            originalFilename: `${current.declarationNumber ?? current.id.toString()}-${input.format.toLowerCase()}.${rendered.extension}`,
            mimeType: rendered.mimeType,
            sizeBytes: BigInt(rendered.bytes.length),
            sha256: contentHash,
            metadata: {
              schemaVersion: SCHEMA_VERSION,
              adapterVersion: ADAPTER_VERSION,
              headerRow: false,
            },
            createdByUserId: actor.userId,
          },
          select: {
            id: true,
          },
        });

        const created = await tx.declarationExport.create({
          data: {
            declarationBatchId: current.id,
            documentId: document.id,
            format: input.format,
            schemaVersion: SCHEMA_VERSION,
            adapterVersion: ADAPTER_VERSION,
            recordCount: rows.length,
            exportedByUserId: actor.userId,
            metadata: {
              sha256: contentHash,
              headerRow: false,
            },
          },
          select: declarationExportSelect,
        });

        if (current.status === "READY") {
          await tx.declarationBatch.update({
            where: {
              id: current.id,
            },
            data: {
              status: "EXPORTED",
              exportedAt: new Date(),
            },
          });

          await tx.declarationBatchStatusHistory.create({
            data: {
              declarationBatchId: current.id,
              oldStatus: "READY",
              newStatus: "EXPORTED",
              changedByUserId: actor.userId,
              metadata: {
                source: "api",
                format: input.format,
              },
            },
          });
        }

        await auditService.writeWithinTransaction(tx, {
          organizationId: actor.organizationId,
          actorUserId: actor.userId,
          action: "DECLARATION_EXPORT",
          entityType: "DECLARATION_EXPORT",
          entityId: created.id,
          entityKey: current.declarationNumber ?? current.id.toString(),
          newValues: {
            declarationBatchId: current.id.toString(),
            format: created.format,
            documentId: created.documentId.toString(),
            recordCount: created.recordCount,
            sha256: contentHash,
          },
          ...auditTechnicalFields(metadata),
        });

        committed = true;
        return created;
      });

      return toDeclarationExportResponse(declarationExport);
    } catch (error) {
      if (!committed) {
        await documentStorage.remove(storageUri);
      }

      throw error;
    }
  }
}

export const declarationService = new DeclarationService();
