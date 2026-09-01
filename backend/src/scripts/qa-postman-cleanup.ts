import "dotenv/config";

import { prisma } from "../infrastructure/database/prisma.js";
import { documentStorage } from "../modules/documents/document.storage.js";

const QA_PREFIX = "QA-POSTMAN";

async function removeDocumentFiles(storageUris: string[]) {
  for (const storageUri of storageUris) {
    try {
      await documentStorage.remove(storageUri);
    } catch (error) {
      console.warn(`Could not remove QA document file: ${storageUri}`, error);
    }
  }
}

async function main() {
  const organizations = await prisma.organization.findMany({
    where: {
      OR: [
        {
          legalName: {
            startsWith: QA_PREFIX,
          },
        },
        {
          declarantId: {
            startsWith: QA_PREFIX,
          },
        },
      ],
    },
    select: {
      id: true,
    },
  });

  const organizationIds = organizations.map((organization) => organization.id);

  if (organizationIds.length === 0) {
    console.log("No QA Postman organizations found.");
    return;
  }

  // Capture document metadata before DB cleanup. Physical files are removed
  // only after the transaction commits, so a failed cleanup never leaves
  // Document rows pointing to files that were already deleted.
  const documentsForRemoval = await prisma.document.findMany({
    where: {
      organizationId: {
        in: organizationIds,
      },
    },
    select: {
      id: true,
      storageUri: true,
    },
  });
  const documentIds = documentsForRemoval.map((document) => document.id);
  const storageUris = documentsForRemoval.map(
    (document) => document.storageUri,
  );

  await prisma.$transaction(async (tx) => {
    const qaUsers = await tx.user.findMany({
      where: {
        organizationId: {
          in: organizationIds,
        },
      },
      select: {
        id: true,
      },
    });
    const qaUserIds = qaUsers.map((user) => user.id);

    const invoices = await tx.invoice.findMany({
      where: {
        organizationId: {
          in: organizationIds,
        },
      },
      select: {
        id: true,
      },
    });
    const invoiceIds = invoices.map((invoice) => invoice.id);

    const invoiceVersions = await tx.invoiceVersion.findMany({
      where: {
        invoiceId: {
          in: invoiceIds,
        },
      },
      select: {
        id: true,
      },
    });
    const invoiceVersionIds = invoiceVersions.map((version) => version.id);

    const appointments = await tx.appointment.findMany({
      where: {
        organizationId: {
          in: organizationIds,
        },
      },
      select: {
        id: true,
      },
    });
    const appointmentIds = appointments.map((appointment) => appointment.id);

    const encounters = await tx.clinicalEncounter.findMany({
      where: {
        appointmentId: {
          in: appointmentIds,
        },
      },
      select: {
        id: true,
      },
    });
    const encounterIds = encounters.map((encounter) => encounter.id);

    const declarationBatches = await tx.declarationBatch.findMany({
      where: {
        organizationId: {
          in: organizationIds,
        },
      },
      select: {
        id: true,
      },
    });
    const declarationBatchIds = declarationBatches.map((batch) => batch.id);

    const authorizations = await tx.svbAuthorization.findMany({
      where: {
        patient: {
          organizationId: {
            in: organizationIds,
          },
        },
      },
      select: {
        id: true,
      },
    });
    const authorizationIds = authorizations.map(
      (authorization) => authorization.id,
    );

    await tx.declarationSubmission.deleteMany({
      where: {
        declarationBatchId: {
          in: declarationBatchIds,
        },
      },
    });
    await tx.declarationExport.deleteMany({
      where: {
        declarationBatchId: {
          in: declarationBatchIds,
        },
      },
    });
    await tx.declarationItem.deleteMany({
      where: {
        declarationBatchId: {
          in: declarationBatchIds,
        },
      },
    });
    await tx.declarationBatchStatusHistory.deleteMany({
      where: {
        declarationBatchId: {
          in: declarationBatchIds,
        },
      },
    });
    await tx.declarationBatch.deleteMany({
      where: {
        id: {
          in: declarationBatchIds,
        },
      },
    });

    await tx.invoiceDocument.deleteMany({
      where: {
        OR: [
          {
            invoiceVersionId: {
              in: invoiceVersionIds,
            },
          },
          {
            documentId: {
              in: documentIds,
            },
          },
        ],
      },
    });
    await tx.signature.deleteMany({
      where: {
        OR: [
          {
            invoiceVersionId: {
              in: invoiceVersionIds,
            },
          },
          {
            signatureDocumentId: {
              in: documentIds,
            },
          },
        ],
      },
    });
    await tx.invoiceCorrection.deleteMany({
      where: {
        invoiceId: {
          in: invoiceIds,
        },
      },
    });
    await tx.invoiceStatusHistory.deleteMany({
      where: {
        invoiceId: {
          in: invoiceIds,
        },
      },
    });
    // Break InvoiceItem self-reference before deleting the QA invoice items.
    // Correction-version items point to source items through
    // sourceInvoiceItemId with ON DELETE RESTRICT.
    // The column is nullable and all affected rows are about to be deleted,
    // so nulling only the QA graph is the FK-safe cleanup strategy.
    await tx.invoiceItem.updateMany({
      where: {
        invoiceVersionId: {
          in: invoiceVersionIds,
        },
        sourceInvoiceItemId: {
          not: null,
        },
      },
      data: {
        sourceInvoiceItemId: null,
      },
    });

    await tx.invoiceItem.deleteMany({
      where: {
        invoiceVersionId: {
          in: invoiceVersionIds,
        },
      },
    });
    await tx.invoice.updateMany({
      where: {
        id: {
          in: invoiceIds,
        },
      },
      data: {
        currentVersionId: null,
      },
    });
    // Break InvoiceVersion self-reference before deleting QA versions.
    // Correction versions point to the version they supersede through
    // supersedesVersionId with ON DELETE RESTRICT.
    // The field is nullable and all affected QA versions are deleted
    // immediately afterwards.
    await tx.invoiceVersion.updateMany({
      where: {
        id: {
          in: invoiceVersionIds,
        },
        supersedesVersionId: {
          not: null,
        },
      },
      data: {
        supersedesVersionId: null,
      },
    });

    await tx.invoiceVersion.deleteMany({
      where: {
        id: {
          in: invoiceVersionIds,
        },
      },
    });
    await tx.invoice.deleteMany({
      where: {
        id: {
          in: invoiceIds,
        },
      },
    });

    await tx.encounterProcedure.deleteMany({
      where: {
        encounterId: {
          in: encounterIds,
        },
      },
    });
    await tx.encounterDiagnosis.deleteMany({
      where: {
        encounterId: {
          in: encounterIds,
        },
      },
    });
    await tx.clinicalEncounter.deleteMany({
      where: {
        id: {
          in: encounterIds,
        },
      },
    });
    await tx.appointmentStatusHistory.deleteMany({
      where: {
        appointmentId: {
          in: appointmentIds,
        },
      },
    });
    await tx.appointment.deleteMany({
      where: {
        id: {
          in: appointmentIds,
        },
      },
    });

    // Appointments may reference these; delete them only after appointments.
    await tx.accidentCase.deleteMany({
      where: {
        patient: {
          organizationId: {
            in: organizationIds,
          },
        },
      },
    });
    await tx.treatmentCase.deleteMany({
      where: {
        organizationId: {
          in: organizationIds,
        },
      },
    });

    await tx.svbAuthorizationItem.deleteMany({
      where: {
        authorizationId: {
          in: authorizationIds,
        },
      },
    });
    await tx.svbAuthorization.deleteMany({
      where: {
        id: {
          in: authorizationIds,
        },
      },
    });
    await tx.patientInsurance.deleteMany({
      where: {
        patient: {
          organizationId: {
            in: organizationIds,
          },
        },
      },
    });
    await tx.provider.deleteMany({
      where: {
        organizationId: {
          in: organizationIds,
        },
      },
    });
    await tx.clinicLocation.deleteMany({
      where: {
        organizationId: {
          in: organizationIds,
        },
      },
    });
    await tx.patient.deleteMany({
      where: {
        organizationId: {
          in: organizationIds,
        },
      },
    });

    // User has multiple ON DELETE RESTRICT dependencies.
    // Remove all remaining organization-owned user references BEFORE users.

    await tx.systemSetting.deleteMany({
      where: {
        organizationId: {
          in: organizationIds,
        },
      },
    });

    // AuditLog.actorUserId -> User is the FK that caused P2003.
    await tx.auditLog.deleteMany({
      where: {
        organizationId: {
          in: organizationIds,
        },
      },
    });

    // Document.createdByUserId -> User. InvoiceDocument, Signature and
    // DeclarationExport references were already removed above.
    await tx.document.deleteMany({
      where: {
        id: {
          in: documentIds,
        },
      },
    });

    if (qaUserIds.length > 0) {
      // UserRole can reference a QA user either as userId or assignedByUserId.
      await tx.userRole.deleteMany({
        where: {
          OR: [
            {
              userId: {
                in: qaUserIds,
              },
            },
            {
              assignedByUserId: {
                in: qaUserIds,
              },
            },
          ],
        },
      });

      await tx.user.deleteMany({
        where: {
          id: {
            in: qaUserIds,
          },
        },
      });
    }
    await tx.numberSequence.deleteMany({
      where: {
        organizationId: {
          in: organizationIds,
        },
      },
    });
    await tx.organization.deleteMany({
      where: {
        id: {
          in: organizationIds,
        },
      },
    });

    await tx.svbTariff.deleteMany({
      where: {
        svbProcedure: {
          code: {
            startsWith: "QA-",
          },
        },
      },
    });
    await tx.svbProcedure.deleteMany({
      where: {
        code: {
          startsWith: "QA-",
        },
      },
    });
    await tx.diagnosisCode.deleteMany({
      where: {
        codeSystem: "QA-POSTMAN",
      },
    });
    await tx.payer.deleteMany({
      where: {
        code: "QA-POSTMAN-SVB",
      },
    });
  });

  // Remove QA files only after the DB transaction committed successfully.
  await removeDocumentFiles(storageUris);

  console.log(`Removed ${organizationIds.length} QA Postman organization(s).`);
}

main()
  .catch((error) => {
    console.error("QA Postman cleanup failed");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
