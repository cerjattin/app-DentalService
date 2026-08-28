import type { SvbDeclarationRow } from "./declaration-row.mapper.js";
import { renderCsvRows } from "./csv.adapter.js";

export function renderTxtRows(rows: SvbDeclarationRow[]) {
  return renderCsvRows(rows);
}
