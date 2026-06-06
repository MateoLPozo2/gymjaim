import { ParsedCsv } from "@/lib/csv";

export function CsvPreviewTable({
  csv,
  maxRows = 10,
  highlightCol,
}: {
  csv: ParsedCsv;
  maxRows?: number;
  highlightCol?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-border max-h-64">
      <table className="w-full text-xs font-mono">
        <thead className="bg-secondary sticky top-0">
          <tr>
            {csv.columns.map((c) => (
              <th
                key={c}
                className={`text-left px-3 py-1.5 font-semibold whitespace-nowrap ${
                  c === highlightCol ? "text-accent" : ""
                }`}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {csv.rows.slice(0, maxRows).map((row, i) => (
            <tr key={i} className="border-t border-border/60">
              {row.map((v, j) => (
                <td
                  key={j}
                  className={`px-3 py-1 whitespace-nowrap ${
                    csv.columns[j] === highlightCol ? "bg-accent/5" : ""
                  }`}
                >
                  {v == null ? (
                    <span className="text-muted-foreground italic">NaN</span>
                  ) : (
                    String(v)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ResultTable({ json }: { json: string }) {
  let parsed: { columns: string[]; data: unknown[][] };
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
              <th key={c} className="text-left px-3 py-1.5 font-semibold">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {parsed.data.slice(0, 50).map((row, i) => (
            <tr key={i} className="border-t border-border/60">
              {row.map((v, j) => (
                <td key={j} className="px-3 py-1 whitespace-nowrap">
                  {v == null ? (
                    <span className="text-muted-foreground">NaN</span>
                  ) : (
                    String(v)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
