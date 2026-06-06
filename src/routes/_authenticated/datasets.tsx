import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listDatasets, toggleDatasetPublic } from "@/lib/api/datasets.functions";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/datasets")({
  head: () => ({ meta: [{ title: "Datasets — Jim's Data Gym" }] }),
  component: DatasetsPage,
});

function DatasetCard({ d, onToggle }: { d: any; onToggle: (v: boolean) => void }) {
  const [expanded, setExpanded] = useState(false);
  const cols: string[] = d.columns ?? [];
  const shown = expanded ? cols : cols.slice(0, 6);

  return (
    <Card className="hover:border-accent/50 transition-colors">
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <Link
          to="/datasets/$id"
          params={{ id: d.id }}
          className="flex-1 min-w-0 -m-2 p-2 rounded-md hover:bg-accent/5"
        >
          <CardTitle className="font-display text-lg flex items-center gap-2">
            {d.name}
            {d.is_builtin && <Badge variant="secondary">built-in</Badge>}
            {!d.is_builtin && d.is_public && <Badge variant="outline">public</Badge>}
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{d.description}</p>
          <p className="mt-1 text-xs font-mono text-muted-foreground">
            cols: {shown.join(", ")}
            {cols.length > 6 && !expanded ? "…" : ""}
          </p>
          {cols.length > 6 && (
            <button
              type="button"
              className="mt-1 text-xs text-accent hover:underline"
              onClick={(e) => {
                e.preventDefault();
                setExpanded((v) => !v);
              }}
            >
              {expanded ? "Show fewer" : `Show all ${cols.length} columns`}
            </button>
          )}
        </Link>
        {!d.is_builtin && (
          <PublicToggle id={d.id} initial={d.is_public} onToggle={onToggle} />
        )}
      </CardHeader>
    </Card>
  );
}

function DatasetsPage() {
  const fn = useServerFn(listDatasets);
  const toggleFn = useServerFn(toggleDatasetPublic);
  const q = useQuery({ queryKey: ["datasets"], queryFn: () => fn() });

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Datasets</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Built-in samples, public community uploads, and your own CSVs.
          </p>
        </div>
        <Button asChild className="gap-2">
          <Link to="/exercises/new"><Plus className="h-4 w-4" /> Upload via new exercise</Link>
        </Button>
      </div>

      <div className="mt-8 grid gap-4">
        {(q.data?.datasets ?? []).map((d: any) => (
          <DatasetCard
            key={d.id}
            d={d}
            onToggle={async (v) => {
              try {
                await toggleFn({ data: { id: d.id, is_public: v } });
                toast.success(v ? "Shared with community" : "Made private");
                q.refetch();
              } catch (e: unknown) {
                toast.error(e instanceof Error ? e.message : "Failed");
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}

function PublicToggle({ id, initial, onToggle }: { id: string; initial: boolean; onToggle: (v: boolean) => void }) {
  const [v, setV] = useState(initial);
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      Share publicly
      <Switch checked={v} onCheckedChange={(nv) => { setV(nv); onToggle(nv); }} />
    </div>
  );
}
