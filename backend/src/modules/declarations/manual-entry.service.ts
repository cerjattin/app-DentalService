import { createHash } from "node:crypto";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../infrastructure/database/prisma.js";
import { isTransactionConflict } from "../../infrastructure/database/transaction-conflict.js";
import { AppError } from "../../shared/errors/app-error.js";
import { auditService, auditTechnicalFields } from "../audit/audit.service.js";
import type {
  AuthenticatedRequestContext,
  RequestSecurityMetadata,
} from "../auth/auth.types.js";
import { documentService } from "../documents/document.service.js";
import { documentRepository } from "../documents/document.repository.js";
import {
  declarationRepository,
  declarationSubmissionSelect,
} from "./declaration.repository.js";
import { toDeclarationSubmissionResponse } from "./declaration.types.js";
import { assertDeclarationIdentity } from "./declaration-identity.js";
import { assertManualSvbRecordingEnabled } from "../svb-readiness/svb-readiness.service.js";
import {
  declarationItemToSvbRow,
  diagnoseSvbDeclarationRow,
} from "./export/declaration-row.mapper.js";
import {
  manualEntryRepository,
  manualEntrySelect,
  type ManualEntryRecord,
} from "./manual-entry.repository.js";
import type {
  PrepareManualEntryInput,
  RecordManualSubmissionInput,
  ReleaseManualEntryInput,
  RecordManualResultInput,
} from "./manual-entry.schemas.js";

export function canonicalManualJson(value: unknown): string {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
    return JSON.stringify(value);
  if (Array.isArray(value))
    return `[${value.map(canonicalManualJson).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map(
        (key) => `${JSON.stringify(key)}:${canonicalManualJson(record[key])}`,
      )
      .join(",")}}`;
  }
  throw new Error("Unsupported canonical snapshot value");
}
export const manualHash = (value: unknown) =>
  createHash("sha256").update(canonicalManualJson(value)).digest("hex");
const conflict = (code: string, message: string): never => {
  throw new AppError(409, code, message);
};

async function transaction<T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10000,
        timeout: 15000,
      });
    } catch (error) {
      const unique =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002";
      if (isTransactionConflict(error) || unique) {
        if (attempt < 2) continue;
        conflict(
          "MANUAL_ENTRY_CONCURRENT_CONFLICT",
          "Manual portal data changed concurrently; reload before retrying",
        );
      }
      throw error;
    }
  }
}
async function batch(
  tx: Prisma.TransactionClient,
  id: bigint,
  actor: AuthenticatedRequestContext,
) {
  const row = await declarationRepository.lockBatch(
    tx,
    id,
    actor.organizationId,
  );
  if (!row)
    throw new AppError(404, "DECLARATION_NOT_FOUND", "Declaration not found");
  return row;
}
async function visibleBatch(id: bigint, actor: AuthenticatedRequestContext) {
  if (!(await declarationRepository.findById(id, actor.organizationId)))
    throw new AppError(404, "DECLARATION_NOT_FOUND", "Declaration not found");
}
function owner(entry: ManualEntryRecord, actor: AuthenticatedRequestContext) {
  if (
    entry.preparedByUserId !== actor.userId &&
    !actor.permissions.includes("declaration.update")
  ) {
    throw new AppError(
      403,
      "PERMISSION_DENIED",
      "Only the preparing operator or a declaration supervisor can resolve this preparation",
    );
  }
}
function externalTime(value: string) {
  const time = new Date(value);
  if (!Number.isFinite(time.getTime()) || time.getTime() > Date.now() + 300000)
    throw new AppError(
      400,
      "INVALID_EXTERNAL_TIMESTAMP",
      "External time must be valid and must not be in the future",
    );
  return time;
}
export function manualEntryResponse(row: ManualEntryRecord) {
  return {
    id: row.id.toString(),
    declarationId: row.declarationBatchId.toString(),
    state: row.state,
    contentHash: row.contentHash,
    schemaVersion: "ODONTHO_MANUAL_ENTRY_V1",
    entryMode: "MANUAL_ENTRY",
    preparedByUserId: row.preparedByUserId.toString(),
    preparedAt: row.preparedAt.toISOString(),
    uncertaintyReason: row.uncertaintyReason,
    releaseReason: row.releaseReason,
    releasedAt: row.releasedAt?.toISOString() ?? null,
    resolutionDocumentId: row.resolutionDocumentId?.toString() ?? null,
    submissionId: row.submissionId?.toString() ?? null,
    receiptDocumentId: row.receiptDocumentId?.toString() ?? null,
    receiptSha256: row.receiptSha256,
    externalSubmittedAt: row.externalSubmittedAt?.toISOString() ?? null,
    recordedAt: row.confirmedAt?.toISOString() ?? null,
    result: row.result
      ? {
          id: row.result.id.toString(),
          status: row.result.status,
          documentId: row.result.resultDocumentId.toString(),
          sha256: row.result.resultSha256,
          externalReference: row.result.externalReference,
          externalRespondedAt: row.result.externalRespondedAt.toISOString(),
          recordedAt: row.result.recordedAt.toISOString(),
          recordedByUserId: row.result.recordedByUserId.toString(),
          lines: row.result.lineResults,
        }
      : null,
  };
}

async function evidence(id: bigint, actor: AuthenticatedRequestContext) {
  const stored = await documentRepository.findById(id, actor.organizationId);
  if (!stored)
    throw new AppError(
      404,
      "DOCUMENT_NOT_FOUND",
      "Evidence document not found",
    );
  if (!["OTHER", "SUPPORTING_DOCUMENT"].includes(stored.documentType))
    throw new AppError(
      400,
      "MANUAL_EVIDENCE_TYPE_INVALID",
      "Upload portal evidence as OTHER or SUPPORTING_DOCUMENT",
    );
  const downloaded = await documentService.download(id, actor);
  const bytes = downloaded.bytes;
  const valid =
    stored.mimeType === "application/pdf"
      ? bytes.subarray(0, 5).toString() === "%PDF-"
      : stored.mimeType === "image/png"
        ? bytes
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : stored.mimeType === "image/jpeg"
          ? bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
          : stored.mimeType === "image/webp"
            ? bytes.subarray(0, 4).toString() === "RIFF" &&
              bytes.subarray(8, 12).toString() === "WEBP"
            : false;
  if (!valid || BigInt(bytes.length) !== stored.sizeBytes)
    throw new AppError(
      409,
      "MANUAL_EVIDENCE_INVALID",
      "Evidence bytes do not match the stored type or size",
    );
  return stored;
}

async function packet(
  tx: Prisma.TransactionClient,
  current: Awaited<ReturnType<typeof batch>>,
  requireCompleteInvoice = false,
) {
  if (!["DRAFT", "READY", "EXPORTED"].includes(current.status))
    conflict(
      "MANUAL_ENTRY_NOT_ALLOWED",
      "This declaration cannot be prepared for manual entry",
    );
  assertDeclarationIdentity(current);
  const rows = await manualEntryRepository.sourceItems(current.id, tx);
  if (!rows.length)
    conflict(
      "DECLARATION_EMPTY",
      "A manual entry requires at least one closed invoice item",
    );
  const invoiceIds = [
    ...new Set(rows.map((r) => r.invoiceItem.invoiceVersion.invoice.id)),
  ].sort((a, b) => (a < b ? -1 : 1));
  await manualEntryRepository.lockInvoices(invoiceIds, tx);
  if (requireCompleteInvoice) {
    const versionIds = new Set(
      rows.map((row) => row.invoiceItem.invoiceVersionId),
    );
    if (invoiceIds.length !== 1 || versionIds.size !== 1)
      conflict(
        "MANUAL_ENTRY_SINGLE_INVOICE_REQUIRED",
        "A manual presentation must contain one complete invoice and one version",
      );
    const expected = await manualEntryRepository.completeInvoiceItemIds(
      rows[0]!.invoiceItem.invoiceVersionId,
      tx,
    );
    const selected = new Set(rows.map((row) => row.invoiceItemId.toString()));
    if (
      selected.size !== rows.length ||
      selected.size !== expected.length ||
      expected.some((item) => !selected.has(item.id.toString()))
    ) {
      conflict(
        "MANUAL_ENTRY_INCOMPLETE_INVOICE",
        "Include exactly all items of the closed invoice version before preparing or recording a presentation",
      );
    }
  }
  const totals = new Map<string, Prisma.Decimal>();
  const items = rows.map((row) => {
    const item = row.invoiceItem,
      version = item.invoiceVersion,
      invoice = version.invoice;
    if (
      invoice.organizationId !== current.organizationId ||
      invoice.patientInsurance.payerId !== current.payerId ||
      invoice.status !== "CLOSED" ||
      version.status !== "CLOSED" ||
      invoice.currentVersionId !== version.id
    ) {
      conflict(
        "MANUAL_SOURCE_NOT_CURRENT",
        "All manual entries must refer to current closed invoice versions",
      );
    }
    if (
      !version.contentHash ||
      !/^[a-f0-9]{64}$/.test(version.contentHash) ||
      !current.declarantIdSnapshot ||
      row.declarantIdSnapshot !== current.declarantIdSnapshot ||
      row.declarantIdSnapshot !== version.declarantIdSnapshot ||
      !row.amountSnapshot.equals(item.amount)
    )
      conflict(
        "MANUAL_SOURCE_INCONSISTENT",
        "Frozen invoice identity, signature hash or amount needs explicit reconciliation",
      );
    totals.set(
      item.currencyCodeSnapshot,
      (totals.get(item.currencyCodeSnapshot) ?? new Prisma.Decimal(0)).add(
        row.amountSnapshot,
      ),
    );
    return {
      declarationItemId: row.id.toString(),
      sequenceNumber: row.sequenceNumber,
      invoiceItemId: item.id.toString(),
      invoiceId: invoice.id.toString(),
      invoiceVersionId: version.id.toString(),
      versionNumber: version.versionNumber,
      invoiceContentHash: version.contentHash,
      declarantId: row.declarantIdSnapshot,
      invoiceNumber: row.invoiceNumberSnapshot,
      detailInvoiceNumber: row.detailInvoiceNumberSnapshot,
      serviceDate: row.serviceDateSnapshot.toISOString().slice(0, 10),
      procedureCode: item.procedureCodeSnapshot,
      procedureDescription: item.procedureDescriptionSnapshot,
      providerId: row.providerIdSnapshot,
      insuredId: row.insuredIdSnapshot,
      treatmentId: row.treatmentIdSnapshot,
      accidentFormNumber: row.accidentFormNumberSnapshot,
      authorizationId: row.authorizationIdSnapshot,
      numberOfTreatments: row.numberOfTreatmentsSnapshot,
      assistance: row.assistanceSnapshot,
      referrerId: row.referrerIdSnapshot,
      diagnosticCode: row.diagnosticCodeSnapshot,
      policlinic: row.policlinicSnapshot,
      additionalNote: row.additionalNoteSnapshot,
      quantity: item.quantity.toFixed(2),
      unitTariff: item.unitTariffSnapshot.toFixed(2),
      amount: row.amountSnapshot.toFixed(2),
      currencyCode: item.currencyCodeSnapshot,
      technicalFileIssues: diagnoseSvbDeclarationRow(
        declarationItemToSvbRow(row),
      ),
    };
  });
  return {
    schemaVersion: "ODONTHO_MANUAL_ENTRY_V1",
    entryMode: "MANUAL_ENTRY",
    notOfficialSvbFile: true,
    officialRulesVerified: false,
    externalSubmissionPerformedByApplication: false,
    declaration: {
      id: current.id.toString(),
      number: current.declarationNumber,
      organizationId: current.organizationId.toString(),
      payerId: current.payerId.toString(),
      declarantId: current.declarantIdSnapshot,
      periodStart: current.periodStart?.toISOString().slice(0, 10) ?? null,
      periodEnd: current.periodEnd?.toISOString().slice(0, 10) ?? null,
    },
    unconfirmedFieldSemantics: ["NumberOfTreatments", "Assistance"],
    items,
    totalsByCurrency: [...totals]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([currencyCode, amount]) => ({
        currencyCode,
        amount: amount.toFixed(2),
      })),
  };
}

async function audit(
  tx: Prisma.TransactionClient,
  actor: AuthenticatedRequestContext,
  metadata: RequestSecurityMetadata,
  action: string,
  row: ManualEntryRecord,
  reason?: string,
) {
  await auditService.writeWithinTransaction(tx, {
    organizationId: actor.organizationId,
    actorUserId: actor.userId,
    action,
    entityType: "DECLARATION_MANUAL_ENTRY",
    entityId: row.id,
    entityKey: row.declarationBatchId.toString(),
    ...(reason ? { reason } : {}),
    newValues: {
      state: row.state,
      contentHash: row.contentHash,
      submissionId: row.submissionId?.toString() ?? null,
      receiptDocumentId: row.receiptDocumentId?.toString() ?? null,
      externalSubmittedAt: row.externalSubmittedAt?.toISOString() ?? null,
      resultId: row.result?.id.toString() ?? null,
      resultStatus: row.result?.status ?? null,
      resultDocumentId: row.result?.resultDocumentId.toString() ?? null,
    },
    ...auditTechnicalFields(metadata),
  });
}

export const manualEntryService = {
  async dossier(id: bigint, actor: AuthenticatedRequestContext) {
    return transaction(async (tx) => {
      const current = await batch(tx, id, actor);
      const active = await manualEntryRepository.active(id, tx);
      if (active)
        return {
          content: active.contentSnapshot,
          contentHash: active.contentHash,
          entry: manualEntryResponse(active),
        };
      const content = await packet(tx, current);
      return { content, contentHash: manualHash(content), entry: null };
    });
  },
  async prepare(
    id: bigint,
    input: PrepareManualEntryInput,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    return transaction(async (tx) => {
      const current = await batch(tx, id, actor);
      const previous = await manualEntryRepository.byClaimKey(
        actor.organizationId,
        input.idempotencyKey,
        tx,
      );
      if (previous) {
        if (previous.declarationBatchId !== id)
          conflict(
            "IDEMPOTENCY_KEY_CONFLICT",
            "The key was already used for another declaration",
          );
        return { record: manualEntryResponse(previous), replayed: true };
      }
      assertManualSvbRecordingEnabled();
      if (await manualEntryRepository.active(id, tx))
        conflict(
          "MANUAL_ENTRY_LOCKED",
          "This declaration already has an active manual preparation or submission",
        );
      if (current.submissions.length)
        conflict(
          "DECLARATION_ALREADY_SUBMITTED",
          "A submission already exists for this declaration",
        );
      const content = await packet(tx, current, true);
      const row = await tx.declarationManualEntry.create({
        data: {
          organizationId: actor.organizationId,
          declarationBatchId: id,
          claimKey: input.idempotencyKey,
          contentHash: manualHash(content),
          contentSnapshot: content,
          preparedByUserId: actor.userId,
        },
        select: manualEntrySelect,
      });
      await audit(tx, actor, metadata, "MANUAL_ENTRY_PREPARE", row);
      return { record: manualEntryResponse(row), replayed: false };
    });
  },
  async uncertain(
    id: bigint,
    entryId: bigint,
    reason: string,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    return transaction(async (tx) => {
      await batch(tx, id, actor);
      const row = await manualEntryRepository.find(
        entryId,
        id,
        actor.organizationId,
        tx,
      );
      if (!row)
        throw new AppError(
          404,
          "MANUAL_ENTRY_NOT_FOUND",
          "Manual preparation not found",
        );
      owner(row, actor);
      if (row.state !== "PREPARED")
        conflict(
          "MANUAL_ENTRY_NOT_ALLOWED",
          "Only an active preparation can be marked uncertain",
        );
      const updated = await tx.declarationManualEntry.update({
        where: { id: entryId },
        data: { state: "UNCERTAIN", uncertaintyReason: reason },
        select: manualEntrySelect,
      });
      await audit(
        tx,
        actor,
        metadata,
        "MANUAL_ENTRY_UNCERTAIN",
        updated,
        reason,
      );
      return manualEntryResponse(updated);
    });
  },
  async release(
    id: bigint,
    entryId: bigint,
    input: ReleaseManualEntryInput,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    await visibleBatch(id, actor);
    const proof = input.resolutionDocumentId
      ? await evidence(BigInt(input.resolutionDocumentId), actor)
      : null;
    return transaction(async (tx) => {
      await batch(tx, id, actor);
      const row = await manualEntryRepository.find(
        entryId,
        id,
        actor.organizationId,
        tx,
      );
      if (!row)
        throw new AppError(
          404,
          "MANUAL_ENTRY_NOT_FOUND",
          "Manual preparation not found",
        );
      owner(row, actor);
      if (!["PREPARED", "UNCERTAIN"].includes(row.state))
        conflict(
          "MANUAL_ENTRY_NOT_ALLOWED",
          "A recorded submission cannot be released",
        );
      if (row.state === "UNCERTAIN" && !proof)
        conflict(
          "MANUAL_ENTRY_RESOLUTION_EVIDENCE_REQUIRED",
          "Verify the portal and attach evidence before releasing an uncertain operation",
        );
      const updated = await tx.declarationManualEntry.update({
        where: { id: entryId },
        data: {
          state: "RELEASED",
          releaseReason: input.reason,
          releasedAt: new Date(),
          resolutionDocumentId: proof?.id ?? null,
        },
        select: manualEntrySelect,
      });
      await audit(
        tx,
        actor,
        metadata,
        "MANUAL_ENTRY_RELEASE",
        updated,
        input.reason,
      );
      return manualEntryResponse(updated);
    });
  },
  async record(
    id: bigint,
    input: RecordManualSubmissionInput,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    await visibleBatch(id, actor);
    const submittedAt = externalTime(input.submittedAt);
    const requestHash = manualHash({
      id: id.toString(),
      manualEntryId: input.manualEntryId,
      contentHash: input.expectedContentHash,
      receiptDocumentId: input.receiptDocumentId,
      externalReference: input.externalReference,
      submittedAt: submittedAt.toISOString(),
      reason: input.reason ?? null,
    });
    const confirmed = await manualEntryRepository.byRecordKey(
      actor.organizationId,
      input.idempotencyKey,
    );
    if (confirmed) {
      if (
        confirmed.recordHash !== requestHash ||
        confirmed.declarationBatchId !== id
      )
        conflict(
          "IDEMPOTENCY_KEY_CONFLICT",
          "The key was already used with different content",
        );
      const submission = await prisma.declarationSubmission.findUniqueOrThrow({
        where: { id: confirmed.submissionId! },
        select: declarationSubmissionSelect,
      });
      return {
        record: {
          ...toDeclarationSubmissionResponse(submission),
          manualEntry: manualEntryResponse(confirmed),
        },
        replayed: true,
      };
    }
    assertManualSvbRecordingEnabled();
    const proof = await evidence(BigInt(input.receiptDocumentId), actor);
    return transaction(async (tx) => {
      const current = await batch(tx, id, actor);
      const previous = await manualEntryRepository.byRecordKey(
        actor.organizationId,
        input.idempotencyKey,
        tx,
      );
      if (previous) {
        if (
          previous.recordHash !== requestHash ||
          previous.declarationBatchId !== id
        )
          conflict(
            "IDEMPOTENCY_KEY_CONFLICT",
            "The key was already used with different content",
          );
        const submission = await tx.declarationSubmission.findUniqueOrThrow({
          where: { id: previous.submissionId! },
          select: declarationSubmissionSelect,
        });
        return {
          record: {
            ...toDeclarationSubmissionResponse(submission),
            manualEntry: manualEntryResponse(previous),
          },
          replayed: true,
        };
      }
      assertManualSvbRecordingEnabled();
      const row = await manualEntryRepository.find(
        BigInt(input.manualEntryId),
        id,
        actor.organizationId,
        tx,
      );
      if (!row)
        throw new AppError(
          404,
          "MANUAL_ENTRY_NOT_FOUND",
          "Manual preparation not found",
        );
      owner(row, actor);
      if (
        !["PREPARED", "UNCERTAIN"].includes(row.state) ||
        current.submissions.length
      )
        conflict(
          "DECLARATION_ALREADY_SUBMITTED",
          "This declaration already has a submission",
        );
      if (
        row.contentHash !== input.expectedContentHash ||
        manualHash(await packet(tx, current, true)) !== row.contentHash
      )
        conflict(
          "MANUAL_CONTENT_CHANGED",
          "The frozen manual-entry content changed; resolve the discrepancy before recording",
        );
      const storedProof = await manualEntryRepository.document(
        proof.id,
        actor.organizationId,
        tx,
      );
      if (!storedProof || storedProof.sha256 !== proof.sha256)
        conflict(
          "MANUAL_EVIDENCE_INVALID",
          "Evidence changed before the record was committed",
        );
      const ordinal = await tx.declarationBatch.update({
        where: { id },
        data: { lastSubmissionAttempt: { increment: 1 } },
        select: { lastSubmissionAttempt: true },
      });
      const submission = await tx.declarationSubmission.create({
        data: {
          declarationBatchId: id,
          attemptNumber: ordinal.lastSubmissionAttempt,
          channel: "MANUAL",
          status: "SUBMITTED",
          externalReference: input.externalReference,
          submittedByUserId: actor.userId,
          requestMetadata: {
            workflow: "MANUAL_ENTRY_V1",
            source: "OPERATOR_ATTESTATION",
            contentHash: row.contentHash,
            receiptDocumentId: proof.id.toString(),
            externalSubmittedAt: submittedAt.toISOString(),
            reason: input.reason ?? null,
            applicationTransmittedToSvb: false,
            officialFileFormat: null,
          },
        },
        select: declarationSubmissionSelect,
      });
      const confirmedAt = new Date();
      const updated = await tx.declarationManualEntry.update({
        where: { id: row.id },
        data: {
          state: "RECORDED",
          recordKey: input.idempotencyKey,
          recordHash: requestHash,
          submissionId: submission.id,
          receiptDocumentId: proof.id,
          receiptSha256: proof.sha256,
          externalSubmittedAt: submittedAt,
          confirmedAt,
        },
        select: manualEntrySelect,
      });
      await tx.declarationItem.updateMany({
        where: { declarationBatchId: id },
        data: { lineStatus: "SUBMITTED" },
      });
      await tx.declarationBatch.update({
        where: { id },
        data: {
          status: "SUBMITTED",
          submittedAt: confirmedAt,
          submissionReference: input.externalReference,
        },
      });
      await tx.declarationBatchStatusHistory.create({
        data: {
          declarationBatchId: id,
          oldStatus: current.status,
          newStatus: "SUBMITTED",
          changedByUserId: actor.userId,
          metadata: {
            source: "MANUAL_ENTRY_RECORD",
            submissionId: submission.id.toString(),
            externalSubmittedAt: submittedAt.toISOString(),
          },
        },
      });
      await audit(
        tx,
        actor,
        metadata,
        "MANUAL_ENTRY_RECORD",
        updated,
        input.reason,
      );
      return {
        record: {
          ...toDeclarationSubmissionResponse(submission),
          manualEntry: manualEntryResponse(updated),
        },
        replayed: false,
      };
    });
  },
  async result(
    id: bigint,
    submissionId: bigint,
    input: RecordManualResultInput,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    await visibleBatch(id, actor);
    const proof = await evidence(BigInt(input.resultDocumentId), actor);
    const respondedAt = externalTime(input.respondedAt);
    const lines = input.lines
      .map((l) => ({
        declarationItemId: l.declarationItemId,
        status: l.status,
        responseCode: l.responseCode ?? null,
        responseMessage: l.responseMessage ?? null,
      }))
      .sort((a, b) =>
        BigInt(a.declarationItemId) < BigInt(b.declarationItemId) ? -1 : 1,
      );
    const hash = manualHash({
      id: id.toString(),
      submissionId: submissionId.toString(),
      status: input.status,
      resultDocumentId: input.resultDocumentId,
      externalReference: input.externalReference,
      respondedAt: respondedAt.toISOString(),
      reason: input.reason ?? null,
      lines,
    });
    return transaction(async (tx) => {
      const current = await batch(tx, id, actor);
      const previous = await tx.declarationManualResult.findUnique({
        where: {
          organizationId_idempotencyKey: {
            organizationId: actor.organizationId,
            idempotencyKey: input.idempotencyKey,
          },
        },
      });
      if (previous) {
        if (previous.requestHash !== hash)
          conflict(
            "IDEMPOTENCY_KEY_CONFLICT",
            "The result key was already used with different content",
          );
        const found = await manualEntryRepository.find(
          previous.manualEntryId,
          id,
          actor.organizationId,
          tx,
        );
        if (!found)
          throw new AppError(
            404,
            "MANUAL_ENTRY_NOT_FOUND",
            "Manual preparation not found",
          );
        return { record: manualEntryResponse(found), replayed: true };
      }
      const row = await tx.declarationManualEntry.findFirst({
        where: {
          submissionId,
          declarationBatchId: id,
          organizationId: actor.organizationId,
        },
        select: manualEntrySelect,
      });
      if (!row)
        throw new AppError(
          404,
          "DECLARATION_SUBMISSION_NOT_FOUND",
          "Manual submission not found",
        );
      if (current.status !== "SUBMITTED" || row.result)
        conflict(
          "DECLARATION_SUBMISSION_RESULT_NOT_ALLOWED",
          "A final official result already exists or the declaration is not submitted",
        );
      if (respondedAt < row.externalSubmittedAt!)
        throw new AppError(
          400,
          "INVALID_EXTERNAL_TIMESTAMP",
          "Response time precedes the declared portal entry",
        );
      const expected = new Set(current.items.map((l) => l.id.toString()));
      if (
        lines.length !== expected.size ||
        new Set(lines.map((l) => l.declarationItemId)).size !== expected.size ||
        lines.some((l) => !expected.has(l.declarationItemId))
      ) {
        conflict(
          "MANUAL_RESULT_LINES_MISMATCH",
          "Provide exactly one result for every submitted declaration item",
        );
      }
      const accepted = lines.filter((l) => l.status === "ACCEPTED").length;
      if (
        (input.status === "ACCEPTED" && accepted !== lines.length) ||
        (input.status === "REJECTED" && accepted !== 0) ||
        (input.status === "PARTIALLY_REJECTED" &&
          (accepted === 0 || accepted === lines.length))
      )
        conflict(
          "MANUAL_RESULT_STATUS_MISMATCH",
          "Batch and line outcomes disagree",
        );
      if (
        lines.some(
          (l) =>
            l.status === "REJECTED" && !l.responseCode && !l.responseMessage,
        )
      )
        conflict(
          "MANUAL_RESULT_REJECTION_REASON_REQUIRED",
          "A rejected line needs its external code or explanation",
        );
      const storedProof = await manualEntryRepository.document(
        proof.id,
        actor.organizationId,
        tx,
      );
      if (!storedProof || storedProof.sha256 !== proof.sha256)
        conflict("MANUAL_EVIDENCE_INVALID", "Evidence changed before commit");
      await tx.declarationManualResult.create({
        data: {
          manualEntryId: row.id,
          organizationId: actor.organizationId,
          idempotencyKey: input.idempotencyKey,
          requestHash: hash,
          status: input.status,
          resultDocumentId: proof.id,
          resultSha256: proof.sha256,
          externalReference: input.externalReference,
          reason: input.reason ?? null,
          externalRespondedAt: respondedAt,
          recordedByUserId: actor.userId,
          lineResults: lines,
        },
      });
      const recordedAt = new Date();
      await tx.declarationSubmission.update({
        where: { id: submissionId },
        data: {
          status: input.status,
          respondedAt: recordedAt,
          responseMetadata: {
            workflow: "OFFICIAL_MANUAL_RESULT_V1",
            evidenceDocumentId: proof.id.toString(),
            evidenceSha256: proof.sha256,
            externalRespondedAt: respondedAt.toISOString(),
            externalReference: input.externalReference,
            reason: input.reason ?? null,
            lines,
          },
        },
      });
      for (const line of lines)
        await tx.declarationItem.update({
          where: { id: BigInt(line.declarationItemId) },
          data: {
            lineStatus: line.status,
            responseCode: line.responseCode,
            responseMessage: line.responseMessage,
          },
        });
      await tx.declarationBatch.update({
        where: { id },
        data: {
          status: input.status,
          ...(input.status === "ACCEPTED"
            ? { acceptedAt: recordedAt }
            : { rejectedAt: recordedAt }),
        },
      });
      await tx.declarationBatchStatusHistory.create({
        data: {
          declarationBatchId: id,
          oldStatus: "SUBMITTED",
          newStatus: input.status,
          changedByUserId: actor.userId,
          metadata: {
            source: "OFFICIAL_MANUAL_RESULT",
            submissionId: submissionId.toString(),
            evidenceDocumentId: proof.id.toString(),
          },
        },
      });
      const updated = await manualEntryRepository.find(
        row.id,
        id,
        actor.organizationId,
        tx,
      );
      await audit(
        tx,
        actor,
        metadata,
        "MANUAL_ENTRY_OFFICIAL_RESULT",
        updated!,
        input.reason,
      );
      return { record: manualEntryResponse(updated!), replayed: false };
    });
  },
};
