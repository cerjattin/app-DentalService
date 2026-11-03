import { spawnSync } from "node:child_process";
import { describe, it, expect } from "vitest";
import { readPermissionPolicy } from "../../src/infrastructure/database/permission-sync.js";
describe("DEP12 maintenance policy and CLI guards", () => {
  it("parses the seed literals without running its writes and preserves the contract matrix", () => {
    const policy = readPermissionPolicy();
    expect(policy.permissions.length).toBeGreaterThanOrEqual(70);
    expect(policy.roles.ADMIN).toHaveLength(policy.permissions.length);
    expect(policy.roles.RECEPTION).toContain("treatment_case.read");
    expect(policy.roles.RECEPTION).not.toContain("treatment_case.manage");
    expect(policy.roles.PROVIDER).toContain("treatment_case.manage");
    expect(policy.policyHash).toMatch(/^[a-f0-9]{64}$/);
  });
  it("refuses implicit operational targets and missing apply preconditions without exposing secrets", () => {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      DATABASE_URL:
        "postgresql://secret-must-not-print@operational.invalid/postgres",
    };
    delete env.TEST_DATABASE_URL;
    for (const args of [
      [],
      ["--apply"],
      ["--apply", "--expected-diff", "bad"],
    ]) {
      const r = spawnSync(
        process.execPath,
        ["--import", "tsx", "src/scripts/sync-pilot-permissions.ts", ...args],
        { env, encoding: "utf8", windowsHide: true, timeout: 10000 },
      );
      expect(r.status).toBe(1);
      expect(r.stdout).toBe("");
      expect(r.stderr).not.toContain("secret-must-not-print");
    }
  }, 35000);
});
