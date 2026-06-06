import type { RunOutput } from "@/lib/exercise/types";
import { ResultTable } from "./CsvPreviewTable";

export function OutputPanel({ output }: { output: RunOutput | null }) {
  if (!output) return null;
  return (
    <div className="space-y-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Run output</p>
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
  );
}
