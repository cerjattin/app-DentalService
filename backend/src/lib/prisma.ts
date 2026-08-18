import "dotenv/config";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not defined.");
}

const url = new URL(databaseUrl);

const database = decodeURIComponent(url.pathname.replace(/^\/+/, ""));

if (!database) {
  throw new Error("DATABASE_URL does not contain a database name.");
}

const adapter = new PrismaMariaDb({
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database,
  connectionLimit: 10,
});

export const prisma = new PrismaClient({
  adapter,
});
