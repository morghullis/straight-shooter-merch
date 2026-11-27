/**
 * A size guide's table as typed in Shopify (Content > Metaobjects > Size guide > Table): one row per
 * line, cells split by "|" or tabs (a table pasted from a spreadsheet works too); the first line
 * names the columns. Blank lines and empty cells at the edges are ignored.
 */
export function parseSizeTable(text: string | null | undefined): {
  columns: string[];
  rows: string[][];
} {
  const lines = (text ?? "")
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^\s*\|/, "")
        .replace(/\|\s*$/, "")
        .split(/\s*[|\t]\s*/)
        .map((cell) => cell.trim()),
    )
    .filter((cells) => cells.some(Boolean));
  const [columns = [], ...rows] = lines;
  return { columns, rows };
}
