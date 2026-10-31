import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/infrastructure/database/prisma.js";
import { normalizeSearch } from "../../src/infrastructure/database/text-search.js";
import { svbCatalogService } from "../../src/modules/svb-catalog/svb-catalog.service.js";
import { listSvbProceduresQuerySchema } from "../../src/modules/svb-catalog/svb-catalog.schemas.js";

const suffix = randomUUID().replaceAll("-", "");
const code = `TEST-PG-José-${suffix}`;
const ids: bigint[] = [];
afterAll(async () => {
  await prisma.svbTariff.deleteMany({ where: { svbProcedureId: { in: ids } } });
  await prisma.svbProcedure.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

describe("PostgreSQL migration compatibility", () => {
  it("preserves original text, accent/case-insensitive equality and unique constraints", async () => {
    const procedure = await prisma.svbProcedure.create({ data: { code, description: "CAFÉ Curaçao Œuvre" } });
    ids.push(procedure.id);
    const found = await prisma.svbProcedure.findUniqueOrThrow({ where: { code: code.replace("José", "JOSE").toLowerCase() } });
    expect(found.code).toBe(code);
    expect(found.description).toBe("CAFÉ Curaçao Œuvre");
    await expect(prisma.svbProcedure.create({ data: { code: code.replace("José", "Jose"), description: "Duplicate" } })).rejects.toMatchObject({ code: "P2002" });
  });
  it("searches the real catalogue without accents and keeps support fields out of DTOs", async () => {
    const result = await svbCatalogService.listProcedures(listSvbProceduresQuerySchema.parse({ q: "cafe curacao oeuvre" }));
    const procedure = result.procedures.find(row => row.id === ids[0]!.toString());
    expect(procedure?.description).toBe("CAFÉ Curaçao Œuvre");
    expect(procedure).not.toHaveProperty("descriptionSearch");
    expect(await normalizeSearch("CAFÉ ŒUVRE")).toBe("cafe oeuvre");
  });
  it("updates timestamp and search support even for SQL writes", async () => {
    const original = await prisma.svbProcedure.findUniqueOrThrow({ where: { id: ids[0]! } });
    await prisma.$executeRaw`UPDATE svb_procedures SET description = 'ÉCOLE', description_search = 'forged' WHERE id = ${original.id}`;
    const changed = await prisma.svbProcedure.findUniqueOrThrow({ where: { id: original.id } });
    expect(changed.description).toBe("ÉCOLE");
    expect(changed.descriptionSearch).toBe("ecole");
    expect(changed.updatedAt.getTime()).toBeGreaterThan(original.updatedAt.getTime());
    await prisma.$executeRaw`SELECT pg_sleep(0.005)`;
    await prisma.$executeRaw`UPDATE svb_procedures SET description = 'ecole' WHERE id = ${original.id}`;
    const caseOnly = await prisma.svbProcedure.findUniqueOrThrow({ where: { id: original.id } });
    expect(caseOnly.updatedAt.getTime()).toBeGreaterThan(changed.updatedAt.getTime());
  });
  it("retains Decimal precision and rejects invalid amounts and periods at the database", async () => {
    const tariff = { svbProcedureId: ids[0]!, amount: "9999999999999.99", currencyCode: "USD", validFrom: new Date("2026-01-01T00:00:00Z") };
    const saved = await prisma.svbTariff.create({ data: tariff });
    expect(saved.amount.toFixed(2)).toBe("9999999999999.99");
    await expect(prisma.svbTariff.create({ data: { ...tariff, currencyCode: "ANG", amount: "-0.01" } })).rejects.toThrow();
    await expect(prisma.svbTariff.create({ data: { ...tariff, currencyCode: "ANG", validTo: new Date("2025-12-31T00:00:00Z") } })).rejects.toThrow();
    await expect(prisma.svbProcedure.create({ data: { id: -1n, code: `NEG-${suffix}`, description: "Invalid unsigned id" } })).rejects.toThrow();
  });
});
