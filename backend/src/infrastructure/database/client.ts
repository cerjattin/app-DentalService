import "../../config/load-env.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";
import { postgresConnectionConfig } from "./database-url.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const limit = Number(process.env.DB_CONNECTION_LIMIT ?? 5);
if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error("DB_CONNECTION_LIMIT must be between 1 and 50");
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  adapter: new PrismaPg({
    ...postgresConnectionConfig(databaseUrl, process.env.DATABASE_CA_CERT_PATH),
    max: limit,
  }),
});
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
