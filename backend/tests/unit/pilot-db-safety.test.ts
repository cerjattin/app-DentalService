import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  checkedDocumentPath,
  requireLocalQaUrl,
  runQaRecovery,
} from "../../src/infrastructure/database/qa-recovery.js";
import { localMigrationInventory } from "../../src/infrastructure/database/pilot-db-inventory.js";

describe("Pilot database safety", () => {
  it("rejects remote, non-test, query overrides and ambiguous recovery URLs before connecting", () => {
    for (const url of [
      "postgresql://user:secret@remote.invalid/qa_test",
      "postgresql://postgres@127.0.0.1/clinic",
      "postgresql://postgres@127.0.0.1/qa_test?host=remote.invalid",
      "mysql://localhost/qa_test",
    ])
      expect(() => requireLocalQaUrl(url)).toThrow();
    expect(
      requireLocalQaUrl("postgresql://postgres@127.0.0.1:55443/source_test")
        .pathname,
    ).toBe("/source_test");
  });
  it("refuses recovery over the source itself without opening a connection", async () => {
    await expect(
      runQaRecovery({
        sourceUrl: "postgresql://postgres@127.0.0.1/same_test",
        restoreUrl: "postgresql://postgres@127.0.0.1/same_test",
        sourceDocuments: "unused",
        output: "unused",
        pgBin: "unused",
        writersPaused: true,
      }),
    ).rejects.toThrow("distinct");
  });
  it("resolves only local document keys within the designated root", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "odontho-recovery-"));
    await mkdir(path.join(root, "synthetic"));
    await writeFile(path.join(root, "synthetic", "receipt.txt"), "synthetic");
    expect(
      (
        await checkedDocumentPath(
          root,
          "local://documents/synthetic/receipt.txt",
        )
      ).key,
    ).toBe("synthetic/receipt.txt");
    for (const key of [
      "../secret",
      "/absolute",
      "a/../secret",
      "C:/secret",
      "a\\secret",
    ])
      await expect(
        checkedDocumentPath(root, "local://documents/" + key),
      ).rejects.toThrow();
    await expect(
      checkedDocumentPath(root, "https://public.invalid/receipt"),
    ).rejects.toThrow();
  });
  it("fingerprints actual migration bytes and includes each migration without exposing connection values", () => {
    const migrations = localMigrationInventory();
    expect(migrations[0]!.name).toBe("20261030000000_init");
    expect(migrations.length).toBeGreaterThanOrEqual(5);
    expect(migrations.every((m) => /^[a-f0-9]{64}$/.test(m.checksum))).toBe(
      true,
    );
  });
  it("CLI refuses implicit operational URLs and missing recovery authorization without printing secrets", () => {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      DATABASE_URL:
        "postgresql://user:must-not-print@operational.invalid/postgres",
    };
    delete env.TEST_DATABASE_URL;
    for (const script of ["inspect-pilot-db", "qa-recovery-drill"]) {
      const result = spawnSync(
        process.execPath,
        ["--import", "tsx", `src/scripts/${script}.ts`],
        { env, encoding: "utf8", windowsHide: true, timeout: 10000 },
      );
      expect(result.status).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).not.toContain("must-not-print");
      expect(result.stderr).not.toContain("operational.invalid");
    }
  }, 25000);
});
