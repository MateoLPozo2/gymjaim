import type { Difficulty, MissingPlan } from "@/lib/missing-values";

export type { Difficulty, MissingPlan };

export interface ExerciseMeta {
  id: string;
  title: string;
  description?: string | null;
  target_col: string;
  y_col: string;
  condition_col?: string | null;
  difficulty: Difficulty;
  dataset?: {
    id: string;
    is_builtin?: boolean;
    builtin_key?: string | null;
  } | null;
}

export interface SlopesResult {
  expected: number;
  user: number;
  optimal: number;
  meanImputed: number;
  medianImputed: number;
  intercept: { exp: number; user: number };
}

export interface GradeResult {
  slopes: SlopesResult;
  delta: number;
  pct: number;
  matched: boolean;
}

export interface RunOutput {
  stdout: string;
  resultText: string | null;
  tableJson: string | null;
  error?: string;
}

export interface ColumnSummary {
  col: string;
  dtype: "numeric" | "string" | "bool";
  nonNull: number;
  missing: number;
  samples: string;
  summary: string;
}
