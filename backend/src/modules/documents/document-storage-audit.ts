import { createHash } from "node:crypto";
type InventoryDocument = {
  id: bigint;
  organizationId: bigint;
  storageUri: string;
  storageProvider: string;
  sha256: string;
  sizeBytes: bigint;
};
const hash = (bytes: Buffer | string) =>
  createHash("sha256").update(bytes).digest("hex");
/** Read-only deployment evidence. Public report has counts/hashes, never paths, identities or provider errors. */
export async function auditDocumentStorage(
  documents: InventoryDocument[],
  options: {
    read?: (uri: string) => Promise<Buffer>;
    requireExternal: boolean;
  },
) {
  const report = {
    readOnly: true,
    documents: documents.length,
    local: 0,
    external: 0,
    unsupported: 0,
    bytesVerified: 0,
    missing: 0,
    integrityMismatch: 0,
    storageFailures: 0,
    bytesVerificationExecuted: options.read !== undefined,
    externalRequired: options.requireExternal,
    manifestHash: "",
    blocked: false,
  };
  const manifest = [...documents]
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((doc) => ({
      id: doc.id.toString(),
      organizationId: doc.organizationId.toString(),
      storageUri: doc.storageUri,
      storageProvider: doc.storageProvider,
      sha256: doc.sha256,
      sizeBytes: doc.sizeBytes.toString(),
    }));
  report.manifestHash = hash(JSON.stringify(manifest));
  for (const doc of documents) {
    const local = doc.storageUri.startsWith("local://documents/");
    const external = doc.storageUri.startsWith("supabase://documents/");
    if (local) report.local++;
    else if (external) report.external++;
    else {
      report.unsupported++;
      continue;
    }
    if (!options.read) continue;
    try {
      const bytes = await options.read(doc.storageUri);
      if (BigInt(bytes.length) !== doc.sizeBytes || hash(bytes) !== doc.sha256)
        report.integrityMismatch++;
      else report.bytesVerified++;
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? error.code
          : undefined;
      if (code === "DOCUMENT_FILE_NOT_FOUND") report.missing++;
      else report.storageFailures++;
    }
  }
  report.blocked =
    report.unsupported > 0 ||
    report.integrityMismatch > 0 ||
    report.missing > 0 ||
    report.storageFailures > 0 ||
    (options.requireExternal && report.local > 0);
  return { report, manifest };
}
