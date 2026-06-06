import type { ParsedCsv } from "@/lib/csv";
import { csvToString } from "@/lib/exercise/csv-serialize";
import type { ExecResult } from "@/hooks/use-pyodide";
import { mean, median } from "@/lib/stats";

export interface JsRunnerContext {
  targetCol: string;
  yCol: string;
  conditionCol?: string | null;
}

function cloneCsv(csv: ParsedCsv): ParsedCsv {
  return {
    columns: csv.columns.slice(),
    rows: csv.rows.map((r) => r.slice()),
  };
}

function colIndex(csv: ParsedCsv, name: string): number {
  return csv.columns.indexOf(name);
}

function numericValues(csv: ParsedCsv, col: string): number[] {
  const i = colIndex(csv, col);
  if (i === -1) return [];
  return csv.rows
    .map((r) => r[i])
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
}

function fillnaColumn(csv: ParsedCsv, col: string, value: number) {
  const i = colIndex(csv, col);
  if (i === -1) return;
  for (const row of csv.rows) {
    if (row[i] == null) row[i] = value;
  }
}

function fillnaGroupTransform(
  csv: ParsedCsv,
  groupCol: string,
  targetCol: string,
  stat: "mean" | "median",
) {
  const gi = colIndex(csv, groupCol);
  const ti = colIndex(csv, targetCol);
  if (gi === -1 || ti === -1) return;

  const groupValues = numericValues(csv, groupCol);
  const threshold = median(groupValues);
  const groups = new Map<string, number[]>();

  for (const row of csv.rows) {
    const gv = row[gi];
    const key =
      typeof gv === "number" ? (gv > threshold ? "high" : "low") : String(gv ?? "unknown");
    const tv = row[ti];
    if (typeof tv === "number") {
      const arr = groups.get(key) ?? [];
      arr.push(tv);
      groups.set(key, arr);
    }
  }

  const groupStats = new Map<string, number>();
  for (const [key, vals] of groups) {
    groupStats.set(key, stat === "mean" ? mean(vals) : median(vals));
  }

  for (const row of csv.rows) {
    if (row[ti] != null) continue;
    const gv = row[gi];
    const key =
      typeof gv === "number" ? (gv > threshold ? "high" : "low") : String(gv ?? "unknown");
    const fill = groupStats.get(key);
    if (fill != null && Number.isFinite(fill)) row[ti] = fill;
  }
}

function fillnaGroupbyTransform(
  csv: ParsedCsv,
  groupCol: string,
  targetCol: string,
  stat: "mean" | "median",
) {
  const gi = colIndex(csv, groupCol);
  const ti = colIndex(csv, targetCol);
  if (gi === -1 || ti === -1) return;

  const groups = new Map<string, number[]>();
  for (const row of csv.rows) {
    const key = String(row[gi] ?? "");
    const tv = row[ti];
    if (typeof tv === "number") {
      const arr = groups.get(key) ?? [];
      arr.push(tv);
      groups.set(key, arr);
    }
  }

  const groupStats = new Map<string, number>();
  for (const [key, vals] of groups) {
    groupStats.set(key, stat === "mean" ? mean(vals) : median(vals));
  }

  for (const row of csv.rows) {
    if (row[ti] != null) continue;
    const key = String(row[gi] ?? "");
    const fill = groupStats.get(key);
    if (fill != null && Number.isFinite(fill)) row[ti] = fill;
  }
}

function toTableJson(csv: ParsedCsv, n: number): string {
  const head = csv.rows.slice(0, n);
  return JSON.stringify({
    columns: csv.columns,
    data: head.map((r) => r.map((v) => (v == null ? null : typeof v === "number" ? v : String(v)))),
    index: head.map((_, i) => i),
  });
}

function applyKnownPatterns(code: string, csv: ParsedCsv, ctx: JsRunnerContext): boolean {
  let applied = false;
  const col = `['"]([^'"]+)['"]`;

  const meanFill = new RegExp(
    `df\\[${col}\\]\\s*=\\s*df\\[\\1\\]\\.fillna\\(\\s*df\\[\\1\\]\\.mean\\(\\)\\s*\\)`,
  );
  const medianFill = new RegExp(
    `df\\[${col}\\]\\s*=\\s*df\\[\\1\\]\\.fillna\\(\\s*df\\[\\1\\]\\.median\\(\\)\\s*\\)`,
  );
  const groupTransform = new RegExp(
    `df\\[${col}\\]\\s*=\\s*df\\.groupby\\(\\s*${col}\\s*\\)\\[${col}\\]\\.transform\\(\\s*['"](mean|median)['"]\\s*\\)`,
  );
  const bucketGroup = /df\[['"][^'"]+['"]\]\s*=\s*df\.groupby\(/;

  let m = code.match(meanFill);
  if (m) {
    const col = m[1];
    const vals = numericValues(csv, col);
    if (vals.length) {
      fillnaColumn(csv, col, mean(vals));
      applied = true;
    }
  }

  m = code.match(medianFill);
  if (m) {
    const col = m[1];
    const vals = numericValues(csv, col);
    if (vals.length) {
      fillnaColumn(csv, col, median(vals));
      applied = true;
    }
  }

  m = code.match(groupTransform);
  if (m) {
    const groupCol = m[1];
    const targetCol = m[2];
    const stat = m[3] as "mean" | "median";
    fillnaGroupbyTransform(csv, groupCol, targetCol, stat);
    applied = true;
  }

  if (bucketGroup.test(code) && ctx.conditionCol && ctx.targetCol) {
    fillnaGroupTransform(csv, ctx.conditionCol, ctx.targetCol, "mean");
    applied = true;
  }

  if (!applied && ctx.targetCol) {
    const target = ctx.targetCol;
    if (code.includes(".mean()") && code.includes("fillna")) {
      const vals = numericValues(csv, target);
      if (vals.length) {
        fillnaColumn(csv, target, mean(vals));
        applied = true;
      }
    } else if (code.includes(".median()") && code.includes("fillna")) {
      const vals = numericValues(csv, target);
      if (vals.length) {
        fillnaColumn(csv, target, median(vals));
        applied = true;
      }
    }
  }

  return applied;
}

export function runJsImputation(
  code: string,
  workingCsv: ParsedCsv,
  ctx: JsRunnerContext,
): ExecResult {
  const df = cloneCsv(workingCsv);
  const applied = applyKnownPatterns(code, df, ctx);

  if (!applied) {
    return {
      ok: false,
      stdout: "",
      resultText: null,
      resultIsTable: false,
      tableJson: null,
      dfCsv: csvToString(workingCsv),
      error:
        "JS fallback only supports mean/median fillna and simple groupby transform patterns. Retry Python or use a sample solution snippet.",
    };
  }

  const lines = code
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith("#"));
  const lastLine = lines[lines.length - 1]?.trim() ?? "";
  const wantsHead = /df\.head\s*\(\s*\)/.test(lastLine);

  if (wantsHead) {
    const nMatch = lastLine.match(/df\.head\s*\(\s*(\d+)\s*\)/);
    const n = nMatch ? Number(nMatch[1]) : 5;
    return {
      ok: true,
      stdout: "(JS fallback — pandas not available)\n",
      resultText: null,
      resultIsTable: true,
      tableJson: toTableJson(df, n),
      dfCsv: csvToString(df),
    };
  }

  return {
    ok: true,
    stdout: "(JS fallback — pandas not available)\n",
    resultText: null,
    resultIsTable: false,
    tableJson: null,
    dfCsv: csvToString(df),
  };
}
