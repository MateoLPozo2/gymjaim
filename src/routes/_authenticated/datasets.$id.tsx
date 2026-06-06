import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { getDatasetDetail } from "@/lib/api/datasets.functions";
import { getBuiltinCsv } from "@/lib/datasets/builtin";
import { BUILTIN_META } from "@/lib/datasets/builtin-meta";
import { parseCsv, ParsedCsv } from "@/lib/csv";
import { mean, median } from "@/lib/stats";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/datasets/$id")({
  head: () => ({ meta: [{ title: "Dataset — GymJaim" }] }),
  component: DatasetDetailPage,
});

function DatasetDetailPage() {
  const { id } = Route.useParams();
  const fn = useServerFn(getDatasetDetail);
  const q = useQuery({
    queryKey: ["dataset", id],
    queryFn: () => fn({ data: { id } }),
  });

  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const ds: any = q.data?.dataset;
    if (!ds) return;
    async function load() {
      try {
        let text: string | null = null;
        if (ds.is_builtin && ds.builtin_key) text = getBuiltinCsv(ds.builtin_key);
        else if (q.data?.csvUrl) text = await fetch(q.data.csvUrl).then((r) => r.text());
        if (cancelled) return;
        if (!text) {
          setLoadErr("CSV not available");
          return;
        }
        setParsed(parseCsv(text));
      } catch (e: any) {
        if (!cancelled) setLoadErr(e?.message ?? "Failed to load CSV");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [q.data]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Link
        to="/datasets"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to datasets
      </Link>
      {q.isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
      ) : q.error ? (
        <p className="mt-6 text-destructive">{(q.error as Error).message}</p>
      ) : q.data ? (
        <Detail
          dataset={(q.data as any).dataset}
          parsed={parsed}
          loadErr={loadErr}
        />
      ) : null}
    </div>
  );
}

function Detail({ dataset, parsed, loadErr }: { dataset: any; parsed: ParsedCsv | null; loadErr: string | null }) {
  const meta = dataset.is_builtin && dataset.builtin_key ? BUILTIN_META[dataset.builtin_key] : null;

  const stats = useMemo(() => {
    if (!parsed) return null;
    return parsed.columns.map((col, i) => {
      const vals = parsed.rows.map((r) => r[i]);
      const nonNull = vals.filter((v) => v !== null && v !== "");
      const nums = nonNull.filter((v): v is number => typeof v === "number");
      const isNumeric = nums.length > 0 && nums.length / Math.max(nonNull.length, 1) > 0.6;
      const samples = nonNull.slice(0, 4).map((v) => String(v)).join(", ");
      let summary = "";
      if (isNumeric) {
        const mn = Math.min(...nums);
        const mx = Math.max(...nums);
        summary = `min ${fmt(mn)} · mean ${fmt(mean(nums))} · median ${fmt(median(nums))} · max ${fmt(mx)}`;
      }
      return {
        col,
        dtype: isNumeric ? "numeric" : nonNull.every((v) => v === "true" || v === "false") ? "bool" : "string",
        nonNull: nonNull.length,
        missing: vals.length - nonNull.length,
        samples,
        summary,
      };
    });
  }, [parsed]);

  return (
    <div className="mt-4 space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight flex items-center gap-3">
          {dataset.name}
          {dataset.is_builtin && <Badge variant="secondary">built-in</Badge>}
          {!dataset.is_builtin && dataset.is_public && <Badge variant="outline">public</Badge>}
        </h1>
        {dataset.description && (
          <p className="mt-2 text-sm text-muted-foreground max-w-3xl">{dataset.description}</p>
        )}
      </div>

      {meta && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base">About this dataset</CardTitle>
            <CardDescription>
              Source: {meta.sourceUrl ? <a className="underline" href={meta.sourceUrl} target="_blank" rel="noreferrer">{meta.source}</a> : meta.source}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>{meta.blurb}</p>
            <p className="text-muted-foreground"><span className="font-medium text-foreground">Typical use: </span>{meta.typicalUse}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <SmallStat label="Rows" value={parsed ? parsed.rows.length.toLocaleString() : "—"} />
        <SmallStat label="Columns" value={parsed ? parsed.columns.length.toLocaleString() : "—"} />
        <SmallStat label="Storage" value={dataset.is_builtin ? "bundled" : "uploaded CSV"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Variables</CardTitle>
          <CardDescription>Inferred from the CSV. Numeric columns include summary statistics.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadErr ? (
            <p className="text-sm text-destructive">{loadErr}</p>
          ) : !stats ? (
            <p className="text-sm text-muted-foreground">Parsing CSV…</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-xs font-mono">
                <thead className="bg-secondary">
                  <tr>
                    <th className="text-left px-3 py-2">Column</th>
                    <th className="text-left px-3 py-2">Type</th>
                    <th className="text-left px-3 py-2">Non-null</th>
                    <th className="text-left px-3 py-2">Missing</th>
                    <th className="text-left px-3 py-2">Samples / Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((s) => (
                    <tr key={s.col} className="border-t border-border/60">
                      <td className="px-3 py-1.5 font-semibold">{s.col}</td>
                      <td className="px-3 py-1.5">{s.dtype}</td>
                      <td className="px-3 py-1.5">{s.nonNull}</td>
                      <td className="px-3 py-1.5">{s.missing}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">
                        {s.summary || s.samples}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Preview</CardTitle>
          <CardDescription>First 20 rows.</CardDescription>
        </CardHeader>
        <CardContent>
          {parsed ? (
            <div className="overflow-x-auto rounded-md border border-border max-h-96">
              <table className="w-full text-xs font-mono">
                <thead className="bg-secondary sticky top-0">
                  <tr>
                    {parsed.columns.map((c) => (
                      <th key={c} className="text-left px-3 py-1.5 font-semibold whitespace-nowrap">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.slice(0, 20).map((r, i) => (
                    <tr key={i} className="border-t border-border/60">
                      {r.map((v, j) => (
                        <td key={j} className="px-3 py-1 whitespace-nowrap">
                          {v == null ? <span className="text-muted-foreground">NaN</span> : String(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-base font-semibold">{value}</p>
    </div>
  );
}

function fmt(v: number) {
  if (!Number.isFinite(v)) return "—";
  if (Math.abs(v) >= 1000) return v.toFixed(0);
  return v.toFixed(2);
}
