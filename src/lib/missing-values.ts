// Deterministic missing-value generator. Mirrors the difficulty modes from
// the original Streamlit dashboard:
//   Easy   = missing completely at random (MCAR)
//   Medium = missing conditional on another variable
//   Hard   = conditional + restricted to the top/bottom quartile of target
//
// The same `seed` always produces the same set of deleted-row indices, so
// "Reset" and email follow-ups land on the exact same starting state.
import { ParsedCsv, dropMissingRows, getColumn, numericColumns } from "./csv";
import { mulberry32, sampleWithoutReplacement } from "./seeded-random";
import { mean, quantile } from "./stats";

export type Difficulty = "easy" | "medium" | "hard";

export interface MissingPlan {
  cleanCsv: ParsedCsv;
  workingCsv: ParsedCsv;
  deletedIndices: number[];
  conditionOp: ">" | "<";
  conditionValue: number;
  hardQuartile: "top" | "bottom";
}

export function buildPlan(
  csv: ParsedCsv,
  targetCol: string,
  yCol: string,
  conditionCol: string | null,
  difficulty: Difficulty,
  seed: number,
): MissingPlan {
  const rand = mulberry32(seed);
  const baseCols = [targetCol, yCol, ...(conditionCol ? [conditionCol] : [])];
  const cleanCsv = dropMissingRows(csv, baseCols);
  const working: ParsedCsv = {
    columns: cleanCsv.columns,
    rows: cleanCsv.rows.map((r) => r.slice()),
  };

  const targetIdx = cleanCsv.columns.indexOf(targetCol);
  const allIdx = cleanCsv.rows.map((_, i) => i);

  const condCol =
    conditionCol && conditionCol !== targetCol
      ? conditionCol
      : numericColumns(cleanCsv).find((c) => c !== targetCol && c !== yCol) ??
        cleanCsv.columns.find((c) => c !== targetCol && c !== yCol) ??
        targetCol;
  const condValuesRaw = getColumn(cleanCsv, condCol).filter(
    (v): v is number => v !== null,
  );
  const conditionValue = mean(condValuesRaw);
  const conditionOp: ">" | "<" = rand() < 0.5 ? ">" : "<";
  const hardQuartile: "top" | "bottom" = rand() < 0.5 ? "top" : "bottom";

  let eligible: number[] = allIdx;
  if (difficulty !== "easy") {
    const condIdx = cleanCsv.columns.indexOf(condCol);
    eligible = allIdx.filter((i) => {
      const v = cleanCsv.rows[i][condIdx];
      if (typeof v !== "number") return false;
      return conditionOp === ">" ? v > conditionValue : v < conditionValue;
    });
  }

  if (difficulty === "hard") {
    const targetValues = getColumn(cleanCsv, targetCol).filter(
      (v): v is number => v !== null,
    );
    const threshold = quantile(targetValues, hardQuartile === "top" ? 0.75 : 0.25);
    eligible = eligible.filter((i) => {
      const v = cleanCsv.rows[i][targetIdx];
      if (typeof v !== "number") return false;
      return hardQuartile === "top" ? v >= threshold : v <= threshold;
    });
  }

  if (eligible.length === 0) eligible = allIdx;

  const pct = 0.1 + rand() * 0.2; // 10-30%
  const n = Math.max(1, Math.floor(eligible.length * pct));
  const deletedIndices = sampleWithoutReplacement(eligible, n, rand);
  for (const i of deletedIndices) {
    working.rows[i][targetIdx] = null;
  }

  return {
    cleanCsv,
    workingCsv: working,
    deletedIndices,
    conditionOp,
    conditionValue,
    hardQuartile,
  };
}
