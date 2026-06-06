import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type PyodideStatus = "idle" | "booting" | "ready" | "loading_dataset" | "loaded" | "error";

export interface ExecResult {
  ok: boolean;
  stdout: string;
  resultText: string | null;
  resultIsTable: boolean;
  tableJson: string | null;
  dfCsv: string;
  error?: string;
}

export interface PeekResult {
  ok: boolean;
  tableJson: string | null;
  error?: string;
}

export interface UsePyodide {
  status: PyodideStatus;
  error: string | null;
  isReady: boolean;
  loadDataset: (csv: string) => Promise<void>;
  resetDataset: (csv: string) => Promise<void>;
  exec: (code: string) => Promise<ExecResult>;
  peek: (n?: number) => Promise<PeekResult>;
  retry: () => void;
}

function formatWorkerError(e: ErrorEvent): string {
  const parts = [e.message || "Worker script error"];
  if (e.filename) parts.push(`at ${e.filename}:${e.lineno}:${e.colno}`);
  return parts.join(" ");
}

export function usePyodide(): UsePyodide {
  const workerRef = useRef<Worker | null>(null);
  const [status, setStatus] = useState<PyodideStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [bootGeneration, setBootGeneration] = useState(0);
  const execPendingRef = useRef<Map<number, (r: ExecResult) => void>>(new Map());
  const peekPendingRef = useRef<Map<number, (r: PeekResult) => void>>(new Map());
  const bootWaitersRef = useRef<Array<() => void>>([]);
  const loadWaitersRef = useRef<Array<() => void>>([]);
  const idRef = useRef(0);
  const bootedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    bootedRef.current = false;
    setError(null);
    setStatus("booting");

    // #region agent log
    fetch("http://127.0.0.1:7843/ingest/7d9a5a8f-76b1-409b-8c93-bd0cae8d08e2", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "6cf81e" },
      body: JSON.stringify({
        sessionId: "6cf81e",
        runId: "pre-fix",
        hypothesisId: "A",
        location: "use-pyodide.ts:effect",
        message: "creating pyodide worker",
        data: { bootGeneration, href: window.location.href },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    const worker = new Worker(new URL("../lib/pyodide/worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;
    worker.postMessage({ type: "init" });

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      // #region agent log
      fetch("http://127.0.0.1:7843/ingest/7d9a5a8f-76b1-409b-8c93-bd0cae8d08e2", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "6cf81e" },
        body: JSON.stringify({
          sessionId: "6cf81e",
          runId: "pre-fix",
          hypothesisId: msg.type === "init_error" ? "B,C,E" : msg.type === "ready" ? "E" : "D",
          location: "use-pyodide.ts:onmessage",
          message: "worker message",
          data: { type: msg.type, error: msg.error ?? null },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      if (msg.type === "ready") {
        bootedRef.current = true;
        setStatus((s) => (s === "loaded" ? "loaded" : "ready"));
        bootWaitersRef.current.forEach((w) => w());
        bootWaitersRef.current = [];
      } else if (msg.type === "loaded") {
        setStatus("loaded");
        loadWaitersRef.current.forEach((w) => w());
        loadWaitersRef.current = [];
      } else if (msg.type === "init_error") {
        setError(String(msg.error ?? "Failed to load Python runtime"));
        setStatus("error");
        bootWaitersRef.current.forEach((w) => w());
        bootWaitersRef.current = [];
      } else if (msg.type === "exec_result") {
        const fn = execPendingRef.current.get(msg.id);
        if (fn) {
          execPendingRef.current.delete(msg.id);
          fn(msg);
        }
      } else if (msg.type === "peek_result") {
        const fn = peekPendingRef.current.get(msg.id);
        if (fn) {
          peekPendingRef.current.delete(msg.id);
          fn(msg);
        }
      }
    };

    worker.onerror = (e) => {
      // #region agent log
      fetch("http://127.0.0.1:7843/ingest/7d9a5a8f-76b1-409b-8c93-bd0cae8d08e2", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "6cf81e" },
        body: JSON.stringify({
          sessionId: "6cf81e",
          runId: "pre-fix",
          hypothesisId: "A",
          location: "use-pyodide.ts:onerror",
          message: "worker script error",
          data: {
            message: e.message,
            filename: e.filename,
            lineno: e.lineno,
            colno: e.colno,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      setError(formatWorkerError(e));
      setStatus("error");
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
      bootedRef.current = false;
    };
  }, [bootGeneration]);

  const retry = useCallback(() => {
    execPendingRef.current.clear();
    peekPendingRef.current.clear();
    bootWaitersRef.current = [];
    loadWaitersRef.current = [];
    setBootGeneration((g) => g + 1);
  }, []);

  const waitForBoot = () =>
    new Promise<void>((resolve) => {
      if (bootedRef.current) {
        resolve();
        return;
      }
      bootWaitersRef.current.push(resolve);
    });

  const postLoad = (csv: string, kind: "load" | "reset") =>
    new Promise<void>((resolve) => {
      const send = () => {
        setStatus("loading_dataset");
        loadWaitersRef.current.push(() => resolve());
        workerRef.current?.postMessage({ type: kind, csv });
      };
      if (bootedRef.current) send();
      else bootWaitersRef.current.push(send);
    });

  return useMemo<UsePyodide>(
    () => ({
      status,
      error,
      isReady: status === "loaded",
      loadDataset: async (csv) => {
        await waitForBoot();
        if (!bootedRef.current) {
          throw new Error(error ?? "Python runtime failed to load");
        }
        await postLoad(csv, "load");
      },
      resetDataset: async (csv) => {
        await waitForBoot();
        if (!bootedRef.current) {
          throw new Error(error ?? "Python runtime failed to load");
        }
        await postLoad(csv, "reset");
      },
      exec: (code) =>
        new Promise((resolve) => {
          const id = ++idRef.current;
          execPendingRef.current.set(id, resolve);
          workerRef.current?.postMessage({ type: "exec", code, id });
        }),
      peek: (n = 10) =>
        new Promise((resolve) => {
          const id = ++idRef.current;
          peekPendingRef.current.set(id, resolve);
          workerRef.current?.postMessage({ type: "peek", id, n });
        }),
      retry,
    }),
    [status, error, retry],
  );
}
