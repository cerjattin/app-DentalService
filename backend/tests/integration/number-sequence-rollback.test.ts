import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "../../src/infrastructure/database/prisma.js";

import { numberSequenceService } from "../../src/modules/number-sequences/number-sequence.service.js";

const TEST_YEAR = 65001;
const TEST_PREFIX = "TEST-RB-";

let organizationId: bigint;

describe("NumberSequenceService rollback", () => {
  beforeAll(async () => {
    const organization = await prisma.organization.findFirstOrThrow({
      where: {
        legalName: "Odontho Services B.V.",
        isActive: true,
      },

      select: {
        id: true,
      },
    });

    organizationId = organization.id;

    const existing = await prisma.numberSequence.findUnique({
      where: {
        organizationId_sequenceType_sequenceYear: {
          organizationId,
          sequenceType: "INVOICE",
          sequenceYear: TEST_YEAR,
        },
      },
    });

    if (existing) {
      throw new Error(`Test sequence already exists for year ${TEST_YEAR}.`);
    }

    await prisma.numberSequence.create({
      data: {
        organizationId,
        sequenceType: "INVOICE",
        sequenceYear: TEST_YEAR,
        prefix: TEST_PREFIX,
        currentValue: 0n,
        padding: 6,
      },
    });
  });

  afterAll(async () => {
    await prisma.numberSequence.deleteMany({
      where: {
        organizationId,
        sequenceType: "INVOICE",
        sequenceYear: TEST_YEAR,
        prefix: TEST_PREFIX,
      },
    });

    await prisma.$disconnect();
  });

  it("rolls back the allocated value when the business transaction fails", async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        const allocated = await numberSequenceService.allocateWithinTransaction(
          tx,
          {
            organizationId,
            sequenceType: "INVOICE",
            sequenceYear: TEST_YEAR,
          },
        );

        expect(allocated.value).toBe(1n);

        /*
         * Simula que la creación de
         * Patient / Appointment /
         * Invoice / Declaration falla
         * después de asignar número.
         */
        throw new Error("SIMULATED_BUSINESS_FAILURE");
      }),
    ).rejects.toThrow("SIMULATED_BUSINESS_FAILURE");

    /*
     * El incremento debe haber sido
     * revertido por MySQL.
     */
    const sequence = await prisma.numberSequence.findUniqueOrThrow({
      where: {
        organizationId_sequenceType_sequenceYear: {
          organizationId,
          sequenceType: "INVOICE",
          sequenceYear: TEST_YEAR,
        },
      },

      select: {
        currentValue: true,
      },
    });

    expect(sequence.currentValue).toBe(0n);
  });
});
