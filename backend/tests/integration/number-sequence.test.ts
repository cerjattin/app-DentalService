import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "../../src/infrastructure/database/prisma.js";

import { numberSequenceService } from "../../src/modules/number-sequences/number-sequence.service.js";

type AllocationResult = {
  value: bigint;
  formatted: string;
  sequenceYear: number;
};

describe("NumberSequenceService", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("allocates a patient number inside a transaction", async () => {
    const organization = await prisma.organization.findFirstOrThrow({
      where: {
        legalName: "Odontho Services B.V.",
        isActive: true,
      },

      select: {
        id: true,
      },
    });

    let result: AllocationResult | undefined;

    const rollbackMarker = new Error("TEST_ROLLBACK_NUMBER_SEQUENCE");

    try {
      await prisma.$transaction(
        async (tx) => {
          result = await numberSequenceService.allocateWithinTransaction(tx, {
            organizationId: organization.id,

            sequenceType: "PATIENT",
          });

          throw rollbackMarker;
        },
        {
          maxWait: 10_000,
          timeout: 10_000,
        },
      );
    } catch (error) {
      if (error !== rollbackMarker) {
        throw error;
      }
    }

    if (!result) {
      throw new Error(
        "NumberSequenceService did not return an allocation result",
      );
    }

    expect(result.formatted).toMatch(/^PAT-\d+$/);

    expect(result.value).toBeGreaterThan(0n);

    expect(result.sequenceYear).toBe(0);
  });
});
