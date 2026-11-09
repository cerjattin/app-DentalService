import pg from "pg";
import request from "supertest";
import { randomUUID } from "node:crypto";
import {
  beforeAll,
  afterAll,
  afterEach,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import { app } from "../../src/app.js";
import { prisma } from "../../src/infrastructure/database/prisma.js";
import { accessTokenService } from "../../src/modules/auth/access-token.service.js";
import { dentalinkAdapterProvider } from "../../src/modules/dentalink/dentalink.adapter.js";
import { auditService } from "../../src/modules/audit/audit.service.js";
import {
  createNegFuncDbFixture,
  insertDbRow,
} from "../helpers/neg-func-db-fixture.js";
const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
let f: Awaited<ReturnType<typeof createNegFuncDbFixture>>,
  other: typeof f,
  token: string,
  foreign: string,
  provider: string,
  reception: string;
const base = "/api/v1/integrations/dentalink/accounts";
const auth = (value = token) => ({ Authorization: `Bearer ${value}` });
const acct = (id: string) => `${base}/${id}`;
const prev = (account: string, run: string) =>
  `${acct(account)}/previews/${run}`;
const patient = (externalId = "000001") => ({
  entityType: "PATIENT",
  externalId,
  payload: {
    firstName: `Synthetic-${randomUUID().slice(0, 8)}`,
    lastName: "Import QA",
  },
});
const appointment = (externalId = "000002", patientExternalId = "000001") => ({
  entityType: "APPOINTMENT",
  externalId,
  payload: {
    patientExternalId,
    providerExternalId: "00007",
    locationExternalId: "00002",
    start: "2027-01-12T10:00:00-04:00",
    end: "2027-01-12T10:30:00-04:00",
    eligibility: "NEW_APPOINTMENT",
  },
});
const inject = (
  account: string,
  items: unknown[],
  nextCursor: string | null = null,
  complete = true,
) => {
  const read = vi.fn(async () => ({
    externalAccountId: account,
    items,
    nextCursor,
    complete,
  }));
  vi.spyOn(dentalinkAdapterProvider, "resolve").mockReturnValue({
    kind: "SYNTHETIC",
    readPage: read,
  });
  return read;
};
async function account() {
  const external = `000-account-${randomUUID()}`;
  const a = (
    await request(app)
      .post(base)
      .set(auth())
      .send({
        externalAccountId: external,
        label: "Synthetic internal account",
      })
      .expect(201)
  ).body.data;
  await request(app)
    .patch(acct(a.id))
    .set(auth())
    .send({ enabled: true })
    .expect(200);
  return { id: a.id as string, external };
}
async function mappings(id: string) {
  for (const m of [
    { kind: "PROVIDER", externalId: "00007", localId: f.providerId },
    { kind: "LOCATION", externalId: "00002", localId: f.clinicLocationId },
  ])
    await request(app)
      .put(acct(id) + "/mappings")
      .set(auth())
      .send(m)
      .expect(200);
}
const preview = (id: string, key: string = randomUUID()) =>
  request(app)
    .post(acct(id) + "/previews")
    .set(auth())
    .send({ idempotencyKey: key });
const confirm = (
  a: string,
  r: { id: string; contentHash: string },
  key: string = randomUUID(),
) =>
  request(app)
    .post(prev(a, r.id) + "/confirm")
    .set(auth())
    .send({ expectedContentHash: r.contentHash, idempotencyKey: key });
beforeAll(async () => {
  await db.connect();
  f = await createNegFuncDbFixture(db);
  other = await createNegFuncDbFixture(db);
  for (const fixture of [f, other])
    await db.query(
      "INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE code='ADMIN'",
      [fixture.userId],
    );
  token = await accessTokenService.sign(
    BigInt(f.userId),
    BigInt(f.organizationId),
  );
  foreign = await accessTokenService.sign(
    BigInt(other.userId),
    BigInt(other.organizationId),
  );
  for (const role of ["PROVIDER", "RECEPTION"]) {
    const id = await insertDbRow(db, "users", {
      organization_id: f.organizationId,
      email: `ops-import-${role}-${f.organizationId}@local.invalid`,
      password_hash: "synthetic",
      first_name: "Synthetic",
      last_name: role,
    });
    await db.query(
      "INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE code=$2",
      [id, role],
    );
    const t = await accessTokenService.sign(
      BigInt(id),
      BigInt(f.organizationId),
    );
    if (role === "PROVIDER") provider = t;
    else reception = t;
  }
  await insertDbRow(db, "number_sequences", {
    organization_id: f.organizationId,
    sequence_type: "PATIENT",
    sequence_year: 0,
    current_value: "500",
    prefix: "IMP-",
  });
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  vi.restoreAllMocks();
  if (!new URL(process.env.TEST_DATABASE_URL!).pathname.endsWith("_test"))
    throw new Error("Dedicated QA required");
  for (const fixture of [f, other]) {
    const org = fixture.organizationId;
    for (const table of [
      "dentalink_import_items",
      "dentalink_external_identities",
      "dentalink_import_runs",
      "dentalink_mappings",
      "dentalink_accounts",
    ])
      await db.query(`DELETE FROM ${table} WHERE organization_id=$1`, [org]);
    await db.query(
      "DELETE FROM appointment_status_history WHERE appointment_id IN (SELECT id FROM appointments WHERE organization_id=$1)",
      [org],
    );
    await db.query("DELETE FROM appointments WHERE organization_id=$1", [org]);
    await db.query("DELETE FROM patients WHERE organization_id=$1 AND id<>$2", [
      org,
      fixture.patientId,
    ]);
    await db.query("DELETE FROM audit_logs WHERE organization_id=$1", [org]);
    await db.query(
      "DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE organization_id=$1 AND id<>$2)",
      [org, fixture.userId],
    );
    await db.query("DELETE FROM users WHERE organization_id=$1 AND id<>$2", [
      org,
      fixture.userId,
    ]);
    await fixture.cleanup();
  }
  await prisma.$disconnect();
  await db.end();
}, 20000);
describe("OPS01 internal Dentalink import, synthetic adapter only", () => {
  it("is explicitly unconfigured, scoped and permission protected; browser cannot supply a token or payload", async () => {
    const a = await account();
    const status = await request(app)
      .get(acct(a.id) + "/status")
      .set(auth())
      .expect(200);
    expect(status.body.data).toMatchObject({
      state: "NOT_CONFIGURED",
      canPreview: false,
      realConnectionVerified: false,
    });
    expect((await preview(a.id)).body.error.code).toBe(
      "DENTALINK_NOT_CONFIGURED",
    );
    expect(
      await prisma.dentalinkImportRun.count({
        where: { accountId: BigInt(a.id) },
      }),
    ).toBe(0);
    await request(app).get(base).expect(401);
    await request(app).get(base).set(auth(provider)).expect(403);
    await request(app)
      .get(acct(a.id) + "/status")
      .set(auth(foreign))
      .expect(404);
    await request(app)
      .post(base)
      .set(auth(reception))
      .send({ externalAccountId: "another", label: "QA" })
      .expect(403);
    await request(app)
      .post(acct(a.id) + "/previews")
      .set(auth())
      .send({ idempotencyKey: randomUUID(), token: "DO_NOT_ACCEPT", items: [] })
      .expect(400);
  });
  it("imports a new patient and scheduled appointment atomically, preserves zero IDs and retries without duplication", async () => {
    const a = await account();
    await mappings(a.id);
    const p = patient(),
      ap = appointment();
    inject(a.external, [p, ap]);
    const key = randomUUID();
    const run = (await preview(a.id, key).expect(201)).body.data;
    expect(run).toMatchObject({
      state: "PREVIEW_READY",
      sourceMode: "SYNTHETIC",
      realConnectionVerified: false,
      counts: { ready: 2 },
    });
    expect((await preview(a.id, key).expect(200)).body.data.id).toBe(run.id);
    const runs = await request(app)
      .get(acct(a.id) + "/previews?pageSize=1")
      .set(auth(reception))
      .expect(200);
    expect(runs.body.data[0]).toMatchObject({
      id: run.id,
      state: "PREVIEW_READY",
    });
    expect(runs.body.meta).toMatchObject({ total: 1, totalPages: 1 });
    expect(runs.body.data[0]).not.toHaveProperty("payloadJson");
    const list = await request(app)
      .get(prev(a.id, run.id) + "/items?pageSize=1")
      .set(auth(reception))
      .expect(200);
    expect(list.body.meta).toMatchObject({ total: 2, totalPages: 2 });
    expect(list.headers["cache-control"]).toBe("private, no-store");
    const confirmKey = randomUUID();
    const results = await Promise.all([
      confirm(a.id, run, confirmKey),
      confirm(a.id, run, confirmKey),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 201]);
    expect(results[0]!.body.data.counts.imported).toBe(2);
    const identities = await prisma.dentalinkExternalIdentity.findMany({
      where: { accountId: BigInt(a.id) },
    });
    expect(identities.map((i) => i.externalId).sort()).toEqual([
      "000001",
      "000002",
    ]);
    const apid = identities.find((i) => i.appointmentId)?.appointmentId;
    expect(
      (await prisma.appointment.findUniqueOrThrow({ where: { id: apid! } }))
        .status,
    ).toBe("SCHEDULED");
    expect(
      (
        await prisma.patient.findUniqueOrThrow({
          where: { id: BigInt(f.patientId) },
        })
      ).patientNumber,
    ).toBe("DB-PATIENT");
    const second = (await preview(a.id).expect(201)).body.data;
    expect(second.counts.skipped).toBe(2);
    await confirm(a.id, second).expect(201);
    expect(
      await prisma.dentalinkExternalIdentity.count({
        where: { accountId: BigInt(a.id) },
      }),
    ).toBe(2);
    const audit = await prisma.auditLog.findMany({
      where: {
        organizationId: BigInt(f.organizationId),
        entityType: "DENTALINK_ACCOUNT",
      },
    });
    expect(JSON.stringify(audit.map((i) => i.newValues))).not.toContain(
      p.payload.firstName,
    );
  });
  it("keeps the page cursor on incomplete reads, resumes, and sanitizes source errors", async () => {
    const a = await account();
    const p = patient();
    const read = inject(a.external, [p], "next-page");
    const run = (await preview(a.id).expect(201)).body.data;
    expect(run.state).toBe("READING");
    read.mockResolvedValueOnce({
      externalAccountId: a.external,
      items: [],
      nextCursor: null,
      complete: false,
    });
    expect(
      (
        await request(app)
          .post(prev(a.id, run.id) + "/read-next-page")
          .set(auth())
          .send({})
      ).body.error.code,
    ).toBe("DENTALINK_PAGE_INCOMPLETE");
    expect(
      (
        await prisma.dentalinkImportRun.findUniqueOrThrow({
          where: { id: BigInt(run.id) },
        })
      ).cursor,
    ).toBe("next-page");
    read.mockRejectedValueOnce(new Error("PRIVATE_TOKEN_AND_PAYLOAD"));
    const error = await request(app)
      .post(prev(a.id, run.id) + "/read-next-page")
      .set(auth())
      .send({})
      .expect(503);
    expect(JSON.stringify(error.body)).not.toContain("PRIVATE_TOKEN");
    read.mockResolvedValueOnce({
      externalAccountId: a.external,
      items: [],
      nextCursor: null,
      complete: true,
    });
    await request(app)
      .post(prev(a.id, run.id) + "/read-next-page")
      .set(auth())
      .send({})
      .expect(200);
    expect(
      (
        await prisma.dentalinkImportRun.findUniqueOrThrow({
          where: { id: BigInt(run.id) },
        })
      ).state,
    ).toBe("PREVIEW_READY");
  });
  it("reports possible matches, malformed payloads, unmapped references and unsupported source status without merging", async () => {
    const a = await account();
    inject(a.external, [
      {
        entityType: "PATIENT",
        externalId: "match",
        payload: { firstName: "Synthetic", lastName: "Database QA" },
      },
      {
        entityType: "PATIENT",
        externalId: "bad",
        payload: { firstName: "Missing surname", token: "HIDDEN" },
      },
      appointment("missing", "unknown"),
      {
        ...appointment("unsupported"),
        payload: { ...appointment().payload, eligibility: "UNSUPPORTED" },
      },
    ]);
    const run = (await preview(a.id).expect(201)).body.data;
    expect(run.counts.issues).toBe(4);
    const items = (
      await request(app)
        .get(prev(a.id, run.id) + "/items")
        .set(auth())
        .expect(200)
    ).body.data;
    expect(
      items.find((i: { externalId: string }) => i.externalId === "match")
        .issueCodes,
    ).toContain("POSSIBLE_PATIENT_MATCH");
    expect(JSON.stringify(items)).not.toContain("HIDDEN");
    expect(
      (await confirm(a.id, run).expect(201)).body.data.counts.imported,
    ).toBe(0);
    expect(
      await prisma.dentalinkExternalIdentity.count({
        where: { accountId: BigInt(a.id) },
      }),
    ).toBe(0);
  });
  it("rolls back entities, identities and allocated numbers on failure between creation and linking", async () => {
    const a = await account();
    inject(a.external, [patient()]);
    const run = (await preview(a.id).expect(201)).body.data;
    const sequence = await prisma.numberSequence.findFirstOrThrow({
      where: {
        organizationId: BigInt(f.organizationId),
        sequenceType: "PATIENT",
      },
    });
    const before = await prisma.patient.count({
      where: { organizationId: BigInt(f.organizationId) },
    });
    const original = auditService.writeWithinTransaction.bind(auditService);
    vi.spyOn(auditService, "writeWithinTransaction").mockImplementation(
      async (tx, input) => {
        if (input.action === "DENTALINK_IMPORT_CONFIRM")
          throw new Error("SYNTHETIC FINAL AUDIT FAILURE");
        return original(tx, input);
      },
    );
    await confirm(a.id, run).expect(500);
    expect(
      await prisma.patient.count({
        where: { organizationId: BigInt(f.organizationId) },
      }),
    ).toBe(before);
    expect(
      await prisma.dentalinkExternalIdentity.count({
        where: { accountId: BigInt(a.id) },
      }),
    ).toBe(0);
    expect(
      (
        await prisma.numberSequence.findUniqueOrThrow({
          where: { id: sequence.id },
        })
      ).currentValue,
    ).toBe(sequence.currentValue);
    vi.restoreAllMocks();
    await confirm(a.id, run).expect(201);
  });
  it("rejects changed mappings or staged payloads and cross-organization targets", async () => {
    const a = await account();
    await mappings(a.id);
    inject(a.external, [patient(), appointment()]);
    const run = (await preview(a.id).expect(201)).body.data;
    await request(app)
      .put(acct(a.id) + "/mappings")
      .set(auth())
      .send({
        kind: "PROVIDER",
        externalId: "00007",
        localId: other.providerId,
      })
      .expect(404);
    await prisma.dentalinkImportItem.updateMany({
      where: { runId: BigInt(run.id), entityType: "PATIENT" },
      data: { payloadJson: { firstName: "Tampered", lastName: "Payload" } },
    });
    expect((await confirm(a.id, run)).body.error.code).toBe(
      "DENTALINK_PREVIEW_CHANGED",
    );
    const b = await account();
    inject(b.external, [patient()]);
    const otherRun = (await preview(b.id).expect(201)).body.data;
    await request(app)
      .put(acct(b.id) + "/mappings")
      .set(auth())
      .send({ kind: "PROVIDER", externalId: "new-map", localId: f.providerId })
      .expect(200);
    expect((await confirm(b.id, otherRun)).body.error.code).toBe(
      "DENTALINK_PREVIEW_CHANGED",
    );
  });
  it("serializes two previews confirmed concurrently without duplicating external identities", async () => {
    const a = await account();
    const p = patient();
    inject(a.external, [p]);
    const first = (await preview(a.id).expect(201)).body.data,
      second = (await preview(a.id).expect(201)).body.data;
    const confirmations = await Promise.all([
      confirm(a.id, first),
      confirm(a.id, second),
    ]);
    expect(confirmations.map((r) => r.status)).toEqual([201, 201]);
    expect(
      confirmations.reduce((sum, r) => sum + r.body.data.counts.imported, 0),
    ).toBe(1);
    expect(
      confirmations.reduce((sum, r) => sum + r.body.data.counts.skipped, 0),
    ).toBe(1);
  });
});
