import { Prisma } from "../../generated/prisma/client.js";

// Prisma ORM writes use P2034. PostgreSQL errors from raw SELECT ... FOR UPDATE
// can instead arrive as P2010 with SQLSTATE in adapter metadata.
export function isTransactionConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === "P2034") return true;
  if (error.code !== "P2010") return false;
  function sqlState(value: unknown, depth = 0): boolean {
    if (depth > 4 || typeof value !== "object" || value === null) return false;
    const record = value as Record<string, unknown>;
    return [record.code, record.originalCode].some((code) => code === "40001" || code === "40P01") ||
      [record.driverAdapterError, record.cause].some((cause) => sqlState(cause, depth + 1));
  }
  return sqlState(error.meta);
}
