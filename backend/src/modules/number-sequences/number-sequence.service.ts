import type { Prisma } from "../../generated/prisma/client.js";

import { AppError } from "../../shared/errors/app-error.js";

import { formatBusinessNumber } from "./number-sequence.formatter.js";

import { getDefaultSequenceYear } from "./number-sequence-year.js";

import type {
  AllocateNumberInput,
  AllocatedBusinessNumber,
} from "./number-sequence.types.js";

export class NumberSequenceService {
  async allocateWithinTransaction(
    tx: Prisma.TransactionClient,
    input: AllocateNumberInput,
  ): Promise<AllocatedBusinessNumber> {
    const sequenceYear =
      input.sequenceYear ?? getDefaultSequenceYear(input.sequenceType);

    /*
     * El UPDATE es intencional.
     *
     * InnoDB bloqueará la fila durante la
     * transacción, evitando que dos
     * transacciones obtengan el mismo número.
     */
    const updateResult = await tx.numberSequence.updateMany({
      where: {
        organizationId: input.organizationId,

        sequenceType: input.sequenceType,

        sequenceYear,
      },

      data: {
        currentValue: {
          increment: 1n,
        },
      },
    });

    if (updateResult.count !== 1) {
      throw new AppError(
        500,
        "NUMBER_SEQUENCE_NOT_CONFIGURED",
        "Number sequence is not configured",
        {
          organizationId: input.organizationId.toString(),

          sequenceType: input.sequenceType,

          sequenceYear,
        },
      );
    }

    const sequence = await tx.numberSequence.findUnique({
      where: {
        organizationId_sequenceType_sequenceYear: {
          organizationId: input.organizationId,

          sequenceType: input.sequenceType,

          sequenceYear,
        },
      },

      select: {
        organizationId: true,
        sequenceType: true,
        sequenceYear: true,
        prefix: true,
        currentValue: true,
        padding: true,
      },
    });

    if (!sequence) {
      throw new AppError(
        500,
        "NUMBER_SEQUENCE_READ_FAILED",
        "Number sequence could not be read after allocation",
      );
    }

    const formatted = formatBusinessNumber(
      sequence.prefix,
      sequence.currentValue,
      sequence.padding,
    );

    return {
      organizationId: sequence.organizationId,

      sequenceType: sequence.sequenceType,

      sequenceYear: sequence.sequenceYear,

      value: sequence.currentValue,

      prefix: sequence.prefix,

      padding: sequence.padding,

      formatted,
    };
  }
}

export const numberSequenceService = new NumberSequenceService();
