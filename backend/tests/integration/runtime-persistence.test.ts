import pg from "pg";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { randomUUID, createHash } from "node:crypto";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { env } from "../../src/config/env.js";
import { prisma } from "../../src/infrastructure/database/prisma.js";
import { accessTokenService } from "../../src/modules/auth/access-token.service.js";
import { createNegFuncDbFixture } from "../helpers/neg-func-db-fixture.js";
const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
let f: Awaited<ReturnType<typeof createNegFuncDbFixture>>,
  other: typeof f,
  token: string,
  foreign: string;
let child: ChildProcess | undefined, origin: string;
const root = path.resolve("storage/dep12-runtime-qa", randomUUID());
const bytes = Buffer.from("%PDF-1.4\nSYNTHETIC DEP12 RESTART EVIDENCE\n%%EOF");
const digest = (buffer: Buffer) =>
  createHash("sha256").update(buffer).digest("hex");
async function stop() {
  if (!child || child.exitCode !== null) return;
  const process = child;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("QA child did not stop")),
      10000,
    );
    process.once("close", () => {
      clearTimeout(timer);
      resolve();
    });
    process.kill("SIGTERM");
  });
  child = undefined;
}
async function start() {
  const probe = createServer();
  await new Promise<void>((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const address = probe.address();
  if (!address || typeof address === "string")
    throw new Error("QA port unavailable");
  const port = address.port;
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  child = spawn(process.execPath, ["--import", "tsx", "src/server.ts"], {
    windowsHide: true,
    stdio: "ignore",
    env: {
      ...process.env,
      NODE_ENV: "test",
      ODONTHO_ENV_FILE: "",
      DATABASE_URL: process.env.TEST_DATABASE_URL!,
      HOST: "127.0.0.1",
      PORT: String(port),
      LOG_LEVEL: "silent",
      DOCUMENT_STORAGE_PROVIDER: "LOCAL",
      DOCUMENT_STORAGE_PATH: root,
      ACCESS_TOKEN_SECRET: env.ACCESS_TOKEN_SECRET,
      SVB_MANUAL_RECORDING_ENABLED: "false",
      VERCEL: "0",
    },
  });
  origin = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null)
      throw new Error("QA runtime exited before readiness");
    try {
      if (
        (
          await fetch(`${origin}/health/ready`, {
            signal: AbortSignal.timeout(1000),
          })
        ).ok
      )
        return;
    } catch {
      /* Booting child. */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("QA runtime readiness timed out");
}
const headers = () => ({ Authorization: `Bearer ${token}` });
describe("DEP12 actual runtime with a persistent QA directory", () => {
  beforeAll(async () => {
    await db.connect();
    f = await createNegFuncDbFixture(db);
    other = await createNegFuncDbFixture(db);
    for (const id of [f.userId, other.userId])
      await db.query(
        "INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE code='ADMIN'",
        [id],
      );
    token = await accessTokenService.sign(
      BigInt(f.userId),
      BigInt(f.organizationId),
    );
    foreign = await accessTokenService.sign(
      BigInt(other.userId),
      BigInt(other.organizationId),
    );
    await start();
  }, 30000);
  afterAll(async () => {
    await stop();
    if (f) {
      const docs = await prisma.document.findMany({
        where: { organizationId: BigInt(f.organizationId) },
      });
      await prisma.document.deleteMany({
        where: { organizationId: BigInt(f.organizationId) },
      });
      for (const doc of docs) {
        if (!doc.storageUri.startsWith("local://documents/"))
          throw new Error("Unexpected QA provider");
        const target = path.resolve(
          root,
          doc.storageUri.slice("local://documents/".length),
        );
        if (
          !target.startsWith(`${root}${path.sep}`) ||
          !root.startsWith(path.resolve("storage/dep12-runtime-qa") + path.sep)
        )
          throw new Error("QA file cleanup refused");
        await unlink(target);
      }
      await f.cleanup();
      await other.cleanup();
    }
    await prisma.$disconnect();
    await db.end();
  }, 20000);
  it("retains identical authenticated bytes and organization isolation after a new server process", async () => {
    const upload = await fetch(
      `${origin}/api/v1/documents?documentType=OTHER&originalFilename=synthetic-restart.pdf`,
      {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/pdf" },
        body: new Uint8Array(bytes),
      },
    );
    expect(upload.status).toBe(201);
    const metadata = z
      .object({
        data: z.object({ id: z.string(), sha256: z.string() }).passthrough(),
      })
      .parse(await upload.json()).data;
    expect(metadata.sha256).toBe(digest(bytes));
    expect(metadata).not.toHaveProperty("storageUri");
    const first = await fetch(
      `${origin}/api/v1/documents/${metadata.id}/download`,
      { headers: headers() },
    );
    expect(first.status).toBe(200);
    expect(digest(Buffer.from(await first.arrayBuffer()))).toBe(
      metadata.sha256,
    );
    await stop();
    await start();
    const second = await fetch(
      `${origin}/api/v1/documents/${metadata.id}/download`,
      { headers: headers() },
    );
    expect(second.status).toBe(200);
    expect(second.headers.get("cache-control")).toBe("private, no-store");
    expect(Buffer.from(await second.arrayBuffer())).toEqual(bytes);
    expect(
      (
        await fetch(`${origin}/api/v1/documents/${metadata.id}/download`, {
          headers: { Authorization: `Bearer ${foreign}` },
        })
      ).status,
    ).toBe(404);
    expect(
      (await fetch(`${origin}/api/v1/documents/${metadata.id}/download`))
        .status,
    ).toBe(401);
    const readiness = await fetch(`${origin}/api/v1/svb-pilot/readiness`, {
      headers: headers(),
    });
    expect(
      z
        .object({
          data: z.object({ manualPortalRecordingEnabled: z.boolean() }),
        })
        .parse(await readiness.json()).data.manualPortalRecordingEnabled,
    ).toBe(false);
  }, 30000);
});
