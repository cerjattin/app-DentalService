import { createHash } from "node:crypto";
import { AppError } from "../../shared/errors/app-error.js";
import { normalizeStorageKey } from "./document.storage.js";

const unavailable = () =>
  new AppError(
    503,
    "DOCUMENT_STORAGE_UNAVAILABLE",
    "Private document storage is unavailable",
  );
const digest = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
/** Server-only adapter. No public URLs, signed URLs, bucket creation or overwrite. */
export class SupabaseDocumentStorage {
  constructor(
    private readonly config: { url: string; key: string; bucket: string },
    private readonly fetcher: typeof fetch = fetch,
  ) {}
  uriFromKey(key: string) {
    return `supabase://documents/${this.config.bucket}/${normalizeStorageKey(key)}`;
  }
  private key(uri: string) {
    const prefix = `supabase://documents/${this.config.bucket}/`;
    if (!uri.startsWith(prefix))
      throw new AppError(
        409,
        "DOCUMENT_STORAGE_UNSUPPORTED",
        "Document storage bucket is unsupported",
      );
    return normalizeStorageKey(uri.slice(prefix.length));
  }
  private path(key: string) {
    return `${encodeURIComponent(this.config.bucket)}/${normalizeStorageKey(key).split("/").map(encodeURIComponent).join("/")}`;
  }
  private async call(path: string, init: RequestInit = {}) {
    try {
      return await this.fetcher(
        `${this.config.url.replace(/\/$/, "")}/storage/v1/${path}`,
        {
          ...init,
          redirect: "error",
          signal: AbortSignal.timeout(15_000),
          headers: {
            Authorization: `Bearer ${this.config.key}`,
            apikey: this.config.key,
            ...init.headers,
          },
        },
      );
    } catch {
      throw unavailable();
    } // Never propagate URLs, headers or service responses into API/log errors.
  }
  private async assertPrivate() {
    const response = await this.call(
      `bucket/${encodeURIComponent(this.config.bucket)}`,
    );
    if (!response.ok) throw unavailable();
    let bucket: unknown;
    try {
      bucket = await response.json();
    } catch {
      throw unavailable();
    }
    if (
      typeof bucket !== "object" ||
      bucket === null ||
      !("public" in bucket) ||
      bucket.public !== false
    ) {
      throw new AppError(
        503,
        "DOCUMENT_STORAGE_NOT_PRIVATE",
        "Document storage bucket must be private",
      );
    }
  }
  private async readObject(key: string) {
    const response = await this.call(`object/authenticated/${this.path(key)}`);
    if (response.status === 404)
      throw new AppError(
        404,
        "DOCUMENT_FILE_NOT_FOUND",
        "Document file was not found",
      );
    if (!response.ok) throw unavailable();
    try {
      return Buffer.from(await response.arrayBuffer());
    } catch {
      throw unavailable();
    }
  }
  async write(key: string, bytes: Buffer) {
    const uri = this.uriFromKey(key);
    await this.assertPrivate();
    const response = await this.call(`object/${this.path(key)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "x-upsert": "false",
        "Cache-Control": "private, no-store",
      },
      body: new Uint8Array(bytes),
    });
    if (!response.ok) {
      // Supabase may return either HTTP 400 or 409 for an existing immutable key.
      if (response.status === 400 || response.status === 409) {
        const current = await this.readObject(key);
        if (digest(current) === digest(bytes)) return uri;
        throw new AppError(
          409,
          "DOCUMENT_STORAGE_CONFLICT",
          "Document storage key already contains different bytes",
        );
      }
      throw unavailable();
    }
    const saved = await this.readObject(key);
    if (digest(saved) !== digest(bytes))
      throw new AppError(
        409,
        "DOCUMENT_INTEGRITY_MISMATCH",
        "Stored document hash does not match uploaded bytes",
      );
    return uri;
  }
  async read(uri: string) {
    const key = this.key(uri);
    await this.assertPrivate();
    return this.readObject(key);
  }
  async exists(uri: string) {
    try {
      await this.read(uri);
      return true;
    } catch (error) {
      if (error instanceof AppError && error.code === "DOCUMENT_FILE_NOT_FOUND")
        return false;
      throw error;
    }
  }
  async remove(uri: string) {
    const key = this.key(uri);
    await this.assertPrivate();
    const response = await this.call(`object/${this.path(key)}`, {
      method: "DELETE",
    });
    if (!response.ok && response.status !== 404) throw unavailable();
  }
}
