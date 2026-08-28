import { createHash } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors/app-error.js";

const STORAGE_URI_PREFIX = "local://documents/";

function storageRoot() {
  const root = path.resolve(process.cwd(), env.DOCUMENT_STORAGE_PATH);
  const srcRoot = path.resolve(process.cwd(), "src");

  if (root === srcRoot || root.startsWith(`${srcRoot}${path.sep}`)) {
    throw new AppError(
      500,
      "DOCUMENT_STORAGE_INVALID",
      "Document storage path cannot be inside src",
    );
  }

  return root;
}

function normalizeStorageKey(key: string) {
  const normalized = key.replaceAll("\\", "/");

  if (
    normalized.length === 0 ||
    normalized.startsWith("/") ||
    normalized.includes("../") ||
    normalized.includes("/..") ||
    normalized === ".."
  ) {
    throw new AppError(
      400,
      "DOCUMENT_STORAGE_URI_INVALID",
      "Document storage URI is invalid",
    );
  }

  return normalized;
}

function storagePathFromKey(key: string) {
  const root = storageRoot();
  const target = path.resolve(root, ...normalizeStorageKey(key).split("/"));

  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    throw new AppError(
      400,
      "DOCUMENT_STORAGE_URI_INVALID",
      "Document storage URI is invalid",
    );
  }

  return target;
}

export function sha256Hex(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function storageUriFromKey(key: string) {
  return `${STORAGE_URI_PREFIX}${normalizeStorageKey(key)}`;
}

export function keyFromStorageUri(storageUri: string) {
  if (!storageUri.startsWith(STORAGE_URI_PREFIX)) {
    throw new AppError(
      409,
      "DOCUMENT_STORAGE_UNSUPPORTED",
      "Document storage provider is unsupported",
    );
  }

  return normalizeStorageKey(storageUri.slice(STORAGE_URI_PREFIX.length));
}

export class LocalDocumentStorage {
  async write(key: string, bytes: Buffer) {
    const target = storagePathFromKey(key);

    await mkdir(path.dirname(target), { recursive: true });

    try {
      await writeFile(target, bytes, { flag: "wx" });
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "EEXIST"
      ) {
        const existing = await readFile(target);
        if (sha256Hex(existing) === sha256Hex(bytes)) {
          return storageUriFromKey(key);
        }
      }

      throw error;
    }

    return storageUriFromKey(key);
  }

  async read(storageUri: string) {
    const target = storagePathFromKey(keyFromStorageUri(storageUri));

    try {
      return await readFile(target);
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        throw new AppError(
          404,
          "DOCUMENT_FILE_NOT_FOUND",
          "Document file was not found",
        );
      }

      throw error;
    }
  }

  async remove(storageUri: string) {
    const target = storagePathFromKey(keyFromStorageUri(storageUri));
    await rm(target, { force: true });
  }

  async exists(storageUri: string) {
    const target = storagePathFromKey(keyFromStorageUri(storageUri));

    try {
      await stat(target);
      return true;
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return false;
      }

      throw error;
    }
  }
}

export const documentStorage = new LocalDocumentStorage();
