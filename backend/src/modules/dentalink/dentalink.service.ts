import {
  Prisma,
  type DentalinkImportItem,
  type DentalinkImportRun,
  type DentalinkAccount,
} from "../../generated/prisma/client.js";
import { prisma } from "../../infrastructure/database/prisma.js";
import { isTransactionConflict } from "../../infrastructure/database/transaction-conflict.js";
import { AppError } from "../../shared/errors/app-error.js";
import { parseDateOnly } from "../../shared/utils/date-only.js";
import type {
  AuthenticatedRequestContext,
  RequestSecurityMetadata,
} from "../auth/auth.types.js";
import { auditService, auditTechnicalFields } from "../audit/audit.service.js";
import { patientService } from "../patients/patient.service.js";
import { appointmentService } from "../appointments/appointment.service.js";
import { manualHash } from "../declarations/manual-entry.service.js";
import { getDentalinkAdapter } from "./dentalink.adapter.js";
import { dentalinkRepository as repo } from "./dentalink.repository.js";
import {
  normalizedPageSchema,
  normalizedPatientSchema,
  normalizedAppointmentSchema,
  type PreviewInput,
  type PatientPayload,
} from "./dentalink.schemas.js";
function fail(code: string, message: string): never {
  throw new AppError(409, code, message);
}
const absent = (): never => {
  throw new AppError(
    404,
    "DENTALINK_RESOURCE_NOT_FOUND",
    "Import resource not found",
  );
};
async function transaction<T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  for (let attempt = 0; ; attempt++)
    try {
      return await prisma.$transaction(work, {
        isolationLevel: "Serializable",
        maxWait: 10000,
        timeout: 30000,
      });
    } catch (error) {
      if (
        isTransactionConflict(error) ||
        (error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002")
      ) {
        if (attempt < 2) continue;
        fail(
          "DENTALINK_CONCURRENT_CHANGE",
          "Import data changed; reload before retrying",
        );
      }
      if (error instanceof AppError) throw error;
      throw new AppError(
        500,
        "DENTALINK_IMPORT_FAILED",
        "Import operation failed; no partial local changes were committed",
      );
    }
}
export const accountResponse = (a: DentalinkAccount) => ({
  id: a.id.toString(),
  externalAccountId: a.externalAccountId,
  label: a.label,
  enabled: a.enabled,
  createdAt: a.createdAt.toISOString(),
  updatedAt: a.updatedAt.toISOString(),
});
export const runResponse = (r: DentalinkImportRun) => ({
  id: r.id.toString(),
  accountId: r.accountId.toString(),
  state: r.state,
  from: r.fromAt?.toISOString() ?? null,
  to: r.toAt?.toISOString() ?? null,
  contentHash: r.previewHash,
  sourceMode: String(
    (r.counts as Record<string, unknown>).sourceMode ?? "PREPARED_ADAPTER",
  ),
  realConnectionVerified: false,
  counts: r.counts,
  hasNextPage: r.state === "READING",
  createdByUserId: r.createdByUserId.toString(),
  createdAt: r.createdAt.toISOString(),
  confirmedAt: r.confirmedAt?.toISOString() ?? null,
});
const itemResponse = (i: DentalinkImportItem) => ({
  id: i.id.toString(),
  entityType: i.entityType,
  externalId: i.externalId,
  data: i.payloadJson,
  disposition: i.disposition,
  issueCodes: i.issueCodes,
  patientId: i.patientId?.toString() ?? null,
  appointmentId: i.appointmentId?.toString() ?? null,
});
async function audit(
  tx: Prisma.TransactionClient,
  actor: AuthenticatedRequestContext,
  metadata: RequestSecurityMetadata,
  action: string,
  accountId: bigint,
  values: Prisma.InputJsonObject,
) {
  await auditService.writeWithinTransaction(tx, {
    organizationId: actor.organizationId,
    actorUserId: actor.userId,
    action,
    entityType: "DENTALINK_ACCOUNT",
    entityId: accountId,
    newValues: values,
    ...auditTechnicalFields(metadata),
  });
}
async function scope(
  accountId: bigint,
  actor: AuthenticatedRequestContext,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  return (await repo.account(accountId, actor.organizationId, tx)) ?? absent();
}
async function runScope(
  accountId: bigint,
  id: bigint,
  actor: AuthenticatedRequestContext,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  await scope(accountId, actor, tx);
  return (await repo.run(id, accountId, actor.organizationId, tx)) ?? absent();
}
function normalize(entityType: "PATIENT" | "APPOINTMENT", raw: unknown) {
  const result =
    entityType === "PATIENT"
      ? normalizedPatientSchema.safeParse(raw)
      : normalizedAppointmentSchema.safeParse(raw);
  if (!result.success) return null;
  if (entityType === "PATIENT")
    try {
      const patient = result.data as PatientPayload;
      if (patient.dateOfBirth)
        parseDateOnly(patient.dateOfBirth, "dateOfBirth");
    } catch {
      return null;
    }
  return JSON.parse(JSON.stringify(result.data)) as Prisma.InputJsonObject;
}
async function evaluation(
  tx: Prisma.TransactionClient,
  account: DentalinkAccount,
  item: Pick<DentalinkImportItem, "entityType" | "externalId" | "payloadJson">,
  stagedPatients: Set<string>,
  window: Pick<DentalinkImportRun, "fromAt" | "toAt">,
) {
  const linked = await repo.identity(
    account.id,
    item.entityType,
    item.externalId,
    tx,
  );
  if (linked)
    return {
      disposition: "SKIPPED" as const,
      issueCodes: [] as string[],
      patientId: linked.patientId,
      appointmentId: linked.appointmentId,
    };
  const payload = normalize(item.entityType, item.payloadJson);
  if (!payload)
    return {
      disposition: "ISSUE" as const,
      issueCodes: ["INVALID_NORMALIZED_DATA"],
      patientId: null,
      appointmentId: null,
    };
  const issues: string[] = [];
  if (item.entityType === "PATIENT") {
    const data = normalizedPatientSchema.parse(payload);
    if (await repo.possiblePatient(account.organizationId, data, tx))
      issues.push("POSSIBLE_PATIENT_MATCH");
  } else {
    const data = normalizedAppointmentSchema.parse(payload);
    const start = new Date(data.start);
    if (
      (window.fromAt && start < window.fromAt) ||
      (window.toAt && start >= window.toAt)
    )
      issues.push("OUTSIDE_IMPORT_WINDOW");
    if (data.eligibility !== "NEW_APPOINTMENT")
      issues.push("UNSUPPORTED_SOURCE_STATUS");
    const patient = await repo.identity(
      account.id,
      "PATIENT",
      data.patientExternalId,
      tx,
    );
    if (!patient?.patientId && !stagedPatients.has(data.patientExternalId))
      issues.push("PATIENT_REFERENCE_MISSING");
    const maps = await repo.maps(account.id, tx);
    const provider = maps.find(
        (m) =>
          m.kind === "PROVIDER" && m.externalId === data.providerExternalId,
      ),
      location = maps.find(
        (m) =>
          m.kind === "LOCATION" && m.externalId === data.locationExternalId,
      );
    if (!provider?.providerId) issues.push("PROVIDER_MAPPING_MISSING");
    else if (
      !(await repo.activeTarget(
        tx,
        "PROVIDER",
        provider.providerId,
        account.organizationId,
      ))
    )
      issues.push("PROVIDER_INACTIVE");
    if (!location?.clinicLocationId) issues.push("LOCATION_MAPPING_MISSING");
    else if (
      !(await repo.activeTarget(
        tx,
        "LOCATION",
        location.clinicLocationId,
        account.organizationId,
      ))
    )
      issues.push("LOCATION_INACTIVE");
    if (
      provider?.providerId &&
      (await repo.providerOverlap(
        tx,
        account.organizationId,
        provider.providerId,
        data.start,
        data.end,
      ))
    )
      issues.push("APPOINTMENT_PROVIDER_OVERLAP");
  }
  return {
    disposition: issues.length ? ("ISSUE" as const) : ("READY" as const),
    issueCodes: issues,
    patientId: null,
    appointmentId: null,
  };
}
function counts(items: DentalinkImportItem[], pages: number) {
  return {
    total: items.length,
    ready: items.filter((i) => i.disposition === "READY").length,
    issues: items.filter((i) => i.disposition === "ISSUE").length,
    imported: items.filter((i) => i.disposition === "IMPORTED").length,
    skipped: items.filter((i) => i.disposition === "SKIPPED").length,
    pages,
  };
}
async function previewHash(
  tx: Prisma.TransactionClient,
  run: DentalinkImportRun,
  items: DentalinkImportItem[],
) {
  const maps = await repo.maps(run.accountId, tx);
  return manualHash({
    runId: run.id.toString(),
    accountId: run.accountId.toString(),
    from: run.fromAt?.toISOString() ?? null,
    to: run.toAt?.toISOString() ?? null,
    mappings: maps.map((m) => ({
      kind: m.kind,
      externalId: m.externalId,
      providerId: m.providerId?.toString() ?? null,
      clinicLocationId: m.clinicLocationId?.toString() ?? null,
    })),
    items: items.map((i) => ({
      entityType: i.entityType,
      externalId: i.externalId,
      payloadHash: i.payloadHash,
      disposition: i.disposition,
      issueCodes: i.issueCodes,
    })),
  });
}
export const dentalinkService = {
  async list(
    actor: AuthenticatedRequestContext,
    page: number,
    pageSize: number,
  ) {
    const [rows, total] = await repo.accountPage(
      actor.organizationId,
      page,
      pageSize,
    );
    return {
      data: rows.map(accountResponse),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  },
  async status(id: bigint, actor: AuthenticatedRequestContext) {
    const account = await scope(id, actor);
    const adapter = getDentalinkAdapter();
    return {
      account: accountResponse(account),
      state: !account.enabled
        ? "DISABLED"
        : !adapter
          ? "NOT_CONFIGURED"
          : adapter.kind === "SYNTHETIC"
            ? "SYNTHETIC_QA"
            : "PREPARED_ADAPTER",
      canPreview: account.enabled && !!adapter,
      realConnectionVerified: false,
      mode: "READ_ONLY_IMPORT",
    };
  },
  async create(
    input: { externalAccountId: string; label: string },
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    return transaction(async (tx) => {
      const old = await repo.accountByExternalId(
        tx,
        actor.organizationId,
        input.externalAccountId,
      );
      if (old)
        fail(
          "DENTALINK_ACCOUNT_EXISTS",
          "This external account already exists",
        );
      const a = await repo.createAccount(tx, {
        ...input,
        organizationId: actor.organizationId,
      });
      await audit(tx, actor, metadata, "DENTALINK_ACCOUNT_CREATE", a.id, {
        enabled: false,
      });
      return accountResponse(a);
    });
  },
  async enable(
    id: bigint,
    enabled: boolean,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    return transaction(async (tx) => {
      if (!(await repo.lockAccount(tx, id, actor.organizationId))) absent();
      const a = await repo.setAccountEnabled(tx, id, enabled);
      await audit(tx, actor, metadata, "DENTALINK_ACCOUNT_UPDATE", id, {
        enabled,
      });
      return accountResponse(a);
    });
  },
  async mappings(id: bigint, actor: AuthenticatedRequestContext) {
    await scope(id, actor);
    return (await repo.maps(id)).map((m) => ({
      id: m.id.toString(),
      kind: m.kind,
      externalId: m.externalId,
      localId: (m.providerId ?? m.clinicLocationId)!.toString(),
    }));
  },
  async map(
    id: bigint,
    input: {
      kind: "PROVIDER" | "LOCATION";
      externalId: string;
      localId: string;
    },
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    return transaction(async (tx) => {
      if (!(await repo.lockAccount(tx, id, actor.organizationId))) absent();
      const local = await repo.activeTarget(
        tx,
        input.kind,
        BigInt(input.localId),
        actor.organizationId,
      );
      if (!local)
        throw new AppError(
          404,
          "DENTALINK_MAPPING_TARGET_NOT_FOUND",
          "Active mapping target not found",
        );
      const row = await repo.upsertMapping(
        tx,
        id,
        actor.organizationId,
        input.kind,
        input.externalId,
        local.id,
      );
      await audit(tx, actor, metadata, "DENTALINK_MAPPING_UPDATE", id, {
        kind: input.kind,
        mappingId: row.id.toString(),
      });
      return {
        id: row.id.toString(),
        kind: row.kind,
        externalId: row.externalId,
        localId: local.id.toString(),
      };
    });
  },
  async preview(
    id: bigint,
    input: PreviewInput,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    const result = await transaction(async (tx) => {
      const account =
        (await repo.lockAccount(tx, id, actor.organizationId)) ?? absent();
      const existing = await repo.runByRequestKey(tx, id, input.idempotencyKey);
      if (existing) {
        if (
          (existing.fromAt?.toISOString() ?? null) !==
            (input.from ? new Date(input.from).toISOString() : null) ||
          (existing.toAt?.toISOString() ?? null) !==
            (input.to ? new Date(input.to).toISOString() : null)
        )
          fail(
            "IDEMPOTENCY_KEY_CONFLICT",
            "Preview key already used with another window",
          );
        return { run: existing, replayed: true };
      }
      if (!account.enabled)
        fail(
          "DENTALINK_ACCOUNT_DISABLED",
          "Enable the logical account before preparing an import",
        );
      const adapter = getDentalinkAdapter();
      if (!adapter)
        fail(
          "DENTALINK_NOT_CONFIGURED",
          "Dentalink access and a verified read adapter are not configured",
        );
      const run = await repo.createRun(tx, {
        organizationId: actor.organizationId,
        accountId: id,
        requestKey: input.idempotencyKey,
        fromAt: input.from ? new Date(input.from) : null,
        toAt: input.to ? new Date(input.to) : null,
        createdByUserId: actor.userId,
        counts: { pages: 0, sourceMode: adapter.kind },
      });
      await audit(tx, actor, metadata, "DENTALINK_PREVIEW_CREATE", id, {
        runId: run.id.toString(),
      });
      return { run, replayed: false };
    });
    if (result.replayed)
      return { record: runResponse(result.run), replayed: true };
    return {
      record: await this.readPage(id, result.run.id, actor, metadata),
      replayed: false,
    };
  },
  async readPage(
    accountId: bigint,
    id: bigint,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    const original = await runScope(accountId, id, actor);
    if (original.state !== "READING") return runResponse(original);
    const account = await scope(accountId, actor);
    if (!account.enabled)
      fail("DENTALINK_ACCOUNT_DISABLED", "Import account is disabled");
    const adapter = getDentalinkAdapter();
    if (!adapter)
      fail(
        "DENTALINK_NOT_CONFIGURED",
        "A verified read adapter is not configured",
      );
    let source: unknown;
    try {
      source = await adapter.readPage({
        externalAccountId: account.externalAccountId,
        from: original.fromAt?.toISOString() ?? null,
        to: original.toAt?.toISOString() ?? null,
        cursor: original.cursor,
      });
    } catch {
      throw new AppError(
        503,
        "DENTALINK_READ_FAILED",
        "The source page could not be read; retry without advancing the cursor",
      );
    }
    const parsed = normalizedPageSchema.safeParse(source);
    if (!parsed.success)
      throw new AppError(
        502,
        "DENTALINK_INVALID_PAGE",
        "The adapter returned an invalid normalized page",
      );
    const page = parsed.data;
    if (page.externalAccountId !== account.externalAccountId)
      fail(
        "DENTALINK_SOURCE_ACCOUNT_MISMATCH",
        "Source page belongs to another account",
      );
    if (!page.complete)
      fail(
        "DENTALINK_PAGE_INCOMPLETE",
        "The page is incomplete; the cursor was not advanced",
      );
    if (page.nextCursor !== null && page.nextCursor === original.cursor)
      fail(
        "DENTALINK_CURSOR_NOT_ADVANCING",
        "The adapter must advance its cursor",
      );
    return transaction(async (tx) => {
      const currentAccount =
        (await repo.lockAccount(tx, accountId, actor.organizationId)) ??
        absent();
      const run =
        (await repo.lockRun(tx, id, accountId, actor.organizationId)) ??
        absent();
      if (run.state !== "READING" || run.cursor !== original.cursor)
        fail(
          "DENTALINK_PAGE_CHANGED",
          "Another reader advanced this preview; reload its state",
        );
      if (!currentAccount.enabled)
        fail("DENTALINK_ACCOUNT_DISABLED", "Import account is disabled");
      const before = await repo.items(id, tx);
      const pages = Number((run.counts as Record<string, unknown>).pages ?? 0);
      if (before.length + page.items.length > 1000 || pages >= 50)
        fail(
          "DENTALINK_PREVIEW_LIMIT",
          "Use a smaller source window (1000 rows / 50 pages maximum)",
        );
      for (const row of page.items) {
        const payload = normalize(row.entityType, row.payload);
        const savedPayload = payload ?? {};
        const hash = manualHash(savedPayload);
        const previous = await repo.itemByExternalId(
          tx,
          id,
          row.entityType,
          row.externalId,
        );
        if (previous) {
          if (previous.payloadHash !== hash)
            fail(
              "DENTALINK_SOURCE_CHANGED",
              "A repeated external ID has conflicting page content",
            );
          continue;
        }
        await repo.createItem(tx, {
          organizationId: actor.organizationId,
          accountId,
          runId: id,
          entityType: row.entityType,
          externalId: row.externalId,
          payloadJson: savedPayload,
          payloadHash: hash,
          disposition: payload ? "READY" : "ISSUE",
          issueCodes: payload ? [] : ["INVALID_NORMALIZED_DATA"],
        });
      }
      let items = await repo.items(id, tx);
      if (page.nextCursor === null) {
        const patients = new Set<string>();
        for (const item of items) {
          const result = await evaluation(
            tx,
            currentAccount,
            item,
            patients,
            run,
          );
          if (item.entityType === "PATIENT" && result.disposition === "READY")
            patients.add(item.externalId);
          await repo.updateItem(tx, item.id, result);
        }
        items = await repo.items(id, tx);
      }
      const summary = {
        ...counts(items, pages + 1),
        sourceMode: String(
          (run.counts as Record<string, unknown>).sourceMode ?? adapter.kind,
        ),
      };
      const hash =
        page.nextCursor === null ? await previewHash(tx, run, items) : null;
      const updated = await repo.updateRun(tx, id, {
        cursor: page.nextCursor,
        state: page.nextCursor === null ? "PREVIEW_READY" : "READING",
        previewHash: hash,
        counts: summary,
      });
      await audit(tx, actor, metadata, "DENTALINK_PREVIEW_PAGE", accountId, {
        runId: id.toString(),
        ...summary,
      });
      return runResponse(updated);
    });
  },
  async getRun(
    accountId: bigint,
    id: bigint,
    actor: AuthenticatedRequestContext,
  ) {
    return runResponse(await runScope(accountId, id, actor));
  },
  async listRuns(
    accountId: bigint,
    actor: AuthenticatedRequestContext,
    page: number,
    pageSize: number,
  ) {
    await scope(accountId, actor);
    const [rows, total] = await repo.runPage(
      accountId,
      actor.organizationId,
      page,
      pageSize,
    );
    return {
      data: rows.map(runResponse),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  },
  async listItems(
    accountId: bigint,
    id: bigint,
    actor: AuthenticatedRequestContext,
    page: number,
    pageSize: number,
  ) {
    await runScope(accountId, id, actor);
    const [items, total] = await repo.itemPage(
      id,
      actor.organizationId,
      page,
      pageSize,
    );
    return {
      data: items.map(itemResponse),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  },
  async confirm(
    accountId: bigint,
    id: bigint,
    input: { idempotencyKey: string; expectedContentHash: string },
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    return transaction(async (tx) => {
      const account =
        (await repo.lockAccount(tx, accountId, actor.organizationId)) ??
        absent();
      const run =
        (await repo.lockRun(tx, id, accountId, actor.organizationId)) ??
        absent();
      const requestHash = manualHash({
        runId: id.toString(),
        accountId: accountId.toString(),
        contentHash: input.expectedContentHash,
      });
      const previous = await repo.runByConfirmKey(
        tx,
        accountId,
        input.idempotencyKey,
      );
      if (previous) {
        if (previous.id !== id || previous.confirmHash !== requestHash)
          fail(
            "IDEMPOTENCY_KEY_CONFLICT",
            "Confirmation key already used with other content",
          );
        return { record: runResponse(previous), replayed: true };
      }
      if (run.state !== "PREVIEW_READY")
        fail(
          "DENTALINK_PREVIEW_NOT_READY",
          "Read all pages before confirming, or recover the original confirmation key",
        );
      if (!account.enabled)
        fail("DENTALINK_ACCOUNT_DISABLED", "Import account is disabled");
      const items = await repo.items(id, tx);
      if (
        run.previewHash !== input.expectedContentHash ||
        items.some(
          (item) => manualHash(item.payloadJson) !== item.payloadHash,
        ) ||
        (await previewHash(tx, run, items)) !== run.previewHash
      )
        fail(
          "DENTALINK_PREVIEW_CHANGED",
          "Preview content or mappings changed; prepare another preview",
        );
      for (const item of [...items].sort(
        (a, b) =>
          (a.entityType === "PATIENT" ? 0 : 1) -
          (b.entityType === "PATIENT" ? 0 : 1),
      )) {
        const result = await evaluation(tx, account, item, new Set(), run);
        if (result.disposition !== "READY") {
          await repo.updateItem(tx, item.id, result);
          continue;
        }
        try {
          if (item.entityType === "PATIENT") {
            const data = normalizedPatientSchema.parse(item.payloadJson);
            const patient = await patientService.createWithinTransaction(
              tx,
              data,
              actor,
              metadata,
              true,
            );
            await repo.createIdentity(tx, {
              organizationId: actor.organizationId,
              accountId,
              entityType: "PATIENT",
              externalId: item.externalId,
              patientId: patient.id,
            });
            await repo.updateItem(tx, item.id, {
              disposition: "IMPORTED",
              patientId: patient.id,
              issueCodes: [],
            });
          } else {
            const data = normalizedAppointmentSchema.parse(item.payloadJson);
            const patient = await repo.identity(
              accountId,
              "PATIENT",
              data.patientExternalId,
              tx,
            );
            const maps = await repo.maps(accountId, tx);
            if (!patient?.patientId)
              fail(
                "PATIENT_REFERENCE_MISSING",
                "A source patient could not be imported",
              );
            const provider = maps.find(
                (m) =>
                  m.kind === "PROVIDER" &&
                  m.externalId === data.providerExternalId,
              )!,
              location = maps.find(
                (m) =>
                  m.kind === "LOCATION" &&
                  m.externalId === data.locationExternalId,
              )!;
            const appointment =
              await appointmentService.createWithinTransaction(
                tx,
                {
                  patientId: patient.patientId.toString(),
                  providerId: provider.providerId!.toString(),
                  clinicLocationId: location.clinicLocationId!.toString(),
                  scheduledStart: data.start,
                  scheduledEnd: data.end,
                },
                actor,
                metadata,
                true,
              );
            await repo.createIdentity(tx, {
              organizationId: actor.organizationId,
              accountId,
              entityType: "APPOINTMENT",
              externalId: item.externalId,
              appointmentId: appointment.id,
            });
            await repo.updateItem(tx, item.id, {
              disposition: "IMPORTED",
              appointmentId: appointment.id,
              issueCodes: [],
            });
          }
        } catch (error) {
          if (
            !(error instanceof AppError) ||
            ![
              "PATIENT_DOCUMENT_ALREADY_EXISTS",
              "PATIENT_REFERENCE_MISSING",
              "APPOINTMENT_PROVIDER_OVERLAP",
              "PATIENT_INACTIVE",
              "PROVIDER_INACTIVE",
              "LOCATION_INACTIVE",
              "PROVIDER_NOT_FOUND",
              "LOCATION_NOT_FOUND",
            ].includes(error.code)
          )
            throw error;
          await repo.updateItem(tx, item.id, {
            disposition: "ISSUE",
            issueCodes: [error.code],
          });
        }
      }
      const finalItems = await repo.items(id, tx);
      const summary = {
        ...counts(
          finalItems,
          Number((run.counts as Record<string, unknown>).pages ?? 0),
        ),
        sourceMode: String(
          (run.counts as Record<string, unknown>).sourceMode ??
            "PREPARED_ADAPTER",
        ),
      };
      const updated = await repo.updateRun(tx, id, {
        state: "CONFIRMED",
        confirmKey: input.idempotencyKey,
        confirmHash: requestHash,
        confirmedAt: new Date(),
        counts: summary,
      });
      await audit(tx, actor, metadata, "DENTALINK_IMPORT_CONFIRM", accountId, {
        runId: id.toString(),
        contentHash: run.previewHash,
        ...summary,
      });
      return { record: runResponse(updated), replayed: false };
    });
  },
};
