import "dotenv/config";

import { prisma } from "../lib/prisma.js";

const TEST_YEAR = 2099;
const CONCURRENT_REQUESTS = 50;

type AllocatedNumber = {
  value: bigint;
  formatted: string;
};

async function allocateNumber(
  organizationId: bigint,
): Promise<AllocatedNumber> {
  return prisma.$transaction(async (tx) => {
    /*
     * The UPDATE is intentionally the first operation.
     * InnoDB takes an exclusive row lock for this sequence row.
     * Concurrent transactions targeting the same row serialize here.
     */
    await tx.numberSequence.update({
      where: {
        organizationId_sequenceType_sequenceYear: {
          organizationId,
          sequenceType: "INVOICE",
          sequenceYear: TEST_YEAR,
        },
      },
      data: {
        currentValue: {
          increment: 1n,
        },
      },
    });

    const sequence = await tx.numberSequence.findUniqueOrThrow({
      where: {
        organizationId_sequenceType_sequenceYear: {
          organizationId,
          sequenceType: "INVOICE",
          sequenceYear: TEST_YEAR,
        },
      },
      select: {
        currentValue: true,
        prefix: true,
        padding: true,
      },
    });

    const numericPart = sequence.currentValue
      .toString()
      .padStart(sequence.padding, "0");

    return {
      value: sequence.currentValue,
      formatted: `${sequence.prefix}${TEST_YEAR}-${numericPart}`,
    };
  });
}

async function main() {
  console.log("=== ODONTHO FASE 9C - CONCURRENCY TEST ===");

  const organization = await prisma.organization.findFirstOrThrow({
    where: {
      legalName: "Odontho Services B.V.",
      isActive: true,
    },
    select: {
      id: true,
      legalName: true,
    },
  });

  /*
   * Dedicated future-year fixture.
   * It does not touch the production INVOICE sequence for the current year.
   */
  await prisma.numberSequence.upsert({
    where: {
      organizationId_sequenceType_sequenceYear: {
        organizationId: organization.id,
        sequenceType: "INVOICE",
        sequenceYear: TEST_YEAR,
      },
    },
    update: {
      prefix: "TEST-INV-",
      currentValue: 0n,
      padding: 6,
    },
    create: {
      organizationId: organization.id,
      sequenceType: "INVOICE",
      sequenceYear: TEST_YEAR,
      prefix: "TEST-INV-",
      currentValue: 0n,
      padding: 6,
    },
  });

  try {
    console.log(
      `Launching ${CONCURRENT_REQUESTS} concurrent allocations against one sequence row...`,
    );

    const results = await Promise.all(
      Array.from({ length: CONCURRENT_REQUESTS }, () =>
        allocateNumber(organization.id),
      ),
    );

    const values = results.map((result) => Number(result.value));
    const formatted = results.map((result) => result.formatted);

    const uniqueValues = new Set(values);
    const uniqueFormatted = new Set(formatted);

    const sortedValues = [...values].sort((a, b) => a - b);
    const expectedValues = Array.from(
      { length: CONCURRENT_REQUESTS },
      (_, index) => index + 1,
    );

    const duplicates = values.length - uniqueValues.size;

    const formattedDuplicates = formatted.length - uniqueFormatted.size;

    const contiguous =
      JSON.stringify(sortedValues) === JSON.stringify(expectedValues);

    const finalSequence = await prisma.numberSequence.findUniqueOrThrow({
      where: {
        organizationId_sequenceType_sequenceYear: {
          organizationId: organization.id,
          sequenceType: "INVOICE",
          sequenceYear: TEST_YEAR,
        },
      },
      select: {
        currentValue: true,
      },
    });

    const finalValueCorrect =
      finalSequence.currentValue === BigInt(CONCURRENT_REQUESTS);

    console.log("\nResults:");
    console.log({
      organization: organization.legalName,
      requested: CONCURRENT_REQUESTS,
      returned: results.length,
      uniqueNumericValues: uniqueValues.size,
      uniqueFormattedNumbers: uniqueFormatted.size,
      duplicates,
      formattedDuplicates,
      contiguous,
      finalCurrentValue: finalSequence.currentValue.toString(),
      finalValueCorrect,
    });

    console.log("\nFirst 10 allocated numbers:");
    console.log(
      results
        .sort((a, b) => Number(a.value - b.value))
        .slice(0, 10)
        .map((result) => result.formatted),
    );

    if (duplicates !== 0) {
      throw new Error(
        `Concurrency failure: ${duplicates} duplicate numeric sequence values detected.`,
      );
    }

    if (formattedDuplicates !== 0) {
      throw new Error(
        `Concurrency failure: ${formattedDuplicates} duplicate formatted numbers detected.`,
      );
    }

    if (!contiguous) {
      throw new Error(
        `Concurrency failure: expected values 1..${CONCURRENT_REQUESTS} without gaps.`,
      );
    }

    if (!finalValueCorrect) {
      throw new Error(
        `Concurrency failure: final currentValue should be ${CONCURRENT_REQUESTS}.`,
      );
    }

    console.log("\n✅ PASS: no duplicate sequence values");
    console.log("✅ PASS: no duplicate formatted invoice numbers");
    console.log("✅ PASS: values are contiguous");
    console.log("✅ PASS: final counter matches allocation count");
    console.log("✅ FASE 9C concurrency test passed");
  } finally {
    /*
     * Always remove the isolated test sequence.
     * This does not affect the real current-year sequence.
     */
    await prisma.numberSequence.deleteMany({
      where: {
        organizationId: organization.id,
        sequenceType: "INVOICE",
        sequenceYear: TEST_YEAR,
        prefix: "TEST-INV-",
      },
    });

    const remainingFixture = await prisma.numberSequence.count({
      where: {
        organizationId: organization.id,
        sequenceType: "INVOICE",
        sequenceYear: TEST_YEAR,
        prefix: "TEST-INV-",
      },
    });

    console.log(`\nCleanup fixture count: ${remainingFixture}`);

    if (remainingFixture !== 0) {
      throw new Error("Concurrency test fixture cleanup failed.");
    }
  }
}

main()
  .catch((error) => {
    console.error("\n❌ FASE 9C concurrency test failed");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
