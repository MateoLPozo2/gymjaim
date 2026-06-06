import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listAttempts, listDueReviews } from "@/lib/api/attempts.functions";
import { listExercises } from "@/lib/api/exercises.functions";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Dumbbell, Flame, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — GymJaim" }] }),
  component: Dashboard,
});

function Dashboard() {
  const attemptsFn = useServerFn(listAttempts);
  const dueFn = useServerFn(listDueReviews);
  const exFn = useServerFn(listExercises);

  const attempts = useQuery({ queryKey: ["attempts"], queryFn: () => attemptsFn() });
  const due = useQuery({ queryKey: ["reviews-due"], queryFn: () => dueFn() });
  const exercises = useQuery({
    queryKey: ["exercises", "public"],
    queryFn: () => exFn({ data: { scope: "public" } }),
  });

  const last7 = (attempts.data?.attempts ?? []).filter(
    (a: any) => Date.now() - new Date(a.created_at).getTime() < 7 * 86400_000,
  );
  const matches = (attempts.data?.attempts ?? []).filter((a: any) => a.matched_oracle).length;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="font-display text-3xl tracking-tight">Welcome back to the gym</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Reps in the last 7 days, what's due, and what to try next.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Stat label="Reps this week" value={last7.length.toString()} icon={Dumbbell} />
        <Stat label="Oracle matches" value={matches.toString()} icon={Flame} />
        <Stat label="Reviews due" value={(due.data?.reviews ?? []).length.toString()} icon={ArrowRight} />
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl">Recent reps</CardTitle>
            <CardDescription>Your last attempts across all exercises.</CardDescription>
          </CardHeader>
          <CardContent>
            {attempts.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (attempts.data?.attempts ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No reps yet — take your first below.</p>
            ) : (
              <ul className="divide-y divide-border">
                {(attempts.data?.attempts ?? []).slice(0, 6).map((a: any) => (
                  <li key={a.id} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="font-mono text-xs text-muted-foreground">
                      {new Date(a.created_at).toLocaleString()}
                    </span>
                    <span className="flex items-center gap-2">
                      {a.matched_oracle && (
                        <Badge variant="outline" className="border-success text-success">
                          oracle
                        </Badge>
                      )}
                      <span className="font-mono">
                        Δ {a.slope_delta == null ? "—" : a.slope_delta.toFixed(3)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl">Suggested next rep</CardTitle>
            <CardDescription>From the public library.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(exercises.data?.exercises ?? []).slice(0, 4).map((ex: any) => (
              <div key={ex.id} className="flex items-center justify-between border-b border-border/60 pb-2.5 last:border-0">
                <div>
                  <p className="text-sm font-medium">{ex.title}</p>
                  <p className="text-xs text-muted-foreground capitalize">{ex.difficulty}</p>
                </div>
                <Button asChild size="sm" variant="ghost">
                  <Link to="/exercises/$id" params={{ id: ex.id }}>
                    Open →
                  </Link>
                </Button>
              </div>
            ))}
            {(exercises.data?.exercises ?? []).length === 0 && (
              <div className="text-sm text-muted-foreground">
                No public exercises yet.{" "}
                <Link to="/exercises/new" className="text-foreground underline underline-offset-2">
                  Author the first one
                </Link>
                .
              </div>
            )}
            <Button asChild className="w-full mt-3 gap-2">
              <Link to="/exercises/new">
                <Plus className="h-4 w-4" /> Create a new exercise
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="p-6 flex items-center gap-4">
        <Icon className="h-8 w-8 text-accent" />
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
          <p className="font-display text-3xl mt-1">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
