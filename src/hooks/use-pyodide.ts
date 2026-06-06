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
  const errorRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    bootedRef.current = false;
    errorRef.current = null;
    setError(null);
    setStatus("booting");

    const worker = new Worker(new URL("../lib/pyodide/worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;
    worker.postMessage({ type: "init" });

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.type === "ready") {
        bootedRef.current = true;
        setStatus((s) => (s === "loaded" || s === "loading_dataset" ? s : "ready"));
        bootWaitersRef.current.forEach((w) => w());
        bootWaitersRef.current = [];
      } else if (msg.type === "loaded") {
        setStatus("loaded");
        loadWaitersRef.current.forEach((w) => w());
        loadWaitersRef.current = [];
      } else if (msg.type === "init_error") {
        const err = String(msg.error ?? "Failed to load Python runtime");
        errorRef.current = err;
        setError(err);
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
      const err = formatWorkerError(e);
      errorRef.current = err;
      setError(err);
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

  const waitForBoot = useCallback(
    () =>
      new Promise<void>((resolve) => {
        if (bootedRef.current) {
          resolve();
          return;
        }
        bootWaitersRef.current.push(resolve);
      }),
    [],
  );

  const postLoad = useCallback(
    (csv: string, kind: "load" | "reset") =>
      new Promise<void>((resolve) => {
        const send = () => {
          setStatus("loading_dataset");
          loadWaitersRef.current.push(() => resolve());
          workerRef.current?.postMessage({ type: kind, csv });
        };
        if (bootedRef.current) send();
        else bootWaitersRef.current.push(send);
      }),
    [],
  );

  const loadDataset = useCallback(
    async (csv: string) => {
      await waitForBoot();
      if (!bootedRef.current) throw new Error(errorRef.current ?? "Python runtime failed to load");
      await postLoad(csv, "load");
    },
    [waitForBoot, postLoad],
  );

  const resetDataset = useCallback(
    async (csv: string) => {
      await waitForBoot();
      if (!bootedRef.current) throw new Error(errorRef.current ?? "Python runtime failed to load");
      await postLoad(csv, "reset");
    },
    [waitForBoot, postLoad],
  );

  const exec = useCallback(
    (code: string) =>
      new Promise<ExecResult>((resolve) => {
        const id = ++idRef.current;
        execPendingRef.current.set(id, resolve);
        workerRef.current?.postMessage({ type: "exec", code, id });
      }),
    [],
  );

  const peek = useCallback(
    (n = 10) =>
      new Promise<PeekResult>((resolve) => {
        const id = ++idRef.current;
        peekPendingRef.current.set(id, resolve);
        workerRef.current?.postMessage({ type: "peek", id, n });
      }),
    [],
  );

  return useMemo<UsePyodide>(
    () => ({
      status,
      error,
      isReady: status === "loaded",
      loadDataset,
      resetDataset,
      exec,
      peek,
      retry,
    }),
    [status, error, loadDataset, resetDataset, exec, peek, retry],
  );
}
