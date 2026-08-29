import type {
  DeclarationBatchRecord,
  DeclarationExportRecord,
} from "./declaration.repository.js";

export interface DeclarationSubmissionAdapterInput {
  declaration: DeclarationBatchRecord;
  declarationExport: DeclarationExportRecord;
  documentBytes: Buffer;
  metadata: {
    correlationId?: string;
  };
}

export interface DeclarationSubmissionAdapterResult {
  channel: "PORTAL_UPLOAD" | "API" | "MANUAL" | "OTHER";
  externalReference?: string;
  requestMetadata?: Record<string, unknown>;
  responseMetadata?: Record<string, unknown>;
}

export interface DeclarationSubmissionAdapter {
  submit(
    input: DeclarationSubmissionAdapterInput,
  ): Promise<DeclarationSubmissionAdapterResult>;
}
