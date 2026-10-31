import "./src/config/load-env.js";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",

  migrations: {
    path: "prisma/postgresql/migrations",
    seed: "node --import tsx prisma/seed.ts",
  },

  datasource: {
    url: process.env.ODONTHO_MIGRATION_URL ?? env("DATABASE_URL"),
  },
});
