import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { getExercise } from "@/lib/api/exercises.functions";
import { recordAttempt } from "@/lib/api/attempts.functions";
import { getBuiltinCsv } from "@/lib/datasets/builtin";
import { usePyodide } from "@/hooks/use-pyodide";
import { parseCsv, getColumn, dropMissingRows, ParsedCsv } from "@/lib/csv";
import { buildPlan, Difficulty } from "@/lib/missing-values";
import { mean, median, ordinaryLeastSquares } from "@/lib/stats";
import { randomSeed } from "@/lib/seeded-random";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
  ComposedChart,
} from "recharts";
import { ArrowLeft, Check, Play, RotateCw } from "lucide-react";
import Editor from "@monaco-editor/react";

const RunnerSearch = z.object({ seed: z.string().optional() });

export const Route = createFileRoute("/_authenticated/exercises/$id")({
  validateSearch: (s) => RunnerSearch.parse(s),
  head: () => ({ meta: [{ title: "Take a rep — GymJaim" }] }),
  component: RunnerPage,
});

function RunnerPage() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getEx = useServerFn(getExercise);
  const recordFn = useServerFn(recordAttempt);

  const exQuery = useQuery({
    queryKey: ["exercise", id],
    queryFn: () => getEx({ data: { id } }),
  });

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <Link
        to="/exercises"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </Link>
      {exQuery.isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading exercise…</p>
      ) : exQuery.error ? (
        <p className="mt-6 text-destructive">{(exQuery.error as Error).message}</p>
      ) : (
        <Runner
          exercise={(exQuery.data as any).exercise}
          datasetUrl={(exQuery.data as any).datasetCsvUrl}
          initialSeed={search.seed ? Number(search.seed) : undefined}
          onRecorded={() => {
            qc.invalidateQueries({ queryKey: ["attempts"] });
            qc.invalidateQueries({ queryKey: ["reviews-due"] });
          }}
        />
      )}
    </div>
  );
}

function Runner({
  exercise,
  datasetUrl,
  initialSeed,
  onRecorded,
}: {
  exercise: any;
  datasetUrl: string | null;
  initialSeed?: number;
  onRecorded: () => void;
}) {
  const recordFn = useServerFn(recordAttempt);
  const pyodide = usePyodide();
  const [seed] = useState<number>(initialSeed ?? randomSeed());
  const [rawCsv, setRawCsv] = useState<string | null>(null);
  const [plan, setPlan] = useState<ReturnType<typeof buildPlan> | null>(null);
  const [workingCsv, setWorkingCsv] = useState<ParsedCsv | null>(null);
  const [code, setCode] = useState<string>(
    `# df has the dataset with NaNs in '${exercise.target_col}'.\n# Try imputing them so the regression of '${exercise.target_col}' on '${exercise.y_col}'\n# matches the un-deleted ground truth.\n\ndf['${exercise.target_col}'] = df['${exercise.target_col}'].fillna(\n    df['${exercise.target_col}'].mean()\n)\n\ndf.head()\n`,
  );
  const [output, setOutput] = useState<{ stdout: string; resultText: string | null; tableJson: string | null; error?: string } | null>(null);
  const [running, setRunning] = useState(false);
  const recordedRef = useRef(false);

  // Fetch the dataset CSV (built-in or signed URL).
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const ds = exercise.dataset;
      let text: string | null = null;
      if (ds?.is_builtin && ds.builtin_key) text = getBuiltinCsv(ds.builtin_key);
      else if (datasetUrl) text = await fetch(datasetUrl).then((r) => r.text());
      if (cancelled) return;
      if (!text) {
        toast.error("Could not load dataset");
        return;
      }
      setRawCsv(text);
      const parsed = parseCsv(text);
      const built = buildPlan(
        parsed,
        exercise.target_col,
        exercise.y_col,
        exercise.condition_col,
        exercise.difficulty as Difficulty,
        seed,
      );
      setPlan(built);
      setWorkingCsv(built.workingCsv);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [exercise.id, datasetUrl, seed]);

  // Push the working CSV (with NaNs) into the Pyodide DataFrame once both are ready.
  useEffect(() => {
    if (!workingCsv || pyodide.status !== "ready") return;
    pyodide.loadDataset(csvToString(workingCsv));
  }, [pyodide.status, workingCsv]);

  // Compute slopes from whatever pandas returned in df after exec.
  const slopes = useMemo(() => {
    if (!plan || !workingCsv) return null;
    const clean = plan.cleanCsv;
    const exp = ordinaryLeastSquares(
      getColumn(clean, exercise.target_col),
      getColumn(clean, exercise.y_col),
    );
    const user = ordinaryLeastSquares(
      getColumn(workingCsv, exercise.target_col),
      getColumn(workingCsv, exercise.y_col),
    );

    // Oracle subset: rows that were deleted (post-condition for medium/hard).
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
  }, [plan, workingCsv, exercise]);

  const delta = slopes ? slopes.user - slopes.expected : NaN;
  const pct = slopes && slopes.expected ? (delta / slopes.expected) * 100 : NaN;
  const matched =
    !!slopes &&
    Number.isFinite(slopes.optimal) &&
    Math.abs(slopes.user - slopes.optimal) < 1e-4;

  async function onRun() {
    if (pyodide.status === "loading") {
      toast.message("Pyodide is still booting (one-time, ~10s)…");
      return;
    }
    setRunning(true);
    try {
      const result = await pyodide.exec(code);
      setOutput({
        stdout: result.stdout,
        resultText: result.resultText,
        tableJson: result.tableJson,
        error: result.error,
      });
      if (result.dfCsv) setWorkingCsv(parseCsv(result.dfCsv));
    } finally {
      setRunning(false);
    }
  }

  async function onReset() {
    if (!plan) return;
    setWorkingCsv(plan.workingCsv);
    await pyodide.resetDataset(csvToString(plan.workingCsv));
    setOutput(null);
    toast.success("Reverted to the starting missing-values dataset");
  }

  async function onSave() {
    if (!slopes || recordedRef.current) return;
    recordedRef.current = true;
    try {
      await recordFn({
        data: {
          exercise_id: exercise.id,
          seed,
          code,
          user_slope: Number.isFinite(slopes.user) ? slopes.user : null,
          expected_slope: Number.isFinite(slopes.expected) ? slopes.expected : null,
          optimal_slope: Number.isFinite(slopes.optimal) ? slopes.optimal : null,
          slope_delta: Number.isFinite(delta) ? delta : null,
          matched_oracle: matched,
        },
      });
      toast.success("Rep saved — review scheduled for +2 days");
      onRecorded();
    } catch (e: any) {
      recordedRef.current = false;
      toast.error(e?.message ?? "Could not save");
    }
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-3xl tracking-tight">{exercise.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <Badge variant="secondary" className="capitalize mr-2">{exercise.difficulty}</Badge>
            Target <code className="text-foreground">{exercise.target_col}</code> · y{" "}
            <code className="text-foreground">{exercise.y_col}</code>
            <span className="ml-3 font-mono text-xs">seed {seed}</span>
          </p>
          {exercise.description && (
            <p className="mt-2 text-sm text-muted-foreground max-w-3xl">{exercise.description}</p>
          )}
        </div>
        <PyodideStatus status={pyodide.status} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
        {/* Code panel */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Your imputation</CardTitle>
            <CardDescription>
              <code>df</code> is bound to a pandas DataFrame. Mutate it, return a value, or print.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border overflow-hidden">
              <Editor
                height="280px"
                defaultLanguage="python"
                value={code}
                onChange={(v) => setCode(v ?? "")}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  scrollBeyondLastLine: false,
                  fontFamily: "JetBrains Mono, monospace",
                }}
              />
            </div>
            <div className="mt-3 flex gap-2">
              <Button onClick={onRun} disabled={running || pyodide.status === "loading"} className="gap-2">
                <Play className="h-4 w-4" /> Run
              </Button>
              <Button variant="outline" onClick={onReset} className="gap-2">
                <RotateCw className="h-4 w-4" /> Reset
              </Button>
              <Button variant="secondary" onClick={onSave} className="ml-auto gap-2" disabled={!slopes || !Number.isFinite(slopes.user)}>
                <Check className="h-4 w-4" /> Save rep
              </Button>
            </div>
            {output && (
              <div className="mt-4 space-y-3">
                {output.error && (
                  <pre className="rounded-md bg-destructive/10 text-destructive p-3 text-xs overflow-x-auto whitespace-pre-wrap">
                    {output.error}
                  </pre>
                )}
                {output.stdout && (
                  <pre className="rounded-md bg-secondary p-3 text-xs overflow-x-auto whitespace-pre-wrap font-mono">
                    {output.stdout}
                  </pre>
                )}
                {output.tableJson && <ResultTable json={output.tableJson} />}
                {output.resultText && !output.tableJson && (
                  <pre className="rounded-md bg-secondary p-3 text-xs overflow-x-auto whitespace-pre-wrap font-mono">
                    {output.resultText}
                  </pre>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Metrics + chart */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Score vs. the truth</CardTitle>
            <CardDescription>
              The blue line is the regression on the un-deleted data. Yours is the dashed ochre line.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <Stat label="Expected" value={fmt(slopes?.expected)} />
              <Stat label="Yours" value={fmt(slopes?.user)} tone="accent" />
              <Stat
                label="Δ"
                value={fmtSigned(delta)}
                sub={Number.isFinite(pct) ? `${pct.toFixed(1)}%` : ""}
              />
              <Stat label="Optimal" value={fmt(slopes?.optimal)} tone="success" />
            </div>
            {matched && (
              <div className="mt-3 rounded-md border border-success/40 bg-success/10 text-success px-3 py-2 text-xs flex items-center gap-2">
                <Check className="h-4 w-4" /> Great — that's the oracle answer.
              </div>
            )}
            <div className="mt-5 h-72">
              {plan && workingCsv && slopes ? (
                <RegressionChart
                  plan={plan}
                  workingCsv={workingCsv}
                  exercise={exercise}
                  slopes={slopes}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Preparing chart…</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PyodideStatus({ status }: { status: string }) {
  const text =
    status === "loading"
      ? "Booting Python runtime…"
      : status === "ready" || status === "dataset"
        ? "Python ready"
        : status === "error"
          ? "Python failed to load"
          : "";
  if (!text) return null;
  return (
    <span className="text-xs font-mono text-muted-foreground">
      <span
        className={`inline-block h-2 w-2 rounded-full mr-2 ${
          status === "ready" || status === "dataset"
            ? "bg-success"
            : status === "error"
              ? "bg-destructive"
              : "bg-accent animate-pulse"
        }`}
      />
      {text}
    </span>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "accent" | "success";
}) {
  const color =
    tone === "accent" ? "text-accent" : tone === "success" ? "text-success" : "text-foreground";
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-1 font-mono text-base font-semibold ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function fmt(v: number | undefined) {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(3);
}
function fmtSigned(v: number) {
  if (!Number.isFinite(v)) return "—";
  return (v >= 0 ? "+" : "") + v.toFixed(3);
}

function csvToString(p: ParsedCsv): string {
  const header = p.columns.map(escapeCsv).join(",");
  const rows = p.rows.map((r) =>
    r
      .map((v) => (v == null ? "" : typeof v === "number" ? String(v) : escapeCsv(String(v))))
      .join(","),
  );
  return [header, ...rows].join("\n");
}
function escapeCsv(s: string) {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function ResultTable({ json }: { json: string }) {
  let parsed: { columns: string[]; data: any[][] };
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  return (
    <div className="rounded-md border border-border overflow-auto max-h-64">
      <table className="w-full text-xs font-mono">
        <thead className="bg-secondary sticky top-0">
          <tr>
            {parsed.columns.map((c) => (
              <th key={c} className="text-left px-3 py-1.5 font-semibold">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {parsed.data.slice(0, 50).map((row, i) => (
            <tr key={i} className="border-t border-border/60">
              {row.map((v, j) => (
                <td key={j} className="px-3 py-1 whitespace-nowrap">
                  {v == null ? <span className="text-muted-foreground">NaN</span> : String(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RegressionChart({
  plan,
  workingCsv,
  exercise,
  slopes,
}: {
  plan: ReturnType<typeof buildPlan>;
  workingCsv: ParsedCsv;
  exercise: any;
  slopes: { expected: number; user: number; intercept: { exp: number; user: number } };
}) {
  const xs = getColumn(plan.cleanCsv, exercise.target_col).filter((v): v is number => v !== null);
  const ys = getColumn(plan.cleanCsv, exercise.y_col).filter((v): v is number => v !== null);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const lineData = [xMin, xMax].map((x) => ({
    x,
    expected: slopes.expected * x + slopes.intercept.exp,
    user: slopes.user * x + slopes.intercept.user,
  }));
  const scatter = xs
    .slice(0, 100)
    .map((x, i) => ({ x, y: ys[i] }))
    .filter((d) => Number.isFinite(d.x) && Number.isFinite(d.y));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          type="number"
          dataKey="x"
          domain={["dataMin", "dataMax"]}
          tick={{ fontSize: 11 }}
          label={{ value: exercise.target_col, position: "insideBottom", offset: -2, fontSize: 11 }}
        />
        <YAxis
          type="number"
          dataKey="y"
          tick={{ fontSize: 11 }}
          label={{ value: exercise.y_col, angle: -90, position: "insideLeft", fontSize: 11 }}
        />
        <ZAxis range={[20, 20]} />
        <Tooltip />
        <Scatter data={scatter} fill="oklch(0.5 0.04 250 / 0.6)" />
        <Line
          data={lineData}
          dataKey="expected"
          stroke="oklch(0.22 0.04 250)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
          name="Truth"
        />
        <Line
          data={lineData}
          dataKey="user"
          stroke="oklch(0.68 0.13 60)"
          strokeWidth={2}
          strokeDasharray="6 4"
          dot={false}
          isAnimationActive={false}
          name="Yours"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
