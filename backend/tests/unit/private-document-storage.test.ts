import { describe, expect, it, vi } from "vitest";
import { SupabaseDocumentStorage } from "../../src/modules/documents/supabase-document.storage.js";
import { LocalDocumentStorage } from "../../src/modules/documents/document.storage.js";
import { envSchema } from "../../src/config/env.js";
import { randomUUID } from "node:crypto";

const config = {
  url: "https://synthetic.example",
  bucket: "private-evidence",
  key: "SYNTHETIC-SERVER-ONLY-KEY",
};
const bytes = Buffer.from("SYNTHETIC QA EVIDENCE");
function fixture(
  options: {
    public?: boolean;
    writeStatus?: number;
    saved?: Buffer;
    unavailable?: boolean;
  } = {},
) {
  const fetcher = vi.fn<typeof fetch>(async (input, init) => {
    if (options.unavailable)
      throw new Error(`secret ${config.key} ${config.url}`);
    const url = String(input);
    if (url.includes("/bucket/"))
      return Response.json({ public: options.public ?? false });
    if (init?.method === "POST")
      return new Response(null, { status: options.writeStatus ?? 200 });
    if (init?.method === "DELETE") return new Response(null, { status: 200 });
    return new Response(new Uint8Array(options.saved ?? bytes));
  });
  return { storage: new SupabaseDocumentStorage(config, fetcher), fetcher };
}
describe("Private persistent document storage", () => {
  it("checks bucket privacy and hashes bytes across a fresh adapter instance", async () => {
    const f = fixture(),
      uri = await f.storage.write("1/evidence/a.bin", bytes);
    expect(uri).toBe("supabase://documents/private-evidence/1/evidence/a.bin");
    expect(
      await new SupabaseDocumentStorage(config, f.fetcher).read(uri),
    ).toEqual(bytes);
    const upload = f.fetcher.mock.calls.find(
      ([, init]) => init?.method === "POST",
    )!;
    expect(upload[1]?.headers).toMatchObject({
      "x-upsert": "false",
      Authorization: `Bearer ${config.key}`,
    });
    expect(
      f.fetcher.mock.calls.every(([, init]) => init?.redirect === "error"),
    ).toBe(true);
    expect(
      f.fetcher.mock.calls.some(([url]) =>
        String(url).includes("/object/public/"),
      ),
    ).toBe(false);
  });
  it("rejects public or unverified bucket metadata before any object operation", async () => {
    const f = fixture({ public: true });
    await expect(f.storage.write("1/a.bin", bytes)).rejects.toMatchObject({
      code: "DOCUMENT_STORAGE_NOT_PRIVATE",
    });
    expect(f.fetcher).toHaveBeenCalledTimes(1);
    await expect(
      f.storage.read(f.storage.uriFromKey("1/a.bin")),
    ).rejects.toMatchObject({ code: "DOCUMENT_STORAGE_NOT_PRIVATE" });
  });
  it("allows a duplicate key only for identical bytes and never overwrites", async () => {
    const f = fixture({ writeStatus: 400 });
    await expect(f.storage.write("1/a.bin", bytes)).resolves.toBe(
      f.storage.uriFromKey("1/a.bin"),
    );
    const different = fixture({
      writeStatus: 409,
      saved: Buffer.from("DIFFERENT"),
    });
    await expect(
      different.storage.write("1/a.bin", bytes),
    ).rejects.toMatchObject({ code: "DOCUMENT_STORAGE_CONFLICT" });
    expect(
      different.fetcher.mock.calls.some(
        ([, init]) => init?.method === "PUT" || init?.method === "DELETE",
      ),
    ).toBe(false);
  });
  it("detects a hash mismatch immediately after upload", async () => {
    await expect(
      fixture({ saved: Buffer.from("CORRUPT") }).storage.write(
        "1/a.bin",
        bytes,
      ),
    ).rejects.toMatchObject({ code: "DOCUMENT_INTEGRITY_MISMATCH" });
  });
  it("does not leak network errors or fall back to local storage", async () => {
    const f = fixture({ unavailable: true });
    const error = await f.storage
      .write("1/a.bin", bytes)
      .catch((e: unknown) => e);
    expect(error).toMatchObject({
      statusCode: 503,
      code: "DOCUMENT_STORAGE_UNAVAILABLE",
    });
    expect(String(error)).not.toContain(config.key);
    expect(String(error)).not.toContain(config.url);
  });
  it("rejects traversal and other bucket URIs without sending credentials", async () => {
    const f = fixture();
    for (const key of [
      "../file",
      "a/../file",
      "a/./file",
      "/file",
      "a//file",
      "a\0file",
    ])
      expect(() => f.storage.uriFromKey(key)).toThrow();
    await expect(
      f.storage.read("supabase://documents/foreign/a"),
    ).rejects.toMatchObject({ code: "DOCUMENT_STORAGE_UNSUPPORTED" });
    expect(f.fetcher).not.toHaveBeenCalled();
  });
  it("keeps existing local URIs readable after adapter restart", async () => {
    const first = new LocalDocumentStorage();
    const uri = await first.write(`final08-unit/${randomUUID()}.bin`, bytes);
    try {
      expect(await new LocalDocumentStorage().read(uri)).toEqual(bytes);
    } finally {
      await first.remove(uri);
    }
  });
  it("distinguishes a missing object from a provider failure", async () => {
    const fetcher = vi.fn<typeof fetch>(async (url) =>
      String(url).includes("/bucket/")
        ? Response.json({ public: false })
        : new Response(null, { status: 404 }),
    );
    const storage = new SupabaseDocumentStorage(config, fetcher);
    expect(await storage.exists(storage.uriFromKey("1/missing"))).toBe(false);
    await expect(
      storage.read(storage.uriFromKey("1/missing")),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("Deployment environment guards", () => {
  const base = {
    DATABASE_URL: "postgresql://qa@127.0.0.1/qa_test",
    ACCESS_TOKEN_SECRET: "synthetic-unit-secret-at-least-32-characters",
  };
  const hosted = {
    ...base,
    NODE_ENV: "production",
    VERCEL: "1",
    DOCUMENT_STORAGE_PROVIDER: "SUPABASE",
    SUPABASE_URL: config.url,
    SUPABASE_SERVICE_ROLE_KEY: config.key,
    SUPABASE_STORAGE_BUCKET: config.bucket,
    DOCUMENT_MAX_UPLOAD_BYTES: "4194304",
    CORS_ALLOWED_ORIGINS: "https://client.example",
  };
  it("allows the complete server-only configuration", () =>
    expect(envSchema.safeParse(hosted).success).toBe(true));
  it("rejects ephemeral storage, oversized uploads and missing credentials on Vercel", () => {
    for (const override of [
      { DOCUMENT_STORAGE_PROVIDER: "LOCAL" },
      { DOCUMENT_MAX_UPLOAD_BYTES: "5242880" },
      { SUPABASE_SERVICE_ROLE_KEY: undefined },
    ]) {
      expect(envSchema.safeParse({ ...hosted, ...override }).success).toBe(
        false,
      );
    }
  });
  it("rejects wildcard, mixed, HTTP and path CORS origins", () => {
    for (const origin of [
      "*",
      "https://client.example,*",
      "http://client.example",
      "https://client.example/path",
    ])
      expect(
        envSchema.safeParse({ ...hosted, CORS_ALLOWED_ORIGINS: origin })
          .success,
      ).toBe(false);
  });
  it("rejects credentials or paths in the storage origin", () => {
    for (const url of [
      "invalid",
      "http://host.example",
      "https://user:pass@host.example",
      "https://host.example/path",
      "https://host.example/?key=secret",
    ])
      expect(
        envSchema.safeParse({ ...hosted, SUPABASE_URL: url }).success,
      ).toBe(false);
  });
});
