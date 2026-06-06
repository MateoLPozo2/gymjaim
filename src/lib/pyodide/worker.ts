// Pyodide web-worker bootstrap. Loads pandas/numpy/scikit-learn on first init,
// then executes user code with `df` pre-bound.
/// <reference lib="webworker" />

declare const self: DedicatedWorkerGlobalScope;

interface InitMsg {
  type: "init";
}
interface LoadDatasetMsg {
  type: "load";
  csv: string;
}
interface ResetMsg {
  type: "reset";
  csv: string;
}
interface ExecMsg {
  type: "exec";
  code: string;
  id: number;
}
interface PeekMsg {
  type: "peek";
  id: number;
  n?: number;
}

type In = InitMsg | LoadDatasetMsg | ResetMsg | ExecMsg | PeekMsg;

interface OutExec {
  type: "exec_result";
  id: number;
  ok: boolean;
  stdout: string;
  resultText: string | null;
  resultIsTable: boolean;
  tableJson: string | null;
  dfCsv: string;
  error?: string;
}

interface OutPeek {
  type: "peek_result";
  id: number;
  ok: boolean;
  tableJson: string | null;
  error?: string;
}

const PYODIDE_BASE = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";
const PYODIDE_INDEX = PYODIDE_BASE;
const PYODIDE_CDN = `${PYODIDE_BASE}pyodide.mjs`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pyodide: any = null;
let dfLoaded = false;

async function ensurePyodide() {
  if (pyodide) return pyodide;
  // #region agent log
  fetch("http://127.0.0.1:7843/ingest/7d9a5a8f-76b1-409b-8c93-bd0cae8d08e2", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "6cf81e" },
    body: JSON.stringify({
      sessionId: "6cf81e",
      runId: "pre-fix",
      hypothesisId: "B",
      location: "worker.ts:ensurePyodide:start",
      message: "ensurePyodide starting",
      data: { indexURL: PYODIDE_INDEX, cdn: PYODIDE_CDN, workerHref: self.location.href },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  const { loadPyodide } = await import(/* @vite-ignore */ PYODIDE_CDN);
  pyodide = await loadPyodide({ indexURL: PYODIDE_INDEX });
  // #region agent log
  fetch("http://127.0.0.1:7843/ingest/7d9a5a8f-76b1-409b-8c93-bd0cae8d08e2", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "6cf81e" },
    body: JSON.stringify({
      sessionId: "6cf81e",
      runId: "pre-fix",
      hypothesisId: "B",
      location: "worker.ts:ensurePyodide:loaded",
      message: "loadPyodide done, loading packages",
      data: { version: pyodide.version },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  await pyodide.loadPackage(["pandas", "numpy", "scikit-learn"]);
  // #region agent log
  fetch("http://127.0.0.1:7843/ingest/7d9a5a8f-76b1-409b-8c93-bd0cae8d08e2", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "6cf81e" },
    body: JSON.stringify({
      sessionId: "6cf81e",
      runId: "pre-fix",
      hypothesisId: "C",
      location: "worker.ts:ensurePyodide:packages",
      message: "packages loaded",
      data: { packages: ["pandas", "numpy", "scikit-learn"] },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  await pyodide.runPythonAsync(`
import io, json, contextlib, traceback
import pandas as pd
import numpy as np
`);
  return pyodide;
}

async function loadCsvIntoDf(csv: string) {
  const py = await ensurePyodide();
  py.globals.set("__csv_text", csv);
  await py.runPythonAsync(`df = pd.read_csv(io.StringIO(__csv_text))`);
  dfLoaded = true;
}

self.onmessage = async (e: MessageEvent<In>) => {
  const msg = e.data;
  try {
    if (msg.type === "init") {
      try {
        await ensurePyodide();
        // #region agent log
        fetch("http://127.0.0.1:7843/ingest/7d9a5a8f-76b1-409b-8c93-bd0cae8d08e2", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "6cf81e" },
          body: JSON.stringify({
            sessionId: "6cf81e",
            runId: "pre-fix",
            hypothesisId: "E",
            location: "worker.ts:init:ready",
            message: "init complete, posting ready",
            data: {},
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
        self.postMessage({ type: "ready" });
      } catch (err) {
        // #region agent log
        fetch("http://127.0.0.1:7843/ingest/7d9a5a8f-76b1-409b-8c93-bd0cae8d08e2", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "6cf81e" },
          body: JSON.stringify({
            sessionId: "6cf81e",
            runId: "pre-fix",
            hypothesisId: "B,C,E",
            location: "worker.ts:init:error",
            message: "init failed",
            data: { error: err instanceof Error ? err.message : String(err) },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
        self.postMessage({
          type: "init_error",
          error: err instanceof Error ? err.message : String(err),
        });
      }
      return;
    }

    if (msg.type === "load" || msg.type === "reset") {
      await loadCsvIntoDf(msg.csv);
      self.postMessage({ type: "loaded" });
      return;
    }

    if (msg.type === "peek") {
      const py = await ensurePyodide();
      if (!dfLoaded) {
        self.postMessage({
          type: "peek_result",
          id: msg.id,
          ok: false,
          tableJson: null,
          error: "Dataset not loaded yet",
        } satisfies OutPeek);
        return;
      }
      const n = msg.n ?? 10;
      py.globals.set("__peek_n", n);
      await py.runPythonAsync(`
__peek_json = df.head(__peek_n).to_json(orient="split", default_handler=str)
`);
      const tableJson = py.globals.get("__peek_json") ?? null;
      self.postMessage({
        type: "peek_result",
        id: msg.id,
        ok: true,
        tableJson: tableJson === null ? null : String(tableJson),
      } satisfies OutPeek);
      return;
    }

    if (msg.type === "exec") {
      const py = await ensurePyodide();
      if (!dfLoaded) {
        self.postMessage({
          type: "exec_result",
          id: msg.id,
          ok: false,
          stdout: "",
          resultText: null,
          resultIsTable: false,
          tableJson: null,
          dfCsv: "",
          error: "Dataset not loaded yet",
        } satisfies OutExec);
        return;
      }
      py.globals.set("__user_code", msg.code ?? "");
      await py.runPythonAsync(`
__buf = io.StringIO()
__err_buf = io.StringIO()
__result = None
__result_is_table = False
__table_json = None
__error = None
try:
    with contextlib.redirect_stdout(__buf), contextlib.redirect_stderr(__err_buf):
        __code = __user_code or ""
        __lines = __code.rstrip().splitlines()
        if len(__lines) == 0:
            pass
        elif len(__lines) == 1:
            try:
                __result = eval(__code, globals())
            except SyntaxError:
                exec(__code, globals())
        else:
            __body = "\\n".join(__lines[:-1])
            __last = __lines[-1]
            try:
                if __body.strip():
                    exec(__body, globals())
                __result = eval(__last, globals())
            except SyntaxError:
                exec(__code, globals())
except Exception as e:
    __error = traceback.format_exc()

if isinstance(__result, (pd.DataFrame, pd.Series)):
    __result_is_table = True
    __df_out = __result if isinstance(__result, pd.DataFrame) else __result.to_frame()
    __table_json = __df_out.head(50).to_json(orient="split", default_handler=str)
elif __result is not None:
    try:
        __result = str(__result)
    except Exception:
        __result = "<unprintable>"

__stdout = __buf.getvalue() + __err_buf.getvalue()
__df_csv = df.to_csv(index=False)
`);
      const stdout = py.globals.get("__stdout") ?? "";
      const resultIsTable = !!py.globals.get("__result_is_table");
      const tableJson = py.globals.get("__table_json") ?? null;
      const resultText = resultIsTable ? null : (py.globals.get("__result") ?? null);
      const dfCsv = py.globals.get("__df_csv") ?? "";
      const error = py.globals.get("__error") ?? undefined;
      self.postMessage({
        type: "exec_result",
        id: msg.id,
        ok: !error,
        stdout: String(stdout),
        resultText: resultText === null ? null : String(resultText),
        resultIsTable,
        tableJson: tableJson === null ? null : String(tableJson),
        dfCsv: String(dfCsv),
        error: error ? String(error) : undefined,
      } satisfies OutExec);
    }
  } catch (err) {
    const id = "id" in msg ? (msg as ExecMsg | PeekMsg).id : -1;
    if (msg.type === "peek") {
      self.postMessage({
        type: "peek_result",
        id,
        ok: false,
        tableJson: null,
        error: err instanceof Error ? err.stack || err.message : String(err),
      } satisfies OutPeek);
    } else {
      self.postMessage({
        type: "exec_result",
        id,
        ok: false,
        stdout: "",
        resultText: null,
        resultIsTable: false,
        tableJson: null,
        dfCsv: "",
        error: err instanceof Error ? err.stack || err.message : String(err),
      } satisfies OutExec);
    }
  }
};

export {};
