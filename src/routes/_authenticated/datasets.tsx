import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listDatasets, toggleDatasetPublic } from "@/lib/api/datasets.functions";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/datasets")({
  head: () => ({ meta: [{ title: "Datasets — GymJaim" }] }),
  component: DatasetsPage,
});

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
          <Card key={d.id} className="hover:border-accent/50 transition-colors">
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
                  cols: {(d.columns || []).slice(0, 6).join(", ")}
                  {(d.columns || []).length > 6 ? "…" : ""}
                </p>
              </Link>
              {!d.is_builtin && (
                <PublicToggle
                  id={d.id}
                  initial={d.is_public}
                  onToggle={async (v) => {
                    try {
                      await toggleFn({ data: { id: d.id, is_public: v } });
                      toast.success(v ? "Shared with community" : "Made private");
                      q.refetch();
                    } catch (e: any) {
                      toast.error(e?.message ?? "Failed");
                    }
                  }}
                />
              )}
            </CardHeader>
          </Card>
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
