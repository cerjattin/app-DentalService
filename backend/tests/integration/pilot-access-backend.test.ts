import pg from "pg";
import request from "supertest";
import { SignJWT } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { env } from "../../src/config/env.js";
import { prisma } from "../../src/infrastructure/database/prisma.js";
import { accessTokenService } from "../../src/modules/auth/access-token.service.js";
import { createNegFuncDbFixture } from "../helpers/neg-func-db-fixture.js";
const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
let f: Awaited<ReturnType<typeof createNegFuncDbFixture>>, token: string;
const me = (value = token) =>
  request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${value}`);
describe("Pilot backend access with existing JWT and database permissions", () => {
  beforeAll(async () => {
    await db.connect();
    f = await createNegFuncDbFixture(db);
    await db.query(
      "INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE code='ADMIN'",
      [f.userId],
    );
    token = await accessTokenService.sign(
      BigInt(f.userId),
      BigInt(f.organizationId),
    );
  });
  afterAll(async () => {
    await f?.cleanup();
    await db.end();
    await prisma.$disconnect();
  });
  it("rejects an expired, correctly signed access token without exposing it", async () => {
    const expired = await new SignJWT({ org: f.organizationId, typ: "access" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(f.userId)
      .setIssuer(env.JWT_ISSUER)
      .setAudience(env.JWT_AUDIENCE)
      .setIssuedAt(1)
      .setExpirationTime(2)
      .sign(new TextEncoder().encode(env.ACCESS_TOKEN_SECRET));
    const r = await me(expired).expect(401);
    expect(r.body.error.code).toBe("INVALID_ACCESS_TOKEN");
    expect(JSON.stringify(r.body)).not.toContain(expired);
    expect(r.body.error.correlationId).toEqual(expect.any(String));
  });
  it("enforces account deactivation and changed organization on the next request", async () => {
    await me().expect(200);
    await db.query("UPDATE users SET status='INACTIVE' WHERE id=$1", [
      f.userId,
    ]);
    try {
      await me().expect(401);
    } finally {
      await db.query("UPDATE users SET status='ACTIVE' WHERE id=$1", [
        f.userId,
      ]);
    }
    const foreign = await accessTokenService.sign(
      BigInt(f.userId),
      BigInt(f.organizationId) + 1000000n,
    );
    await me(foreign).expect(401);
    await me().expect(200);
  });
  it("reloads effective permissions for the same token, without a role-name shortcut", async () => {
    await request(app)
      .get("/api/v1/organization")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    await db.query("DELETE FROM user_roles WHERE user_id=$1", [f.userId]);
    try {
      await request(app)
        .get("/api/v1/organization")
        .set("Authorization", `Bearer ${token}`)
        .expect(403);
    } finally {
      await db.query(
        "INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE code='ADMIN'",
        [f.userId],
      );
    }
    await me().expect(200);
  });
  it("enforces the actual document limit and keeps errors free of bytes and storage details", async () => {
    const r = await request(app)
      .post(
        "/api/v1/documents?documentType=OTHER&originalFilename=synthetic.pdf",
      )
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/pdf")
      .send(Buffer.alloc(env.DOCUMENT_MAX_UPLOAD_BYTES + 1, 65))
      .expect(400);
    expect(r.body.error.code).toBe("DOCUMENT_TOO_LARGE");
    expect(JSON.stringify(r.body)).not.toContain("storageUri");
    expect(r.body.error.stack).toBeUndefined();
  });
});
