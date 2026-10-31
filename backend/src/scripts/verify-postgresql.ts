import { prisma } from "../infrastructure/database/prisma.js";

try {
  const result = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    return tx.$queryRaw<Array<{ version: string; tables: number; checks: number }>>`
      SELECT current_setting('server_version') AS version,
        (SELECT count(*)::int FROM information_schema.tables
         WHERE table_schema = 'public' AND table_type = 'BASE TABLE') AS tables,
        (SELECT count(*)::int FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
         WHERE n.nspname = 'public' AND c.contype = 'c') AS checks`;
  });
  console.log(JSON.stringify({ connected: true, readOnly: true, ...result[0] }, null, 2));
} catch {
  console.error("PostgreSQL verification failed. Check connection, TLS certificate and project status.");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
