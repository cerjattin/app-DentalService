import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../../generated/prisma/client.js";
import { env } from "../../config/env.js";
import { parseMySqlDatabaseUrl } from "./database-url.js";

const databaseConfig = parseMySqlDatabaseUrl(env.DATABASE_URL);

const adapter = new PrismaMariaDb({
  host: databaseConfig.host,
  port: databaseConfig.port,
  user: databaseConfig.user,
  password: databaseConfig.password,
  database: databaseConfig.database,

  connectionLimit: env.DB_CONNECTION_LIMIT,

  allowPublicKeyRetrieval: true,
});

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
