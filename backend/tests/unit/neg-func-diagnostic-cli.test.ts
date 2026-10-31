import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const invoke = (args: string[], testUrl?: string) => {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL:
      "postgresql://qa:must-not-be-printed@operational.invalid/postgres",
  };
  delete env.TEST_DATABASE_URL;
  if (testUrl !== undefined) env.TEST_DATABASE_URL = testUrl;
  return spawnSync(
    process.execPath,
    ["--import", "tsx", "src/scripts/diagnose-neg-func-db.ts", ...args],
    {
      env,
      encoding: "utf8",
      windowsHide: true,
      timeout: 5_000,
    },
  );
};

describe("NEG-FUNC database diagnostic safety", () => {
  it("never falls back to the operational DATABASE_URL", () => {
    const result = invoke([]);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("dedicated local _test");
    expect(result.stderr).not.toContain("must-not-be-printed");
    expect(result.stderr).not.toContain("operational.invalid");
  });
  it("rejects remote and malformed test connections before querying and never echoes secrets", () => {
    for (const url of [
      "postgresql://qa:must-not-be-printed@remote.invalid/postgres",
      "must-not-be-printed-invalid-url",
    ]) {
      const result = invoke([], url);
      expect(result.status).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).not.toContain("must-not-be-printed");
    }
  });
  it("exports read-only aggregate SQL without opening a connection", () => {
    const result = invoke(["--sql"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY",
    );
    expect(result.stdout).toContain("ROLLBACK;");
    expect(result.stdout).toContain("affected_count");
    expect(result.stdout).not.toMatch(
      /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER|CREATE)\b/i,
    );
    expect(result.stdout).not.toContain("must-not-be-printed");
  });
});
