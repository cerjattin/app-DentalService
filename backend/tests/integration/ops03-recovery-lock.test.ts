import pg from "pg";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { mkdir, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  requireLocalQaUrl,
  runQaRecovery,
} from "../../src/infrastructure/database/qa-recovery.js";

describe.skipIf(!process.env.RESTORE_LOCK_TEST_DATABASE_URL)(
  "OPS-03 bounded recovery under source locks",
  () => {
    it("reports its waiting phase and releases the snapshot within the lock deadline", async () => {
      const sourceUrl = requireLocalQaUrl(
        process.env.TEST_DATABASE_URL!,
      ).toString();
      const restoreUrl = requireLocalQaUrl(
        process.env.RESTORE_LOCK_TEST_DATABASE_URL!,
      ).toString();
      const blocker = new pg.Client({ connectionString: sourceUrl });
      const root = path.resolve(
        process.env.QA_RECOVERY_TEST_ROOT ?? "storage/ops03-db-qa",
        "blocked-" + randomUUID(),
      );
      const output = path.join(root, "output");
      await mkdir(root, { recursive: true });
      await blocker.connect();
      try {
        await blocker.query("BEGIN");
        await blocker.query("LOCK TABLE documents IN ACCESS EXCLUSIVE MODE");
        const start = Date.now();
        await expect(
          runQaRecovery({
            sourceUrl,
            restoreUrl,
            sourceDocuments: root,
            output,
            pgBin: process.env.PG_BIN ?? "C:/Program Files/PostgreSQL/17/bin",
            writersPaused: true,
          }),
        ).rejects.toThrow("snapshot-fingerprint");
        expect(Date.now() - start).toBeLessThan(15000);
        const progress = JSON.parse(
          await readFile(path.join(output, "progress.json"), "utf8"),
        );
        expect(progress).toMatchObject({
          phase: "snapshot-fingerprint",
          status: "FAILED",
        });
        const sessions = (
          await blocker.query(
            "SELECT count(*)::int AS rows FROM pg_stat_activity WHERE application_name='odontho-qa-recovery-source' AND datname=current_database()",
          )
        ).rows[0]!;
        expect(sessions.rows).toBe(0);
      } finally {
        await blocker.query("ROLLBACK");
        await blocker.end();
      }
    }, 20000);
  },
);
