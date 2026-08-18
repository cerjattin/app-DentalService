import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "../../src/infrastructure/database/prisma.js";

import { numberSequenceService } from "../../src/modules/number-sequences/number-sequence.service.js";

const TEST_YEAR = 65000;
const TEST_PREFIX = "TEST-INV-";
const CONCURRENT_REQUESTS = 50;

let organizationId: bigint;

describe("NumberSequenceService concurrency", () => {
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

    /*
     * Seguridad:
     * no sobrescribimos una secuencia preexistente.
     */
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
      throw new Error(
        `Test sequence already exists for year ${TEST_YEAR}. Refusing to overwrite it.`,
      );
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

  it("allocates 50 unique contiguous numbers under concurrency", async () => {
    const results = await Promise.all(
      Array.from(
        {
          length: CONCURRENT_REQUESTS,
        },

        () =>
          prisma.$transaction(async (tx) => {
            return numberSequenceService.allocateWithinTransaction(tx, {
              organizationId,
              sequenceType: "INVOICE",
              sequenceYear: TEST_YEAR,
            });
          }),
      ),
    );

    expect(results).toHaveLength(CONCURRENT_REQUESTS);

    const values = results.map((result) => result.value);

    const formatted = results.map((result) => result.formatted);

    /*
     * 50 llamadas deben producir
     * exactamente 50 valores únicos.
     */
    expect(new Set(values.map(String)).size).toBe(CONCURRENT_REQUESTS);

    expect(new Set(formatted).size).toBe(CONCURRENT_REQUESTS);

    /*
     * Ordenamos únicamente para comprobar
     * que son 1..50 sin huecos.
     */
    const sortedValues = [...values].sort((a, b) =>
      a < b ? -1 : a > b ? 1 : 0,
    );

    const expectedValues = Array.from(
      {
        length: CONCURRENT_REQUESTS,
      },

      (_, index) => BigInt(index + 1),
    );

    expect(sortedValues).toEqual(expectedValues);

    /*
     * Verificación DB final.
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

    expect(sequence.currentValue).toBe(BigInt(CONCURRENT_REQUESTS));
  }, 30_000);
});
