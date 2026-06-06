import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import Editor from "@monaco-editor/react";
import { Check, Copy, Lightbulb, Play, RotateCw, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { parseCsv } from "@/lib/csv";
import { recordAttempt } from "@/lib/api/attempts.functions";
import { buildSampleSolutions } from "@/lib/exercise-solutions";
import { csvToString } from "@/lib/exercise/csv-serialize";
import { gradeAttempt } from "@/lib/exercise/grade";
import { runJsImputation } from "@/lib/exercise/js-runner";
import { buildPlan } from "@/lib/exercise/plan";
import type { Difficulty, ExerciseMeta, RunOutput } from "@/lib/exercise/types";
import { getBuiltinCsv } from "@/lib/datasets/builtin";
import { randomSeed } from "@/lib/seeded-random";
import { usePyodide } from "@/hooks/use-pyodide";
import { useVoiceCoach } from "@/hooks/use-voice-coach";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { generateFeedback, type FeedbackResult } from "@/lib/exercise/feedback";
import { DatasetInspector } from "./DatasetInspector";
import { FeedbackPanels } from "./FeedbackPanels";
import { OutputPanel } from "./OutputPanel";

interface ExerciseRunnerProps {
  exercise: ExerciseMeta & {
    dataset?: { id: string; is_builtin?: boolean; builtin_key?: string | null };
  };
  datasetUrl: string | null;
  initialSeed?: number;
  onRecorded: () => void;
}

export function ExerciseRunner({
  exercise,
  datasetUrl,
  initialSeed,
  onRecorded,
}: ExerciseRunnerProps) {
  const recordFn = useServerFn(recordAttempt);
  const pyodide = usePyodide();
  const voice = useVoiceCoach();
  const [seed] = useState(initialSeed ?? randomSeed());
  const [plan, setPlan] = useState<ReturnType<typeof buildPlan> | null>(null);
  const [workingCsv, setWorkingCsv] = useState<ReturnType<typeof parseCsv> | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const datasetLoadedRef = useRef(false);
  const datasetLoadingRef = useRef(false);
  const briefingPlayedRef = useRef(false);

  const starterCode = useMemo(
    () =>
      `# df has the dataset with NaNs in '${exercise.target_col}'.\n# Try imputing them so the regression of '${exercise.target_col}' on '${exercise.y_col}'\n# matches the un-deleted ground truth.\n\ndf['${exercise.target_col}'] = df['${exercise.target_col}'].fillna(\n    df['${exercise.target_col}'].mean()\n)\n\ndf.head()\n`,
    [exercise.target_col, exercise.y_col],
  );
  const [code, setCode] = useState(starterCode);
  const sampleSolutions = useMemo(
    () => buildSampleSolutions(exercise.target_col, exercise.y_col, exercise.condition_col),
    [exercise.target_col, exercise.y_col, exercise.condition_col],
  );
  const [output, setOutput] = useState<RunOutput | null>(null);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackResult | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  // Load CSV and build missing-value plan.
  useEffect(() => {
    let cancelled = false;
    datasetLoadedRef.current = false;
    async function load() {
      setDataLoading(true);
      const ds = exercise.dataset;
      let text: string | null = null;
      if (ds?.is_builtin && ds.builtin_key) text = getBuiltinCsv(ds.builtin_key);
      else if (datasetUrl) text = await fetch(datasetUrl).then((r) => r.text());
      if (cancelled) return;
      if (!text) {
        toast.error("Could not load dataset");
        setDataLoading(false);
        return;
      }
      const parsed = parseCsv(text);
      const built = buildPlan(
        parsed,
        exercise.target_col,
        exercise.y_col,
        exercise.condition_col ?? null,
        exercise.difficulty as Difficulty,
        seed,
      );
      setPlan(built);
      setWorkingCsv(built.workingCsv);
      setDataLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [exercise.id, datasetUrl, seed, exercise]);

  // Reset pandas load flags when Pyodide reboots (e.g. retry).
  useEffect(() => {
    if (pyodide.status === "booting") {
      datasetLoadedRef.current = false;
      datasetLoadingRef.current = false;
    }
  }, [pyodide.status]);

  // Load plan into Pyodide once when ready.
  useEffect(() => {
    if (!plan || dataLoading) return;
    if (datasetLoadedRef.current || datasetLoadingRef.current) return;
    if (pyodide.status === "error") return;
    if (pyodide.status !== "ready" && pyodide.status !== "loaded") return;

    datasetLoadingRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        await pyodide.loadDataset(csvToString(plan.workingCsv));
        if (!cancelled) datasetLoadedRef.current = true;
      } catch (e: unknown) {
        if (!cancelled) {
          datasetLoadingRef.current = false;
          toast.error(e instanceof Error ? e.message : "Failed to load dataset into pandas");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [plan, dataLoading, pyodide.status]);

  // Voice briefing on first load.
  useEffect(() => {
    if (!plan || briefingPlayedRef.current || !voice.enabled) return;
    briefingPlayedRef.current = true;
    const text = `${exercise.title}. Difficulty: ${exercise.difficulty}. Impute missing values in ${exercise.target_col} and regress on ${exercise.y_col}. ${plan.deletedIndices.length} values were removed.`;
    voice.speak(text);
  }, [plan, exercise, voice]);

  const grade = useMemo(() => {
    if (!plan || !workingCsv) return null;
    return gradeAttempt(plan, workingCsv, exercise);
  }, [plan, workingCsv, exercise]);

  const pyodideBooting =
    pyodide.status === "booting" ||
    pyodide.status === "idle" ||
    pyodide.status === "loading_dataset";

  function applyRunResult(result: {
    stdout: string;
    resultText: string | null;
    tableJson: string | null;
    dfCsv: string;
    error?: string;
  }) {
    setOutput({
      stdout: result.stdout,
      resultText: result.resultText,
      tableJson: result.tableJson,
      error: result.error,
    });
    if (result.dfCsv) setWorkingCsv(parseCsv(result.dfCsv));
    setHasRun(true);
  }

  async function onRun() {
    if (!workingCsv) return;

    if (pyodide.status === "error") {
      setRunning(true);
      try {
        const result = runJsImputation(code, workingCsv, {
          targetCol: exercise.target_col,
          yCol: exercise.y_col,
          conditionCol: exercise.condition_col,
        });
        applyRunResult(result);
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("Run complete (JS fallback)");
          if (plan && result.dfCsv) {
            const newCsv = parseCsv(result.dfCsv);
            const g = gradeAttempt(plan, newCsv, exercise);
            setFeedback(null);
            setFeedbackLoading(true);
            setTimeout(() => {
              setFeedback(generateFeedback({
                targetCol: exercise.target_col,
                yCol: exercise.y_col,
                conditionCol: exercise.condition_col,
                userCode: code,
                slopes: { expected: g.slopes.expected, user: g.slopes.user, optimal: g.slopes.optimal, delta: g.delta, pct: g.pct, matched: g.matched },
              }));
              setFeedbackLoading(false);
            }, 600);
          }
        }
      } finally {
        setRunning(false);
      }
      return;
    }

    if (pyodideBooting) {
      toast.message("Python runtime is still booting (one-time, ~10s)…");
      return;
    }
    if (!pyodide.isReady) {
      toast.message("Loading dataset into pandas…");
      return;
    }

    setRunning(true);
    try {
      const result = await pyodide.exec(code);
      applyRunResult(result);
      if (result.error) {
        toast.error("Code raised an exception — see output");
      } else {
        toast.success("Run complete");
        if (plan && result.dfCsv) {
          const newCsv = parseCsv(result.dfCsv);
          const g = gradeAttempt(plan, newCsv, exercise);
          setFeedback(null);
          setFeedbackLoading(true);
          setTimeout(() => {
            setFeedback(generateFeedback({
              targetCol: exercise.target_col,
              yCol: exercise.y_col,
              conditionCol: exercise.condition_col,
              userCode: code,
              slopes: { expected: g.slopes.expected, user: g.slopes.user, optimal: g.slopes.optimal, delta: g.delta, pct: g.pct, matched: g.matched },
            }));
            setFeedbackLoading(false);
          }, 600);
        }
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Run failed");
    } finally {
      setRunning(false);
    }
  }

  async function onReset() {
    if (!plan) return;
    setWorkingCsv(plan.workingCsv);
    setCode(starterCode);
    setOutput(null);
    setRecorded(false);
    setHasRun(false);
    setFeedback(null);
    setFeedbackLoading(false);
    if (pyodide.status === "error") {
      toast.success("Reverted dataset and code to the starter state");
      return;
    }
    try {
      await pyodide.resetDataset(csvToString(plan.workingCsv));
      toast.success("Reverted dataset and code to the starter state");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Reset failed");
    }
  }

  async function onSave() {
    if (recorded) {
      toast.message("Rep already saved");
      return;
    }
    if (!hasRun) {
      toast.message("Run your code first to apply imputation");
      return;
    }
    if (!grade || !Number.isFinite(grade.slopes.user)) {
      toast.message("Run your code first — no grade yet");
      return;
    }
    setRecorded(true);
    setSaving(true);
    try {
      const res = await recordFn({
        data: {
          exercise_id: exercise.id,
          seed,
          code,
          user_slope: Number.isFinite(grade.slopes.user) ? grade.slopes.user : null,
          expected_slope: Number.isFinite(grade.slopes.expected) ? grade.slopes.expected : null,
          optimal_slope: Number.isFinite(grade.slopes.optimal) ? grade.slopes.optimal : null,
          slope_delta: Number.isFinite(grade.delta) ? grade.delta : null,
          matched_oracle: grade.matched,
        },
      });
      if (res.scheduled) {
        toast.success("Rep saved — review scheduled for +2 days");
      } else {
        toast.success("Rep saved");
        toast.warning("Review scheduling failed — check Settings");
      }
      onRecorded();
      if (voice.enabled) {
        const debrief = grade.matched
          ? `Oracle match. Expected slope ${fmt(grade.slopes.expected)}, yours ${fmt(grade.slopes.user)}.`
          : `Expected slope ${fmt(grade.slopes.expected)}, yours ${fmt(grade.slopes.user)}, delta ${fmtSigned(grade.delta)}.`;
        voice.speak(debrief);
      }
    } catch (e: unknown) {
      setRecorded(false);
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  function onBriefing() {
    if (!plan) return;
    voice.speak(
      `${exercise.title}. ${exercise.difficulty} difficulty. Target column ${exercise.target_col}, regress on ${exercise.y_col}. ${plan.deletedIndices.length} missing values to impute.`,
    );
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-3xl tracking-tight">{exercise.title}</h1>
          <div className="mt-1 text-sm text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
            <Badge variant="secondary" className="capitalize">
              {exercise.difficulty}
            </Badge>
            <span>
              Target <code className="text-foreground">{exercise.target_col}</code> · y{" "}
              <code className="text-foreground">{exercise.y_col}</code>
            </span>
            <span className="font-mono text-xs">seed {seed}</span>
          </div>
          {exercise.description && (
            <p className="mt-2 text-sm text-muted-foreground max-w-3xl">{exercise.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {voice.enabled && (
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={onBriefing}>
              <Volume2 className="h-4 w-4" /> Briefing
            </Button>
          )}
          <PyodideStatus status={pyodide.status} error={pyodide.error} onRetry={pyodide.retry} />
        </div>
      </div>

      {plan && workingCsv && (
        <div className="mt-6">
          <DatasetInspector
            plan={plan}
            workingCsv={workingCsv}
            targetCol={exercise.target_col}
            yCol={exercise.y_col}
            conditionCol={exercise.condition_col}
            datasetId={exercise.dataset?.id}
          />
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
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
            <div className="mt-3 flex gap-2 flex-wrap">
              <Button onClick={onRun} disabled={running || dataLoading} className="gap-2">
                <Play className="h-4 w-4" />{" "}
                {running
                  ? "Running…"
                  : pyodideBooting
                    ? "Booting Python…"
                    : pyodide.status === "error"
                      ? "Run (JS fallback)"
                      : "Run"}
              </Button>
              <Button variant="outline" onClick={onReset} className="gap-2" disabled={!plan}>
                <RotateCw className="h-4 w-4" /> Reset
              </Button>
              <Button
                variant="secondary"
                onClick={onSave}
                className="ml-auto gap-2"
                disabled={
                  saving || !hasRun || !grade || !Number.isFinite(grade.slopes.user) || recorded
                }
              >
                <Check className="h-4 w-4" /> {saving ? "Saving…" : "Save rep"}
              </Button>
            </div>
            {workingCsv && (pyodide.isReady || hasRun) && (
              <p className="mt-2 text-[11px] font-mono text-muted-foreground">
                df ready · {workingCsv.rows.length} rows × {workingCsv.columns.length} cols
                {pyodide.status === "error" && hasRun ? " · JS fallback" : ""}
              </p>
            )}
            <div className="mt-4">
              <OutputPanel output={output} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Score vs. the truth</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <Stat label="Expected" value={fmt(grade?.slopes.expected)} />
              <Stat label="Yours" value={fmt(grade?.slopes.user)} tone="accent" />
              <Stat
                label="Δ"
                value={fmtSigned(grade?.delta ?? NaN)}
                sub={grade && Number.isFinite(grade.pct) ? `${grade.pct.toFixed(1)}%` : ""}
              />
              <Stat label="Optimal" value={fmt(grade?.slopes.optimal)} tone="success" />
            </div>
            {grade?.matched && (
              <div className="mt-3 rounded-md border border-success/40 bg-success/10 text-success px-3 py-2 text-xs flex items-center gap-2">
                <Check className="h-4 w-4" /> Great — that's the oracle answer.
              </div>
            )}
            <FeedbackPanels
              coach={feedback?.coach ?? null}
              critic={feedback?.critic ?? null}
              loading={feedbackLoading}
            />
            {!feedbackLoading && !feedback && (
              <p className="mt-5 text-sm text-muted-foreground">
                Run your code to get feedback.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <SampleSolutions
        solutions={sampleSolutions}
        onLoad={(snippet) => {
          setCode(snippet);
          toast.success("Snippet loaded into the editor — hit Run");
        }}
      />
    </div>
  );
}

function SampleSolutions({
  solutions,
  onLoad,
}: {
  solutions: ReturnType<typeof buildSampleSolutions>;
  onLoad: (snippet: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <Lightbulb className="h-4 w-4" />
        {open ? "Hide sample solutions" : "Peek at sample solutions"}
      </button>
      {open && (
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {solutions.map((s) => (
            <Card key={s.key}>
              <CardHeader>
                <CardTitle className="font-display text-base">{s.title}</CardTitle>
                <CardDescription>{s.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="rounded-md bg-secondary p-3 text-[11px] overflow-x-auto whitespace-pre font-mono leading-relaxed max-h-56">
                  {s.code}
                </pre>
                <div className="mt-3 flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={() => onLoad(s.code)}
                  >
                    <Copy className="h-3.5 w-3.5" /> Load into editor
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function PyodideStatus({
  status,
  error,
  onRetry,
}: {
  status: string;
  error: string | null;
  onRetry: () => void;
}) {
  const text =
    status === "booting" || status === "idle"
      ? "Booting Python runtime…"
      : status === "ready" || status === "loading_dataset"
        ? "Python ready · loading dataset"
        : status === "loaded"
          ? "Python + pandas ready"
          : status === "error"
            ? "Python failed — JS fallback available"
            : "";
  if (!text) return null;
  return (
    <span className="text-xs font-mono text-muted-foreground inline-flex items-center gap-2">
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          status === "loaded"
            ? "bg-success"
            : status === "error"
              ? "bg-destructive"
              : "bg-accent animate-pulse"
        }`}
      />
      <span>{status === "error" && error ? error : text}</span>
      {status === "error" && (
        <button type="button" onClick={onRetry} className="text-accent hover:underline">
          Retry
        </button>
      )}
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
