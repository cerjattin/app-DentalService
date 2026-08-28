import type { Prisma } from "../../generated/prisma/client.js";

import type {
  InvoiceItemRecord,
  InvoiceRecord,
  InvoiceStatusHistoryRecord,
  InvoiceVersionRecord,
} from "./invoice.repository.js";

function decimalString(value: Prisma.Decimal) {
  return value.toFixed(2);
}

function dateOnly(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? null;
}

export function toInvoiceItemResponse(item: InvoiceItemRecord) {
  return {
    id: item.id.toString(),
    invoiceVersionId: item.invoiceVersionId.toString(),
    lineNumber: item.lineNumber,
    detailInvoiceNumber: item.detailInvoiceNumber,
    encounterProcedureId: item.encounterProcedureId.toString(),
    sourceInvoiceItemId: item.sourceInvoiceItemId?.toString() ?? null,
    svbProcedureId: item.svbProcedureId.toString(),
    svbTariffId: item.svbTariffId.toString(),
    serviceDateSnapshot: dateOnly(item.serviceDateSnapshot),
    procedureCodeSnapshot: item.procedureCodeSnapshot,
    procedureDescriptionSnapshot: item.procedureDescriptionSnapshot,
    providerIdSnapshot: item.providerIdSnapshot,
    insuredIdSnapshot: item.insuredIdSnapshot,
    unitTariffSnapshot: decimalString(item.unitTariffSnapshot),
    currencyCodeSnapshot: item.currencyCodeSnapshot,
    quantity: decimalString(item.quantity),
    amount: decimalString(item.amount),
    authorizationIdSnapshot: item.authorizationIdSnapshot,
    diagnosticCodeSnapshot: item.diagnosticCodeSnapshot,
    treatmentIdSnapshot: item.treatmentIdSnapshot,
    accidentFormNumberSnapshot: item.accidentFormNumberSnapshot,
    numberOfTreatmentsSnapshot: item.numberOfTreatmentsSnapshot,
    assistanceSnapshot: item.assistanceSnapshot,
    referrerIdSnapshot: item.referrerIdSnapshot,
    policlinicSnapshot: item.policlinicSnapshot,
    additionalNote: item.additionalNote,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export function toInvoiceVersionResponse(version: InvoiceVersionRecord) {
  return {
    id: version.id.toString(),
    invoiceId: version.invoiceId.toString(),
    versionNumber: version.versionNumber,
    versionType: version.versionType,
    supersedesVersionId: version.supersedesVersionId?.toString() ?? null,
    status: version.status,
    invoiceDate: dateOnly(version.invoiceDate),
    currencyCode: version.currencyCode,
    totalAmount: decimalString(version.totalAmount),
    declarantIdSnapshot: version.declarantIdSnapshot,
    patientNameSnapshot: version.patientNameSnapshot,
    patientDocumentTypeSnapshot: version.patientDocumentTypeSnapshot,
    patientDocumentNumberSnapshot: version.patientDocumentNumberSnapshot,
    insuredIdSnapshot: version.insuredIdSnapshot,
    contentHash: version.contentHash,
    preparedByUserId: version.preparedByUserId.toString(),
    lockedAt: version.lockedAt?.toISOString() ?? null,
    signedAt: version.signedAt?.toISOString() ?? null,
    closedAt: version.closedAt?.toISOString() ?? null,
    supersededAt: version.supersededAt?.toISOString() ?? null,
    createdAt: version.createdAt.toISOString(),
    updatedAt: version.updatedAt.toISOString(),
    items: version.items.map(toInvoiceItemResponse),
  };
}

export function toInvoiceResponse(invoice: InvoiceRecord) {
  return {
    id: invoice.id.toString(),
    organizationId: invoice.organizationId.toString(),
    appointmentId: invoice.appointmentId.toString(),
    patientId: invoice.patientId.toString(),
    patientInsuranceId: invoice.patientInsuranceId.toString(),
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    currentVersionId: invoice.currentVersionId?.toString() ?? null,
    createdByUserId: invoice.createdByUserId.toString(),
    cancelledByUserId: invoice.cancelledByUserId?.toString() ?? null,
    cancelledAt: invoice.cancelledAt?.toISOString() ?? null,
    cancellationReason: invoice.cancellationReason,
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
    appointment: {
      id: invoice.appointment.id.toString(),
      appointmentNumber: invoice.appointment.appointmentNumber,
      scheduledStartAt: invoice.appointment.scheduledStartAt.toISOString(),
      scheduledEndAt: invoice.appointment.scheduledEndAt.toISOString(),
      status: invoice.appointment.status,
    },
    patient: {
      id: invoice.patient.id.toString(),
      patientNumber: invoice.patient.patientNumber,
      firstName: invoice.patient.firstName,
      middleName: invoice.patient.middleName,
      lastName: invoice.patient.lastName,
      secondLastName: invoice.patient.secondLastName,
      documentType: invoice.patient.documentType,
      documentNumber: invoice.patient.documentNumber,
    },
    patientInsurance: {
      id: invoice.patientInsurance.id.toString(),
      insuredId: invoice.patientInsurance.insuredId,
      status: invoice.patientInsurance.status,
      payer: {
        id: invoice.patientInsurance.payer.id.toString(),
        code: invoice.patientInsurance.payer.code,
        name: invoice.patientInsurance.payer.name,
      },
    },
    currentVersion:
      invoice.currentVersion === null
        ? null
        : toInvoiceVersionResponse(invoice.currentVersion),
    versions: invoice.versions.map((version) => ({
      id: version.id.toString(),
      versionNumber: version.versionNumber,
      versionType: version.versionType,
      status: version.status,
      totalAmount: decimalString(version.totalAmount),
      createdAt: version.createdAt.toISOString(),
    })),
  };
}

export function toInvoiceStatusHistoryResponse(
  row: InvoiceStatusHistoryRecord,
) {
  return {
    id: row.id.toString(),
    invoiceId: row.invoiceId.toString(),
    invoiceVersionId: row.invoiceVersionId?.toString() ?? null,
    oldStatus: row.oldStatus,
    newStatus: row.newStatus,
    reason: row.reason,
    changedByUserId: row.changedByUserId.toString(),
    changedAt: row.changedAt.toISOString(),
    metadata: row.metadata,
  };
}
