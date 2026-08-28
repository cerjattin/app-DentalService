import type { Prisma } from "../../generated/prisma/client.js";

import { prisma } from "../../infrastructure/database/prisma.js";

export const invoiceItemSelect = {
  id: true,
  invoiceVersionId: true,
  lineNumber: true,
  detailInvoiceNumber: true,
  encounterProcedureId: true,
  sourceInvoiceItemId: true,
  svbProcedureId: true,
  svbTariffId: true,
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
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.InvoiceItemSelect;

export const invoiceVersionSelect = {
  id: true,
  invoiceId: true,
  versionNumber: true,
  versionType: true,
  supersedesVersionId: true,
  status: true,
  invoiceDate: true,
  currencyCode: true,
  totalAmount: true,
  declarantIdSnapshot: true,
  patientNameSnapshot: true,
  patientDocumentTypeSnapshot: true,
  patientDocumentNumberSnapshot: true,
  insuredIdSnapshot: true,
  contentHash: true,
  preparedByUserId: true,
  lockedAt: true,
  signedAt: true,
  closedAt: true,
  supersededAt: true,
  createdAt: true,
  updatedAt: true,
  items: {
    select: invoiceItemSelect,
    orderBy: {
      lineNumber: "asc",
    },
  },
} satisfies Prisma.InvoiceVersionSelect;

export const invoiceSelect = {
  id: true,
  organizationId: true,
  appointmentId: true,
  patientId: true,
  patientInsuranceId: true,
  invoiceNumber: true,
  status: true,
  currentVersionId: true,
  createdByUserId: true,
  cancelledByUserId: true,
  cancelledAt: true,
  cancellationReason: true,
  createdAt: true,
  updatedAt: true,
  appointment: {
    select: {
      id: true,
      appointmentNumber: true,
      scheduledStartAt: true,
      scheduledEndAt: true,
      status: true,
    },
  },
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
  patientInsurance: {
    select: {
      id: true,
      insuredId: true,
      status: true,
      payer: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
    },
  },
  currentVersion: {
    select: invoiceVersionSelect,
  },
  versions: {
    select: {
      id: true,
      versionNumber: true,
      versionType: true,
      status: true,
      totalAmount: true,
      createdAt: true,
    },
    orderBy: {
      versionNumber: "asc",
    },
  },
} satisfies Prisma.InvoiceSelect;

export const invoiceStatusHistorySelect = {
  id: true,
  invoiceId: true,
  invoiceVersionId: true,
  oldStatus: true,
  newStatus: true,
  reason: true,
  changedByUserId: true,
  changedAt: true,
  metadata: true,
} satisfies Prisma.InvoiceStatusHistorySelect;

export type InvoiceRecord = Prisma.InvoiceGetPayload<{
  select: typeof invoiceSelect;
}>;
export type InvoiceVersionRecord = Prisma.InvoiceVersionGetPayload<{
  select: typeof invoiceVersionSelect;
}>;
export type InvoiceItemRecord = Prisma.InvoiceItemGetPayload<{
  select: typeof invoiceItemSelect;
}>;
export type InvoiceStatusHistoryRecord =
  Prisma.InvoiceStatusHistoryGetPayload<{
    select: typeof invoiceStatusHistorySelect;
  }>;

export class InvoiceRepository {
  findById(
    invoiceId: bigint,
    organizationId: bigint,
    client: Prisma.TransactionClient | typeof prisma = prisma,
  ) {
    return client.invoice.findFirst({
      where: {
        id: invoiceId,
        organizationId,
      },
      select: invoiceSelect,
    });
  }

  findByAppointmentId(
    appointmentId: bigint,
    organizationId: bigint,
    client: Prisma.TransactionClient | typeof prisma = prisma,
  ) {
    return client.invoice.findFirst({
      where: {
        appointmentId,
        organizationId,
      },
      select: invoiceSelect,
    });
  }
}

export const invoiceRepository = new InvoiceRepository();
