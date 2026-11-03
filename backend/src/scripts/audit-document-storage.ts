import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { prisma } from "../infrastructure/database/prisma.js";
import { documentRepository } from "../modules/documents/document.repository.js";
import { documentStorage } from "../modules/documents/document.storage.js";
import { auditDocumentStorage } from "../modules/documents/document-storage-audit.js";
import { env } from "../config/env.js";

// Explicitly selected environment only; no automatic fallback to clinic configuration.
try {
  const args = process.argv.slice(2);
  if (
    !args.includes("--read-only") ||
    args.some(
      (arg) =>
        ![
          "--read-only",
          "--verify-bytes",
          "--require-external",
          "--private-manifest",
        ].includes(arg),
    ) ||
    (!process.env.TEST_DATABASE_URL && !process.env.ODONTHO_ENV_FILE)
  )
    throw new Error("Explicit environment and --read-only required");
  if (
    process.env.TEST_DATABASE_URL &&
    env.DATABASE_URL !== process.env.TEST_DATABASE_URL
  )
    throw new Error("Dedicated environment mismatch");
  if (process.env.TEST_DATABASE_URL) {
    const target = new URL(process.env.TEST_DATABASE_URL);
    if (
      !["postgres:", "postgresql:"].includes(target.protocol) ||
      !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
      !/^\/[a-z0-9_]+_test$/.test(target.pathname)
    )
      throw new Error("Dedicated local QA required");
  }
  const documents = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      const rows: Awaited<
        ReturnType<typeof documentRepository.storageInventoryPage>
      > = [];
      let cursor: bigint | null = null;
      while (true) {
        const page = await documentRepository.storageInventoryPage(cursor, tx);
        rows.push(...page);
        if (page.length < 500) return rows;
        cursor = page.at(-1)!.id;
      }
    },
    { isolationLevel: "RepeatableRead", timeout: 30000 },
  );
  // Object I/O is deliberately outside the database transaction.
  const result = await auditDocumentStorage(documents, {
    requireExternal: args.includes("--require-external"),
    ...(args.includes("--verify-bytes")
      ? { read: (uri: string) => documentStorage.read(uri) }
      : {}),
  });
  if (args.includes("--private-manifest")) {
    const root = path.resolve("storage/dep12-private");
    await mkdir(root, { recursive: true });
    await writeFile(
      path.join(root, `document-manifest-${randomUUID()}.json`),
      JSON.stringify(
        {
          purpose: "READ_ONLY_TRANSFER_PLAN_NOT_APPLIED",
          manifestHash: result.report.manifestHash,
          documents: result.manifest,
        },
        null,
        2,
      ),
      { flag: "wx", mode: 0o600 },
    );
  }
  console.log(
    JSON.stringify(
      {
        ...result.report,
        privateManifestWritten: args.includes("--private-manifest"),
        operationalReadinessApproved: false,
        provider: env.DOCUMENT_STORAGE_PROVIDER,
      },
      null,
      2,
    ),
  );
  if (result.report.blocked) process.exitCode = 2;
} catch {
  console.error(
    JSON.stringify({ code: "DOCUMENT_STORAGE_AUDIT_FAILED", readOnly: true }),
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
