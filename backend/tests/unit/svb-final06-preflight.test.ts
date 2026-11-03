import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { parseSvbMasterBatch } from "../../src/infrastructure/database/svb-master-preflight.js";
import { final06PreflightSql } from "../../src/infrastructure/database/svb-final06-preflight.js";

const batch = () => ({
  format: "odontho-svb-master-preflight-v1",
  source: null,
  procedures: [
    {
      evidenceRow: "synthetic-1",
      data: {
        code: "00001",
        description: "Synthetic only",
        requiresAuthorization: false,
        requiresReferral: false,
        isActive: false,
      },
    },
  ],
  tariffs: [
    {
      evidenceRow: "synthetic-2",
      procedureCode: "00001",
      data: {
        amount: "9999999999999.99",
        currencyCode: "ANG",
        validFrom: "2026-11-01",
        isActive: false,
      },
    },
  ],
});

describe("Final06 master preparation without invented source rules", () => {
  it("preserves external codes and exact decimal strings; missing provenance stays missing", () => {
    const parsed = parseSvbMasterBatch(batch());
    expect(parsed.procedures[0]!.data.code).toBe("00001");
    expect(parsed.tariffs[0]!.data.amount).toBe("9999999999999.99");
    expect(parsed.source).toBeNull();
  });
  it("rejects monetary JS numbers, inferred flags and extraneous snapshots", () => {
    const value = batch();
    expect(() =>
      parseSvbMasterBatch({
        ...value,
        tariffs: [
          {
            ...value.tariffs[0],
            data: { ...value.tariffs[0]!.data, amount: 1.01 },
          },
        ],
      }),
    ).toThrow();
    const { requiresReferral: _, ...partial } = value.procedures[0]!.data;
    expect(() =>
      parseSvbMasterBatch({
        ...value,
        procedures: [{ evidenceRow: "QA", data: partial }],
      }),
    ).toThrow();
    expect(() => parseSvbMasterBatch({ ...value, assistance: "N" })).toThrow();
  });
  it("rejects impossible dates, inverted periods and incomplete provenance", () => {
    const value = batch();
    for (const dates of [
      { validFrom: "2026-02-30" },
      { validFrom: "2026-11-01", validTo: "2026-10-31" },
    ])
      expect(() =>
        parseSvbMasterBatch({
          ...value,
          tariffs: [
            {
              ...value.tariffs[0],
              data: { ...value.tariffs[0]!.data, ...dates },
            },
          ],
        }),
      ).toThrow();
    expect(() =>
      parseSvbMasterBatch({ ...value, source: { version: "unknown" } }),
    ).toThrow();
  });
  it("exports structural aggregate SQL without writes or implicit source approval", () => {
    const sql = final06PreflightSql();
    expect(sql).toContain("REPEATABLE READ READ ONLY");
    expect(sql).toContain("ROLLBACK;");
    expect(sql).not.toMatch(
      /\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE)\b/i,
    );
    expect(sql).toContain("Zero findings do not authorize");
  });
});

function cli(args: string[], testUrl?: string) {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: "postgresql://do-not-print@operational.invalid/postgres",
  };
  delete env.TEST_DATABASE_URL;
  if (testUrl) env.TEST_DATABASE_URL = testUrl;
  return spawnSync(
    process.execPath,
    ["--import", "tsx", "src/scripts/preflight-final06-db.ts", ...args],
    { env, encoding: "utf8", windowsHide: true, timeout: 10000 },
  );
}
describe("Final06 CLI connection safety", () => {
  it("does not fall back to operational config or echo connection secrets", () => {
    for (const url of [
      undefined,
      "postgresql://do-not-print@remote.invalid/qa_test",
      "postgresql://postgres@127.0.0.1/clinic",
      "postgresql://postgres@127.0.0.1/qa_test?host=remote.invalid",
    ]) {
      const result = cli([], url);
      expect(result.status).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).not.toContain("do-not-print");
      expect(result.stderr).not.toContain("remote.invalid");
    }
  }, 45000);
  it("only exports SQL without a connection and rejects unknown or apply flags", () => {
    const result = cli(["--sql"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("READ ONLY");
    expect(cli(["--apply"]).status).toBe(1);
    expect(cli(["--sql", "--apply"]).status).toBe(1);
  }, 35000);
});
