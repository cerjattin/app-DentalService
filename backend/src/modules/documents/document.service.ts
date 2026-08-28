import { randomUUID } from "node:crypto";

import type { Prisma } from "../../generated/prisma/client.js";

import { env } from "../../config/env.js";
import { prisma } from "../../infrastructure/database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";

import type { AuthenticatedRequestContext } from "../auth/auth.types.js";
import { invoiceRepository } from "../invoices/invoice.repository.js";

import {
  documentRepository,
  documentSelect,
  invoiceDocumentSelect,
} from "./document.repository.js";
import type { UploadDocumentQuery } from "./document.schemas.js";
import { documentStorage, sha256Hex } from "./document.storage.js";
import {
  toDocumentResponse,
  toInvoiceDocumentResponse,
} from "./document.types.js";

const SIGNATURE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const GENERIC_UPLOAD_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

function assertSafeOriginalFilename(originalFilename: string) {
  const value = originalFilename.trim();

  if (
    value.length === 0 ||
    value.includes("/") ||
    value.includes("\\") ||
    value.includes("\0") ||
    value === "." ||
    value === ".." ||
    value.includes("..")
  ) {
    throw new AppError(
      400,
      "INVALID_DOCUMENT_FILENAME",
      "Document filename is invalid",
    );
  }

  return value;
}

function normalizeMimeType(mimeType: string | undefined) {
  return mimeType?.split(";")[0]?.trim().toLowerCase() ?? "";
}

function assertUploadMime(
  documentType: UploadDocumentQuery["documentType"],
  mimeType: string,
) {
  const allowed =
    documentType === "SIGNATURE"
      ? SIGNATURE_MIME_TYPES
      : GENERIC_UPLOAD_MIME_TYPES;

  if (!allowed.has(mimeType)) {
    throw new AppError(
      400,
      "DOCUMENT_MIME_TYPE_NOT_ALLOWED",
      "Document MIME type is not allowed",
    );
  }
}

function uploadStorageKey(input: {
  organizationId: bigint;
  documentType: string;
  sha256: string;
}) {
  return [
    input.organizationId.toString(),
    "uploads",
    input.documentType.toLowerCase(),
    `${randomUUID()}-${input.sha256.slice(0, 16)}.bin`,
  ].join("/");
}

export class DocumentService {
  async upload(
    input: UploadDocumentQuery & {
      bytes: Buffer;
      mimeType: string | undefined;
    },
    actor: AuthenticatedRequestContext,
  ) {
    const originalFilename = assertSafeOriginalFilename(input.originalFilename);
    const mimeType = normalizeMimeType(input.mimeType);
    assertUploadMime(input.documentType, mimeType);

    if (input.bytes.length === 0) {
      throw new AppError(400, "DOCUMENT_EMPTY", "Document file is empty");
    }

    if (input.bytes.length > env.DOCUMENT_MAX_UPLOAD_BYTES) {
      throw new AppError(
        400,
        "DOCUMENT_TOO_LARGE",
        "Document exceeds maximum upload size",
      );
    }

    const sha256 = sha256Hex(input.bytes);
    const storageUri = await documentStorage.write(
      uploadStorageKey({
        organizationId: actor.organizationId,
        documentType: input.documentType,
        sha256,
      }),
      input.bytes,
    );

    try {
      const document = await prisma.document.create({
        data: {
          organizationId: actor.organizationId,
          documentType: input.documentType,
          storageProvider: "LOCAL",
          storageUri,
          originalFilename,
          mimeType,
          sizeBytes: BigInt(input.bytes.length),
          sha256,
          metadata: {
            uploadSource: "api",
          } satisfies Prisma.InputJsonObject,
          createdByUserId: actor.userId,
        },
        select: documentSelect,
      });

      return toDocumentResponse(document);
    } catch (error) {
      await documentStorage.remove(storageUri);
      throw error;
    }
  }

  async getMetadata(documentId: bigint, actor: AuthenticatedRequestContext) {
    const document = await documentRepository.findById(
      documentId,
      actor.organizationId,
    );

    if (!document) {
      throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document not found");
    }

    return toDocumentResponse(document);
  }

  async download(documentId: bigint, actor: AuthenticatedRequestContext) {
    const document = await documentRepository.findById(
      documentId,
      actor.organizationId,
    );

    if (!document) {
      throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document not found");
    }

    const bytes = await documentStorage.read(document.storageUri);

    if (sha256Hex(bytes) !== document.sha256) {
      throw new AppError(
        409,
        "DOCUMENT_INTEGRITY_MISMATCH",
        "Document file hash does not match stored metadata",
      );
    }

    return {
      document: toDocumentResponse(document),
      bytes,
    };
  }

  async listInvoiceDocuments(
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

    const rows = await documentRepository.findInvoiceDocumentsByInvoiceId(
      invoiceId,
      actor.organizationId,
    );

    return rows.map(toInvoiceDocumentResponse);
  }

  async findInvoicePdfByStorageUri(storageUri: string) {
    return prisma.invoiceDocument.findFirst({
      where: {
        document: {
          storageUri,
        },
      },
      select: invoiceDocumentSelect,
    });
  }
}

export const documentService = new DocumentService();
