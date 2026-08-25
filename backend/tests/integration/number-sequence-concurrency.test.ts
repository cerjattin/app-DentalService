import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "../../src/infrastructure/database/prisma.js";

import { numberSequenceService } from "../../src/modules/number-sequences/number-sequence.service.js";

const TEST_YEAR = 65000;

const TEST_PREFIX = "TEST-INV-";

const CONCURRENT_REQUESTS = 50;

const SEQUENCE_TYPE = "INVOICE" as const;

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
     * Buscamos si quedó una secuencia del mismo
     * año por una ejecución anterior fallida.
     */
    const existing = await prisma.numberSequence.findUnique({
      where: {
        organizationId_sequenceType_sequenceYear: {
          organizationId,

          sequenceType: SEQUENCE_TYPE,

          sequenceYear: TEST_YEAR,
        },
      },

      select: {
        id: true,
        prefix: true,
      },
    });

    /*
     * Año 65000 está reservado exclusivamente
     * para tests.
     *
     * Si existe nuestra propia fixture,
     * podemos limpiarla.
     *
     * Si existe algo con otro prefix,
     * nos negamos a tocarlo.
     */
    if (existing) {
      if (existing.prefix !== TEST_PREFIX) {
        throw new Error(
          `Sequence ${SEQUENCE_TYPE}/${TEST_YEAR} already exists with unexpected prefix "${existing.prefix}". Refusing to overwrite it.`,
        );
      }

      await prisma.numberSequence.delete({
        where: {
          id: existing.id,
        },
      });
    }

    /*
     * Creamos una fixture completamente
     * aislada de las secuencias operativas.
     */
    await prisma.numberSequence.create({
      data: {
        organizationId,

        sequenceType: SEQUENCE_TYPE,

        sequenceYear: TEST_YEAR,

        prefix: TEST_PREFIX,

        currentValue: 0n,

        padding: 6,
      },
    });
  });

  afterAll(async () => {
    /*
     * Eliminamos únicamente nuestra fixture.
     */
    if (organizationId !== undefined) {
      await prisma.numberSequence.deleteMany({
        where: {
          organizationId,

          sequenceType: SEQUENCE_TYPE,

          sequenceYear: TEST_YEAR,

          prefix: TEST_PREFIX,
        },
      });
    }

    await prisma.$disconnect();
  });

  it("allocates 50 unique contiguous numbers under concurrency", async () => {
    /*
     * Lanzamos 50 solicitudes concurrentes.
     *
     * El pool puede ser menor que 50.
     * Las solicitudes esperan su turno para
     * obtener una transacción.
     */
    const results = await Promise.all(
      Array.from(
        {
          length: CONCURRENT_REQUESTS,
        },

        () =>
          prisma.$transaction(
            async (tx) =>
              numberSequenceService.allocateWithinTransaction(tx, {
                organizationId,

                sequenceType: SEQUENCE_TYPE,

                sequenceYear: TEST_YEAR,
              }),

            {
              /*
               * El valor elevado es deliberado:
               * este es un stress test con 50
               * transacciones sobre la misma fila.
               */
              maxWait: 30_000,

              timeout: 30_000,
            },
          ),
      ),
    );

    expect(results).toHaveLength(CONCURRENT_REQUESTS);

    /*
     * El servicio trabaja con bigint.
     * Conservamos bigint durante toda
     * la validación.
     */
    const values = results.map((result) => result.value);

    const formattedNumbers = results.map((result) => result.formatted);

    /*
     * 50 valores numéricos distintos.
     */
    expect(new Set(values).size).toBe(CONCURRENT_REQUESTS);

    /*
     * 50 identificadores formateados distintos.
     */
    expect(new Set(formattedNumbers).size).toBe(CONCURRENT_REQUESTS);

    /*
     * Ordenamos bigint sin convertirlos
     * innecesariamente a number.
     */
    const sortedValues = [...values].sort((left, right) => {
      if (left < right) {
        return -1;
      }

      if (left > right) {
        return 1;
      }

      return 0;
    });

    const expectedValues = Array.from(
      {
        length: CONCURRENT_REQUESTS,
      },

      (_, index) => BigInt(index + 1),
    );

    /*
     * Debemos obtener exactamente:
     *
     * 1,2,3,...,50
     *
     * sin huecos.
     */
    expect(sortedValues).toEqual(expectedValues);

    /*
     * Todos deben conservar el prefix
     * específico del test.
     */
    for (const formatted of formattedNumbers) {
      expect(formatted.startsWith(TEST_PREFIX)).toBe(true);
    }

    /*
     * Verificamos el contador persistido.
     */
    const sequence = await prisma.numberSequence.findUniqueOrThrow({
      where: {
        organizationId_sequenceType_sequenceYear: {
          organizationId,

          sequenceType: SEQUENCE_TYPE,

          sequenceYear: TEST_YEAR,
        },
      },

      select: {
        currentValue: true,

        prefix: true,

        padding: true,
      },
    });

    expect(sequence.currentValue).toBe(BigInt(CONCURRENT_REQUESTS));

    expect(sequence.prefix).toBe(TEST_PREFIX);

    expect(sequence.padding).toBe(6);
  });
});
