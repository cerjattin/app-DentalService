import { prisma } from "./prisma.js";

// Both stored search columns and input use the database's unaccent dictionary.
// Original text and historical snapshots remain unchanged.
export async function normalizeSearch(value: string | undefined) {
  if (value === undefined) return undefined;
  const [row] = await prisma.$queryRaw<Array<{ value: string }>>`
    SELECT odontho_fold_search(${value}::text) AS value`;
  if (!row) throw new Error("Search normalization failed");
  return row.value;
}
