import { getColumn, ParsedCsv } from "@/lib/csv";
import { mean, median } from "@/lib/stats";
import type { ColumnSummary } from "./types";

export function headTable(csv: ParsedCsv, n = 10): ParsedCsv {
  return { columns: csv.columns, rows: csv.rows.slice(0, n) };
}

export function missingInColumn(csv: ParsedCsv, col: string): number {
  const i = csv.columns.indexOf(col);
  if (i === -1) return 0;
  return csv.rows.filter((r) => r[i] === null).length;
}

export function columnSummary(csv: ParsedCsv): ColumnSummary[] {
  return csv.columns.map((col, i) => {
    const vals = csv.rows.map((r) => r[i]);
    const nonNull = vals.filter((v) => v !== null && v !== "");
    const nums = nonNull.filter((v): v is number => typeof v === "number");
    const isNumeric =
      nums.length > 0 && nums.length / Math.max(nonNull.length, 1) > 0.6;
    const samples = nonNull.slice(0, 4).map((v) => String(v)).join(", ");
    let summary = "";
    if (isNumeric) {
      const mn = Math.min(...nums);
      const mx = Math.max(...nums);
      summary = `min ${fmt(mn)} · mean ${fmt(mean(nums))} · median ${fmt(median(nums))} · max ${fmt(mx)}`;
    }
    return {
      col,
      dtype: isNumeric
        ? "numeric"
        : nonNull.every((v) => v === "true" || v === "false")
          ? "bool"
          : "string",
      nonNull: nonNull.length,
      missing: vals.length - nonNull.length,
      samples,
      summary,
    };
  });
}

function fmt(v: number) {
  if (!Number.isFinite(v)) return "—";
  if (Math.abs(v) >= 1000) return v.toFixed(0);
  return v.toFixed(2);
}
