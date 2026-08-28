import { Prisma } from "../../generated/prisma/client.js";

import { prisma } from "../../infrastructure/database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";

import { auditService, auditTechnicalFields } from "../audit/audit.service.js";
import type {
  AuthenticatedRequestContext,
  RequestSecurityMetadata,
} from "../auth/auth.types.js";
import { invoiceRepository } from "../invoices/invoice.repository.js";
import { computeInvoiceContentHash } from "../invoices/invoice-signature-canonicalizer.js";

import type {
  CaptureSignatureInput,
  VoidSignatureInput,
} from "./signature.schemas.js";
import { signatureRepository, signatureSelect } from "./signature.repository.js";
import { toSignatureResponse } from "./signature.types.js";

const HEX_SHA_256 = /^[a-f0-9]{64}$/;

function isSerializableConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
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

function mapSignatureUniqueError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw new AppError(
      409,
      "SIGNATURE_DOCUMENT_ALREADY_USED",
      "Signature document is already linked to another signature",
    );
  }

  throw error;
}

function canonicalInput(invoice: NonNullable<Awaited<ReturnType<typeof invoiceRepository.findById>>>) {
  const version = invoice.currentVersion;

  if (invoice.invoiceNumber === null || version === null) {
    throw new AppError(
      409,
      "INVOICE_VERSION_NOT_SIGNATURE_READY",
      "Invoice version is not ready for signature",
    );
  }

  return {
    invoiceNumber: invoice.invoiceNumber,
    version,
  };
}

function verifyStoredContentHash(
  invoice: NonNullable<Awaited<ReturnType<typeof invoiceRepository.findById>>>,
) {
  const version = invoice.currentVersion;

  if (version === null || version.contentHash === null) {
    throw new AppError(
      409,
      "INVOICE_VERSION_NOT_SIGNATURE_READY",
      "Invoice version is not ready for signature",
    );
  }

  const computedHash = computeInvoiceContentHash(canonicalInput(invoice));

  if (computedHash !== version.contentHash) {
    throw new AppError(
      409,
      "INVOICE_CONTENT_INTEGRITY_MISMATCH",
      "Invoice signature content no longer matches its stored hash",
    );
  }
}

function assertSignatureReady(
  invoice: NonNullable<Awaited<ReturnType<typeof invoiceRepository.findById>>>,
  versionId: bigint,
) {
  const version = invoice.currentVersion;

  if (
    version === null ||
    invoice.currentVersionId !== versionId ||
    version.id !== versionId
  ) {
    throw new AppError(
      409,
      "INVOICE_VERSION_NOT_CURRENT",
      "Invoice version is not the current version",
    );
  }

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

function resolveSignerName(
  input: CaptureSignatureInput,
  patientNameSnapshot: string,
) {
  if (input.signatureType === "PATIENT") {
    return patientNameSnapshot;
  }

  if (input.signerName === undefined) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "signerName is required for this signature type",
    );
  }

  return input.signerName;
}

function resolveSignerRelationship(input: CaptureSignatureInput) {
  if (input.signatureType === "PATIENT") {
    return null;
  }

  if (
    ["LEGAL_REPRESENTATIVE", "GUARDIAN"].includes(input.signatureType) &&
    input.signerRelationship === undefined
  ) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "signerRelationship is required for this signature type",
    );
  }

  return input.signerRelationship ?? null;
}

export class SignatureService {
  async list(
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

    if (
      invoice.currentVersionId !== versionId &&
      !invoice.versions.some((version) => version.id === versionId)
    ) {
      throw new AppError(
        404,
        "INVOICE_VERSION_NOT_FOUND",
        "Invoice version not found",
      );
    }

    const signatures = await signatureRepository.listByVersion(versionId);

    return signatures.map(toSignatureResponse);
  }

  async capture(
    invoiceId: bigint,
    versionId: bigint,
    input: CaptureSignatureInput,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    try {
      const signature = await serializableTransaction(async (tx) => {
        const invoice = await invoiceRepository.findById(
          invoiceId,
          actor.organizationId,
          tx,
        );

        if (!invoice) {
          throw new AppError(404, "INVOICE_NOT_FOUND", "Invoice not found");
        }

        const version = assertSignatureReady(invoice, versionId);

        if (input.expectedContentHash !== version.contentHash) {
          throw new AppError(
            409,
            "SIGNATURE_CONTENT_HASH_MISMATCH",
            "Signature content hash does not match the prepared invoice version",
          );
        }

        verifyStoredContentHash(invoice);

        const document = await tx.document.findFirst({
          where: {
            id: BigInt(input.signatureDocumentId),
            organizationId: actor.organizationId,
          },
          select: {
            id: true,
            documentType: true,
            sizeBytes: true,
            sha256: true,
            signature: {
              select: {
                id: true,
              },
            },
          },
        });

        if (document === null) {
          throw new AppError(
            404,
            "SIGNATURE_DOCUMENT_NOT_FOUND",
            "Signature document not found",
          );
        }

        if (
          document.documentType !== "SIGNATURE" ||
          document.sizeBytes <= 0n ||
          !HEX_SHA_256.test(document.sha256)
        ) {
          throw new AppError(
            409,
            "SIGNATURE_DOCUMENT_INVALID",
            "Signature document is invalid",
          );
        }

        if (document.signature !== null) {
          throw new AppError(
            409,
            "SIGNATURE_DOCUMENT_ALREADY_USED",
            "Signature document is already linked to another signature",
          );
        }

        const signerName = resolveSignerName(
          input,
          version.patientNameSnapshot,
        );
        const signerRelationship = resolveSignerRelationship(input);
        const signedAt = new Date();

        const created = await tx.signature.create({
          data: {
            invoiceVersionId: version.id,
            patientId: invoice.patientId,
            signatureDocumentId: document.id,
            signatureType: input.signatureType,
            signerName,
            signerRelationship,
            captureMethod: input.captureMethod,
            signedContentHash: version.contentHash,
            signatureHash: document.sha256,
            status: "VALID",
            signedAt,
            capturedByUserId: actor.userId,
            ...(input.deviceIdentifier !== undefined
              ? { deviceIdentifier: input.deviceIdentifier }
              : {}),
            ...(metadata.ipAddress !== undefined
              ? { ipAddress: metadata.ipAddress }
              : {}),
            ...(metadata.userAgent !== undefined
              ? { userAgent: metadata.userAgent }
              : {}),
            ...(input.metadata !== undefined
              ? {
                  metadata:
                    input.metadata === null ? Prisma.JsonNull : input.metadata,
                }
              : {}),
          },
          select: signatureSelect,
        });

        await auditService.writeWithinTransaction(tx, {
          organizationId: actor.organizationId,
          actorUserId: actor.userId,
          action: "SIGNATURE_CAPTURE",
          entityType: "SIGNATURE",
          entityId: created.id,
          entityKey: `${invoice.invoiceNumber ?? invoice.id.toString()}:v${version.versionNumber.toString()}`,
          newValues: {
            invoiceVersionId: created.invoiceVersionId.toString(),
            patientId: created.patientId.toString(),
            signatureType: created.signatureType,
            captureMethod: created.captureMethod,
            signedContentHash: created.signedContentHash,
            signatureHash: created.signatureHash,
            signatureDocumentId: created.signatureDocumentId.toString(),
          },
          ...auditTechnicalFields(metadata),
        });

        return created;
      });

      return toSignatureResponse(signature);
    } catch (error) {
      mapSignatureUniqueError(error);
    }
  }

  async void(
    invoiceId: bigint,
    versionId: bigint,
    signatureId: bigint,
    input: VoidSignatureInput,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    const signature = await serializableTransaction(async (tx) => {
      const invoice = await invoiceRepository.findById(
        invoiceId,
        actor.organizationId,
        tx,
      );

      if (!invoice) {
        throw new AppError(404, "INVOICE_NOT_FOUND", "Invoice not found");
      }

      const version = invoice.currentVersion;

      if (
        version === null ||
        invoice.currentVersionId !== versionId ||
        version.id !== versionId
      ) {
        throw new AppError(
          409,
          "INVOICE_VERSION_NOT_CURRENT",
          "Invoice version is not the current version",
        );
      }

      const current = await signatureRepository.findById(
        signatureId,
        versionId,
        tx,
      );

      if (current === null) {
        throw new AppError(404, "SIGNATURE_NOT_FOUND", "Signature not found");
      }

      if (current.status !== "VALID" || version.status !== "PENDING_SIGNATURE") {
        throw new AppError(
          409,
          "SIGNATURE_NOT_VOIDABLE",
          "Signature cannot be voided in the current invoice version state",
        );
      }

      const voidedAt = new Date();
      await tx.signature.update({
        where: { id: current.id },
        data: {
          status: "VOID",
          voidedAt,
          voidedByUserId: actor.userId,
          voidReason: input.reason,
        },
        select: { id: true },
      });

      const updated = await signatureRepository.findById(
        current.id,
        versionId,
        tx,
      );

      if (updated === null) {
        throw new AppError(
          500,
          "INTERNAL_SERVER_ERROR",
          "Signature could not be read after voiding",
        );
      }

      await auditService.writeWithinTransaction(tx, {
        organizationId: actor.organizationId,
        actorUserId: actor.userId,
        action: "SIGNATURE_VOID",
        entityType: "SIGNATURE",
        entityId: updated.id,
        entityKey: `${invoice.invoiceNumber ?? invoice.id.toString()}:v${version.versionNumber.toString()}`,
        oldValues: {
          status: current.status,
          voidedAt: current.voidedAt?.toISOString() ?? null,
          voidedByUserId: current.voidedByUserId?.toString() ?? null,
          voidReason: current.voidReason,
        },
        newValues: {
          status: updated.status,
          voidedAt: voidedAt.toISOString(),
          voidedByUserId: actor.userId.toString(),
          voidReason: input.reason,
        },
        reason: input.reason,
        ...auditTechnicalFields(metadata),
      });

      return updated;
    });

    return toSignatureResponse(signature);
  }
}

export const signatureService = new SignatureService();
