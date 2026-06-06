// React hook around the Pyodide worker. One worker lives per `usePyodide`
// caller; we keep init lazy so the landing page stays light.
import { useEffect, useMemo, useRef, useState } from "react";

interface ExecResult {
  ok: boolean;
  stdout: string;
  resultText: string | null;
  resultIsTable: boolean;
  tableJson: string | null;
  dfCsv: string;
  error?: string;
}

interface UsePyodide {
  status: "idle" | "loading" | "ready" | "dataset" | "error";
  error: string | null;
  loadDataset: (csv: string) => Promise<void>;
  resetDataset: (csv: string) => Promise<void>;
  exec: (code: string) => Promise<ExecResult>;
}

export function usePyodide(): UsePyodide {
  const workerRef = useRef<Worker | null>(null);
  const [status, setStatus] = useState<UsePyodide["status"]>("idle");
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef<Map<number, (r: ExecResult) => void>>(new Map());
  const initWaitersRef = useRef<Array<() => void>>([]);
  const loadWaitersRef = useRef<Array<() => void>>([]);
  const idRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const worker = new Worker(
      new URL("../lib/pyodide/worker.ts", import.meta.url),
      { type: "module" },
    );
    workerRef.current = worker;
    setStatus("loading");
    worker.postMessage({ type: "init" });
    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.type === "ready") {
        setStatus((s) => (s === "dataset" ? "dataset" : "ready"));
        initWaitersRef.current.forEach((w) => w());
        initWaitersRef.current = [];
      } else if (msg.type === "loaded") {
        setStatus("dataset");
        loadWaitersRef.current.forEach((w) => w());
        loadWaitersRef.current = [];
      } else if (msg.type === "init_error") {
        setError(String(msg.error ?? "Failed to load Python runtime"));
        setStatus("error");
      } else if (msg.type === "exec_result") {
        const fn = pendingRef.current.get(msg.id);
        if (fn) {
          pendingRef.current.delete(msg.id);
          fn(msg);
        }
      }
    };
    worker.onerror = (e) => {
      setError(String(e.message || e));
      setStatus("error");
    };
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  return useMemo<UsePyodide>(
    () => ({
      status,
      error,
      loadDataset: (csv) =>
        new Promise((resolve) => {
          const send = () => {
            loadWaitersRef.current.push(() => resolve());
            workerRef.current?.postMessage({ type: "load", csv });
          };
          if (status === "ready" || status === "dataset") send();
          else initWaitersRef.current.push(send);
        }),
      resetDataset: (csv) =>
        new Promise((resolve) => {
          const send = () => {
            loadWaitersRef.current.push(() => resolve());
            workerRef.current?.postMessage({ type: "reset", csv });
          };
          if (status === "ready" || status === "dataset") send();
          else initWaitersRef.current.push(send);
        }),
      exec: (code) =>
        new Promise((resolve) => {
          const id = ++idRef.current;
          pendingRef.current.set(id, resolve);
          workerRef.current?.postMessage({ type: "exec", code, id });
        }),
    }),
    [status, error],
  );
}
