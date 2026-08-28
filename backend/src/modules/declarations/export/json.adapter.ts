import type { SvbDeclarationRow } from "./declaration-row.mapper.js";

export function renderJsonRows(input: {
  declarationNumber: string | null;
  rows: SvbDeclarationRow[];
}) {
  return Buffer.from(
    `${JSON.stringify(
      {
        schemaVersion: "SVB_DECLARATION_ROW_V1",
        declarationNumber: input.declarationNumber,
        rows: input.rows,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}
