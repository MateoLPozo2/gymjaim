import { getColumn, ParsedCsv } from "@/lib/csv";
import { mean, median, ordinaryLeastSquares } from "@/lib/stats";
import type { ExerciseMeta, GradeResult, MissingPlan, SlopesResult } from "./types";

export function gradeAttempt(
  plan: MissingPlan,
  workingCsv: ParsedCsv,
  exercise: Pick<ExerciseMeta, "target_col" | "y_col" | "condition_col" | "difficulty">,
): GradeResult {
  const slopes = computeSlopes(plan, workingCsv, exercise);
  const delta = slopes.user - slopes.expected;
  const pct = slopes.expected ? (delta / slopes.expected) * 100 : NaN;
  const matched =
    Number.isFinite(slopes.optimal) &&
    Math.abs(slopes.user - slopes.optimal) < 1e-4;
  return { slopes, delta, pct, matched };
}

function computeSlopes(
  plan: MissingPlan,
  workingCsv: ParsedCsv,
  exercise: Pick<ExerciseMeta, "target_col" | "y_col" | "condition_col" | "difficulty">,
): SlopesResult {
  const clean = plan.cleanCsv;
  const exp = ordinaryLeastSquares(
    getColumn(clean, exercise.target_col),
    getColumn(clean, exercise.y_col),
  );
  const user = ordinaryLeastSquares(
    getColumn(workingCsv, exercise.target_col),
    getColumn(workingCsv, exercise.y_col),
  );

  let oracleVals: number[];
  if (exercise.difficulty === "easy") {
    oracleVals = getColumn(clean, exercise.target_col).filter(
      (v): v is number => v !== null,
    );
  } else if (exercise.difficulty === "medium") {
    const condIdx = clean.columns.indexOf(
      exercise.condition_col ?? exercise.target_col,
    );
    oracleVals = clean.rows
      .filter((r) => {
        const v = r[condIdx];
        if (typeof v !== "number") return false;
        return plan.conditionOp === ">"
          ? v > plan.conditionValue
          : v < plan.conditionValue;
      })
      .map((r) => r[clean.columns.indexOf(exercise.target_col)])
      .filter((v): v is number => typeof v === "number");
  } else {
    oracleVals = plan.deletedIndices
      .map((i) => clean.rows[i][clean.columns.indexOf(exercise.target_col)])
      .filter((v): v is number => typeof v === "number");
  }

  const meanV = mean(oracleVals);
  const medV = median(oracleVals);
  const sub = (impute: number) => {
    const test: ParsedCsv = {
      columns: plan.workingCsv.columns,
      rows: plan.workingCsv.rows.map((r) => r.slice()),
    };
    const ti = test.columns.indexOf(exercise.target_col);
    for (const idx of plan.deletedIndices) test.rows[idx][ti] = impute;
    return ordinaryLeastSquares(
      getColumn(test, exercise.target_col),
      getColumn(test, exercise.y_col),
    ).slope;
  };
  const meanSlope = Number.isFinite(meanV) ? sub(meanV) : NaN;
  const medSlope = Number.isFinite(medV) ? sub(medV) : NaN;
  const optimal =
    Math.abs(meanSlope - exp.slope) <= Math.abs(medSlope - exp.slope)
      ? meanSlope
      : medSlope;

  return {
    expected: exp.slope,
    user: user.slope,
    optimal,
    meanImputed: meanSlope,
    medianImputed: medSlope,
    intercept: { exp: exp.intercept, user: user.intercept },
  };
}
