import "dotenv/config";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { z } from "zod";

// Run against an explicitly selected QA backend with an existing authorized QA
// token. Never prints the token or deletes records. Persist partial IDs on failure.
const settings = z
  .object({
    MASTER02R_QA_BASE_URL: z.string().url(),
    MASTER02R_QA_ACCESS_TOKEN: z.string().min(1),
    MASTER02R_QA_CURRENCY: z.string().regex(/^[A-Z]{3}$/),
    MASTER02R_QA_SERVICE_DATE: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    MASTER02R_QA_REPORT_PATH: z
      .string()
      .default("docs/MASTER_02R_LIVE_QA.json"),
  })
  .parse(process.env);
const root =
  settings.MASTER02R_QA_BASE_URL.replace(/\/$/, "") + "/api/v1/svb-procedures";
const row = z
  .object({
    id: z.string().regex(/^[1-9]\d*$/),
    code: z.string().optional(),
    amount: z.string().optional(),
  })
  .passthrough();
const envelope = z.object({
  data: z.unknown().optional(),
  error: z.object({ code: z.string() }).optional(),
});
const report: {
  status: string;
  procedureId?: string;
  procedureCode: string;
  tariffId?: string;
  finalActiveState?: boolean;
  steps: Array<{
    method: string;
    path: string;
    status: number;
    error?: string;
  }>;
} = {
  status: "IN_PROGRESS",
  procedureCode: `TEST-SVB-M02R-LIVE-${Date.now()}`,
  steps: [],
};
async function call(
  method: string,
  path: string,
  expected: number,
  body?: unknown,
) {
  const response = await fetch(root + path, {
    method,
    headers: {
      Authorization: `Bearer ${settings.MASTER02R_QA_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = envelope.parse(await response.json());
  report.steps.push({
    method,
    path,
    status: response.status,
    ...(result.error ? { error: result.error.code } : {}),
  });
  await writeFile(
    settings.MASTER02R_QA_REPORT_PATH,
    JSON.stringify(report, null, 2) + "\n",
  );
  assert.equal(
    response.status,
    expected,
    `${method} ${path}: ${result.error?.code ?? "unexpected HTTP status"}`,
  );
  return result;
}
try {
  const created = row.parse(
    (
      await call("POST", "", 201, {
        code: report.procedureCode,
        description: "QA MASTER-02R service",
        category: "QA",
        unit: "VISIT",
        requiresAuthorization: false,
        requiresReferral: false,
        isActive: true,
        validFrom: settings.MASTER02R_QA_SERVICE_DATE,
        validTo: null,
      })
    ).data,
  );
  report.procedureId = created.id;
  const path = `/${created.id}`;
  await call("GET", path, 200);
  const query = `?q=${encodeURIComponent(report.procedureCode)}&isActive=true&serviceDate=${settings.MASTER02R_QA_SERVICE_DATE}`;
  assert.equal(
    z.array(row).parse((await call("GET", query, 200)).data)[0]?.id,
    created.id,
  );
  const tariff = row.parse(
    (
      await call("POST", path + "/tariffs", 201, {
        amount: "88.80",
        currencyCode: settings.MASTER02R_QA_CURRENCY,
        validFrom: settings.MASTER02R_QA_SERVICE_DATE,
        validTo: null,
        isActive: true,
      })
    ).data,
  );
  report.tariffId = tariff.id;
  assert.equal(tariff.amount, "88.80");
  const history = z
    .array(row)
    .parse((await call("GET", path + "/tariffs", 200)).data);
  assert(history.some((item) => item.id === tariff.id));
  const applicable =
    path +
    `/applicable-tariff?serviceDate=${settings.MASTER02R_QA_SERVICE_DATE}&currencyCode=${settings.MASTER02R_QA_CURRENCY}`;
  await call("GET", applicable, 200);
  await call("PATCH", path, 200, {
    description: "QA MASTER-02R service edited",
    requiresReferral: true,
  });
  assert.equal(
    row.parse(
      (
        await call("PATCH", path + `/tariffs/${tariff.id}`, 200, {
          amount: "89.90",
        })
      ).data,
    ).amount,
    "89.90",
  );
  await call("PATCH", path + "/status", 200, { isActive: false });
  assert.equal(
    z.array(row).parse((await call("GET", query, 200)).data).length,
    0,
  );
  assert.equal(
    (await call("GET", applicable, 409)).error?.code,
    "SVB_PROCEDURE_INACTIVE",
  );
  await call("PATCH", path + "/status", 200, { isActive: true });
  await call("GET", applicable, 200);
  await call("PATCH", path + "/status", 200, { isActive: false });
  report.finalActiveState = false;
  report.status = "PASSED";
} catch (error) {
  report.status = "FAILED";
  console.error(error instanceof Error ? error.message : "QA failed");
  process.exitCode = 1;
} finally {
  await writeFile(
    settings.MASTER02R_QA_REPORT_PATH,
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
}
