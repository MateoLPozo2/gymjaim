import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { listExercises } from "@/lib/api/exercises.functions";
import { listDueReviews } from "@/lib/api/attempts.functions";
import { Plus, ArrowRight, Calendar } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/exercises/")({
  head: () => ({
    meta: [
      { title: "Exercises — GymJaim" },
      { name: "description", content: "Browse the public library or your own exercises." },
    ],
  }),
  component: ExercisesPage,
});

function ExercisesPage() {
  const [scope, setScope] = useState<"public" | "mine" | "due">("public");
  const listFn = useServerFn(listExercises);
  const dueFn = useServerFn(listDueReviews);

  const list = useQuery({
    queryKey: ["exercises", scope],
    queryFn: () =>
      listFn({ data: { scope: scope === "due" ? "all" : scope } }),
    enabled: scope !== "due",
  });

  const due = useQuery({
    queryKey: ["reviews-due"],
    queryFn: () => dueFn(),
    enabled: scope === "due",
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Exercises</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick a rep. Public exercises are authored by the community.
          </p>
        </div>
        <Button asChild className="gap-2">
          <Link to="/exercises/new">
            <Plus className="h-4 w-4" /> New exercise
          </Link>
        </Button>
      </div>

      <Tabs value={scope} onValueChange={(v) => setScope(v as any)} className="mt-8">
        <TabsList>
          <TabsTrigger value="public">Public library</TabsTrigger>
          <TabsTrigger value="mine">Mine</TabsTrigger>
          <TabsTrigger value="due">
            <Calendar className="h-3.5 w-3.5 mr-1.5" /> Due for review
          </TabsTrigger>
        </TabsList>

        <TabsContent value={scope} className="mt-6">
          {scope === "due" ? (
            <DueList items={due.data?.reviews ?? []} loading={due.isLoading} />
          ) : (
            <ExerciseGrid
              items={list.data?.exercises ?? []}
              loading={list.isLoading}
              emptyMine={scope === "mine"}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ExerciseGrid({
  items,
  loading,
  emptyMine,
}: {
  items: any[];
  loading: boolean;
  emptyMine: boolean;
}) {
  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/60 p-12 text-center">
        <p className="text-muted-foreground">
          {emptyMine
            ? "You haven't authored any exercises yet."
            : "No public exercises yet. Be the first to share one!"}
        </p>
        <Button asChild variant="outline" className="mt-4 gap-2">
          <Link to="/exercises/new">
            <Plus className="h-4 w-4" /> Author one
          </Link>
        </Button>
      </div>
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {items.map((ex) => (
        <Card key={ex.id} className="hover:border-accent/60 transition-colors">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="capitalize">
                {ex.difficulty}
              </Badge>
              <Badge variant="outline" className="capitalize text-xs">
                {ex.visibility}
              </Badge>
            </div>
            <CardTitle className="font-display text-xl mt-2">{ex.title}</CardTitle>
            <CardDescription className="line-clamp-2">{ex.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full gap-2">
              <Link to="/exercises/$id" params={{ id: ex.id }}>
                Take a rep <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function DueList({ items, loading }: { items: any[]; loading: boolean }) {
  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/60 p-12 text-center text-muted-foreground">
        Nothing due. Take a rep to schedule your next review.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {items.map((r) => (
        <Card key={r.id} className="flex items-center justify-between p-4">
          <div>
            <p className="text-sm font-medium">Review due</p>
            <p className="text-xs text-muted-foreground">
              Scheduled {new Date(r.due_at).toLocaleString()}
            </p>
          </div>
          <Button asChild size="sm" className="gap-2">
            <Link
              to="/exercises/$id"
              params={{ id: r.exercise_id }}
              search={{ seed: String(r.seed) }}
            >
              Take rep <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </Card>
      ))}
    </div>
  );
}
