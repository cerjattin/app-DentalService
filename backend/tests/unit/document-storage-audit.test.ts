import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { auditDocumentStorage } from "../../src/modules/documents/document-storage-audit.js";
const bytes = Buffer.from("SYNTHETIC"),
  sha256 = createHash("sha256").update(bytes).digest("hex");
const doc = {
  id: 123n,
  organizationId: 456n,
  storageUri: "local://documents/private/path",
  storageProvider: "LOCAL",
  sha256,
  sizeBytes: BigInt(bytes.length),
};
describe("DEP12 read-only document transition inventory", () => {
  it("counts local URIs without claiming that configuration transfers old documents", async () => {
    const result = await auditDocumentStorage([doc], { requireExternal: true });
    expect(result.report).toMatchObject({
      local: 1,
      external: 0,
      blocked: true,
      bytesVerificationExecuted: false,
    });
    expect(result.manifest[0]).toMatchObject({
      id: "123",
      organizationId: "456",
      sizeBytes: String(bytes.length),
      sha256,
    });
    expect(JSON.stringify(result.report)).not.toContain("private/path");
    expect(result.report).not.toHaveProperty("id");
  });
  it("checks existing bytes and preserves a reproducible metadata fingerprint", async () => {
    const read = vi.fn(async () => bytes),
      other = {
        ...doc,
        id: 124n,
        storageUri: "supabase://documents/qa-bucket/a",
        storageProvider: "OTHER",
      };
    const a = await auditDocumentStorage([doc, other], {
      requireExternal: false,
      read,
    });
    const b = await auditDocumentStorage([other, doc], {
      requireExternal: false,
    });
    expect(a.report).toMatchObject({ bytesVerified: 2, blocked: false });
    expect(a.report.manifestHash).toBe(b.report.manifestHash);
    expect(read).toHaveBeenCalledTimes(2);
  });
  it("blocks missing, corrupt, unsupported and provider-error objects without leaking error details", async () => {
    const rows = [
      doc,
      { ...doc, id: 2n },
      { ...doc, id: 3n },
      { ...doc, id: 4n, storageUri: "public://unsupported" },
    ];
    const read = vi
      .fn()
      .mockResolvedValueOnce(Buffer.from("CORRUPT"))
      .mockRejectedValueOnce({ code: "DOCUMENT_FILE_NOT_FOUND" })
      .mockRejectedValueOnce(new Error("SENSITIVE URI AND KEY"));
    const result = await auditDocumentStorage(rows, {
      requireExternal: false,
      read,
    });
    expect(result.report).toMatchObject({
      integrityMismatch: 1,
      missing: 1,
      storageFailures: 1,
      unsupported: 1,
      blocked: true,
    });
    expect(JSON.stringify(result.report)).not.toContain("SENSITIVE");
  });
});
