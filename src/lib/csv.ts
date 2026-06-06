// Lightweight CSV parser & dataframe utilities. Handles quoted fields and
// numeric coercion. We don't need full RFC compliance.
export interface ParsedCsv {
  columns: string[];
  rows: (string | number | null)[][];
}

export function parseCsv(text: string): ParsedCsv {
  const lines: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        cur.push(field);
        field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        cur.push(field);
        field = "";
        if (cur.length > 1 || cur[0] !== "") lines.push(cur);
        cur = [];
      } else {
        field += c;
      }
    }
  }
  if (field.length > 0 || cur.length) {
    cur.push(field);
    lines.push(cur);
  }
  if (lines.length === 0) return { columns: [], rows: [] };
  const columns = lines[0];
  const rows = lines.slice(1).map((cells) =>
    cells.map((cell) => {
      if (cell === "" || cell === "NA" || cell === "NaN") return null;
      const n = Number(cell);
      return Number.isFinite(n) && cell.trim() !== "" ? n : cell;
    }),
  );
  return { columns, rows };
}

export function getColumn(
  csv: ParsedCsv,
  name: string,
): (number | null)[] {
  const i = csv.columns.indexOf(name);
  if (i === -1) return [];
  return csv.rows.map((r) => {
    const v = r[i];
    return typeof v === "number" ? v : null;
  });
}

export function numericColumns(csv: ParsedCsv): string[] {
  return csv.columns.filter((c) => {
    const col = getColumn(csv, c);
    const numericCount = col.filter((v) => v !== null).length;
    return numericCount > csv.rows.length * 0.5;
  });
}

export function dropMissingRows(csv: ParsedCsv, cols: string[]): ParsedCsv {
  const idxs = cols.map((c) => csv.columns.indexOf(c));
  const rows = csv.rows.filter((r) => idxs.every((i) => r[i] !== null));
  return { columns: csv.columns, rows };
}
