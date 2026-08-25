import type { Prisma } from "../../generated/prisma/client.js";

import { prisma } from "../../infrastructure/database/prisma.js";

import { auditService, auditTechnicalFields } from "../audit/audit.service.js";

import type {
  AuthenticatedRequestContext,
  RequestSecurityMetadata,
} from "../auth/auth.types.js";

import { numberSequenceService } from "../number-sequences/number-sequence.service.js";

import { AppError } from "../../shared/errors/app-error.js";

import { parseDateOnly } from "../../shared/utils/date-only.js";

import {
  patientDetailSelect,
  patientRepository,
} from "./patient.repository.js";

import { toPatientResponse } from "./patient.types.js";

import type {
  ArchivePatientInput,
  CreatePatientInput,
  ListPatientsQuery,
  UpdatePatientInput,
} from "./patient.schemas.js";

export class PatientService {
  async create(
    input: CreatePatientInput,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    if (input.documentType && input.documentNumber) {
      const existing = await patientRepository.findByDocument(
        actor.organizationId,
        input.documentType,
        input.documentNumber,
      );

      if (existing) {
        throw new AppError(
          409,
          "PATIENT_DOCUMENT_ALREADY_EXISTS",
          "A patient with this document already exists",
        );
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      const allocatedNumber =
        await numberSequenceService.allocateWithinTransaction(tx, {
          organizationId: actor.organizationId,

          sequenceType: "PATIENT",
        });

      const patient = await tx.patient.create({
        data: {
          organizationId: actor.organizationId,

          patientNumber: allocatedNumber.formatted,

          firstName: input.firstName.trim(),

          lastName: input.lastName.trim(),

          ...(input.middleName !== undefined
            ? {
                middleName: input.middleName,
              }
            : {}),

          ...(input.secondLastName !== undefined
            ? {
                secondLastName: input.secondLastName,
              }
            : {}),

          ...(input.dateOfBirth !== undefined
            ? {
                dateOfBirth:
                  input.dateOfBirth === null
                    ? null
                    : parseDateOnly(input.dateOfBirth, "dateOfBirth"),
              }
            : {}),

          ...(input.sex !== undefined
            ? {
                sex: input.sex,
              }
            : {}),

          ...(input.documentType !== undefined
            ? {
                documentType: input.documentType,
              }
            : {}),

          ...(input.documentNumber !== undefined
            ? {
                documentNumber: input.documentNumber,
              }
            : {}),

          ...(input.email !== undefined
            ? {
                email: input.email,
              }
            : {}),

          ...(input.phone !== undefined
            ? {
                phone: input.phone,
              }
            : {}),

          ...(input.mobilePhone !== undefined
            ? {
                mobilePhone: input.mobilePhone,
              }
            : {}),

          ...(input.addressLine1 !== undefined
            ? {
                addressLine1: input.addressLine1,
              }
            : {}),

          ...(input.addressLine2 !== undefined
            ? {
                addressLine2: input.addressLine2,
              }
            : {}),

          ...(input.city !== undefined
            ? {
                city: input.city,
              }
            : {}),

          ...(input.countryCode !== undefined
            ? {
                countryCode: input.countryCode,
              }
            : {}),
        },

        select: patientDetailSelect,
      });

      await auditService.writeWithinTransaction(tx, {
        organizationId: actor.organizationId,

        actorUserId: actor.userId,

        action: "PATIENT_CREATE",

        entityType: "PATIENT",

        entityId: patient.id,

        entityKey: patient.patientNumber,

        newValues: {
          patientNumber: patient.patientNumber,

          firstName: patient.firstName,

          lastName: patient.lastName,

          documentType: patient.documentType,

          documentNumber: patient.documentNumber,
        },

        ...auditTechnicalFields(metadata),
      });

      return patient;
    });

    return toPatientResponse(created);
  }

  async getById(patientId: bigint, actor: AuthenticatedRequestContext) {
    const patient = await patientRepository.findById(
      patientId,
      actor.organizationId,
    );

    if (!patient) {
      throw new AppError(404, "PATIENT_NOT_FOUND", "Patient not found");
    }

    return toPatientResponse(patient);
  }

  async list(query: ListPatientsQuery, actor: AuthenticatedRequestContext) {
    const skip = (query.page - 1) * query.pageSize;

    const numericId =
      query.q !== undefined && /^[1-9]\d*$/.test(query.q)
        ? BigInt(query.q)
        : undefined;

    const where: Prisma.PatientWhereInput = {
      organizationId: actor.organizationId,

      ...(query.status !== undefined
        ? {
            status: query.status,
          }
        : {}),

      ...(query.q !== undefined
        ? {
            OR: [
              ...(numericId !== undefined
                ? [
                    {
                      id: numericId,
                    },
                  ]
                : []),

              {
                patientNumber: {
                  contains: query.q,
                },
              },

              {
                firstName: {
                  contains: query.q,
                },
              },

              {
                middleName: {
                  contains: query.q,
                },
              },

              {
                lastName: {
                  contains: query.q,
                },
              },

              {
                secondLastName: {
                  contains: query.q,
                },
              },

              {
                documentNumber: {
                  contains: query.q,
                },
              },

              {
                phone: {
                  contains: query.q,
                },
              },

              {
                mobilePhone: {
                  contains: query.q,
                },
              },

              {
                insuranceCoverages: {
                  some: {
                    insuredId: {
                      contains: query.q,
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.patient.findMany({
        where,

        select: patientDetailSelect,

        orderBy: [
          {
            lastName: "asc",
          },
          {
            firstName: "asc",
          },
        ],

        skip,

        take: query.pageSize,
      }),

      prisma.patient.count({
        where,
      }),
    ]);

    return {
      patients: rows.map(toPatientResponse),

      pagination: {
        page: query.page,

        pageSize: query.pageSize,

        total,

        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async update(
    patientId: bigint,
    input: UpdatePatientInput,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    const current = await patientRepository.findById(
      patientId,
      actor.organizationId,
    );

    if (!current) {
      throw new AppError(404, "PATIENT_NOT_FOUND", "Patient not found");
    }

    /*
     * Para validar correctamente la combinación
     * documento tipo + número, usamos el valor
     * nuevo si viene en el PATCH, o el actual
     * si no viene.
     */
    const resultingDocumentType =
      input.documentType !== undefined
        ? input.documentType
        : current.documentType;

    const resultingDocumentNumber =
      input.documentNumber !== undefined
        ? input.documentNumber
        : current.documentNumber;

    if (resultingDocumentType && resultingDocumentNumber) {
      const existing = await patientRepository.findByDocument(
        actor.organizationId,
        resultingDocumentType,
        resultingDocumentNumber,
      );

      if (existing && existing.id !== patientId) {
        throw new AppError(
          409,
          "PATIENT_DOCUMENT_ALREADY_EXISTS",
          "A patient with this document already exists",
        );
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.patient.update({
        where: {
          id: patientId,
        },

        data: {
          ...(input.firstName !== undefined
            ? {
                firstName: input.firstName.trim(),
              }
            : {}),

          ...(input.middleName !== undefined
            ? {
                middleName: input.middleName,
              }
            : {}),

          ...(input.lastName !== undefined
            ? {
                lastName: input.lastName.trim(),
              }
            : {}),

          ...(input.secondLastName !== undefined
            ? {
                secondLastName: input.secondLastName,
              }
            : {}),

          ...(input.dateOfBirth !== undefined
            ? {
                dateOfBirth:
                  input.dateOfBirth === null
                    ? null
                    : parseDateOnly(input.dateOfBirth, "dateOfBirth"),
              }
            : {}),

          ...(input.sex !== undefined
            ? {
                sex: input.sex,
              }
            : {}),

          ...(input.documentType !== undefined
            ? {
                documentType: input.documentType,
              }
            : {}),

          ...(input.documentNumber !== undefined
            ? {
                documentNumber: input.documentNumber,
              }
            : {}),

          ...(input.email !== undefined
            ? {
                email: input.email,
              }
            : {}),

          ...(input.phone !== undefined
            ? {
                phone: input.phone,
              }
            : {}),

          ...(input.mobilePhone !== undefined
            ? {
                mobilePhone: input.mobilePhone,
              }
            : {}),

          ...(input.addressLine1 !== undefined
            ? {
                addressLine1: input.addressLine1,
              }
            : {}),

          ...(input.addressLine2 !== undefined
            ? {
                addressLine2: input.addressLine2,
              }
            : {}),

          ...(input.city !== undefined
            ? {
                city: input.city,
              }
            : {}),

          ...(input.countryCode !== undefined
            ? {
                countryCode: input.countryCode,
              }
            : {}),
        },

        select: patientDetailSelect,
      });

      await auditService.writeWithinTransaction(tx, {
        organizationId: actor.organizationId,

        actorUserId: actor.userId,

        action: "PATIENT_UPDATE",

        entityType: "PATIENT",

        entityId: patientId,

        entityKey: current.patientNumber,

        oldValues: {
          firstName: current.firstName,

          middleName: current.middleName,

          lastName: current.lastName,

          secondLastName: current.secondLastName,

          documentType: current.documentType,

          documentNumber: current.documentNumber,

          email: current.email,

          phone: current.phone,

          mobilePhone: current.mobilePhone,
        },

        newValues: {
          firstName: result.firstName,

          middleName: result.middleName,

          lastName: result.lastName,

          secondLastName: result.secondLastName,

          documentType: result.documentType,

          documentNumber: result.documentNumber,

          email: result.email,

          phone: result.phone,

          mobilePhone: result.mobilePhone,
        },

        ...auditTechnicalFields(metadata),
      });

      return result;
    });

    return toPatientResponse(updated);
  }

  async archive(
    patientId: bigint,
    input: ArchivePatientInput,
    actor: AuthenticatedRequestContext,
    metadata: RequestSecurityMetadata,
  ) {
    const current = await patientRepository.findById(
      patientId,
      actor.organizationId,
    );

    if (!current) {
      throw new AppError(404, "PATIENT_NOT_FOUND", "Patient not found");
    }

    if (current.status === "ARCHIVED") {
      throw new AppError(
        409,
        "PATIENT_ALREADY_ARCHIVED",
        "Patient is already archived",
      );
    }

    const archived = await prisma.$transaction(async (tx) => {
      const patient = await tx.patient.update({
        where: {
          id: patientId,
        },

        data: {
          status: "ARCHIVED",

          archivedAt: new Date(),
        },

        select: patientDetailSelect,
      });

      await auditService.writeWithinTransaction(tx, {
        organizationId: actor.organizationId,

        actorUserId: actor.userId,

        action: "PATIENT_ARCHIVE",

        entityType: "PATIENT",

        entityId: patientId,

        entityKey: patient.patientNumber,

        reason: input.reason,

        oldValues: {
          status: current.status,

          archivedAt: current.archivedAt?.toISOString() ?? null,
        },

        newValues: {
          status: patient.status,

          archivedAt: patient.archivedAt?.toISOString() ?? null,
        },

        ...auditTechnicalFields(metadata),
      });

      return patient;
    });

    return toPatientResponse(archived);
  }
}

export const patientService = new PatientService();
