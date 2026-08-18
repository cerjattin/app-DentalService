import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "../../src/infrastructure/database/prisma.js";

import { numberSequenceService } from "../../src/modules/number-sequences/number-sequence.service.js";

describe("NumberSequenceService", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("allocates a patient number inside a transaction", async () => {
    const organization = await prisma.organization.findFirstOrThrow({
      where: {
        legalName: "Odontho Services B.V.",
      },

      select: {
        id: true,
      },
    });

    const result = await prisma.$transaction(async (tx) => {
      return numberSequenceService.allocateWithinTransaction(tx, {
        organizationId: organization.id,

        sequenceType: "PATIENT",
      });
    });

    expect(result.formatted).toMatch(/^PAT-\d+$/);

    expect(result.value).toBeGreaterThan(0n);

    expect(result.sequenceYear).toBe(0);
  });
});
