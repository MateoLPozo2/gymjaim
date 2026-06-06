import { parseCsv, numericColumns } from "@/lib/csv";
import { columnSummary } from "@/lib/exercise/preview";

export interface DatasetProfileColumn {
  name: string;
  dtype: string;
  non_null: number;
  missing: number;
  samples: string[];
  min?: number;
  max?: number;
  mean?: number;
}

export interface DatasetProfile {
  columns: DatasetProfileColumn[];
  column_names: string[];
  row_count: number;
  numeric_columns: string[];
  preview_rows: Record<string, unknown>[];
}

export function profileCsvLocally(csvText: string): DatasetProfile {
  const parsed = parseCsv(csvText);
  if (parsed.columns.length === 0) throw new Error("Empty CSV");
  const numeric_cols = numericColumns(parsed);
  if (numeric_cols.length < 2) throw new Error("Need at least 2 numeric columns");

  const summaries = columnSummary(parsed);
  const columns: DatasetProfileColumn[] = summaries.map((s) => ({
    name: s.col,
    dtype: s.dtype,
    non_null: s.nonNull,
    missing: s.missing,
    samples: s.samples ? s.samples.split(", ") : [],
  }));

  const preview_rows = parsed.rows.slice(0, 20).map((row) => {
    const obj: Record<string, unknown> = {};
    parsed.columns.forEach((c, i) => {
      obj[c] = row[i];
    });
    return obj;
  });

  return {
    columns,
    column_names: parsed.columns,
    row_count: parsed.rows.length,
    numeric_columns: numeric_cols,
    preview_rows,
  };
}
