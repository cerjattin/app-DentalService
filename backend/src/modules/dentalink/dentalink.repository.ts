import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../infrastructure/database/prisma.js";
import { BLOCKING_APPOINTMENT_STATUSES } from "../appointments/appointment-status.js";
type Client = Prisma.TransactionClient | typeof prisma;
export const dentalinkRepository = {
  async accountPage(organizationId: bigint, page: number, pageSize: number) {
    const where = { organizationId };
    return Promise.all([
      prisma.dentalinkAccount.findMany({
        where,
        orderBy: { id: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.dentalinkAccount.count({ where }),
    ]);
  },
  async runPage(
    accountId: bigint,
    organizationId: bigint,
    page: number,
    pageSize: number,
  ) {
    const where = { accountId, organizationId };
    return Promise.all([
      prisma.dentalinkImportRun.findMany({
        where,
        orderBy: { id: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.dentalinkImportRun.count({ where }),
    ]);
  },
  async itemPage(
    runId: bigint,
    organizationId: bigint,
    page: number,
    pageSize: number,
  ) {
    const where = { runId, organizationId };
    return Promise.all([
      prisma.dentalinkImportItem.findMany({
        where,
        orderBy: { id: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.dentalinkImportItem.count({ where }),
    ]);
  },
  accountByExternalId(
    tx: Prisma.TransactionClient,
    organizationId: bigint,
    externalAccountId: string,
  ) {
    return tx.dentalinkAccount.findUnique({
      where: {
        organizationId_externalAccountId: { organizationId, externalAccountId },
      },
    });
  },
  createAccount(
    tx: Prisma.TransactionClient,
    data: Prisma.DentalinkAccountUncheckedCreateInput,
  ) {
    return tx.dentalinkAccount.create({ data });
  },
  setAccountEnabled(
    tx: Prisma.TransactionClient,
    id: bigint,
    enabled: boolean,
  ) {
    return tx.dentalinkAccount.update({ where: { id }, data: { enabled } });
  },
  activeTarget(
    tx: Prisma.TransactionClient,
    kind: "PROVIDER" | "LOCATION",
    id: bigint,
    organizationId: bigint,
  ) {
    const where = { id, organizationId, isActive: true, archivedAt: null };
    return kind === "PROVIDER"
      ? tx.provider.findFirst({ where, select: { id: true } })
      : tx.clinicLocation.findFirst({ where, select: { id: true } });
  },
  providerOverlap(
    tx: Prisma.TransactionClient,
    organizationId: bigint,
    providerId: bigint,
    start: string,
    end: string,
  ) {
    return tx.appointment.findFirst({
      where: {
        organizationId,
        providerId,
        status: { in: BLOCKING_APPOINTMENT_STATUSES },
        scheduledStartAt: { lt: new Date(end) },
        scheduledEndAt: { gt: new Date(start) },
      },
      select: { id: true },
    });
  },
  upsertMapping(
    tx: Prisma.TransactionClient,
    accountId: bigint,
    organizationId: bigint,
    kind: "PROVIDER" | "LOCATION",
    externalId: string,
    localId: bigint,
  ) {
    const fields = {
      providerId: kind === "PROVIDER" ? localId : null,
      clinicLocationId: kind === "LOCATION" ? localId : null,
    };
    return tx.dentalinkMapping.upsert({
      where: { accountId_kind_externalId: { accountId, kind, externalId } },
      create: { accountId, organizationId, kind, externalId, ...fields },
      update: fields,
    });
  },
  runByRequestKey(
    tx: Prisma.TransactionClient,
    accountId: bigint,
    requestKey: string,
  ) {
    return tx.dentalinkImportRun.findUnique({
      where: { accountId_requestKey: { accountId, requestKey } },
    });
  },
  runByConfirmKey(
    tx: Prisma.TransactionClient,
    accountId: bigint,
    confirmKey: string,
  ) {
    return tx.dentalinkImportRun.findUnique({
      where: { accountId_confirmKey: { accountId, confirmKey } },
    });
  },
  createRun(
    tx: Prisma.TransactionClient,
    data: Prisma.DentalinkImportRunUncheckedCreateInput,
  ) {
    return tx.dentalinkImportRun.create({ data });
  },
  updateRun(
    tx: Prisma.TransactionClient,
    id: bigint,
    data: Prisma.DentalinkImportRunUncheckedUpdateInput,
  ) {
    return tx.dentalinkImportRun.update({ where: { id }, data });
  },
  itemByExternalId(
    tx: Prisma.TransactionClient,
    runId: bigint,
    entityType: "PATIENT" | "APPOINTMENT",
    externalId: string,
  ) {
    return tx.dentalinkImportItem.findUnique({
      where: { runId_entityType_externalId: { runId, entityType, externalId } },
    });
  },
  createItem(
    tx: Prisma.TransactionClient,
    data: Prisma.DentalinkImportItemUncheckedCreateInput,
  ) {
    return tx.dentalinkImportItem.create({ data });
  },
  updateItem(
    tx: Prisma.TransactionClient,
    id: bigint,
    data: Prisma.DentalinkImportItemUncheckedUpdateInput,
  ) {
    return tx.dentalinkImportItem.update({ where: { id }, data });
  },
  createIdentity(
    tx: Prisma.TransactionClient,
    data: Prisma.DentalinkExternalIdentityUncheckedCreateInput,
  ) {
    return tx.dentalinkExternalIdentity.create({ data });
  },
  account(id: bigint, organizationId: bigint, tx: Client = prisma) {
    return tx.dentalinkAccount.findFirst({ where: { id, organizationId } });
  },
  run(
    id: bigint,
    accountId: bigint,
    organizationId: bigint,
    tx: Client = prisma,
  ) {
    return tx.dentalinkImportRun.findFirst({
      where: { id, accountId, organizationId },
    });
  },
  async lockAccount(
    tx: Prisma.TransactionClient,
    id: bigint,
    organizationId: bigint,
  ) {
    await tx.$queryRaw`SELECT id FROM dentalink_accounts WHERE id=${id} AND organization_id=${organizationId} FOR UPDATE`;
    return this.account(id, organizationId, tx);
  },
  async lockRun(
    tx: Prisma.TransactionClient,
    id: bigint,
    accountId: bigint,
    organizationId: bigint,
  ) {
    await tx.$queryRaw`SELECT id FROM dentalink_import_runs WHERE id=${id} AND account_id=${accountId} AND organization_id=${organizationId} FOR UPDATE`;
    return this.run(id, accountId, organizationId, tx);
  },
  items(runId: bigint, tx: Client = prisma) {
    return tx.dentalinkImportItem.findMany({
      where: { runId },
      orderBy: [{ entityType: "asc" }, { externalId: "asc" }, { id: "asc" }],
    });
  },
  maps(accountId: bigint, tx: Client = prisma) {
    return tx.dentalinkMapping.findMany({
      where: { accountId },
      orderBy: [{ kind: "asc" }, { externalId: "asc" }],
    });
  },
  identity(
    accountId: bigint,
    entityType: "PATIENT" | "APPOINTMENT",
    externalId: string,
    tx: Client = prisma,
  ) {
    return tx.dentalinkExternalIdentity.findUnique({
      where: {
        accountId_entityType_externalId: { accountId, entityType, externalId },
      },
    });
  },
  possiblePatient(
    organizationId: bigint,
    data: {
      firstName: string;
      lastName: string;
      documentNumber?: string | null | undefined;
    },
    tx: Client,
  ) {
    return tx.patient.findFirst({
      where: {
        organizationId,
        OR: [
          { firstName: data.firstName, lastName: data.lastName },
          ...(data.documentNumber
            ? [{ documentNumber: data.documentNumber }]
            : []),
        ],
      },
      select: { id: true },
    });
  },
};
