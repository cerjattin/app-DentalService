import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { setTimeout } from "node:timers/promises";
import argon2 from "argon2";
import { z } from "zod";

import { prisma } from "../../src/infrastructure/database/prisma.js";

// This runner provisions only an isolated, disposable QA database. It must never
// be pointed at a clinical database. The HTTP exercise itself preserves records.
const database = new URL(process.env.DATABASE_URL ?? "");
assert.equal(database.pathname, "/odontho_master02r_test");
assert(["localhost", "127.0.0.1"].includes(database.hostname));
const port = "3402";
const origin = `http://127.0.0.1:${port}`;
const password = randomUUID();
const email = `master02r.live.${randomUUID()}@local.invalid`;
const server = spawn(process.execPath, ["--import", "tsx", "src/server.ts"], {
  env: { ...process.env, HOST: "127.0.0.1", PORT: port },
  stdio: "inherit",
});

try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error("QA backend stopped early");
    try {
      ready = (await fetch(`${origin}/health/ready`)).ok;
    } catch {
      // The backend is still starting.
    }
    if (ready) break;
    await setTimeout(500);
  }
  assert(ready, "QA backend did not become ready");

  const organization = await prisma.organization.findFirstOrThrow({
    where: { legalName: "Odontho Services B.V.", isActive: true },
  });
  const role = await prisma.role.findUniqueOrThrow({ where: { code: "ADMIN" } });
  await prisma.user.create({
    data: {
      organizationId: organization.id,
      email,
      passwordHash: await argon2.hash(password),
      firstName: "MASTER02R",
      lastName: "Live QA",
      status: "ACTIVE",
      userRoles: { create: { roleId: role.id } },
    },
  });
  const login = await fetch(`${origin}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(login.status, 200, "QA login failed");
  const session = z.object({ data: z.object({ accessToken: z.string() }) })
    .parse(await login.json());

  const qa = spawn(process.execPath, ["--import", "tsx", "src/scripts/qa-master-02r.ts"], {
    env: {
      ...process.env,
      MASTER02R_QA_BASE_URL: origin,
      MASTER02R_QA_ACCESS_TOKEN: session.data.accessToken,
      MASTER02R_QA_CURRENCY: "ANG",
      MASTER02R_QA_SERVICE_DATE: "2026-10-28",
    },
    stdio: "inherit",
  });
  const exitCode = await new Promise<number | null>((resolve, reject) => {
    qa.once("error", reject);
    qa.once("exit", resolve);
  });
  assert.equal(exitCode, 0, "Live HTTP QA failed; inspect the JSON report");
} finally {
  server.kill("SIGTERM");
  await prisma.$disconnect();
}
