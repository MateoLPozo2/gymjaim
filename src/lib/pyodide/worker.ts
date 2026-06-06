// Pyodide web-worker bootstrap. Loads pandas/numpy/scikit-learn on first init,
// then executes user code with `df` pre-bound. Returns stdout, the value of
// the last expression (when possible), and the updated DataFrame as CSV so the
// main thread can recompute slopes against the user's mutations.
/// <reference lib="webworker" />

declare const self: DedicatedWorkerGlobalScope;

interface InitMsg { type: "init" }
interface LoadDatasetMsg {
  type: "load";
  csv: string;
}
interface ExecMsg {
  type: "exec";
  code: string;
  id: number;
}
interface ResetMsg {
  type: "reset";
  csv: string;
}

type In = InitMsg | LoadDatasetMsg | ExecMsg | ResetMsg;

interface OutInit { type: "ready" }
interface OutLoaded { type: "loaded" }
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
type Out = OutInit | OutLoaded | OutExec;

// Loaded asynchronously from the CDN. We can't bundle pyodide in this stack.
let pyodide: any = null;
let dfLoaded = false;

async function ensurePyodide() {
  if (pyodide) return pyodide;
  (self as any).importScripts(
    "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js",
  );
  pyodide = await (self as any).loadPyodide({
    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/",
  });
  await pyodide.loadPackage(["pandas", "numpy", "scikit-learn"]);
  await pyodide.runPythonAsync(`
import io, json, contextlib, traceback
import pandas as pd
import numpy as np
`);
  return pyodide;
}

self.onmessage = async (e: MessageEvent<In>) => {
  const msg = e.data;
  try {
    if (msg.type === "init") {
      await ensurePyodide();
      (self as any).postMessage({ type: "ready" } satisfies Out);
      return;
    }
    if (msg.type === "load" || msg.type === "reset") {
      const py = await ensurePyodide();
      py.globals.set("__csv_text", msg.csv);
      await py.runPythonAsync(`
df = pd.read_csv(io.StringIO(__csv_text))
`);
      dfLoaded = true;
      (self as any).postMessage({ type: "loaded" } satisfies Out);
      return;
    }
    if (msg.type === "exec") {
      const py = await ensurePyodide();
      if (!dfLoaded) {
        (self as any).postMessage({
          type: "exec_result",
          id: msg.id,
          ok: false,
          stdout: "",
          resultText: null,
          resultIsTable: false,
          tableJson: null,
          dfCsv: "",
          error: "Dataset not loaded yet",
        } satisfies Out);
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
      const resultText = resultIsTable
        ? null
        : (py.globals.get("__result") ?? null);
      const dfCsv = py.globals.get("__df_csv") ?? "";
      const error = py.globals.get("__error") ?? undefined;
      (self as any).postMessage({
        type: "exec_result",
        id: msg.id,
        ok: !error,
        stdout: String(stdout),
        resultText: resultText === null ? null : String(resultText),
        resultIsTable,
        tableJson: tableJson === null ? null : String(tableJson),
        dfCsv: String(dfCsv),
        error: error ? String(error) : undefined,
      } satisfies Out);
    }
  } catch (err) {
    (self as any).postMessage({
      type: "exec_result",
      id: (msg as ExecMsg).id ?? -1,
      ok: false,
      stdout: "",
      resultText: null,
      resultIsTable: false,
      tableJson: null,
      dfCsv: "",
      error: err instanceof Error ? err.stack || err.message : String(err),
    } satisfies Out);
  }
};

export {};
